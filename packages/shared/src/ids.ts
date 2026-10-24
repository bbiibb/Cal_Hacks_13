import { z } from "zod";

/**
 * 해부학적 구조물 식별자. GLB 메시 이름과 1:1로 일치하는 공통 키다.
 * 규칙: 소문자 snake_case 세그먼트를 `.` 로 이어 계층을 표현한다.
 * 예) `aorta`, `aortic_valve`, `aortic_valve.calcification`
 */
export const STRUCTURE_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export const StructureIdSchema = z
  .string()
  .regex(STRUCTURE_ID_PATTERN, "structure_id 형식이 올바르지 않음 (예: aortic_valve.calcification)");
export type StructureId = z.infer<typeof StructureIdSchema>;

/** 수술 기구 식별자. 예) `grasper`, `clip_applier` */
export const INSTRUMENT_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export const InstrumentIdSchema = z
  .string()
  .regex(INSTRUMENT_ID_PATTERN, "instrument_id 형식이 올바르지 않음 (예: clip_applier)");
export type InstrumentId = z.infer<typeof InstrumentIdSchema>;

/** 수술 과정(procedure) 슬러그. 예) `tavr` */
export const ProcedureSlugSchema = z
  .string()
  .regex(INSTRUMENT_ID_PATTERN, "procedure slug 형식이 올바르지 않음");
export type ProcedureSlug = z.infer<typeof ProcedureSlugSchema>;

/**
 * 질환(condition) 슬러그. 수술/시술(procedure)이 치료하는 심장 질환의 식별자.
 * 예) `aortic_stenosis`. 새 질환은 이 규칙만 지키면 코드 변경 없이 콘텐츠로 추가할 수 있다.
 */
export const ConditionSlugSchema = z
  .string()
  .regex(INSTRUMENT_ID_PATTERN, "condition slug 형식이 올바르지 않음 (예: aortic_stenosis)");
export type ConditionSlug = z.infer<typeof ConditionSlugSchema>;
