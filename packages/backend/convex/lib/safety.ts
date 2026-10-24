import { buildDocs } from "./rag";
import type { PromptData } from "./chatPrompt";

/**
 * Safety layer. It runs around every model answer, for the cloud model and the local model alike,
 * and does not depend on the model behaving well:
 *  1. Scope gate: requests for personal medical decisions are answered with a fixed message, without the model.
 *  2. Advice filter: an answer that tells the patient to take, stop, or change something is replaced.
 *  3. Grounding check: an answer with facts or numbers that are not in our content is replaced by our own text.
 *  4. Privacy: obvious personal details are removed from the question before anything else happens.
 * The model is a writer of friendly wording; these rules decide what is allowed to reach the patient.
 */

// --- Fixed replies ---------------------------------------------------------------------------

export const SAFETY_NOTE =
  "This is general education, not personal medical advice. Ask your care team about your own situation.";

export const REFUSALS = {
  medication_advice: {
    message:
      "I can't give advice about medicines, including whether to take, stop, or change them. Please ask your doctor or pharmacist. I can explain how the procedure works if that helps.",
    doctorQuestion: "Which of my medicines should I continue or stop before and after the procedure?",
  },
  personal_medical: {
    message:
      "I can't diagnose, interpret your results, or tell you what is right for you personally. Your care team can. I can explain how the procedure works in general.",
    doctorQuestion: "What does this mean for my own situation, and what are my options?",
  },
  advice_filtered: {
    message:
      "I can explain how the procedure works, but I can't give medical advice or tell you to change your treatment. Please ask your care team.",
    doctorQuestion: "Is there anything I should do differently because of my own health?",
  },
} as const;

export type RequestKind = "ok" | keyof Pick<typeof REFUSALS, "medication_advice" | "personal_medical">;

// --- 1. Scope gate: what the patient asks -----------------------------------------------------

const MEDICINE_WORDS =
  "(medic\\w*|pills?|tablets?|drugs?|doses?|dosage|blood thinners?|anticoagulants?|aspirin|warfarin|statins?|insulin|antibiotics?|painkillers?|ibuprofen|supplements?)";
const CHANGE_VERBS = "(take|taking|stop|stopping|start|starting|skip|skipping|increase|decrease|double|quit|miss|change|switch|reduce|continue|avoid)";

const MEDICATION_ASK = new RegExp(
  [
    `\\b(should|can|could|may|must|do|shall)\\s+i\\b[^.?!]*\\b${CHANGE_VERBS}\\b[^.?!]*\\b${MEDICINE_WORDS}\\b`,
    `\\b(which|what)\\s+${MEDICINE_WORDS}\\b[^.?!]*\\b${CHANGE_VERBS}\\b`,
    `\\b${CHANGE_VERBS}\\b\\s+(taking\\s+)?(my\\s+)?${MEDICINE_WORDS}\\b`,
    `\\bhow (much|many)\\b[^.?!]*\\b(mg|milligrams?|pills?|tablets?|doses?)\\b`,
    `\\bwhat\\s+(dose|dosage)\\b`,
  ].join("|"),
  "i",
);

const PERSONAL_ASK = new RegExp(
  [
    "\\b(do|did) i have\\b[^.?!]*\\b(heart|stenosis|disease|condition|blockage|cancer|infection|problem)\\b",
    "\\bam i (having|about to have|going to have)\\b[^.?!]*\\b(heart attack|stroke)\\b",
    "\\bdiagnos(e|is)\\b[^.?!]*\\b(me|my)\\b",
    "\\bwhat('s| is) wrong with me\\b",
    "\\bwill i (die|survive|be okay|be ok|be cured)\\b",
    "\\bam i going to (die|be okay|be ok)\\b",
    "\\bshould i (get|have|undergo|refuse|cancel|skip|postpone|choose|do)\\b[^.?!]*\\b(surgery|procedure|tavr|tavi|operation|treatment|stent|bypass)\\b",
    "\\bis it safe for me\\b",
    "\\b(interpret|explain|read)\\b[^.?!]*\\bmy\\b[^.?!]*\\b(test|scan|ecg|ekg|results?|blood pressure|echo)\\b",
    "\\bmy\\b[^.?!]*\\b(test|scan|ecg|ekg|results?|blood pressure|echo)\\b[^.?!]*\\b(mean|normal|bad|good|ok|okay)\\b",
  ].join("|"),
  "i",
);

