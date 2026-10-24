import { ChatRequestSchema, type ChatResponse } from "@cal-hacks/shared";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { runChat } from "./chatPipeline";
import { redactPersonalInfo } from "./safety";
import { MAX_HISTORY_TURNS } from "./chatPrompt";
import { LlmError } from "./llm";
import { prepareModel } from "./modelRoute";

/** Minimum time between two questions of one session, in milliseconds. Protects the free quota. */
const MIN_MS_BETWEEN_QUESTIONS = 1500;

export interface QuestionArgs {
  message: string;
  context: { procedure_slug: string; step_index: number; selected_structure_id: string | null };
  sessionId?: Id<"chatSessions">;
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
    const data = await ctx.runQuery(internal.chatContext.get, {
      procedureSlug: context.procedure_slug,
      stepIndex: context.step_index,
      selectedStructureId: context.selected_structure_id,
    });
    if (!data) {
      throw new ConvexError({ code: "context_not_found", message: "That procedure or step does not exist." });
    }

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
    }

    // The context above already lists every real part and step, so existence checks need no more reads
    const structureIds = new Set(data.structures.map((s) => s.id));
    // LLM_PROVIDER decides which model answers ("groq" or "local"); everything else stays the same
    const route = await prepareModel(ctx, data, message);
    const result = await runChat({
      message,
      data,
      history,
      callModel: route.callModel,
      buildMessages: route.buildMessages,
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

    if (args.sessionId) {
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
