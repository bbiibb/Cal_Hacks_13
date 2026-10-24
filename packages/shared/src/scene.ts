import { z } from "zod";
import { InstrumentIdSchema, StructureIdSchema } from "./ids";

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3Schema>;

export const CameraSchema = z.object({
  position: Vec3Schema,
  target: Vec3Schema,
  duration_ms: z.number().int().min(0),
});
export type Camera = z.infer<typeof CameraSchema>;

export const SceneStructureSchema = z.object({
  id: StructureIdSchema,
  /** 0 (fully transparent) to 1 (opaque) */
  opacity: z.number().min(0).max(1),
  highlight: z.boolean(),
});
export type SceneStructure = z.infer<typeof SceneStructureSchema>;

export const TransformSchema = z.object({
  position: Vec3Schema,
  /** Euler angles in radians */
  rotation: Vec3Schema,
  scale: Vec3Schema,
});
export type Transform = z.infer<typeof TransformSchema>;

export const SceneInstrumentSchema = z.object({
  id: InstrumentIdSchema,
  transform: TransformSchema,
});
export type SceneInstrument = z.infer<typeof SceneInstrumentSchema>;

export const AnimationClipSchema = z.object({
  name: z.string().min(1),
  loop: z.boolean(),
});
export type AnimationClip = z.infer<typeof AnimationClipSchema>;

/** The 3D scene state of one step. The scene is rebuilt from this data instead of playing a video. */
export const SceneSchema = z.object({
  camera: CameraSchema,
  structures: z.array(SceneStructureSchema),
  instruments: z.array(SceneInstrumentSchema),
  animation_clip: AnimationClipSchema.nullable(),
});
export type Scene = z.infer<typeof SceneSchema>;
