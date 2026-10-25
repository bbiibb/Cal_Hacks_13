import { v } from "convex/values";
import { z } from "zod";
import {
  ConditionSchema,
  InstrumentSchema,
  ProcedureSchema,
  StructureSchema,
} from "@cal-hacks/shared";
import conditionsJson from "@cal-hacks/shared/fixtures/conditions.json";
import instrumentsJson from "@cal-hacks/shared/fixtures/instruments.json";
import procedureJson from "@cal-hacks/shared/fixtures/procedure.tavr.json";
import structuresJson from "@cal-hacks/shared/fixtures/structures.json";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  fromCondition,
  fromInstrument,
  fromStep,
  fromStructure,
} from "./lib/mappers";

const MAX_STEPS = 200;

/**
 * Puts the dummy content (packages/shared/fixtures) into the database. It is safe to run many times (upsert).
 * Run: `npx convex run seed:run` (first make sure the target deployment is a development one).
 * The seed only adds or updates what is in the fixtures; structures that disappear from the fixtures are not deleted.
 * The steps of a procedure, however, are made to match the fixtures exactly.
 */
export const run = internalMutation({
  args: {},
  returns: v.object({
    conditions: v.number(),
    structures: v.number(),
    instruments: v.number(),
    procedure: v.string(),
    steps: v.number(),
    removedSteps: v.number(),
    // True when the vector index is being rebuilt in the background (see rag.ts)
    indexScheduled: v.boolean(),
  }),
  handler: async (ctx) => {
    // First check that the fixtures themselves follow the contract
    const conditions = z.array(ConditionSchema).parse(conditionsJson);
    const structures = z.array(StructureSchema).parse(structuresJson);
    const instruments = z.array(InstrumentSchema).parse(instrumentsJson);
    const procedure = ProcedureSchema.parse(procedureJson);

    const conditionSlugs = new Set(conditions.map((c) => c.slug));
    if (
      procedure.condition_slug !== null &&
      !conditionSlugs.has(procedure.condition_slug)
    ) {
      throw new Error(`Unknown condition_slug: ${procedure.condition_slug}`);
    }

    for (const c of conditions) {
      const doc = fromCondition(c);
      const existing = await ctx.db
        .query("conditions")
        .withIndex("by_slug", (q) => q.eq("slug", c.slug))
        .unique();
      if (existing) await ctx.db.replace("conditions", existing._id, doc);
      else await ctx.db.insert("conditions", doc);
    }

    for (const s of structures) {
      const doc = fromStructure(s);
      const existing = await ctx.db
        .query("structures")
        .withIndex("by_structure_id", (q) => q.eq("structureId", s.id))
        .unique();
      if (existing) await ctx.db.replace("structures", existing._id, doc);
      else await ctx.db.insert("structures", doc);
    }

    for (const i of instruments) {
      const doc = fromInstrument(i);
      const existing = await ctx.db
        .query("instruments")
        .withIndex("by_instrument_id", (q) => q.eq("instrumentId", i.id))
        .unique();
      if (existing) await ctx.db.replace("instruments", existing._id, doc);
      else await ctx.db.insert("instruments", doc);
    }

    const procedureFields = {
      slug: procedure.slug,
      title: procedure.title,
      summary: procedure.summary,
      order: procedure.order,
      // Convex does not treat undefined as a value, so the field is omitted when it is null
      ...(procedure.condition_slug !== null
        ? { conditionSlug: procedure.condition_slug }
        : {}),
    };
    const existingProcedure = await ctx.db
      .query("procedures")
      .withIndex("by_slug", (q) => q.eq("slug", procedure.slug))
      .unique();
    const procedureId = existingProcedure
      ? existingProcedure._id
      : await ctx.db.insert("procedures", procedureFields);
    if (existingProcedure) {
      await ctx.db.replace("procedures", procedureId, procedureFields);
    }

    for (const step of procedure.steps) {
      const doc = { procedureId, ...fromStep(step) };
      const existing = await ctx.db
        .query("steps")
        .withIndex("by_procedure_and_index", (q) =>
          q.eq("procedureId", procedureId).eq("index", step.index),
        )
        .unique();
      if (existing) await ctx.db.replace("steps", existing._id, doc);
      else await ctx.db.insert("steps", doc);
    }

    // Remove old steps that are no longer in the fixtures
    const keep = new Set(procedure.steps.map((s) => s.index));
    const stored = await ctx.db
      .query("steps")
      .withIndex("by_procedure_and_index", (q) =>
        q.eq("procedureId", procedureId),
      )
      .take(MAX_STEPS);
    let removedSteps = 0;
    for (const s of stored) {
      if (!keep.has(s.index)) {
        await ctx.db.delete("steps", s._id);
        removedSteps++;
      }
    }

    // The seeded parts and steps feed the vector index, so rebuild it in the background. If Ollama is not running
    // this only logs a line; the next question that finds the index out of date tries again.
    await ctx.scheduler.runAfter(0, internal.rag.refreshIndex, { procedureSlug: procedure.slug });

    return {
      conditions: conditions.length,
      structures: structures.length,
      instruments: instruments.length,
      procedure: procedure.slug,
      steps: procedure.steps.length,
      removedSteps,
      indexScheduled: true,
    };
  },
});
