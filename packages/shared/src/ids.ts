import { z } from "zod";

/**
 * Anatomical structure identifier. It is the shared key that matches a mesh name in the GLB model one to one.
 * Rule: lower-case snake_case segments joined with `.` to express hierarchy.
 * Examples: `aorta`, `aortic_valve`, `aortic_valve.calcification`
 */
export const STRUCTURE_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export const StructureIdSchema = z
  .string()
  .regex(STRUCTURE_ID_PATTERN, "Invalid structure_id format (example: aortic_valve.calcification)");
export type StructureId = z.infer<typeof StructureIdSchema>;

/** Surgical instrument identifier. Examples: `guidewire`, `delivery_catheter` */
export const INSTRUMENT_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export const InstrumentIdSchema = z
  .string()
  .regex(INSTRUMENT_ID_PATTERN, "Invalid instrument_id format (example: delivery_catheter)");
export type InstrumentId = z.infer<typeof InstrumentIdSchema>;

/** Procedure slug. Example: `tavr` */
export const ProcedureSlugSchema = z
  .string()
  .regex(INSTRUMENT_ID_PATTERN, "Invalid procedure slug format");
export type ProcedureSlug = z.infer<typeof ProcedureSlugSchema>;

/**
 * Condition slug: identifies the heart condition that a procedure treats.
 * Example: `aortic_stenosis`. A new condition can be added as content, without code changes, as long as it follows this rule.
 */
export const ConditionSlugSchema = z
  .string()
  .regex(INSTRUMENT_ID_PATTERN, "Invalid condition slug format (example: aortic_stenosis)");
export type ConditionSlug = z.infer<typeof ConditionSlugSchema>;
