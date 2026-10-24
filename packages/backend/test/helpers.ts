import procedure from "@cal-hacks/shared/fixtures/procedure.tavr.json";
import structures from "@cal-hacks/shared/fixtures/structures.json";
import type { PromptData } from "../convex/lib/chatPrompt";
import type { SceneActionLookup } from "../convex/lib/sceneActions";

/** Prompt data built from the dummy fixtures, as the database would give it. */
export function promptData(overrides: Partial<PromptData> = {}): PromptData {
  return {
    procedureSlug: procedure.slug,
    procedureTitle: procedure.title,
    steps: procedure.steps.map((s) => ({ index: s.index, title: s.title, summary: s.side_panel.body_markdown })),
    currentStepIndex: 2,
    selectedStructureId: null,
    structures: structures.map((s) => ({ id: s.id, name: s.name_en, description: s.description })),
    ...overrides,
  };
}

export function fixtureLookup(data: PromptData = promptData()): SceneActionLookup {
  const ids = new Set(data.structures.map((s) => s.id));
  return {
    structureExists: async (id) => ids.has(id),
    stepExists: async (slug, index) => slug === data.procedureSlug && data.steps.some((s) => s.index === index),
  };
}
