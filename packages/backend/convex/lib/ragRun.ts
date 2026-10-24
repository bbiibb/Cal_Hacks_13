import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { embedOllama, type OllamaConfig } from "./ollama";
import { RETRIEVE_LIMIT, type RetrievedDoc } from "./rag";

/** Finds the snippets most similar to the question with Convex vector search. */
export async function retrieveDocs(
  ctx: ActionCtx,
  config: OllamaConfig,
  query: string,
  limit = RETRIEVE_LIMIT,
): Promise<RetrievedDoc[]> {
  const [vector] = await embedOllama({ config, input: [query] });
  if (!vector) return [];
  const hits = await ctx.vectorSearch("medicalDocs", "by_embedding", { vector, limit });
  if (hits.length === 0) return [];
  return await ctx.runQuery(internal.rag.getDocs, { ids: hits.map((h) => h._id) });
}
