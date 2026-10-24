import { describe, expect, it } from "vitest";
import {
  ConditionSchema,
  InstrumentSchema,
  ProcedureSchema,
  StructureSchema,
} from "@cal-hacks/shared";
import conditions from "@cal-hacks/shared/fixtures/conditions.json";
import instruments from "@cal-hacks/shared/fixtures/instruments.json";
import procedureJson from "@cal-hacks/shared/fixtures/procedure.tavr.json";
import structures from "@cal-hacks/shared/fixtures/structures.json";
import {
  fromCondition,
  fromInstrument,
  fromStep,
  fromStructure,
  toCondition,
  toInstrument,
  toProcedureSummary,
  toStep,
  toStructure,
} from "../convex/lib/mappers";

describe("mappers: DB 문서 <-> 계약 왕복", () => {
  it("structures: fixtures -> DB -> 계약이 원본과 같다", () => {
    for (const raw of structures) {
      const s = StructureSchema.parse(raw);
      expect(toStructure(fromStructure(s))).toEqual(s);
    }
  });

  it("parent_id 가 null 이면 DB 문서에서 parentId 를 생략한다", () => {
    const root = StructureSchema.parse(structures.find((s) => s.parent_id === null));
    expect("parentId" in fromStructure(root)).toBe(false);
    const child = StructureSchema.parse(structures.find((s) => s.parent_id !== null));
    expect(fromStructure(child).parentId).toBe(child.parent_id);
  });

  it("instruments 왕복", () => {
    for (const raw of instruments) {
      const i = InstrumentSchema.parse(raw);
      expect(toInstrument(fromInstrument(i))).toEqual(i);
    }
  });

  it("conditions 왕복", () => {
    for (const raw of conditions) {
      const c = ConditionSchema.parse(raw);
      expect(toCondition(fromCondition(c))).toEqual(c);
    }
  });

  it("이전 형식의 문서(shortTitle/conditionSlug/order 없음)도 읽는다", () => {
    const step = ProcedureSchema.parse(procedureJson).steps[0]!;
    const old = { index: 0, title: step.title, scene: step.scene, sidePanel: step.side_panel };
    expect(toStep(old).short_title).toBe(step.title);
    expect(toProcedureSummary({ slug: "x", title: "t", summary: "s" })).toEqual({
      slug: "x",
      title: "t",
      summary: "s",
      condition_slug: null,
      order: 0,
    });
  });

  it("steps 왕복", () => {
    const procedure = ProcedureSchema.parse(procedureJson);
    for (const step of procedure.steps) {
      expect(toStep(fromStep(step))).toEqual(step);
    }
  });
});
