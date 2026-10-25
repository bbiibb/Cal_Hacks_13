import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { PromptData } from "./chatPrompt";
import { embedOllama, type OllamaConfig } from "./ollama";
import { QUERY_PREFIX } from "./ragConfig";
import { RETRIEVE_LIMIT, buildDocs, contentHash, docFromChunk, fuseRankings, keywordDocs, type RetrievedDoc } from "./rag";

/** Finds the snippets most similar to the question with Convex vector search. */
export async function vectorDocs(
  ctx: ActionCtx,
  config: OllamaConfig,
  data: PromptData,
  query: string,
  limit: number,
): Promise<RetrievedDoc[]> {
  const [vector] = await embedOllama({ config, input: [`${QUERY_PREFIX}${query}`] });
  if (!vector) return [];
  const hits = await ctx.vectorSearch("medicalDocs", "by_embedding", { vector, limit });
  if (hits.length === 0) return [];
  const stored = await ctx.runQuery(internal.rag.getDocs, { ids: hits.map((h) => h._id) });

  // The knowledge text always comes from our files, not from the index, so an old index cannot give old text
  const chunks = new Map((data.knowledge ?? []).map((c) => [`knowledge:${c.id}`, c]));
  const docs: RetrievedDoc[] = [];
  for (const doc of stored) {
    if (doc.kind !== "knowledge") {
      docs.push(doc);
      continue;
    }
    const chunk = chunks.get(doc.docId);
    if (chunk) docs.push(docFromChunk(chunk));
  }
  return docs;
}

/**
 * Finds the documents for a question by combining meaning (vector search) and exact words (keyword search).
 * If the vector search itself fails for a reason other than the local model being unavailable
 * (for example an empty index), the keyword results are still used.
 */
export async function retrieveDocs(
  ctx: ActionCtx,
  config: OllamaConfig,
  data: PromptData,
  query: string,
  limit = RETRIEVE_LIMIT,
  onVectorError: (error: unknown) => void = () => undefined,
): Promise<RetrievedDoc[]> {
  const keyword = keywordDocs(data, query, limit);
  let vector: RetrievedDoc[] = [];
  try {
    vector = await vectorDocs(ctx, config, data, query, limit);
  } catch (error) {
    onVectorError(error);
  }
  return fuseRankings([vector, keyword], limit);
}

/**
 * Checks that the vector index was built from the content as it is now. If it was not (the content changed after
 * the last build), a rebuild starts in the background; this question is still answered, with the keyword results
 * and the knowledge text, which always come straight from our files. Never fails a question.
 */
export async function ensureIndexFresh(ctx: ActionCtx, data: PromptData): Promise<void> {
  try {
    const hash = contentHash(buildDocs(data));
    const built = await ctx.runQuery(internal.rag.indexedHash, { procedureSlug: data.procedureSlug });
    if (built === hash) return;
    const started = await ctx.runMutation(internal.rag.claimReindex, { procedureSlug: data.procedureSlug, hash });
    if (started) console.log("[index] the content changed since the index was built; rebuilding it in the background");
  } catch (error) {
    console.log("[index] could not check the index:", String(error instanceof Error ? error.message : error));
  }
}
