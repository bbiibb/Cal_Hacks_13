import { v } from "convex/values";
import { query } from "./_generated/server";
import { toStructure } from "./lib/mappers";
import { vStructure } from "./validators";

// There are only a few dozen structures, so they are fetched at once, with an upper bound
const MAX_STRUCTURES = 500;

/** All structures (ordered by structure_id) */
export const list = query({
  args: {},
  returns: v.array(vStructure),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("structures")
      .withIndex("by_structure_id")
      .take(MAX_STRUCTURES);
    return docs.map(toStructure);
  },
});

/** One structure by structure_id, or null if it does not exist */
export const getById = query({
  args: { id: v.string() },
  returns: v.union(vStructure, v.null()),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("structures")
      .withIndex("by_structure_id", (q) => q.eq("structureId", args.id))
      .unique();
    return doc ? toStructure(doc) : null;
  },
});
