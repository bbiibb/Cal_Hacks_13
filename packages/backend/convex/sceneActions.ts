import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { validateSceneActions } from "./lib/sceneActions";
import { vSceneAction } from "./validators";

/**
 * LLM 이 만든 scene_actions 를 검증해 통과한 것만 돌려준다 (zod + DB 존재 여부).
 * 챗봇 action 이 ctx.runQuery(internal.sceneActions.validate, { actions }) 로 호출한다.
 * actions 는 신뢰할 수 없는 LLM 출력이라 any 로 받고 안에서 검증한다.
 */
export const validate = internalQuery({
  args: { actions: v.any() },
  returns: v.object({
    accepted: v.array(vSceneAction),
    rejected: v.array(v.object({ index: v.number(), reason: v.string() })),
  }),
  handler: async (ctx, args) => {
    return await validateSceneActions(args.actions, {
      structureExists: async (structureId) => {
        const doc = await ctx.db
          .query("structures")
          .withIndex("by_structure_id", (q) => q.eq("structureId", structureId))
          .unique();
        return doc !== null;
      },
      stepExists: async (procedureSlug, stepIndex) => {
        const procedure = await ctx.db
          .query("procedures")
          .withIndex("by_slug", (q) => q.eq("slug", procedureSlug))
          .unique();
        if (!procedure) return false;
        const step = await ctx.db
          .query("steps")
          .withIndex("by_procedure_and_index", (q) =>
            q.eq("procedureId", procedure._id).eq("index", stepIndex),
          )
          .unique();
        return step !== null;
      },
    });
  },
});
