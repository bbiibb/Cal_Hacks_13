import { cleanUserText, describeScreen, type ChatTurn, type LlmMessage, type PromptData } from "./chatPrompt";
import { allowedStructureIds, type RetrievedDoc } from "./rag";

/**
 * Prompt for a small local model (Llama 3.2 3B). It is much shorter than the cloud prompt:
 * only the retrieved context, five rules, one worked example, and the JSON format.
 * Camera commands (zoom, rotate, step, reset) are not asked from the model; they are read from the
 * patient's words by rules (see chatActions.detectViewCommands), which a 3B model would often get wrong.
 */

/** Earlier messages sent along. Kept small because a 3B model has a short memory. */
export const MAX_LOCAL_HISTORY_TURNS = 4;

/**
 * JSON schema for Ollama's `format` option. Ollama constrains decoding to it, so the reply is always
 * valid JSON, and `highlight` can only contain ids from the allowed list: the model cannot invent a part.
 */
export function buildLocalSchema(allowedIds: string[]): Record<string, unknown> {
  const highlight =
    allowedIds.length > 0
      ? { type: "array", items: { type: "string", enum: allowedIds }, maxItems: 3 }
      : { type: "array", items: { type: "string" }, maxItems: 0 };
  return {
    type: "object",
    properties: {
      answer: { type: "string" },
      highlight,
      urgent: { type: "boolean" },
      safety: { type: "string" },
      doctor_question: { type: "string" },
    },
    required: ["answer", "highlight", "urgent", "safety", "doctor_question"],
  };
}

export function buildLocalSystemPrompt(docs: RetrievedDoc[], allowedIds: string[]): string {
  const context = docs.map((d, i) => `[${i + 1}] ${d.title}${d.structureId ? ` (${d.structureId})` : ""}: ${d.text}`).join("\n");
  return [
    "You are a patient-education assistant for a 3D heart procedure viewer. Answer using ONLY the CONTEXT below.",
    `CONTEXT:\n${context}`,
    [
      "RULES:",
      "1. Reply in at most 3 short sentences, in plain words, in the patient's language.",
      "2. If the CONTEXT does not contain the answer, say you are not sure and suggest asking the care team. Do not guess.",
      "3. Never diagnose, and never give advice about medicines.",
      "4. If the patient describes emergency symptoms happening now (chest pain, trouble breathing, fainting, stroke signs, heavy bleeding), set urgent to true and tell them to call their local emergency number right away.",
      "5. highlight: the ids from the allowed list that your answer is about. Use [] if none.",
    ].join("\n"),
    `ALLOWED IDS: ${allowedIds.length > 0 ? allowedIds.join(", ") : "(none)"}`,
    'Reply with ONLY this JSON object and nothing else: {"answer": "...", "highlight": [], "urgent": false, "safety": "", "doctor_question": ""}',
  ].join("\n\n");
}

/** One worked example as earlier turns. It helps a small model follow the format. */
function buildLocalExample(data: PromptData, docs: RetrievedDoc[], ids: string[]): LlmMessage[] {
  const first = docs.find((d) => d.structureId);
  if (!first || ids.length === 0) return [];
  const answer = `${first.title}: ${first.text.slice(0, 110).replace(/\s+/g, " ").trim()}`;
  return [
    { role: "user", content: `${describeScreen({ ...data, selectedStructureId: null })}\nQuestion: What is the ${first.title}?` },
    {
      role: "assistant",
      content: JSON.stringify({ answer, highlight: [first.structureId], urgent: false, safety: "", doctor_question: "" }),
    },
  ];
}

export function buildLocalMessages(
  data: PromptData,
  history: ChatTurn[],
  userMessage: string,
  docs: RetrievedDoc[],
): LlmMessage[] {
  const ids = allowedStructureIds(docs);
  const recent = history.slice(-MAX_LOCAL_HISTORY_TURNS).map((turn) => ({
    role: turn.role,
    content: cleanUserText(turn.content),
  }));
  return [
    { role: "system", content: buildLocalSystemPrompt(docs, ids) },
    ...buildLocalExample(data, docs, ids),
    ...recent,
    { role: "user", content: `${describeScreen(data)}\nQuestion: ${cleanUserText(userMessage)}` },
  ];
}
