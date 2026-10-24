import { describe, expect, it } from "vitest";
import chatExample from "@cal-hacks/shared/fixtures/chat-response.example.json";
import procedure from "@cal-hacks/shared/fixtures/procedure.tavr.json";
import structures from "@cal-hacks/shared/fixtures/structures.json";
import {
  MAX_SCENE_ACTIONS,
  validateSceneActions,
  type SceneActionLookup,
} from "../convex/lib/sceneActions";

// fixtures 를 DB 처럼 쓰는 가짜 lookup
const structureIds = new Set(structures.map((s) => s.id));
const lookup: SceneActionLookup = {
  structureExists: async (id) => structureIds.has(id),
  stepExists: async (slug, index) =>
    slug === procedure.slug && index >= 0 && index < procedure.steps.length,
};

describe("validateSceneActions", () => {
  it("챗봇 예시 응답의 scene_actions 는 모두 통과한다", async () => {
    const result = await validateSceneActions(chatExample.scene_actions, lookup);
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(chatExample.scene_actions.length);
  });

  it("배열이 아니면 전부 거부한다", async () => {
    for (const bad of [null, undefined, "focus", { type: "focus" }, 3]) {
      const result = await validateSceneActions(bad, lookup);
      expect(result.accepted).toEqual([]);
      expect(result.rejected).toHaveLength(1);
    }
  });

  it("스키마에 맞지 않는 항목만 거부하고 나머지는 통과시킨다", async () => {
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

  it("스키마는 맞지만 DB 에 없는 structure_id 는 거부한다", async () => {
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

  it("highlight 는 id 중 하나라도 없으면 action 전체를 거부한다", async () => {
    const result = await validateSceneActions(
      [{ type: "highlight", structure_ids: ["aorta", "liver"], enabled: true }],
      lookup,
    );
    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]?.index).toBe(0);
  });

  it("goto_step 은 존재하는 과정/단계만 통과한다", async () => {
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

  it(`최대 ${MAX_SCENE_ACTIONS}개를 넘는 항목은 거부한다`, async () => {
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

  it("빈 배열은 빈 결과를 낸다", async () => {
    expect(await validateSceneActions([], lookup)).toEqual({ accepted: [], rejected: [] });
  });
});
