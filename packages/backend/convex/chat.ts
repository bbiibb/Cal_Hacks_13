import { ChatRequestSchema } from "@cal-hacks/shared";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, env, mutation } from "./_generated/server";
import { runChat } from "./lib/chatPipeline";
import { MAX_HISTORY_TURNS } from "./lib/chatPrompt";
import { LlmError, completeChat, resolveLlmConfig } from "./lib/llm";
import { vChatContext, vChatResponse } from "./validators";

/** Minimum time between two questions of one session, in milliseconds. Protects the free quota. */
const MIN_MS_BETWEEN_QUESTIONS = 1500;

/** Starts a conversation. The returned id is passed to `ask` so the chat keeps its history. */
export const createSession = mutation({
  args: { procedureSlug: v.optional(v.string()) },
  returns: v.id("chatSessions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatSessions", {
      // No login yet, so each conversation gets a random anonymous key
      clientSessionId: crypto.randomUUID(),
      ...(args.procedureSlug ? { procedureSlug: args.procedureSlug } : {}),
    });
  },
});

/**
 * Answers one question in the context of what the patient is looking at.
 * The reply contains the answer text and commands for the 3D view (highlight, focus, zoom, rotate,
 * step changes), which have already been checked against our own content.
 * Errors are thrown as ConvexError with `{ code, message }`.
 */
export const ask = action({
  args: {
    message: v.string(),
    context: vChatContext,
    sessionId: v.optional(v.id("chatSessions")),
  },
  returns: vChatResponse,
  handler: async (ctx, args) => {
    const request = ChatRequestSchema.safeParse({ message: args.message, context: args.context });
    if (!request.success) {
      throw new ConvexError({ code: "invalid_message", message: "Please type a question of up to 500 characters." });
    }
    const { message, context } = request.data;

    try {
      const config = resolveLlmConfig(env);

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
      const result = await runChat({
        message,
        data,
        history,
        callModel: (messages) => completeChat({ config, messages }),
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
  },
});
