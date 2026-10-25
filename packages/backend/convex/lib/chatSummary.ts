/**
 * Conversation memory beyond the few messages the model sees.
 *
 * The model is shown only the latest messages (MAX_HISTORY_TURNS). Older messages are folded into a short
 * summary and then deleted from the database. The summary is built by rules, without asking a model:
 * it keeps what the patient asked (shortened) and which topics were already explained (the titles of the
 * reference facts that answers cited). It never keeps the assistant's own sentences.
 * See docs/chatbot.md ("Conversation memory") for why this is done by rules.
 */

/** Messages kept in full in the database and offered to the model. Older ones are folded into the summary. */
export const RAW_MESSAGES_KEPT = 6;
/** Longest summary text that goes into a prompt, in characters. */
export const SUMMARY_MAX_CHARS = 600;
/** How much of an earlier question is remembered. */
export const SUMMARY_QUESTION_CHARS = 90;
export const MAX_SUMMARY_QUESTIONS = 8;
export const MAX_SUMMARY_TOPICS = 6;
/** Longest earlier message sent to the model as it is. Answers are 3 to 4 short sentences, so this rarely cuts; it keeps the local 2048-token window safe. */
export const MAX_HISTORY_MESSAGE_CHARS = 300;

export interface ConversationSummary {
  /** Earlier questions of the patient, oldest first, each shortened */
  questions: string[];
  /** Topics that were already explained (titles of the cited reference facts), oldest first */
  topics: string[];
}

export interface FoldableMessage {
  role: "user" | "assistant";
  content: string;
  /** Sources the assistant cited (assistant messages only) */
  sources?: { title: string }[];
}

/** One line of text cut at a word boundary, with an ellipsis when it was cut. */
export function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** A source title without the document name in brackets: "Risk: stroke (TAVR patient information guide)" -> "Risk: stroke". */
function topicName(sourceTitle: string): string {
  return sourceTitle.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function addUnique(list: string[], item: string): string[] {
  const key = item.toLowerCase();
  return [...list.filter((x) => x.toLowerCase() !== key), item];
}

/** Adds older messages to a summary. The newest information is kept when a limit is reached. */
export function foldMessages(summary: ConversationSummary | undefined, messages: FoldableMessage[]): ConversationSummary {
  let questions = summary?.questions ?? [];
  let topics = summary?.topics ?? [];
  for (const message of messages) {
    if (message.role === "user") {
      const q = shorten(message.content, SUMMARY_QUESTION_CHARS);
      if (q !== "") questions = addUnique(questions, q);
    } else {
      for (const source of message.sources ?? []) {
        const topic = topicName(source.title);
        if (topic !== "") topics = addUnique(topics, topic);
      }
    }
  }
  return { questions: questions.slice(-MAX_SUMMARY_QUESTIONS), topics: topics.slice(-MAX_SUMMARY_TOPICS) };
}

/** The summary as one paragraph for a prompt, within SUMMARY_MAX_CHARS ("" when there is nothing to say). */
export function renderSummary(summary: ConversationSummary | undefined): string {
  if (!summary) return "";
  let questions = [...summary.questions];
  let topics = [...summary.topics];
  const render = (): string => {
    const parts: string[] = [];
    if (questions.length > 0) parts.push(`The patient earlier asked: ${questions.map((q) => `"${q}"`).join("; ")}.`);
    if (topics.length > 0) parts.push(`Already explained: ${topics.join("; ")}.`);
    return parts.join(" ");
  };
  // Drop the oldest questions first, then the oldest topics, until it fits
  while (render().length > SUMMARY_MAX_CHARS && (questions.length > 0 || topics.length > 0)) {
    if (questions.length > 0) questions = questions.slice(1);
    else topics = topics.slice(1);
  }
  return render();
}

/** An earlier message as the model sees it: control characters are cleaned elsewhere, the length is capped here. */
export function capHistoryMessage(text: string): string {
  return text.length <= MAX_HISTORY_MESSAGE_CHARS ? text : `${text.slice(0, MAX_HISTORY_MESSAGE_CHARS - 1).trimEnd()}…`;
}
