import { z } from "zod";

/**
 * 해부학적 구조물 식별자. GLB 메시 이름과 1:1로 일치하는 공통 키다.
 * 규칙: 소문자 snake_case 세그먼트를 `.` 로 이어 계층을 표현한다.
 * 예) `liver`, `liver.right_lobe`, `gallbladder`
 */
export const STRUCTURE_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export const StructureIdSchema = z
  .string()
  .regex(STRUCTURE_ID_PATTERN, "structure_id 형식이 올바르지 않음 (예: liver.right_lobe)");
export type StructureId = z.infer<typeof StructureIdSchema>;

/** 수술 기구 식별자. 예) `grasper`, `clip_applier` */
export const INSTRUMENT_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export const InstrumentIdSchema = z
  .string()
  .regex(INSTRUMENT_ID_PATTERN, "instrument_id 형식이 올바르지 않음 (예: clip_applier)");
export type InstrumentId = z.infer<typeof InstrumentIdSchema>;

/** 수술 과정(procedure) 슬러그. 예) `laparoscopic_cholecystectomy` */
export const ProcedureSlugSchema = z
  .string()
  .regex(INSTRUMENT_ID_PATTERN, "procedure slug 형식이 올바르지 않음");
export type ProcedureSlug = z.infer<typeof ProcedureSlugSchema>;
