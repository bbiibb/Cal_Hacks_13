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
