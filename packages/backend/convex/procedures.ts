import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import { toProcedureSummary, toStep } from "./lib/mappers";
import { vProcedure, vProcedureSummary, vStep } from "./validators";

const MAX_PROCEDURES = 100;
const MAX_STEPS = 200;

async function findProcedure(ctx: QueryCtx, slug: string) {
  return await ctx.db
    .query("procedures")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

/** 수술 과정 목록 (단계 제외) */
export const list = query({
  args: {},
  returns: v.array(vProcedureSummary),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("procedures")
      .withIndex("by_slug")
      .take(MAX_PROCEDURES);
    return docs.map(toProcedureSummary);
  },
});

/** slug 로 수술 과정과 모든 단계를 조회. 없으면 null */
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(vProcedure, v.null()),
  handler: async (ctx, args) => {
    const procedure = await findProcedure(ctx, args.slug);
    if (!procedure) return null;
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_procedure_and_index", (q) =>
        q.eq("procedureId", procedure._id),
      )
      .take(MAX_STEPS);
    return { ...toProcedureSummary(procedure), steps: steps.map(toStep) };
  },
});

/** 한 단계만 조회. 과정이나 단계가 없으면 null */
export const getStep = query({
  args: { slug: v.string(), index: v.number() },
  returns: v.union(vStep, v.null()),
  handler: async (ctx, args) => {
    const procedure = await findProcedure(ctx, args.slug);
    if (!procedure) return null;
    const step = await ctx.db
      .query("steps")
      .withIndex("by_procedure_and_index", (q) =>
        q.eq("procedureId", procedure._id).eq("index", args.index),
      )
      .unique();
    return step ? toStep(step) : null;
  },
});
