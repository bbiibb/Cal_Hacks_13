import knowledgeTavr from "@cal-hacks/shared/fixtures/knowledge.tavr.json";
import { KnowledgeChunkSchema, type KnowledgeChunk } from "@cal-hacks/shared";
import { stem } from "./text";

/**
 * The chatbot's reference material: short patient-education facts (packages/shared/fixtures/knowledge.*.json).
 * They are bundled with the backend, so the chatbot can use them without any database or embedding model;
 * the local pipeline additionally indexes them for vector search (see rag.ts).
 */
const ALL: KnowledgeChunk[] = KnowledgeChunkSchema.array().parse(knowledgeTavr);

/** The knowledge chunks of one procedure. */
export function knowledgeFor(procedureSlug: string): KnowledgeChunk[] {
  return ALL.filter((c) => c.procedure_slug === procedureSlug);
}

/** What is embedded and searched for a chunk: heading, the questions it answers, and the facts. */
export function chunkSearchText(chunk: KnowledgeChunk): string {
  return `${chunk.title}. ${chunk.questions.join(" ")} ${chunk.text}`;
}

// --- Keyword search (BM25) -----------------------------------------------------------------------
// Vector search is good at meaning, keyword search at exact terms ("pacemaker", "3%", "dentist").
// Using both means a question is found even when one of them misses, and the chatbot still finds
// knowledge when the embedding model is not available.

const QUERY_STOPWORDS = new Set(
  (
    "the and for are was were been being what whats does did how can could will would should you your yours with that this these those have has had " +
    "from about they them their when where which who whom why into than then also not but any get got its there here may might must shall tell " +
    "please want need know like just very much many some more most such only own same too out off over under again further once " +
    "of in to is it be an as at by or if my me we do so no on up us am"
  ).split(" "),
);

/** Search terms of a text: lower-case, stemmed, without very common words. */
export function searchTerms(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return tokens.filter((t) => t.length >= 2 && !QUERY_STOPWORDS.has(t)).map(stem);
}

const K1 = 1.2;
const B = 0.75;

interface IndexedChunk {
  chunk: KnowledgeChunk;
  tf: Map<string, number>;
  length: number;
  /** Every word of each example question, filler words included, for matching a question as a whole */
  questionSets: Set<string>[];
}

const wholeWords = (text: string): Set<string> => new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);

/** How alike two questions are as sets of words: 1 means the same words. */
function overlap(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** A patient who asks (nearly) one of the example questions gets that chunk first, even when the question has only one searchable word ("What is TAVR?"). */
const SAME_QUESTION_MIN_OVERLAP = 0.7;
const SAME_QUESTION_BONUS = 20;

/** Weighting: heading and keywords count double, because they name the topic of the chunk. */
function indexChunk(chunk: KnowledgeChunk): IndexedChunk {
  const terms = [
    ...searchTerms(chunk.title),
    ...searchTerms(chunk.title),
    ...chunk.keywords.flatMap((k) => searchTerms(k)),
    ...chunk.keywords.flatMap((k) => searchTerms(k)),
    ...chunk.questions.flatMap((q) => searchTerms(q)),
    ...searchTerms(chunk.text),
  ];
  const tf = new Map<string, number>();
  for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
  return { chunk, tf, length: terms.length, questionSets: chunk.questions.map(wholeWords) };
}

/** The chunks that best match a question, best first. Chunks with no matching term are left out. */
export function searchKnowledge(chunks: KnowledgeChunk[], query: string, limit: number): KnowledgeChunk[] {
  const queryTerms = [...new Set(searchTerms(query))];
  if (queryTerms.length === 0 || chunks.length === 0) return [];
  const asked = wholeWords(query);

  const indexed = chunks.map(indexChunk);
  const avgLength = indexed.reduce((n, d) => n + d.length, 0) / indexed.length;

  const scored = indexed.map((doc) => {
    let score = 0;
    for (const term of queryTerms) {
      const tf = doc.tf.get(term);
      if (!tf) continue;
      const df = indexed.filter((d) => d.tf.has(term)).length;
      const idf = Math.log(1 + (indexed.length - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * doc.length) / avgLength)));
    }
    const closest = Math.max(0, ...doc.questionSets.map((q) => overlap(asked, q)));
    if (score > 0 && closest >= SAME_QUESTION_MIN_OVERLAP) score += SAME_QUESTION_BONUS * closest;
    return { chunk: doc.chunk, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.chunk);
}
