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

describe("fixtures follow the contract schemas", () => {
  const conditions = z.array(ConditionSchema).parse(load("conditions.json"));
  const structures = z.array(StructureSchema).parse(load("structures.json"));
  const instruments = z.array(InstrumentSchema).parse(load("instruments.json"));
  const procedure = ProcedureSchema.parse(load("procedure.tavr.json"));
  const chat = ChatResponseSchema.parse(load("chat-response.example.json"));

  const structureIds = new Set(structures.map((s) => s.id));
  const instrumentIds = new Set(instruments.map((i) => i.id));

  it("structure parent_id points to an existing structure", () => {
    for (const s of structures) {
      if (s.parent_id) expect(structureIds.has(s.parent_id)).toBe(true);
    }
  });

  it("procedure condition_slug points to an existing condition", () => {
    const slugs = new Set(conditions.map((c) => c.slug));
    expect(procedure.condition_slug).not.toBeNull();
    expect(slugs.has(procedure.condition_slug as string)).toBe(true);
  });

  it("timeline labels (short_title) are short", () => {
    for (const step of procedure.steps) {
      expect(step.short_title.length).toBeLessThanOrEqual(16);
    }
  });

  it("TAVR has the five steps of the team's patient explanation", () => {
    expect(procedure.slug).toBe("tavr");
    expect(procedure.steps.map((s) => s.title)).toEqual([
      "Guiding a wire to your heart",
      "Bringing your new valve into position",
      "Expanding your new valve",
      "Removing the delivery equipment",
      "How your new valve works",
    ]);
  });

  it("every instrument used in a step exists, including the balloon", () => {
    const used = new Set(procedure.steps.flatMap((s) => s.scene.instruments.map((i) => i.id)));
    expect(used.has("balloon")).toBe(true);
    for (const id of used) expect(instrumentIds.has(id)).toBe(true);
  });

  it("every structure and instrument id referenced by a step exists", () => {
    procedure.steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      for (const s of step.scene.structures) expect(structureIds.has(s.id)).toBe(true);
      for (const inst of step.scene.instruments) expect(instrumentIds.has(inst.id)).toBe(true);
      for (const id of step.side_panel.related_structure_ids) expect(structureIds.has(id)).toBe(true);
    });
  });

  it("scene_actions in the chatbot example only reference existing ids and steps", () => {
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

describe("schema rejection cases", () => {
  it("rejects invalid structure_id values", () => {
    for (const bad of ["Aorta", "aorta.", ".aorta", "aorta root", "1aorta", ""]) {
      expect(StructureIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects unknown scene_action types", () => {
    expect(SceneActionSchema.safeParse({ type: "explode", structure_id: "aorta" }).success).toBe(false);
  });

  it("rejects out-of-range opacity", () => {
    expect(
      SceneActionSchema.safeParse({ type: "set_opacity", structure_id: "aorta", opacity: 1.5 }).success,
    ).toBe(false);
  });
});
