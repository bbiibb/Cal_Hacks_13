import { z } from "zod";
import { ProcedureSlugSchema, StructureIdSchema } from "./ids";

/** Commands the chatbot sends to the 3D view. A union discriminated by `type`. */
export const GotoStepActionSchema = z.object({
  type: z.literal("goto_step"),
  procedure_slug: ProcedureSlugSchema,
  step_index: z.number().int().min(0),
});

export const FocusActionSchema = z.object({
  type: z.literal("focus"),
  structure_id: StructureIdSchema,
  duration_ms: z.number().int().min(0).optional(),
});

export const HighlightActionSchema = z.object({
  type: z.literal("highlight"),
  structure_ids: z.array(StructureIdSchema).min(1),
  enabled: z.boolean(),
});

export const SetOpacityActionSchema = z.object({
  type: z.literal("set_opacity"),
  structure_id: StructureIdSchema,
  opacity: z.number().min(0).max(1),
});

/** Move the camera closer to the model (in) or further away (out). */
export const ZoomActionSchema = z.object({
  type: z.literal("zoom"),
  direction: z.enum(["in", "out"]),
  amount: z.enum(["small", "medium", "large"]),
});

/** Orbit the camera around the model. "left" and "right" turn around the vertical axis. */
export const MIN_ROTATE_DEGREES = 5;
export const MAX_ROTATE_DEGREES = 180;
export const RotateActionSchema = z.object({
  type: z.literal("rotate"),
  direction: z.enum(["left", "right", "up", "down"]),
  degrees: z.number().min(MIN_ROTATE_DEGREES).max(MAX_ROTATE_DEGREES),
});

/** Go back to the default camera position. */
export const ResetViewActionSchema = z.object({
  type: z.literal("reset_view"),
});

export const SceneActionSchema = z.discriminatedUnion("type", [
  GotoStepActionSchema,
  FocusActionSchema,
  HighlightActionSchema,
  SetOpacityActionSchema,
  ZoomActionSchema,
  RotateActionSchema,
  ResetViewActionSchema,
]);
export type SceneAction = z.infer<typeof SceneActionSchema>;

export const SidePanelSchema = z.object({
  title: z.string().min(1),
  body_markdown: z.string(),
  related_structure_ids: z.array(StructureIdSchema),
});
export type SidePanel = z.infer<typeof SidePanelSchema>;

export const SourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().nullable(),
});
export type Source = z.infer<typeof SourceSchema>;

export const ChatResponseSchema = z.object({
  message: z.string(),
  scene_actions: z.array(SceneActionSchema),
  side_panel: SidePanelSchema.nullable(),
  sources: z.array(SourceSchema),
  /** One sentence the patient must know (side effects, precautions). Empty when not needed. */
  safety: z.string().default(""),
  /** A question the patient could ask their doctor about this topic. Empty when not needed. */
  doctor_question: z.string().default(""),
  /** True when the patient describes symptoms that need emergency help. */
  urgent: z.boolean().default(false),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

/** Longest question we accept, in characters. */
export const MAX_CHAT_MESSAGE_LENGTH = 500;

/** What the patient is looking at when they ask. The chatbot answers in this context. */
export const ChatContextSchema = z.object({
  procedure_slug: ProcedureSlugSchema,
  step_index: z.number().int().min(0),
  /** The part the patient selected in the 3D view, if any. */
  selected_structure_id: StructureIdSchema.nullable(),
});
export type ChatContext = z.infer<typeof ChatContextSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
  context: ChatContextSchema,
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
