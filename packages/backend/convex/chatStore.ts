import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { RAW_MESSAGES_KEPT, foldMessages, renderSummary } from "./lib/chatSummary";
import { vChatResponse } from "./validators";

/** Recent messages of a session, oldest first, plus when the patient last asked something. */
export const getHistory = internalQuery({
  args: { sessionId: v.id("chatSessions"), limit: v.number() },
  returns: v.object({
    turns: v.array(
      v.object({ role: v.union(v.literal("user"), v.literal("assistant")), content: v.string() }),
    ),
    lastUserAt: v.union(v.number(), v.null()),
    /** Older messages, shortened ("" when the conversation is still short) */
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("chatSessions", args.sessionId);
    const recent = await ctx.db
      .query("chatMessages")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(Math.min(Math.max(args.limit, 1), 20));
    const lastUser = recent.find((m) => m.role === "user");
    return {
      turns: recent.reverse().map((m) => ({ role: m.role, content: m.content })),
      lastUserAt: lastUser ? lastUser._creationTime : null,
      summary: renderSummary(session?.summary),
    };
  },
});

/**
 * Stores one question and its answer, then keeps the conversation short: only the latest RAW_MESSAGES_KEPT
 * messages stay as they are, and older ones are folded into the session's summary and deleted.
 * Only answers that passed validation are saved. A session that was already deleted (window closed, or idle
 * for too long) is not brought back.
 */
export const saveExchange = internalMutation({
  args: { sessionId: v.id("chatSessions"), question: v.string(), response: vChatResponse },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("chatSessions", args.sessionId);
    if (!session) return null;

    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: "user",
      content: args.question,
    });
    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: "assistant",
      content: args.response.message,
      sceneActions: args.response.scene_actions,
      ...(args.response.side_panel ? { sidePanel: args.response.side_panel } : {}),
      sources: args.response.sources,
    });

    // Newest first: everything after the first RAW_MESSAGES_KEPT is older than what the model sees
    const newest = await ctx.db
      .query("chatMessages")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(RAW_MESSAGES_KEPT + 100);
    const older = newest.slice(RAW_MESSAGES_KEPT).reverse();
    if (older.length > 0) {
      const summary = foldMessages(
        session.summary,
        older.map((m) => ({ role: m.role, content: m.content, sources: m.sources })),
      );
      for (const message of older) await ctx.db.delete("chatMessages", message._id);
      await ctx.db.patch("chatSessions", args.sessionId, { summary, lastActiveAt: Date.now() });
    } else {
      await ctx.db.patch("chatSessions", args.sessionId, { lastActiveAt: Date.now() });
    }
    return null;
  },
});
