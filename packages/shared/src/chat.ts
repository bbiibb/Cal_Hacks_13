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

export const SceneActionSchema = z.discriminatedUnion("type", [
  GotoStepActionSchema,
  FocusActionSchema,
  HighlightActionSchema,
  SetOpacityActionSchema,
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
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
