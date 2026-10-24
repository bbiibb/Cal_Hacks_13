import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { vChatResponse } from "./validators";

/** Recent messages of a session, oldest first, plus when the patient last asked something. */
export const getHistory = internalQuery({
  args: { sessionId: v.id("chatSessions"), limit: v.number() },
  returns: v.object({
    turns: v.array(
      v.object({ role: v.union(v.literal("user"), v.literal("assistant")), content: v.string() }),
    ),
    lastUserAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("chatMessages")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(Math.min(Math.max(args.limit, 1), 20));
    const lastUser = recent.find((m) => m.role === "user");
    return {
      turns: recent.reverse().map((m) => ({ role: m.role, content: m.content })),
      lastUserAt: lastUser ? lastUser._creationTime : null,
    };
  },
});

/** Stores one question and its answer. Only answers that passed validation are saved. */
export const saveExchange = internalMutation({
  args: { sessionId: v.id("chatSessions"), question: v.string(), response: vChatResponse },
  returns: v.null(),
  handler: async (ctx, args) => {
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
    return null;
  },
});
