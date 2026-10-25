import { SceneActionSchema, type SceneAction } from "@cal-hacks/shared";

/** Maximum number of scene_actions allowed in one response. Guards against runaway LLM output */
export const MAX_SCENE_ACTIONS = 10;

/** Interface for checking whether something exists in the database. The real implementation uses ctx.db; tests use a fake. */
export interface SceneActionLookup {
  structureExists(structureId: string): Promise<boolean>;
  stepExists(procedureSlug: string, stepIndex: number): Promise<boolean>;
}

export interface RejectedSceneAction {
  /** Position in the input array, or -1 if the input itself is not an array */
  index: number;
  reason: string;
}

export interface SceneActionValidationResult {
  accepted: SceneAction[];
  rejected: RejectedSceneAction[];
}

/**
 * Validates the scene_actions produced by the LLM.
 * It checks (1) the zod schema, then (2) existence in the database, and only items that pass both go into `accepted`.
 * Failed items are dropped and a `reason` is recorded (the caller logs it).
 * If one action contains even one id that does not exist, the whole action is rejected.
 */
export async function validateSceneActions(
  raw: unknown,
  lookup: SceneActionLookup,
): Promise<SceneActionValidationResult> {
  if (!Array.isArray(raw)) {
    return {
      accepted: [],
      rejected: [{ index: -1, reason: "scene_actions is not an array" }],
    };
  }

  const accepted: SceneAction[] = [];
  const rejected: RejectedSceneAction[] = [];

  for (const [index, item] of raw.entries()) {
    if (index >= MAX_SCENE_ACTIONS) {
      rejected.push({ index, reason: `More than the maximum of ${MAX_SCENE_ACTIONS} actions` });
      continue;
    }

    const parsed = SceneActionSchema.safeParse(item);
    if (!parsed.success) {
      rejected.push({ index, reason: `Schema validation failed: ${parsed.error.issues[0]?.message ?? "unknown"}` });
      continue;
    }

    const missing = await findMissingReference(parsed.data, lookup);
    if (missing) {
      rejected.push({ index, reason: missing });
      continue;
    }
    accepted.push(parsed.data);
  }

  return { accepted, rejected };
}

/** Returns a reason string if any reference does not exist, or null if everything exists */
async function findMissingReference(
  action: SceneAction,
  lookup: SceneActionLookup,
): Promise<string | null> {
  switch (action.type) {
    case "goto_step":
      return (await lookup.stepExists(action.procedure_slug, action.step_index))
        ? null
        : `Step does not exist: ${action.procedure_slug}#${action.step_index}`;
    case "focus":
    case "set_opacity":
      return (await lookup.structureExists(action.structure_id))
        ? null
        : `structure_id does not exist: ${action.structure_id}`;
    case "highlight":
      for (const id of action.structure_ids) {
        if (!(await lookup.structureExists(id))) {
          return `structure_id does not exist: ${id}`;
        }
      }
      return null;
    // Camera-only commands do not reference anything in the database
    case "zoom":
    case "rotate":
    case "reset_view":
      return null;
  }
}
