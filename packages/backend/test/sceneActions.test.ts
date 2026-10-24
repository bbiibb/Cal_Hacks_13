import { describe, expect, it } from "vitest";
import chatExample from "@cal-hacks/shared/fixtures/chat-response.example.json";
import procedure from "@cal-hacks/shared/fixtures/procedure.tavr.json";
import structures from "@cal-hacks/shared/fixtures/structures.json";
import {
  MAX_SCENE_ACTIONS,
  validateSceneActions,
  type SceneActionLookup,
} from "../convex/lib/sceneActions";

// A fake lookup that uses the fixtures like a database
const structureIds = new Set(structures.map((s) => s.id));
const lookup: SceneActionLookup = {
  structureExists: async (id) => structureIds.has(id),
  stepExists: async (slug, index) =>
    slug === procedure.slug && index >= 0 && index < procedure.steps.length,
};

describe("validateSceneActions", () => {
  it("all scene_actions in the chatbot example response pass", async () => {
    const result = await validateSceneActions(chatExample.scene_actions, lookup);
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(chatExample.scene_actions.length);
  });

  it("rejects everything when the input is not an array", async () => {
    for (const bad of [null, undefined, "focus", { type: "focus" }, 3]) {
      const result = await validateSceneActions(bad, lookup);
      expect(result.accepted).toEqual([]);
      expect(result.rejected).toHaveLength(1);
    }
  });

  it("rejects only the items that do not match the schema and passes the rest", async () => {
    const result = await validateSceneActions(
      [
        { type: "focus", structure_id: "aorta" },
        { type: "explode", structure_id: "aorta" },
        { type: "set_opacity", structure_id: "aorta", opacity: 1.5 },
        { type: "focus", structure_id: "Aorta Root" },
        "not an object",
      ],
      lookup,
    );
    expect(result.accepted).toEqual([{ type: "focus", structure_id: "aorta" }]);
    expect(result.rejected.map((r) => r.index)).toEqual([1, 2, 3, 4]);
  });

  it("rejects a structure_id that matches the schema but is not in the database", async () => {
    const result = await validateSceneActions(
      [
        { type: "focus", structure_id: "liver" },
        { type: "set_opacity", structure_id: "liver", opacity: 0.5 },
      ],
      lookup,
    );
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0]?.reason).toContain("liver");
  });

  it("rejects the whole highlight action if any id is missing", async () => {
    const result = await validateSceneActions(
      [{ type: "highlight", structure_ids: ["aorta", "liver"], enabled: true }],
      lookup,
    );
    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]?.index).toBe(0);
  });

  it("goto_step only passes for procedures and steps that exist", async () => {
    const last = procedure.steps.length - 1;
    const result = await validateSceneActions(
      [
        { type: "goto_step", procedure_slug: "tavr", step_index: last },
        { type: "goto_step", procedure_slug: "tavr", step_index: last + 1 },
        { type: "goto_step", procedure_slug: "unknown_procedure", step_index: 0 },
        { type: "goto_step", procedure_slug: "tavr", step_index: -1 },
      ],
      lookup,
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((r) => r.index)).toEqual([1, 2, 3]);
  });

  it(`rejects items beyond the maximum of ${MAX_SCENE_ACTIONS}`, async () => {
    const actions = Array.from({ length: MAX_SCENE_ACTIONS + 2 }, () => ({
      type: "focus",
      structure_id: "aorta",
    }));
    const result = await validateSceneActions(actions, lookup);
    expect(result.accepted).toHaveLength(MAX_SCENE_ACTIONS);
    expect(result.rejected.map((r) => r.index)).toEqual([
      MAX_SCENE_ACTIONS,
      MAX_SCENE_ACTIONS + 1,
    ]);
  });

  it("an empty array gives an empty result", async () => {
    expect(await validateSceneActions([], lookup)).toEqual({ accepted: [], rejected: [] });
  });
});
