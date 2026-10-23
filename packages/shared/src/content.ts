import { z } from "zod";
import { InstrumentIdSchema, ProcedureSlugSchema, StructureIdSchema } from "./ids";
import { SceneSchema } from "./scene";
import { SidePanelSchema } from "./chat";

export const StructureSchema = z.object({
  id: StructureIdSchema,
  name_en: z.string().min(1),
  name_ko: z.string().min(1),
  /** 상위 구조물. 최상위면 null. `liver.right_lobe` 의 부모는 `liver` */
  parent_id: StructureIdSchema.nullable(),
  description: z.string(),
});
export type Structure = z.infer<typeof StructureSchema>;

export const InstrumentSchema = z.object({
  id: InstrumentIdSchema,
  name_en: z.string().min(1),
  name_ko: z.string().min(1),
  description: z.string(),
});
export type Instrument = z.infer<typeof InstrumentSchema>;

export const StepSchema = z.object({
  /** 0부터 시작하는 단계 순서 */
  index: z.number().int().min(0),
  title: z.string().min(1),
  scene: SceneSchema,
  side_panel: SidePanelSchema,
});
export type Step = z.infer<typeof StepSchema>;

export const ProcedureSchema = z.object({
  slug: ProcedureSlugSchema,
  title: z.string().min(1),
  summary: z.string(),
  steps: z.array(StepSchema).min(1),
});
export type Procedure = z.infer<typeof ProcedureSchema>;
