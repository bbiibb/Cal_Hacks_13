import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { answerQuestion } from "./lib/chatRun";
import { transcribeStoredAudio } from "./lib/speechRun";
import { vChatContext, vChatResponse } from "./validators";

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

/** Deletes a whole conversation: its messages and the session itself. Lets a patient erase what they asked. */
export const deleteSession = mutation({
  args: { sessionId: v.id("chatSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteSessionData(ctx, args.sessionId);
    return null;
  },
});

/**
 * Deletes conversations older than the given number of hours (data minimization). Run it on a schedule or by hand:
 *   npx convex run chat:purgeOldSessions '{"olderThanHours":24}'
 */
export const purgeOldSessions = internalMutation({
  args: { olderThanHours: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - Math.max(args.olderThanHours, 0) * 3_600_000;
    const old = await ctx.db
      .query("chatSessions")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(50);
    for (const session of old) await deleteSessionData(ctx, session._id);
    return old.length;
  },
});

/**
 * Answers one typed question in the context of what the patient is looking at.
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
    return await answerQuestion(ctx, args);
  },
});

/**
 * Answers one spoken question: the uploaded recording is turned into text with Cartesia (and deleted),
 * and that text is answered like a typed question. `transcript` lets the UI show what was heard.
 * Upload the recording first with `speech.generateUploadUrl`.
 */
export const askByVoice = action({
  args: {
    storageId: v.id("_storage"),
    /** Short language code of the speech, for example "en". Defaults to "en". */
    language: v.optional(v.string()),
    context: vChatContext,
    sessionId: v.optional(v.id("chatSessions")),
  },
  returns: v.object({
    transcript: v.string(),
    language: v.string(),
    response: vChatResponse,
  }),
  handler: async (ctx, args) => {
    const heard = await transcribeStoredAudio(ctx, { storageId: args.storageId, language: args.language });
    if (heard.text === "") {
      throw new ConvexError({ code: "no_speech_detected", message: "I could not hear a question. Please try again." });
    }
    const response = await answerQuestion(ctx, {
      message: heard.text,
      context: args.context,
      sessionId: args.sessionId,
    });
    return { transcript: heard.text, language: heard.language, response };
  },
});

/** Removes every message of a session and then the session. */
async function deleteSessionData(ctx: MutationCtx, sessionId: Id<"chatSessions">): Promise<void> {
  const session = await ctx.db.get("chatSessions", sessionId);
  if (!session) return;
  // Messages are deleted in batches so one call stays small
  for (let i = 0; i < 20; i++) {
    const batch = await ctx.db
      .query("chatMessages")
      .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
      .take(200);
    if (batch.length === 0) break;
    for (const message of batch) await ctx.db.delete("chatMessages", message._id);
  }
  await ctx.db.delete("chatSessions", sessionId);
}
