import { v } from "convex/values";
import { query } from "./_generated/server";
import { toCondition } from "./lib/mappers";
import { vCondition } from "./validators";

const MAX_CONDITIONS = 100;

/** All heart conditions (ordered by slug) */
export const list = query({
  args: {},
  returns: v.array(vCondition),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("conditions")
      .withIndex("by_slug")
      .take(MAX_CONDITIONS);
    return docs.map(toCondition);
  },
});

/** One condition by slug, or null if it does not exist */
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(vCondition, v.null()),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("conditions")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return doc ? toCondition(doc) : null;
  },
});
