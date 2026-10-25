/**
 * Turns the raw text of a language model reply into a clean, typed object.
 * Small models often wrap JSON in code fences, add a sentence before it, or use the wrong types,
 * so this is deliberately forgiving about the shape and strict about the result.
 */

export type ZoomDirection = "in" | "out";
export type RotateDirection = "left" | "right" | "up" | "down";

export interface LlmOutput {
  answer: string;
  highlight: string[];
  /** 1-based step number the patient asked for, or null */
  step: number | null;
  zoom: ZoomDirection | null;
  rotate: { direction: RotateDirection; degrees: number } | null;
  resetView: boolean;
  safety: string;
  doctorQuestion: string;
  urgent: boolean;
}

export const DEFAULT_ROTATE_DEGREES = 45;
const ROTATE_DIRECTIONS: readonly string[] = ["left", "right", "up", "down"];

/** Finds the JSON object inside a reply, even when it is wrapped in text or code fences. */
export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A doctor question must read like a question. Small models sometimes put other text in this field. */
function asQuestion(value: unknown): string {
  const text = asString(value);
  return text.endsWith("?") && text.length <= 240 ? text : "";
}

function asBoolean(value: unknown): boolean {
  return value === true || (typeof value === "string" && value.trim().toLowerCase() === "true");
}

function asStep(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 ? n : null;
}

function asZoom(value: unknown): ZoomDirection | null {
  if (typeof value !== "string") return null;
  const s = value.trim().toLowerCase();
  if (s === "in" || /\bzoom[ _-]?in\b|\bcloser\b/.test(s)) return "in";
  if (s === "out" || /\bzoom[ _-]?out\b|\bfurther\b|\bfarther\b/.test(s)) return "out";
  return null;
}

function clampDegrees(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_ROTATE_DEGREES;
  return Math.min(180, Math.max(5, Math.round(Math.abs(n))));
}

function asRotate(value: unknown): LlmOutput["rotate"] {
  // A weak model may answer with just "left"
  if (typeof value === "string") {
    const direction = value.trim().toLowerCase();
    return ROTATE_DIRECTIONS.includes(direction)
      ? { direction: direction as RotateDirection, degrees: DEFAULT_ROTATE_DEGREES }
      : null;
  }
  if (!value || typeof value !== "object") return null;
  const raw = value as { direction?: unknown; degrees?: unknown };
  const direction = typeof raw.direction === "string" ? raw.direction.trim().toLowerCase() : "";
  if (!ROTATE_DIRECTIONS.includes(direction)) return null;
  return { direction: direction as RotateDirection, degrees: clampDegrees(raw.degrees) };
}

function asIdList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const ids: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Parses a model reply. Returns null when there is no usable answer text. */
export function parseLlmOutput(text: string): LlmOutput | null {
  const raw = extractJsonObject(text);
  if (!raw) return null;
  const obj = raw as Record<string, unknown>;

  const answer = asString(obj.answer);
  if (!answer) return null;

  return {
    answer,
    highlight: asIdList(obj.highlight),
    step: asStep(obj.step),
    zoom: asZoom(obj.zoom),
    rotate: asRotate(obj.rotate),
    resetView: asBoolean(obj.reset_view),
    safety: asString(obj.safety),
    doctorQuestion: asQuestion(obj.doctor_question),
    urgent: asBoolean(obj.urgent),
  };
}
