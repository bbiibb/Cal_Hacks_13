import { ChatRequestSchema, type ChatResponse } from "@cal-hacks/shared";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { isCameraOnly, runChat } from "./chatPipeline";
import { redactPersonalInfo } from "./safety";
import { MAX_HISTORY_TURNS, type PromptData } from "./chatPrompt";
import { LlmError, providerForSpeed, type ChatSpeed } from "./llm";
import { knowledgeFor } from "./knowledge";
import { cameraOnlyRoute, prepareModel } from "./modelRoute";

/** Minimum time between two questions of one session, in milliseconds. Protects the free quota. */
const MIN_MS_BETWEEN_QUESTIONS = 1500;

export interface QuestionArgs {
  message: string;
  context: { procedure_slug: string; step_index: number; selected_structure_id: string | null };
  sessionId?: Id<"chatSessions">;
  /** "slow" answers with the local model, "fast" with the cloud model. Without it, LLM_PROVIDER decides. */
  speed?: ChatSpeed;
}

/**
 * Answers one question in the context of what the patient is looking at.
 * Shared by the typed question (`chat.ask`) and the spoken question (`chat.askByVoice`).
 * Errors are thrown as ConvexError with `{ code, message }`.
 */
export async function answerQuestion(ctx: ActionCtx, args: QuestionArgs): Promise<ChatResponse> {
  const request = ChatRequestSchema.safeParse({ message: args.message, context: args.context });
  if (!request.success) {
    throw new ConvexError({ code: "invalid_message", message: "Please type a question of up to 500 characters." });
  }
  const { context } = request.data;
  // Privacy: personal details are removed before the question goes anywhere (model, logs, or storage)
  const redaction = redactPersonalInfo(request.data.message);
  const message = redaction.text;
  if (redaction.found.length > 0) console.log("[safety] personal details removed from a question:", redaction.found.join(","));

  try {
    const stored = await ctx.runQuery(internal.chatContext.get, {
      procedureSlug: context.procedure_slug,
      stepIndex: context.step_index,
      selectedStructureId: context.selected_structure_id,
    });
    if (!stored) {
      throw new ConvexError({ code: "context_not_found", message: "That procedure or step does not exist." });
    }
    // The reference facts (patient-education knowledge) are bundled with the backend
    let data: PromptData = { ...stored, knowledge: knowledgeFor(stored.procedureSlug) };

    let history: { role: "user" | "assistant"; content: string }[] = [];
    if (args.sessionId) {
      const stored = await ctx.runQuery(internal.chatStore.getHistory, {
        sessionId: args.sessionId,
        limit: MAX_HISTORY_TURNS,
      });
      if (stored.lastUserAt !== null && Date.now() - stored.lastUserAt < MIN_MS_BETWEEN_QUESTIONS) {
        throw new ConvexError({ code: "too_many_requests", message: "Please wait a moment before asking again." });
      }
      history = stored.turns;
      // Older messages are no longer kept; what the patient asked earlier reaches the model as a short summary
      if (stored.summary !== "") data = { ...data, conversationSummary: stored.summary };
    }

    // The context above already lists every real part and step, so existence checks need no more reads
    const structureIds = new Set(data.structures.map((s) => s.id));
    // The patient's speed choice, or else LLM_PROVIDER, decides which model answers; everything else stays the same
    // A pure camera command ("zoom in", "show me the right atrium") needs no model, so no embedding or search either
    const cameraOnly = isCameraOnly(message, data.structures);
    const route = cameraOnly ? cameraOnlyRoute() : await prepareModel(ctx, data, message, providerForSpeed(args.speed));
    const result = await runChat({
      message,
      data,
      history,
      callModel: route.callModel,
      buildMessages: route.buildMessages,
      contextDocs: route.contextDocs,
      lookup: {
        structureExists: async (id) => structureIds.has(id),
        stepExists: async (slug, index) =>
          slug === data.procedureSlug && data.steps.some((s) => s.index === index),
      },
    });

    if (result.rejected.length > 0) {
      console.log("Dropped scene actions:", JSON.stringify(result.rejected));
    }
    if (result.usedFallback) console.log("The model reply could not be parsed; used the fallback answer.");
    // Only the kind of event is logged, never the patient's words
    if (result.safetyEvents.length > 0) console.log("[safety]", result.safetyEvents.join(","));

    // A camera command ("zoom in") says nothing about the patient's questions, so it does not use up memory
    const memorable = !(cameraOnly && !result.response.urgent);
    if (args.sessionId && memorable) {
      await ctx.runMutation(internal.chatStore.saveExchange, {
        sessionId: args.sessionId,
        question: message,
        response: result.response,
      });
    }
    return result.response;
  } catch (error) {
    if (error instanceof LlmError) {
      throw new ConvexError({ code: error.code, message: error.message });
    }
    throw error;
  }
}
