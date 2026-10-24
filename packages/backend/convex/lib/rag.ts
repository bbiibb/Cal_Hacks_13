import type { PromptData } from "./chatPrompt";

/** A piece of text the local model may use to answer. */
export interface RetrievedDoc {
  docId: string;
  kind: "structure" | "step";
  structureId?: string;
  title: string;
  text: string;
}

/** A document before it is embedded and stored. */
export interface RagDocInput extends RetrievedDoc {
  procedureSlug?: string;
  stepIndex?: number;
}

/** How many documents the vector search returns. */
export const RETRIEVE_LIMIT = 4;
/** The most documents that go into one prompt (retrieved plus pinned ones). */
export const MAX_CONTEXT_DOCS = 6;

/** Turns the content of a procedure (parts and steps) into snippets for the vector index. */
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
  return [...structures, ...steps];
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

/** Part ids the model is allowed to highlight: the parts in the context documents. */
export function allowedStructureIds(docs: RetrievedDoc[]): string[] {
  const ids: string[] = [];
  for (const doc of docs) {
    if (doc.structureId && !ids.includes(doc.structureId)) ids.push(doc.structureId);
  }
  return ids;
}
