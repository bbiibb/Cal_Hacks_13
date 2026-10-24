import { z } from "zod";
import {
  ConditionSlugSchema,
  InstrumentIdSchema,
  ProcedureSlugSchema,
  StructureIdSchema,
} from "./ids";
import { SceneSchema } from "./scene";
import { SidePanelSchema } from "./chat";

export const StructureSchema = z.object({
  id: StructureIdSchema,
  name_en: z.string().min(1),
  /** Parent structure, or null for a top-level one. The parent of `aortic_valve.calcification` is `aortic_valve` */
  parent_id: StructureIdSchema.nullable(),
  description: z.string(),
});
export type Structure = z.infer<typeof StructureSchema>;

export const InstrumentSchema = z.object({
  id: InstrumentIdSchema,
  name_en: z.string().min(1),
  description: z.string(),
});
export type Instrument = z.infer<typeof InstrumentSchema>;

/** A heart condition. Several procedures can be linked to one condition. */
export const ConditionSchema = z.object({
  slug: ConditionSlugSchema,
  name_en: z.string().min(1),
  description: z.string(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const StepSchema = z.object({
  /** Step order starting at 0. Each index is one tick on the timeline slider */
  index: z.number().int().min(0),
  title: z.string().min(1),
  /** Short name for the timeline label (kept short so it is not cut off on narrow screens) */
  short_title: z.string().min(1),
  scene: SceneSchema,
  side_panel: SidePanelSchema,
});
export type Step = z.infer<typeof StepSchema>;

export const ProcedureSchema = z.object({
  slug: ProcedureSlugSchema,
  title: z.string().min(1),
  summary: z.string(),
  /** The condition this procedure treats, or null if not decided yet */
  condition_slug: ConditionSlugSchema.nullable(),
  /** Display order within the same condition (smaller comes first) */
  order: z.number().int().min(0),
  steps: z.array(StepSchema).min(1),
});
export type Procedure = z.infer<typeof ProcedureSchema>;
