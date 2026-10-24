import { v } from "convex/values";
import { query } from "./_generated/server";
import { toStructure } from "./lib/mappers";
import { vStructure } from "./validators";

// 구조물은 수십 개 수준이라 한 번에 가져오되, 상한을 둔다
const MAX_STRUCTURES = 500;

/** 모든 구조물 (structure_id 순) */
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

/** structure_id 로 하나 조회. 없으면 null */
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
