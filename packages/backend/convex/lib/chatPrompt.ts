import type { KnowledgeChunk } from "@cal-hacks/shared";
import type { RetrievedDoc } from "./rag";

/**
 * Builds the messages sent to the language model.
 *
 * The prompt is written for small, free models (for example Llama 3.1 8B): short rules, ids copied
 * from a list, two worked examples, and the exact JSON format repeated at the very end.
 */

export interface PromptStructure {
  id: string;
  name: string;
  description: string;
}

export interface PromptStep {
  index: number;
  title: string;
  summary: string;
}

export interface PromptData {
  procedureSlug: string;
  procedureTitle: string;
  steps: PromptStep[];
  currentStepIndex: number;
  /** structure_id of the part the patient selected, if any */
  selectedStructureId: string | null;
  structures: PromptStructure[];
  /** Patient-education facts about the procedure (the reference material). Added by the caller, not stored with the procedure. */
  knowledge?: KnowledgeChunk[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Keeps the prompt short: free tiers limit tokens per minute. */
const MAX_STRUCTURE_DESCRIPTION = 100;
const MAX_STEP_SUMMARY = 160;
/** How many earlier messages are sent along. */
export const MAX_HISTORY_TURNS = 6;

function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Removes control characters so the question cannot break the prompt layout. */
export function cleanUserText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim();
}

/** The one-line description of what is on screen, sent with every question. */
export function describeScreen(data: PromptData): string {
  const step = data.steps.find((s) => s.index === data.currentStepIndex);
  const selected = data.selectedStructureId
    ? data.structures.find((s) => s.id === data.selectedStructureId)
    : undefined;
  const stepText = step
    ? `Step ${step.index + 1} of ${data.steps.length}: "${step.title}"`
    : `Step ${data.currentStepIndex + 1}`;
  const partText = selected ? `${selected.name} (${selected.id})` : "none";
  return `[Screen] ${stepText}. Selected part: ${partText}.`;
}

/** The reference facts found for this question, as a numbered list. */
export function formatReference(reference: RetrievedDoc[]): string {
  return reference.map((d, i) => `[${i + 1}] ${d.title}: ${d.text}`).join("\n");
}

export function buildSystemPrompt(data: PromptData, reference: RetrievedDoc[] = []): string {
  const steps = data.steps
    .map((s) => `${s.index + 1}. ${s.title}: ${shorten(s.summary, MAX_STEP_SUMMARY)}`)
    .join("\n");
  const parts = data.structures
    .map((s) => `${s.id}: ${s.name}. ${shorten(s.description, MAX_STRUCTURE_DESCRIPTION)}`)
    .join("\n");

  return [
    "You are a friendly patient-education assistant. The patient is looking at an interactive 3D model of their heart procedure and asks you questions about what they see.",
    `PROCEDURE: ${data.procedureTitle}`,
    `STEPS:\n${steps}`,
    `PARTS YOU CAN POINT AT (use the ids exactly as written):\n${parts}`,
    ...(reference.length > 0
      ? [`REFERENCE (patient-education facts; answer from these first):\n${formatReference(reference)}`]
      : []),
    [
      "RULES:",
      "- Answer in the patient's language, in plain words, in at most 4 short sentences. Connect the answer to the step or part on screen.",
      "- Use only the information above. Do not add facts, numbers, or percentages that are not written above. If the information does not contain the answer, say you are not sure and suggest asking the care team.",
      "- When you give a percentage, copy it exactly and say it describes groups of patients, not the patient's own risk.",
      "- Never diagnose, estimate personal risk, or tell the patient to start, stop, or change a medicine. For anything personal, tell them to ask their care team.",
      "- Only help with this procedure, the heart, and the 3D model. For any other topic, politely say you can only help with those and suggest something the patient can ask.",
      '- If the patient describes symptoms happening now (chest pain, trouble breathing, fainting, stroke signs, heavy bleeding), set "urgent" to true and start the answer by telling them to call their local emergency number (for example 911, 112, or 999) right away.',
      '- "highlight": 0 to 3 part ids from the list that your answer talks about. Never invent an id. Use [] if no part fits.',
      '- "step": a number from 1 to ' + data.steps.length + " only if the patient asks to see a step. Otherwise null.",
      '- "zoom": "in" or "out" only if the patient asks to zoom, get closer, or move away. Otherwise null.',
      '- "rotate": {"direction": "left" or "right" or "up" or "down", "degrees": a number from 10 to 180} only if the patient asks to turn or rotate the model. Otherwise null.',
      '- "reset_view": true only if the patient asks to reset the view. Otherwise false.',
      '- "safety": one sentence the patient must know if the question is about side effects or precautions. Otherwise "".',
      '- "doctor_question": one useful question the patient could ask their doctor about this topic. Otherwise "".',
    ].join("\n"),
    [
      "OUTPUT FORMAT (most important): reply with ONE JSON object and nothing else. No markdown, no code fences, no text before or after it. Use exactly these keys:",
      '{"answer": string, "highlight": string[], "step": number or null, "zoom": "in" or "out" or null, "rotate": {"direction": string, "degrees": number} or null, "reset_view": boolean, "safety": string, "doctor_question": string, "urgent": boolean}',
    ].join("\n"),
  ].join("\n\n");
}

/** Two worked examples as earlier turns. Small models follow examples better than rules alone. */
function buildExamples(data: PromptData): LlmMessage[] {
  const first =
    data.structures.find((s) => s.id === "aortic_valve") ?? data.structures[0];
  if (!first) return [];
  const screen = describeScreen({ ...data, selectedStructureId: null });
  const lastStep = Math.max(1, data.steps.length);

  const one = {
    answer: `This is the ${first.name}. ${shorten(first.description, 90)} I zoomed in so you can see it better.`,
    highlight: [first.id],
    step: null,
    zoom: "in",
    rotate: null,
    reset_view: false,
    safety: "",
    doctor_question: "",
    urgent: false,
  };
  const two = {
    answer: `Here is step ${lastStep}. I also turned the model a little to the left.`,
    highlight: [],
    step: lastStep,
    zoom: null,
    rotate: { direction: "left", degrees: 30 },
    reset_view: false,
    safety: "",
    doctor_question: "",
    urgent: false,
  };

  return [
    { role: "user", content: `${screen}\nQuestion: What is the ${first.name}? Zoom in please.` },
    { role: "assistant", content: JSON.stringify(one) },
    { role: "user", content: `${screen}\nQuestion: Take me to step ${lastStep} and turn it left a bit.` },
    { role: "assistant", content: JSON.stringify(two) },
  ];
}

export function buildMessages(
  data: PromptData,
  history: ChatTurn[],
  userMessage: string,
  reference: RetrievedDoc[] = [],
): LlmMessage[] {
  const recent = history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
    role: turn.role,
    content: cleanUserText(turn.content),
  }));
  return [
    { role: "system", content: buildSystemPrompt(data, reference) },
    ...buildExamples(data),
    ...recent,
    { role: "user", content: `${describeScreen(data)}\nQuestion: ${cleanUserText(userMessage)}` },
  ];
}
