import { knowledgeSourceTitle, type KnowledgeChunk } from "@cal-hacks/shared";
import type { PromptData } from "./chatPrompt";
import { chunkSearchText, searchKnowledge } from "./knowledge";
import { contentWords } from "./text";

/** A piece of text the model may use to answer. */
export interface RetrievedDoc {
  docId: string;
  kind: "structure" | "step" | "knowledge";
  /** The part this document describes (kind "structure") */
  structureId?: string;
  /** Parts of the 3D model this document is about (kind "knowledge") */
  relatedStructureIds?: string[];
  title: string;
  text: string;
  /** How to cite it in the reply (kind "knowledge") */
  sourceTitle?: string;
}

/** A document before it is embedded and stored. */
export interface RagDocInput extends RetrievedDoc {
  procedureSlug?: string;
  stepIndex?: number;
  /** What is embedded. Defaults to `text` */
  embedText?: string;
}

/** How many documents a question retrieves (after combining vector and keyword search). */
export const RETRIEVE_LIMIT = 4;
/** The most documents that go into one prompt (retrieved plus pinned ones). */
export const MAX_CONTEXT_DOCS = 6;
/** Knowledge facts added to the cloud prompt, which already lists every step and part. */
export const CLOUD_REFERENCE_LIMIT = 3;
/** Longest text of one document inside a prompt. The knowledge chunks are shorter than this. */
export const MAX_DOC_PROMPT_CHARS = 600;

export function docFromChunk(chunk: KnowledgeChunk): RagDocInput {
  return {
    docId: `knowledge:${chunk.id}`,
    kind: "knowledge",
    relatedStructureIds: chunk.structure_ids,
    title: chunk.title,
    text: chunk.text,
    sourceTitle: knowledgeSourceTitle(chunk),
    procedureSlug: chunk.procedure_slug,
    embedText: chunkSearchText(chunk),
  };
}

/** Turns the content of a procedure (parts, steps, and knowledge facts) into snippets for the index. */
export function buildDocs(data: PromptData): RagDocInput[] {
  const structures = data.structures.map<RagDocInput>((s) => ({
    docId: `structure:${s.id}`,
    kind: "structure",
    structureId: s.id,
    title: s.name,
    text: `${s.name}. ${s.description}`,
  }));
  const steps = data.steps.map<RagDocInput>((s) => ({
    docId: `step:${data.procedureSlug}:${s.index}`,
    kind: "step",
    procedureSlug: data.procedureSlug,
    stepIndex: s.index,
    title: s.title,
    text: `Step ${s.index + 1}: ${s.title}. ${s.summary}`,
  }));
  const knowledge = (data.knowledge ?? []).map(docFromChunk);
  return [...structures, ...steps, ...knowledge];
}

/** Documents that are always included: the step on screen and the part the patient selected. */
export function pinnedDocs(data: PromptData): RetrievedDoc[] {
  const docs: RetrievedDoc[] = [];
  const step = data.steps.find((s) => s.index === data.currentStepIndex);
  if (step) {
    docs.push({
      docId: `step:${data.procedureSlug}:${step.index}`,
      kind: "step",
      title: step.title,
      text: `Step ${step.index + 1}: ${step.title}. ${step.summary}`,
    });
  }
  const selected = data.selectedStructureId
    ? data.structures.find((s) => s.id === data.selectedStructureId)
    : undefined;
  if (selected) {
    docs.push({
      docId: `structure:${selected.id}`,
      kind: "structure",
      structureId: selected.id,
      title: selected.name,
      text: `${selected.name}. ${selected.description}`,
    });
  }
  return docs;
}

/** Pinned documents first, then search results, without duplicates, up to `max`. */
export function mergeDocs(pinned: RetrievedDoc[], found: RetrievedDoc[], max = MAX_CONTEXT_DOCS): RetrievedDoc[] {
  const seen = new Set<string>();
  const merged: RetrievedDoc[] = [];
  for (const doc of [...pinned, ...found]) {
    if (seen.has(doc.docId)) continue;
    seen.add(doc.docId);
    merged.push(doc);
    if (merged.length >= max) break;
  }
  return merged;
}

/**
 * Part ids the model is allowed to highlight: the parts in the context documents.
 * `existing` limits the list to parts that really exist in the 3D model.
 */
export function allowedStructureIds(docs: RetrievedDoc[], existing?: Set<string>): string[] {
  const ids: string[] = [];
  for (const doc of docs) {
    for (const id of [doc.structureId, ...(doc.relatedStructureIds ?? [])]) {
      if (id && !ids.includes(id) && (!existing || existing.has(id))) ids.push(id);
    }
  }
  return ids;
}

/** The text of a document as it goes into a prompt: whole, unless unusually long. */
export function promptText(doc: RetrievedDoc): string {
  const text = doc.text.replace(/\s+/g, " ").trim();
  return text.length <= MAX_DOC_PROMPT_CHARS ? text : `${text.slice(0, MAX_DOC_PROMPT_CHARS - 1).trimEnd()}…`;
}

// --- Search -------------------------------------------------------------------------------------

/** Keyword search over the knowledge facts of a procedure. Works without any model or database. */
export function keywordDocs(data: PromptData, query: string, limit = RETRIEVE_LIMIT): RetrievedDoc[] {
  return searchKnowledge(data.knowledge ?? [], query, limit).map(docFromChunk);
}

const RRF_K = 60;

/**
 * Combines several ranked lists (for example vector search and keyword search) into one.
 * Reciprocal rank fusion: a document that ranks well in more than one list comes first, and the scores
 * of the different searches never have to be compared with each other.
 */
export function fuseRankings(lists: RetrievedDoc[][], limit: number): RetrievedDoc[] {
  const scores = new Map<string, { doc: RetrievedDoc; score: number }>();
  for (const list of lists) {
    list.forEach((doc, rank) => {
      const entry = scores.get(doc.docId) ?? { doc, score: 0 };
      entry.score += 1 / (RRF_K + rank + 1);
      scores.set(doc.docId, entry);
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => e.doc);
}

/** A second cited source must share at least this fraction of words with the answer, compared with the best source. */
export const SECOND_SOURCE_MIN_SHARE = 0.9;

/** Matching words an answer must share with a document before that document is cited. */
export const MIN_SHARED_WORDS_FOR_SOURCE = 3;

/**
 * The knowledge documents an answer is based on, for the `sources` of the reply: those whose words
 * the answer actually uses (at least a few of them), best match first. The model is not asked to cite,
 * because a small model cites wrongly; the match is checked against our own text instead.
 */
export function pickSources(answer: string, docs: RetrievedDoc[], max = 2): { title: string; url: null }[] {
  const answerWords = new Set(contentWords(answer));
  let scored = docs
    .filter((d) => d.kind === "knowledge" && d.sourceTitle)
    .map((d) => ({ doc: d, shared: new Set(contentWords(d.text).filter((w) => answerWords.has(w))).size }))
    .filter((s) => s.shared >= MIN_SHARED_WORDS_FOR_SOURCE)
    .sort((a, b) => b.shared - a.shared);
  // A second source must be nearly as good a match as the first, so a passing mention is not cited
  const best = scored[0]?.shared ?? 0;
  scored = scored.filter((s) => s.shared >= best * SECOND_SOURCE_MIN_SHARE).slice(0, max);
  return scored.map((s) => ({ title: s.doc.sourceTitle as string, url: null }));
}
