import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import { embedOllama, resolveOllamaConfig } from "./lib/ollama";
import { buildDocs, contentHash, staleDocIds } from "./lib/rag";
import { knowledgeFor } from "./lib/knowledge";
import { DOCUMENT_PREFIX } from "./lib/ragConfig";
import { LlmError } from "./lib/llm";

const vKind = v.union(v.literal("structure"), v.literal("step"), v.literal("knowledge"));

/** How many texts are embedded per request to the local embedding model. */
const EMBED_BATCH = 16;

const vDocWithEmbedding = v.object({
  docId: v.string(),
  kind: vKind,
  structureId: v.optional(v.string()),
  procedureSlug: v.optional(v.string()),
  stepIndex: v.optional(v.number()),
  title: v.string(),
  text: v.string(),
  embedding: v.array(v.float64()),
});

/** Inserts or replaces documents by `docId`, so indexing can be repeated safely. */
export const upsertDocs = internalMutation({
  args: { docs: v.array(vDocWithEmbedding) },
  returns: v.number(),
  handler: async (ctx, args) => {
    for (const doc of args.docs) {
      const existing = await ctx.db
        .query("medicalDocs")
        .withIndex("by_doc_id", (q) => q.eq("docId", doc.docId))
        .unique();
      if (existing) await ctx.db.replace("medicalDocs", existing._id, doc);
      else await ctx.db.insert("medicalDocs", doc);
    }
    return args.docs.length;
  },
});

