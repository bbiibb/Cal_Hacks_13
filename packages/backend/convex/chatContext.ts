import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

const MAX_STRUCTURES = 500;
const MAX_STEPS = 200;

/**
 * Everything the chatbot prompt needs about what the patient is looking at:
 * the procedure, its steps, and the parts of the model. Returns null if the procedure or step
 * does not exist.
 */
export const get = internalQuery({
  args: {
    procedureSlug: v.string(),
    stepIndex: v.number(),
    selectedStructureId: v.union(v.string(), v.null()),
  },
  returns: v.union(
    v.null(),
    v.object({
      procedureSlug: v.string(),
      procedureTitle: v.string(),
      steps: v.array(v.object({ index: v.number(), title: v.string(), summary: v.string() })),
      currentStepIndex: v.number(),
      selectedStructureId: v.union(v.string(), v.null()),
      structures: v.array(v.object({ id: v.string(), name: v.string(), description: v.string() })),
    }),
  ),
  handler: async (ctx, args) => {
    const procedure = await ctx.db
      .query("procedures")
      .withIndex("by_slug", (q) => q.eq("slug", args.procedureSlug))
      .unique();
    if (!procedure) return null;

    const stepDocs = await ctx.db
      .query("steps")
      .withIndex("by_procedure_and_index", (q) => q.eq("procedureId", procedure._id))
      .take(MAX_STEPS);
    if (!stepDocs.some((s) => s.index === args.stepIndex)) return null;

    const structureDocs = await ctx.db
      .query("structures")
      .withIndex("by_structure_id")
      .take(MAX_STRUCTURES);

    return {
      procedureSlug: procedure.slug,
      procedureTitle: procedure.title,
      steps: stepDocs.map((s) => ({
        index: s.index,
        title: s.title,
        summary: s.sidePanel.body_markdown,
      })),
      currentStepIndex: args.stepIndex,
      selectedStructureId: args.selectedStructureId,
      structures: structureDocs.map((s) => ({
        id: s.structureId,
        name: s.nameEn,
        description: s.description,
      })),
    };
  },
});
