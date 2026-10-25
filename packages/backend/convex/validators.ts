import { v } from "convex/values";

/**
 * The zod schemas in packages/shared (the contract) expressed as Convex validators.
 * The database stores the same snake_case keys as the contract, so no conversion is needed.
 * When the contract (zod) changes, change this file too (see docs/contracts.md).
 */

export const vVec3 = v.array(v.number()); // TODO: the length-3 check is done on the zod side

export const vTransform = v.object({
  position: vVec3,
  rotation: vVec3,
  scale: vVec3,
});

export const vScene = v.object({
  camera: v.object({
    position: vVec3,
    target: vVec3,
    duration_ms: v.number(),
  }),
  structures: v.array(
    v.object({
      id: v.string(),
      opacity: v.number(),
      highlight: v.boolean(),
    }),
  ),
  instruments: v.array(
    v.object({
      id: v.string(),
      transform: vTransform,
    }),
  ),
  animation_clip: v.union(
    v.object({ name: v.string(), loop: v.boolean() }),
    v.null(),
  ),
});

export const vSidePanel = v.object({
  title: v.string(),
  body_markdown: v.string(),
  related_structure_ids: v.array(v.string()),
});

export const vSceneAction = v.union(
  v.object({
    type: v.literal("goto_step"),
    procedure_slug: v.string(),
    step_index: v.number(),
  }),
  v.object({
    type: v.literal("focus"),
    structure_id: v.string(),
    duration_ms: v.optional(v.number()),
  }),
  v.object({
    type: v.literal("highlight"),
    structure_ids: v.array(v.string()),
    enabled: v.boolean(),
  }),
  v.object({
    type: v.literal("set_opacity"),
    structure_id: v.string(),
    opacity: v.number(),
  }),
  v.object({
    type: v.literal("zoom"),
    direction: v.union(v.literal("in"), v.literal("out")),
    amount: v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
  }),
  v.object({
    type: v.literal("rotate"),
    direction: v.union(
      v.literal("left"),
      v.literal("right"),
      v.literal("up"),
      v.literal("down"),
    ),
    degrees: v.number(),
  }),
  v.object({ type: v.literal("reset_view") }),
);

export const vSource = v.object({
  title: v.string(),
  url: v.union(v.string(), v.null()),
});

// --- Return shapes of the read queries: same snake_case as the frontend contract (packages/shared) ---

export const vStructure = v.object({
  id: v.string(),
  name_en: v.string(),
  parent_id: v.union(v.string(), v.null()),
  description: v.string(),
});

export const vInstrument = v.object({
  id: v.string(),
  name_en: v.string(),
  description: v.string(),
});

export const vCondition = v.object({
  slug: v.string(),
  name_en: v.string(),
  description: v.string(),
});

export const vStep = v.object({
  index: v.number(),
  title: v.string(),
  short_title: v.string(),
  scene: vScene,
  side_panel: vSidePanel,
});

export const vProcedureSummary = v.object({
  slug: v.string(),
  title: v.string(),
  summary: v.string(),
  condition_slug: v.union(v.string(), v.null()),
  order: v.number(),
});

export const vProcedure = v.object({
  slug: v.string(),
  title: v.string(),
  summary: v.string(),
  condition_slug: v.union(v.string(), v.null()),
  order: v.number(),
  steps: v.array(vStep),
});

// --- Chat ---

/** How the patient wants the question answered: "slow" (local model) or "fast" (cloud model, paid API). */
export const vChatSpeed = v.union(v.literal("slow"), v.literal("fast"));

export const vChatContext = v.object({
  procedure_slug: v.string(),
  step_index: v.number(),
  selected_structure_id: v.union(v.string(), v.null()),
});

export const vChatResponse = v.object({
  message: v.string(),
  scene_actions: v.array(vSceneAction),
  side_panel: v.union(vSidePanel, v.null()),
  sources: v.array(vSource),
  safety: v.string(),
  doctor_question: v.string(),
  urgent: v.boolean(),
});
