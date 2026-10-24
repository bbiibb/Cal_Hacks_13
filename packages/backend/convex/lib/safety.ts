import { buildDocs } from "./rag";
import type { PromptData } from "./chatPrompt";
import { contentWords } from "./text";

export { contentWords };

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
      "I can't give advice about medicines, including whether to take, stop, or change them. Please ask your doctor or pharmacist, and do not stop or change any medicine unless your care team tells you to. I can explain how the procedure works if that helps.",
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
    "\\bam i\\s+(too\\s+\\w+|a\\s+(good\\s+|suitable\\s+)?candidate|eligible|suitable|healthy enough|fit enough)\\b",
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
  // A ruling on this patient's own suitability is the doctor's decision
  /\byou\s+(may |might |could |probably |likely )?(be|are)\s+(too\s+(young|old|sick|frail)|(a\s+)?(good|suitable|poor)\s+candidate|not\s+(a\s+)?(suitable|good|eligible)|eligible|ineligible)\b/i,
];

/**
 * "Do not stop or change any medicine unless your care team tells you to" is the safe message our content
 * itself gives, and must not be mistaken for advice to stop. Only this exact kind of sentence is let through:
 * a prohibition, together with a pointer to the care team.
 */
const SAFE_MEDICINE_CAUTION =
  /\b(do not|don'?t|never)\b[^.?!]*\b(stop|change|skip|take|start)\b[^.?!]*\b(unless|until|without)\b[^.?!]*\b(care team|doctor|physician|pharmacist|healthcare (professional|provider)|medical team|heart team)\b[^.?!]*[.?!]?/gi;

/** True when an answer gives personal medical instructions, a diagnosis, or a dose. */
export function containsMedicalAdvice(answer: string): boolean {
  const withoutCautions = answer.replace(SAFE_MEDICINE_CAUTION, " ");
  return ADVICE_IN_ANSWER.some((p) => p.test(withoutCautions));
}

// --- 3. Grounding check: is the answer backed by our content? ---------------------------------

/** A number as written, with the unit that goes with it: "3% to 8%", "1 to 2 days", "30-day". */
export interface NumberFact {
  /** The number as shown, with "%" when it is a percentage */
  text: string;
  value: string;
  /** "%" or the stemmed word after the number ("day", "year"); "" when none */
  unit: string;
}

const RANGE_JOINER = /^\s*(?:to|and|or|through|-|–)\s*$/i;

/**
 * Finds the numbers in a text together with their units. A number only counts as known when the same number
 * appears with the same unit in our content: "8 pm" is not the "8%" of the material, and "20 to 30 years" is
 * not made true by a "20%" and a "30-day" elsewhere.
 */
export function numberFacts(text: string): NumberFact[] {
  const clean = text.replace(/(\d)\s*percent\b/gi, "$1%");
  const found = [...clean.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => ({
    value: m[0].replace(",", "."),
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    unit: "",
    shown: m[0],
  }));
  // From the right, so that "3 to 8%" can take the unit of the 8
  for (let i = found.length - 1; i >= 0; i--) {
    const f = found[i]!;
    const rest = clean.slice(f.end);
    if (/^\+?\s?%/.test(rest)) {
      f.unit = "%";
      f.shown = `${f.shown}%`;
      continue;
    }
    const next = found[i + 1];
    const joinedToNext = next ? RANGE_JOINER.test(clean.slice(f.end, next.start)) : false;
    const word = rest.match(/^\+?[\s-]*([A-Za-z]+)/)?.[1]?.toLowerCase();
    if (word && !["to", "and", "or", "through"].includes(word)) f.unit = word.length > 3 ? word.replace(/s$/, "") : word;
    else if (next && joinedToNext) f.unit = next.unit;
    if (f.unit === "%" && !f.shown.endsWith("%")) f.shown = `${f.shown}%`;
  }
  return found.map((f) => ({ text: f.shown, value: f.value, unit: f.unit }));
}

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
  const known = numberFacts(`${sources.join(" ")} ${question}`);
  const knownPairs = new Set(known.map((n) => `${n.value}|${n.unit}`));
  const knownValues = new Set(known.map((n) => n.value));

  const answerWords = [...new Set(contentWords(answer))];
  const novelWords = answerWords.filter((w) => !knownWords.has(w));

  // "Step 3" in the answer refers to our own step list, so those numbers are fine
  const withoutSteps = answer.replace(/\bsteps?\s+\d+/gi, " ");
  const ungroundedNumbers = [
    ...new Set(
      numberFacts(withoutSteps)
        // A number with a unit must be known with that unit; a bare number is known if it appears anywhere
        .filter((n) => !knownPairs.has(`${n.value}|${n.unit}`) && !(n.unit === "" && knownValues.has(n.value)))
        .map((n) => n.text),
    ),
  ];

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
 * Used when the model's answer cannot be trusted. A snippet is shown only if it clearly answers the question:
 * more than half of the question's meaningful words appear in it, and at least one of them is a distinctive word
 * (found in few snippets). A common word like "valve" or "hospital" alone never selects a snippet.
 */
export const MIN_DISTINCTIVE_WEIGHT = 0.45;

export function extractiveAnswer(
  data: PromptData,
  question: string,
): { message: string; structureId?: string; sourceTitle?: string } {
  const wanted = [...new Set(contentWords(question))];
  const docs = buildDocs(data).map((doc) => ({
    doc,
    words: new Set(contentWords(`${doc.title} ${doc.text}`)),
    titleWords: new Set(contentWords(doc.title)),
  }));

  // Rare words count more than common ones, scaled to 0..1 so the rule does not depend on how many snippets exist
  const weight = (word: string): number => {
    const df = docs.filter((d) => d.words.has(word)).length;
    return df === 0 || docs.length < 2 ? 0 : Math.log(docs.length / df) / Math.log(docs.length);
  };

  let best: { score: number; text: string; structureId?: string; sourceTitle?: string } | null = null;
  for (const { doc, words, titleWords } of docs) {
    const matched = wanted.filter((w) => words.has(w));
    if (wanted.length === 0 || matched.length / wanted.length <= 0.5) continue;
    const weights = matched.map(weight);
    if (Math.max(...weights) < MIN_DISTINCTIVE_WEIGHT) continue;
    // A word in the heading counts more: "Risk: stroke" answers a question about stroke better than a list that mentions it
    const score = matched.reduce((sum, w) => sum + weight(w) * (titleWords.has(w) ? 1.5 : 1), 0);
    if (!best || score > best.score) {
      best = {
        score,
        text: doc.text,
        structureId: doc.structureId ?? doc.relatedStructureIds?.[0],
        sourceTitle: doc.sourceTitle,
      };
    }
  }
  const base = "I don't have a reliable answer to that in the information I have.";
  if (!best) return { message: `${base} Please ask your care team.` };
  return {
    message: `${base} Here is what I can share: ${firstSentences(best.text, SNIPPET_MAX_CHARS)} Please ask your care team about anything else.`,
    structureId: best.structureId,
    sourceTitle: best.sourceTitle,
  };
}

/** The knowledge snippets are a few sentences long; the fallback shows only the first ones. */
export const SNIPPET_MAX_CHARS = 320;

/** Whole sentences from the start of a text, up to about `max` characters (at least one sentence). */
export function firstSentences(text: string, max: number): string {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  let result = "";
  for (const sentence of sentences) {
    if (result && result.length + sentence.length > max) break;
    result += sentence;
  }
  return result.trim();
}

// --- Percentages are group statistics --------------------------------------------------------------

export const GROUP_STATISTICS_NOTE = "These percentages describe groups of patients, not your personal risk.";

const MENTIONS_GROUP_NOT_PERSONAL = /\b(groups? of patients|not your (personal|own|individual)|personal risk|your own risk|your individual risk)\b/i;

/**
 * An answer that quotes a percentage always says it is a group statistic. This is added by rule, because a
 * small model forgets it, and a patient could read "about 2% to 5%" as a promise about themselves.
 */
export function withGroupStatisticsNote(answer: string): string {
  if (!/\d\s?%|\bpercent\b/i.test(answer)) return answer;
  if (MENTIONS_GROUP_NOT_PERSONAL.test(answer)) return answer;
  return `${answer.trim()} ${GROUP_STATISTICS_NOTE}`;
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

const RISK_TOPICS = /\b(side effects?|risks?|safe|safety|danger\w*|pain\w*|hurt\w*|complications?|recover\w*|symptoms?|after (the )?(procedure|surgery)|likel\w*|chances?|probab\w*|percent\w*|bleed\w*|stroke|death|dying|die|mortality|leak\w*|infect\w*)\b/i;

/** The standing reminder is added when the question is about risks or recovery. */
export function needsSafetyNote(question: string): boolean {
  return RISK_TOPICS.test(question);
}
