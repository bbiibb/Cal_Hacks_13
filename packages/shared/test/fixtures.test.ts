import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ChatResponseSchema,
  ConditionSchema,
  InstrumentSchema,
  ProcedureSchema,
  SceneActionSchema,
  StructureIdSchema,
  StructureSchema,
} from "../src";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf-8"));

describe("fixtures 는 계약 스키마를 따른다", () => {
  const conditions = z.array(ConditionSchema).parse(load("conditions.json"));
  const structures = z.array(StructureSchema).parse(load("structures.json"));
  const instruments = z.array(InstrumentSchema).parse(load("instruments.json"));
  const procedure = ProcedureSchema.parse(load("procedure.tavr.json"));
  const chat = ChatResponseSchema.parse(load("chat-response.example.json"));

  const structureIds = new Set(structures.map((s) => s.id));
  const instrumentIds = new Set(instruments.map((i) => i.id));

  it("structure parent_id 가 존재하는 구조물을 가리킨다", () => {
    for (const s of structures) {
      if (s.parent_id) expect(structureIds.has(s.parent_id)).toBe(true);
    }
  });

  it("procedure 의 condition_slug 가 존재하는 질환을 가리킨다", () => {
    const slugs = new Set(conditions.map((c) => c.slug));
    expect(procedure.condition_slug).not.toBeNull();
    expect(slugs.has(procedure.condition_slug as string)).toBe(true);
  });

  it("타임라인 라벨(short_title)은 짧다", () => {
    for (const step of procedure.steps) {
      expect(step.short_title.length).toBeLessThanOrEqual(12);
    }
  });

  it("TAVR 1차 버전은 4개 장면이다", () => {
    expect(procedure.slug).toBe("tavr");
    expect(procedure.steps.map((s) => s.title)).toEqual([
      "협착된 원래 판막",
      "새 판막 전달",
      "새 판막 확장",
      "전달 장비 제거 후 최종 위치",
    ]);
  });

  it("step 이 참조하는 structure/instrument id 가 모두 존재한다", () => {
    procedure.steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      for (const s of step.scene.structures) expect(structureIds.has(s.id)).toBe(true);
      for (const inst of step.scene.instruments) expect(instrumentIds.has(inst.id)).toBe(true);
      for (const id of step.side_panel.related_structure_ids) expect(structureIds.has(id)).toBe(true);
    });
  });

  it("챗봇 예시 응답의 scene_actions 가 존재하는 id/step 만 참조한다", () => {
    for (const action of chat.scene_actions) {
      if (action.type === "goto_step") {
        expect(action.procedure_slug).toBe(procedure.slug);
        expect(action.step_index).toBeLessThan(procedure.steps.length);
      } else if (action.type === "highlight") {
        for (const id of action.structure_ids) expect(structureIds.has(id)).toBe(true);
      } else {
        expect(structureIds.has(action.structure_id)).toBe(true);
      }
    }
  });
});

describe("스키마 거부 케이스", () => {
  it("잘못된 structure_id 를 거부한다", () => {
    for (const bad of ["Aorta", "aorta.", ".aorta", "aorta root", "1aorta", ""]) {
      expect(StructureIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("알 수 없는 scene_action type 을 거부한다", () => {
    expect(SceneActionSchema.safeParse({ type: "explode", structure_id: "aorta" }).success).toBe(false);
  });

  it("범위를 벗어난 opacity 를 거부한다", () => {
    expect(
      SceneActionSchema.safeParse({ type: "set_opacity", structure_id: "aorta", opacity: 1.5 }).success,
    ).toBe(false);
  });
});
