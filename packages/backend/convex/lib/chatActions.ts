import type { SceneAction } from "@cal-hacks/shared";
import {
  DEFAULT_ROTATE_DEGREES,
  type LlmOutput,
  type RotateDirection,
  type ZoomDirection,
} from "./chatParse";

/** The most parts we highlight for one answer. */
export const MAX_HIGHLIGHTS = 3;

export const EMERGENCY_NOTICE =
  "If you are having these symptoms now, call your local emergency number (for example 911, 112, or 999) or go to the nearest emergency department right away.";

// --- Safety net: urgent symptoms -------------------------------------------------------------
// This runs even if the model misses the symptom, so a weak model cannot hide an emergency.

const URGENT_SYMPTOMS =
  /\b(chest (pain|pressure|tightness)|heart attack|(can'?t|cannot|can not) breathe|trouble breathing|difficulty breathing|hard to breathe|short(ness)? of breath|faint(ed|ing)?|passed out|unconscious|stroke|face (is )?drooping|slurred speech|sudden weakness|heavy bleeding|bleeding (a lot|heavily|won'?t stop)|won'?t stop bleeding)\b/i;
const PRESENT_CUE = /\b(i am|i'm|i have|i've|i feel|i'm having|having|right now|currently|now)\b/i;
const FUTURE_QUESTION = /^\s*(will|would|could|might|can|does|do|is|are|what|how|why|when|should)\b/i;

export function detectUrgent(message: string): boolean {
  if (!URGENT_SYMPTOMS.test(message)) return false;
  // "Will I have chest pain after the procedure?" asks about the future, not an emergency
  if (FUTURE_QUESTION.test(message) && !/\b(right now|currently|i am having|i'm having)\b/i.test(message)) {
    return false;
  }
  return PRESENT_CUE.test(message);
}

// --- Fallback: simple view commands ------------------------------------------------------------
// "Zoom in", "rotate left 90 degrees", "go to step 3" are clear enough to read without the model.

export type ZoomAmount = "small" | "medium" | "large";

export interface ViewCommands {
  zoom: { direction: ZoomDirection; amount: ZoomAmount } | null;
  rotate: { direction: RotateDirection; degrees: number } | null;
  resetView: boolean;
  /** 1-based step number */
  step: number | null;
}

function amountFrom(message: string): ZoomAmount {
  if (/\b(a little|a bit|slightly|just a)\b/i.test(message)) return "small";
  if (/\b(a lot|much|all the way|as much as)\b/i.test(message)) return "large";
  return "medium";
}

export function detectViewCommands(message: string): ViewCommands {
  const text = message.toLowerCase();

  let zoom: ViewCommands["zoom"] = null;
  if (/\bzoom(ing)?\s*out\b|\b(farther|further) away\b|\bmove (back|away)\b/.test(text)) {
    zoom = { direction: "out", amount: amountFrom(text) };
  } else if (/\bzoom(ing)?\s*in\b|\bget closer\b|\bcloser look\b|\bmagnify\b/.test(text)) {
    zoom = { direction: "in", amount: amountFrom(text) };
  }

  let rotate: ViewCommands["rotate"] = null;
  const rotation = text.match(/\b(rotate|turn|spin|tilt)\b[^.?!]*?\b(left|right|up|down)\b/);
  if (rotation) {
    const degrees = text.match(/(\d{1,3})\s*(degrees?|°)/);
    rotate = {
      direction: rotation[2] as RotateDirection,
      degrees: degrees ? Math.min(180, Math.max(5, Number(degrees[1]))) : DEFAULT_ROTATE_DEGREES,
    };
  }

  const resetView =
    /\b(reset|restore)\b[^.?!]*\b(view|camera|position|model)\b|\b(original|default) (view|position)\b/.test(text);

  const stepMatch = text.match(/\b(?:go to|show|take me to|jump to|move to|see)\s+(?:the\s+)?step\s+(\d{1,2})\b/);
  const step = stepMatch ? Number(stepMatch[1]) : null;

  return { zoom, rotate, resetView, step };
}

// --- Actions for the 3D view -------------------------------------------------------------------

export interface ActionContext {
  procedureSlug: string;
  stepCount: number;
  /** The patient's original message, used for the view-command fallback */
  message: string;
}

/**
 * Turns the model's answer into scene actions. The result is NOT trusted yet:
 * it must still go through the validator (zod schema and database existence checks).
 */
export function buildSceneActions(output: LlmOutput, context: ActionContext): SceneAction[] {
  const commands = detectViewCommands(context.message);
  const actions: SceneAction[] = [];

  const step = output.step ?? commands.step;
  if (step !== null && step >= 1 && step <= context.stepCount) {
    actions.push({ type: "goto_step", procedure_slug: context.procedureSlug, step_index: step - 1 });
  }

  const ids = output.highlight.slice(0, MAX_HIGHLIGHTS);
  if (ids.length > 0) {
    actions.push({ type: "focus", structure_id: ids[0]! });
    actions.push({ type: "highlight", structure_ids: ids, enabled: true });
  }

  const zoom = output.zoom
    ? { direction: output.zoom, amount: commands.zoom?.direction === output.zoom ? commands.zoom.amount : ("medium" as ZoomAmount) }
    : commands.zoom;
  if (zoom) actions.push({ type: "zoom", direction: zoom.direction, amount: zoom.amount });

  const rotate = output.rotate ?? commands.rotate;
  if (rotate) actions.push({ type: "rotate", direction: rotate.direction, degrees: rotate.degrees });

  if (output.resetView || commands.resetView) actions.push({ type: "reset_view" });

  return actions;
}