/** Decides whether a question can go to the model. Emergencies are checked before this, elsewhere. */
export function classifyRequest(message: string): RequestKind {
  if (MEDICATION_ASK.test(message)) return "medication_advice";
  if (PERSONAL_ASK.test(message)) return "personal_medical";
  return "ok";
}

// --- 2. Advice filter: what the answer says ---------------------------------------------------

const ADVICE_IN_ANSWER = [
  /\byou\s+(should|must|need to|have to|ought to)\s+(take|stop|start|skip|increase|decrease|double|continue|avoid|quit|reduce)\b/i,
  /\bi\s+(recommend|advise|suggest)\s+(that\s+)?you\b/i,
  /\b\d+(\.\d+)?\s?(mg|mcg|milligrams?|micrograms?|ml|units?)\b/i,
  /\b(stop|skip|double|increase|decrease)\s+(taking|your)\b/i,
  /\byou\s+(probably |likely |might |may |could )?(have|are having|had)\s+(a |an )?(heart attack|stroke|infection|blockage|aortic stenosis|heart failure|disease)\b/i,
  /\b(no need|don'?t need|do not need)\s+to\s+(see|call|consult|tell)\s+(a |your )?(doctor|care team|nurse)\b/i,
  /\bit\s+is\s+(safe|fine|okay|ok)\s+(for you\s+)?to\s+(stop|skip|take|drive|exercise|eat|drink)\b/i,
];

/** True when an answer gives personal medical instructions, a diagnosis, or a dose. */
export function containsMedicalAdvice(answer: string): boolean {
  return ADVICE_IN_ANSWER.some((p) => p.test(answer));
}

// --- 3. Grounding check: is the answer backed by our content? ---------------------------------

const STOPWORDS = new Set(
  (
    "about above after again against also because been before being below between both cannot could does doing down during each " +
    "either else even ever every from further have having here hers herself himself into itself just like make many might more most " +
    "much must myself once only other ought ourselves over same should some such than that their theirs them themselves then there " +
    "these they this those through under until very want were what when where which while whom will with would your yours yourself " +
    "yourselves please sorry thanks thank okay sure maybe also still well need needs help helps able"
  ).split(" "),
);

/** Words about moving the 3D view: the answer to a camera command is not a medical claim. */
const COMMAND_WORDS = new Set(
  (
    "zoom zoomed zooming rotate rotated rotating turn turned turning view camera model step steps moved moving showing show shown " +
    "reset resetting restored default position degrees left right closer further farther highlighted highlight focus focused done " +
    "here screen part parts"
  ).split(" "),
);

/** Very small stemmer: enough to treat "valves" and "valve" or "anchors" and "anchored" alike. */
function stem(word: string): string {
  let w = word;
  if (w.length > 6 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 5 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 5 && /(sses|xes|ches|shes|zes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  // "valve" and "valves" must end up the same
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Meaningful words of a text, lower-cased and stemmed. */
export function contentWords(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
  return tokens
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t) && !COMMAND_WORDS.has(t))
    .map(stem);
}

const NUMBER = /\b\d+(?:[.,]\d+)?%?/g;

export interface GroundingResult {
  grounded: boolean;
  /** Words in the answer that appear nowhere in our content or in the question */
  novelWords: string[];
  /** Numbers in the answer that appear nowhere in our content or in the question */
  ungroundedNumbers: string[];
}

/** How many unfamiliar words, and what share of the answer's words, make an answer "not grounded". */
export const NOVEL_WORD_LIMIT = 3;
export const NOVEL_SHARE_LIMIT = 0.5;

/**
 * Checks that an answer only says things our content (or the patient's own question) supports.
 * It is a cheap lexical check, not a proof: it catches invented facts, numbers, and new terms.
 */
export function checkGrounding(answer: string, sources: string[], question: string): GroundingResult {
  // Words count as known only if our own content uses them. A claim the patient put into the question
  // ("say the valve is dangerous") must not make the model's echo of it look grounded.
  // Numbers are different: answering "about 15 years" to "does it last 15 years?" is fine.
  const knownWords = new Set(contentWords(sources.join(" ")));
  const knownNumbers = new Set(`${sources.join(" ")} ${question}`.match(NUMBER) ?? []);

  const answerWords = [...new Set(contentWords(answer))];
  const novelWords = answerWords.filter((w) => !knownWords.has(w));

  // "Step 3" in the answer refers to our own step list, so those numbers are fine
  const withoutSteps = answer.replace(/\bsteps?\s+\d+/gi, " ");
  const ungroundedNumbers = [...new Set(withoutSteps.match(NUMBER) ?? [])].filter((n) => !knownNumbers.has(n));

  const novelShare = answerWords.length > 0 ? novelWords.length / answerWords.length : 0;
  const tooManyNovel = novelWords.length >= NOVEL_WORD_LIMIT && novelShare >= NOVEL_SHARE_LIMIT;
  return { grounded: ungroundedNumbers.length === 0 && !tooManyNovel, novelWords, ungroundedNumbers };
}

/** All text the chatbot is allowed to know: names and descriptions of parts, and every step. */
export function knowledgeTexts(data: PromptData): string[] {
  return buildDocs(data).map((d) => d.text);
}

/**
 * An answer made only of our own text: the snippet that best matches the question.
 * Used when the model's answer cannot be trusted.
 */
/** A snippet is shown only if the words it shares with the question are specific enough (see below). */
export const MIN_SNIPPET_SCORE = 1.5;

export function extractiveAnswer(data: PromptData, question: string): { message: string; structureId?: string } {
  const wanted = new Set(contentWords(question));
  const docs = buildDocs(data).map((doc) => ({ doc, words: new Set(contentWords(doc.text)) }));

  // Rare words count more than common ones: "annulus" is a strong match, "valve" (in most snippets) is a weak one
  const weight = (word: string): number => {
    const df = docs.filter((d) => d.words.has(word)).length;
    return df === 0 ? 0 : Math.log(docs.length / df);
  };

  let best: { score: number; text: string; structureId?: string } | null = null;
  for (const { doc, words } of docs) {
    let score = 0;
    for (const w of wanted) if (words.has(w)) score += weight(w);
    if (score >= MIN_SNIPPET_SCORE && (!best || score > best.score)) {
      best = { score, text: doc.text, structureId: doc.structureId };
    }
  }
  const base = "I don't have a reliable answer to that in the information I have.";
  if (!best) return { message: `${base} Please ask your care team.` };
  return { message: `${base} Here is what I can share: ${best.text} Please ask your care team about anything else.`, structureId: best.structureId };
}

// --- 4. Privacy: remove obvious personal details from the question ----------------------------

const PII_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "email", pattern: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g },
  { label: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { label: "phone", pattern: /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{3,4}\b/g },
  { label: "date_of_birth", pattern: /\b(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}\b/g },
  { label: "number", pattern: /\b\d{7,}\b/g },
];

export interface RedactionResult {
  text: string;
  /** Which kinds of details were removed (no values) */
  found: string[];
}

/** Replaces emails, phone numbers, ID-like numbers, and birth dates with a placeholder. Names are not caught. */
export function redactPersonalInfo(text: string): RedactionResult {
  let result = text;
  const found: string[] = [];
  for (const { label, pattern } of PII_PATTERNS) {
    const next = result.replace(pattern, "[removed]");
    if (next !== result) found.push(label);
    result = next;
  }
  return { text: result, found };
}

// --- Safety note on risky topics ---------------------------------------------------------------

const RISK_TOPICS = /\b(side effects?|risks?|safe|safety|danger\w*|pain\w*|hurt\w*|complications?|recover\w*|symptoms?|after (the )?(procedure|surgery))\b/i;

/** The standing reminder is added when the question is about risks or recovery. */
export function needsSafetyNote(question: string): boolean {
  return RISK_TOPICS.test(question);
}