/** Reads documents (without their embeddings) in the order of the given ids. Missing ids are skipped. */
export const getDocs = internalQuery({
  args: { ids: v.array(v.id("medicalDocs")) },
  returns: v.array(
    v.object({
      docId: v.string(),
      kind: vKind,
      structureId: v.optional(v.string()),
      title: v.string(),
      text: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = [];
    for (const id of args.ids) {
      const doc = await ctx.db.get("medicalDocs", id);
      if (!doc) continue;
      docs.push({
        docId: doc.docId,
        kind: doc.kind,
        ...(doc.structureId ? { structureId: doc.structureId } : {}),
        title: doc.title,
        text: doc.text,
      });
    }
    return docs;
  },
});

/** How long a started rebuild blocks another one. After this, a rebuild that never finished is tried again. */
const REINDEX_LOCK_MS = 10 * 60 * 1000;

/** The fingerprint the index was last built from, or null when it was never built. */
export const indexedHash = internalQuery({
  args: { procedureSlug: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("indexState")
      .withIndex("by_procedure_slug", (q) => q.eq("procedureSlug", args.procedureSlug))
      .unique();
    return state ? state.hash : null;
  },
});

/**
 * Called when the content no longer matches the index. Starts one rebuild in the background and returns true,
 * unless the index is already up to date or a rebuild was started a moment ago.
 */
export const claimReindex = internalMutation({
  args: { procedureSlug: v.string(), hash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("indexState")
      .withIndex("by_procedure_slug", (q) => q.eq("procedureSlug", args.procedureSlug))
      .unique();
    const now = Date.now();
    if (state?.hash === args.hash) return false;
    if (state?.startedAt !== undefined && now - state.startedAt < REINDEX_LOCK_MS) return false;
    if (state) await ctx.db.patch("indexState", state._id, { startedAt: now });
    else await ctx.db.insert("indexState", { procedureSlug: args.procedureSlug, hash: "", indexedAt: 0, startedAt: now });
    await ctx.scheduler.runAfter(0, internal.rag.refreshIndex, { procedureSlug: args.procedureSlug });
    return true;
  },
});

/** Remembers what the index was built from and clears the "rebuild started" mark. */
export const saveIndexState = internalMutation({
  args: { procedureSlug: v.string(), hash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("indexState")
      .withIndex("by_procedure_slug", (q) => q.eq("procedureSlug", args.procedureSlug))
      .unique();
    const fields = { procedureSlug: args.procedureSlug, hash: args.hash, indexedAt: Date.now() };
    if (state) await ctx.db.replace("indexState", state._id, fields);
    else await ctx.db.insert("indexState", fields);
    return null;
  },
});

/** Deletes the snippets that the content no longer has. Returns how many were deleted. */
export const pruneDocs = internalMutation({
  args: { procedureSlug: v.string(), keep: v.array(v.string()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const stored = await ctx.db.query("medicalDocs").take(2000);
    const stale = new Set(staleDocIds(stored, new Set(args.keep), args.procedureSlug));
    let removed = 0;
    for (const doc of stored) {
      if (stale.has(doc.docId)) {
        await ctx.db.delete("medicalDocs", doc._id);
        removed++;
      }
    }
    return removed;
  },
});

/**
 * Builds the vector index for one procedure: every part, step, and knowledge fact becomes a snippet that is
 * embedded with the local embedding model, and snippets that the content no longer has are deleted.
 * It runs by itself after `seed:run` and when a question finds that the content changed, so it rarely needs to be
 * run by hand. To run it yourself:
 *   npx convex run rag:indexContent '{"procedureSlug":"tavr"}'
 * It needs Ollama running with the embedding model installed (ollama pull nomic-embed-text).
 */
export const indexContent = internalAction({
  args: { procedureSlug: v.string() },
  returns: v.object({ indexed: v.number(), removed: v.number() }),
  handler: async (ctx, args) => {
    return await buildIndex(ctx, args.procedureSlug);
  },
});

/**
 * The same as `indexContent`, for the background: a failure (for example Ollama is not running) is logged in one
 * line instead of ending as an error, and the next question or seed tries again.
 */
export const refreshIndex = internalAction({
  args: { procedureSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const { indexed, removed } = await buildIndex(ctx, args.procedureSlug);
      console.log(`[index] rebuilt: ${indexed} snippets, ${removed} removed`);
    } catch (error) {
      console.log("[index] could not rebuild the index; will try again later:", String(error instanceof Error ? error.message : error));
    }
    return null;
  },
});

async function buildIndex(ctx: ActionCtx, procedureSlug: string): Promise<{ indexed: number; removed: number }> {
  const data = await ctx.runQuery(internal.chatContext.get, {
    procedureSlug,
    stepIndex: 0,
    selectedStructureId: null,
  });
  if (!data) throw new Error(`Unknown procedure: ${procedureSlug}`);

  const config = resolveOllamaConfig(env);
  const docs = buildDocs({ ...data, knowledge: knowledgeFor(procedureSlug) });
  const hash = contentHash(docs);
  let indexed = 0;
  try {
    for (let i = 0; i < docs.length; i += EMBED_BATCH) {
      const batch = docs.slice(i, i + EMBED_BATCH);
      const embeddings = await embedOllama({
        config,
        input: batch.map((d) => `${DOCUMENT_PREFIX}${d.embedText ?? d.text}`),
      });
      indexed += await ctx.runMutation(internal.rag.upsertDocs, {
        docs: batch.map((d, j) => ({
          docId: d.docId,
          kind: d.kind,
          ...(d.structureId ? { structureId: d.structureId } : {}),
          ...(d.procedureSlug ? { procedureSlug: d.procedureSlug } : {}),
          ...(d.stepIndex !== undefined ? { stepIndex: d.stepIndex } : {}),
          title: d.title,
          text: d.text,
          embedding: embeddings[j] ?? [],
        })),
      });
    }
  } catch (error) {
    // Give a readable message in the terminal instead of a stack trace
    if (error instanceof LlmError) throw Object.assign(new Error(`${error.code}: ${error.message}`), { cause: error });
    throw error;
  }
  // Only after every snippet was stored: drop what is gone and remember what the index now holds
  const removed = await ctx.runMutation(internal.rag.pruneDocs, { procedureSlug, keep: docs.map((d) => d.docId) });
  await ctx.runMutation(internal.rag.saveIndexState, { procedureSlug, hash });
  return { indexed, removed };
}
