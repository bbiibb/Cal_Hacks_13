import { cleanUserText, describeScreen, type ChatTurn, type LlmMessage, type PromptData } from "./chatPrompt";
import { capHistoryMessage } from "./chatSummary";
import { allowedStructureIds, promptText, type RetrievedDoc } from "./rag";

/**
 * Prompt for a small local model (Llama 3.2 3B). It is much shorter than the cloud prompt:
 * only the retrieved context, a few rules, two worked examples, and the JSON format.
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

/** The documents as a numbered list, with the part ids each one is about. */
function formatContext(docs: RetrievedDoc[], allowedIds: string[]): string {
  return docs
    .map((d, i) => {
      const own = [d.structureId, ...(d.relatedStructureIds ?? [])].filter((id): id is string => !!id && allowedIds.includes(id));
      return `[${i + 1}] ${d.title}${own.length > 0 ? ` (part ids: ${own.join(", ")})` : ""}: ${promptText(d)}`;
    })
    .join("\n");
}

/** The exact reply format, repeated at the very end of the system prompt where a small model pays most attention. */
export const LOCAL_FORMAT_LINE =
  'Reply with ONLY this JSON object and nothing else: {"answer": "...", "highlight": [], "urgent": false, "safety": "", "doctor_question": ""}';

export function buildLocalSystemPrompt(docs: RetrievedDoc[], allowedIds: string[], summary = ""): string {
  return [
    "You are a patient-education assistant for a 3D heart procedure viewer. Answer using ONLY the CONTEXT below.",
    `CONTEXT:\n${formatContext(docs, allowedIds)}`,
    ...(summary ? [`EARLIER IN THIS CONVERSATION (older messages, shortened): ${summary}`] : []),
    [
      "RULES:",
      "1. Reply in at most 3 short sentences, in plain words, in the patient's language. Answer the question first. Begin with Yes or No only if the CONTEXT clearly says so.",
      "2. Use only facts, numbers, and percentages written in the CONTEXT. Never add others. If the CONTEXT does not answer the question, say you are not sure and suggest asking the care team. Do not guess.",
      "3. A percentage describes groups of patients, not the patient's own risk. Copy it exactly and say that.",
      "4. Never diagnose. Never tell the patient to start, stop, or change a medicine: say to ask the care team.",
      "5. If the patient describes emergency symptoms happening now (chest pain, trouble breathing, fainting, stroke signs, heavy bleeding), set urgent to true and tell them to call their local emergency number right away.",
      "6. Only help with this procedure, the heart, and the 3D model.",
      "7. highlight: the ids from ALLOWED IDS that your answer is about. Use [] if none.",
      '8. doctor_question: one short question the patient could ask their care team about this topic, or "".',
    ].join("\n"),
    `ALLOWED IDS: ${allowedIds.length > 0 ? allowedIds.join(", ") : "(none)"}`,
    LOCAL_FORMAT_LINE,
  ].join("\n\n");
}

/**
 * Two worked examples as earlier turns. They show a small model the format, and the two behaviours that matter
 * most: answer from the facts, and say "I am not sure" when the facts do not contain the answer.
 * The facts in the first example match our reference material.
 */
function buildLocalExample(data: PromptData, ids: string[]): LlmMessage[] {
  const screen = describeScreen({ ...data, selectedStructureId: null });
  return [
    { role: "user", content: `${screen}\nQuestion: Does the new valve stay in my body?` },
    {
      role: "assistant",
      content: JSON.stringify({
        answer: "Yes. The new valve stays in your heart. It pushes the old valve flaps aside, and its own tissue flaps then open and close to control blood flow.",
        highlight: ids.includes("transcatheter_valve") ? ["transcatheter_valve"] : [],
        urgent: false,
        safety: "",
        doctor_question: "How long is the new valve expected to last?",
      }),
    },
    { role: "user", content: `${screen}\nQuestion: Which hospital is the best one for this?` },
    {
      role: "assistant",
      content: JSON.stringify({
        answer: "I am not sure about that. Your care team can help you choose.",
        highlight: [],
        urgent: false,
        safety: "",
        doctor_question: "Which hospital and team do you recommend for my procedure?",
      }),
    },
  ];
}

export function buildLocalMessages(
  data: PromptData,
  history: ChatTurn[],
  userMessage: string,
  docs: RetrievedDoc[],
  allowedIds?: string[],
): LlmMessage[] {
  const ids = allowedIds ?? allowedStructureIds(docs);
  const recent = history.slice(-MAX_LOCAL_HISTORY_TURNS).map((turn) => ({
    role: turn.role,
    content: capHistoryMessage(cleanUserText(turn.content)),
  }));
  return [
    { role: "system", content: buildLocalSystemPrompt(docs, ids, data.conversationSummary ?? "") },
    ...buildLocalExample(data, ids),
    ...recent,
    { role: "user", content: `${describeScreen(data)}\nQuestion: ${cleanUserText(userMessage)}` },
  ];
}
