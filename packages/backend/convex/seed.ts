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
import { internalMutation } from "./_generated/server";
import {
  fromCondition,
  fromInstrument,
  fromStep,
  fromStructure,
} from "./lib/mappers";

const MAX_STEPS = 200;

/**
 * 더미 콘텐츠(packages/shared/fixtures)를 DB에 넣는다. 여러 번 실행해도 중복되지 않는다 (upsert).
 * 실행: `npx convex run seed:run`  (배포된 환경이 개발용인지 먼저 확인할 것)
 * 시드는 fixtures 에 있는 것만 추가/갱신하며, fixtures 에서 사라진 구조물은 지우지 않는다.
 * 단, 과정(procedure)의 단계는 fixtures 와 정확히 일치하도록 맞춘다.
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
  }),
  handler: async (ctx) => {
    // fixtures 자체가 계약을 따르는지 먼저 확인한다
    const conditions = z.array(ConditionSchema).parse(conditionsJson);
    const structures = z.array(StructureSchema).parse(structuresJson);
    const instruments = z.array(InstrumentSchema).parse(instrumentsJson);
    const procedure = ProcedureSchema.parse(procedureJson);

    const conditionSlugs = new Set(conditions.map((c) => c.slug));
    if (
      procedure.condition_slug !== null &&
      !conditionSlugs.has(procedure.condition_slug)
    ) {
      throw new Error(`알 수 없는 condition_slug: ${procedure.condition_slug}`);
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
      // Convex 는 undefined 를 값으로 취급하지 않으므로 null 이면 필드를 생략한다
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

    // fixtures 에 없는 옛 단계 정리
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

    return {
      conditions: conditions.length,
      structures: structures.length,
      instruments: instruments.length,
      procedure: procedure.slug,
      steps: procedure.steps.length,
      removedSteps,
    };
  },
});
