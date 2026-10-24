import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { validateSceneActions } from "./lib/sceneActions";
import { vSceneAction } from "./validators";

/**
 * Validates the scene_actions produced by the LLM and returns only the ones that pass (zod + existence in the database).
 * The chatbot action calls it with ctx.runQuery(internal.sceneActions.validate, { actions }).
 * `actions` is untrusted LLM output, so it is accepted as `any` and checked inside.
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
