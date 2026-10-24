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
  name_ko: z.string().min(1),
  /** 상위 구조물. 최상위면 null. `aortic_valve.calcification` 의 부모는 `aortic_valve` */
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

/** 심장 질환. 하나의 질환에 여러 수술/시술이 연결될 수 있다. */
export const ConditionSchema = z.object({
  slug: ConditionSlugSchema,
  name_en: z.string().min(1),
  name_ko: z.string().min(1),
  description: z.string(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const StepSchema = z.object({
  /** 0부터 시작하는 단계 순서. 타임라인 슬라이더의 눈금이 된다 */
  index: z.number().int().min(0),
  title: z.string().min(1),
  /** 타임라인 라벨용 짧은 이름 (좁은 화면에서 잘리지 않도록 짧게) */
  short_title: z.string().min(1),
  scene: SceneSchema,
  side_panel: SidePanelSchema,
});
export type Step = z.infer<typeof StepSchema>;

export const ProcedureSchema = z.object({
  slug: ProcedureSlugSchema,
  title: z.string().min(1),
  summary: z.string(),
  /** 이 수술이 치료하는 질환. 아직 정해지지 않았으면 null */
  condition_slug: ConditionSlugSchema.nullable(),
  /** 같은 질환 안에서 보여줄 순서 (작을수록 먼저) */
  order: z.number().int().min(0),
  steps: z.array(StepSchema).min(1),
});
export type Procedure = z.infer<typeof ProcedureSchema>;
