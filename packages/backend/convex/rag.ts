import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { embedOllama, resolveOllamaConfig } from "./lib/ollama";
import { buildDocs } from "./lib/rag";
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

/**
 * Builds the vector index for one procedure: every part, step, and knowledge fact becomes a snippet that is
 * embedded with the local embedding model. Run it after seeding or editing content:
 *   npx convex run rag:indexContent '{"procedureSlug":"tavr"}'
 * It needs Ollama running with the embedding model installed (ollama pull nomic-embed-text).
 */
export const indexContent = internalAction({
  args: { procedureSlug: v.string() },
  returns: v.object({ indexed: v.number() }),
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.chatContext.get, {
      procedureSlug: args.procedureSlug,
      stepIndex: 0,
      selectedStructureId: null,
    });
    if (!data) throw new Error(`Unknown procedure: ${args.procedureSlug}`);

    const config = resolveOllamaConfig(env);
    const docs = buildDocs({ ...data, knowledge: knowledgeFor(args.procedureSlug) });
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
    return { indexed };
  },
});
