import { describe, expect, it } from "vitest";
import {
  InstrumentSchema,
  ProcedureSchema,
  StructureSchema,
} from "@cal-hacks/shared";
import instruments from "@cal-hacks/shared/fixtures/instruments.json";
import procedureJson from "@cal-hacks/shared/fixtures/procedure.tavr.json";
import structures from "@cal-hacks/shared/fixtures/structures.json";
import {
  fromInstrument,
  fromStep,
  fromStructure,
  toInstrument,
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

  it("steps 왕복", () => {
    const procedure = ProcedureSchema.parse(procedureJson);
    for (const step of procedure.steps) {
      expect(toStep(fromStep(step))).toEqual(step);
    }
  });
});
