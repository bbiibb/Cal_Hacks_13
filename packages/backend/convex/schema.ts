import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { EMBEDDING_DIMENSIONS } from "./lib/ragConfig";
import { vScene, vSceneAction, vSidePanel, vSource, vVec3 } from "./validators";

export default defineSchema({
  // Anatomical structures. structureId is the shared key that matches a GLB mesh name one to one.
  structures: defineTable({
    structureId: v.string(),
    nameEn: v.string(),
    parentId: v.optional(v.string()), // structureId of the parent
    description: v.string(),
  })
    .index("by_structure_id", ["structureId"])
    .index("by_parent_id", ["parentId"]),

  // Surgical instruments
  instruments: defineTable({
    instrumentId: v.string(),
    nameEn: v.string(),
    description: v.string(),
  }).index("by_instrument_id", ["instrumentId"]),

  // Heart conditions. A new condition only needs a new row in this table (no code change).
  conditions: defineTable({
    slug: v.string(),
    nameEn: v.string(),
    description: v.string(),
  }).index("by_slug", ["slug"]),

  // Procedures. conditionSlug and order are optional so that older documents stay valid.
  procedures: defineTable({
    slug: v.string(),
    title: v.string(),
    summary: v.string(),
    conditionSlug: v.optional(v.string()),
    order: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_condition_slug_and_order", ["conditionSlug", "order"]),

  // Procedure steps: represented as a 3D scene state per step, not as a video.
  steps: defineTable({
    procedureId: v.id("procedures"),
    index: v.number(), // starts at 0
    title: v.string(),
    shortTitle: v.optional(v.string()), // label for the timeline; title is used when missing
    scene: vScene,
    sidePanel: vSidePanel,
  }).index("by_procedure_and_index", ["procedureId", "index"]),

  // Annotations (label and explanation) attached to a structure
  annotations: defineTable({
    structureId: v.string(),
    stepId: v.optional(v.id("steps")),
    label: v.string(),
    body: v.string(),
    position: v.optional(vVec3),
  })
    .index("by_structure_id", ["structureId"])
    .index("by_step_id", ["stepId"]),

  // Chatbot conversation sessions (an anonymous key made by the client is used until authentication exists)
  chatSessions: defineTable({
    clientSessionId: v.string(),
    procedureSlug: v.optional(v.string()),
    currentStepIndex: v.optional(v.number()),
    // When the patient last asked something. Conversations idle for too long are deleted (see crons.ts)
    lastActiveAt: v.optional(v.number()),
    // Older messages, shortened by rules (lib/chatSummary.ts), after the originals were deleted
    summary: v.optional(v.object({ questions: v.array(v.string()), topics: v.array(v.string()) })),
  })
    .index("by_client_session_id", ["clientSessionId"])
    .index("by_last_active_at", ["lastActiveAt"]),

  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    // Assistant messages only: only items that passed validation are stored and delivered
    sceneActions: v.optional(v.array(vSceneAction)),
    sidePanel: v.optional(vSidePanel),
    sources: v.optional(v.array(vSource)),
  }).index("by_session_id", ["sessionId"]),

  // What the vector index was last built from, so a change in the content is noticed (see rag.ts)
  indexState: defineTable({
    procedureSlug: v.string(),
    // Fingerprint of the content the index was built from (lib/rag.ts contentHash)
    hash: v.string(),
    indexedAt: v.number(),
    // Set while a rebuild has been started and not finished, so one change starts one rebuild
    startedAt: v.optional(v.number()),
  }).index("by_procedure_slug", ["procedureSlug"]),

  // Text snippets for retrieval (RAG), each with an embedding for vector search.
  // Used by the local pipeline (LLM_PROVIDER=local). Filled by `npx convex run rag:indexContent`.
  medicalDocs: defineTable({
    docId: v.string(), // stable key, for example "structure:aortic_valve", "step:tavr:2" or "knowledge:risk.stroke"
    kind: v.union(v.literal("structure"), v.literal("step"), v.literal("knowledge")),
    structureId: v.optional(v.string()),
    procedureSlug: v.optional(v.string()),
    stepIndex: v.optional(v.number()),
    title: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_doc_id", ["docId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: EMBEDDING_DIMENSIONS,
      filterFields: ["kind"],
    }),
});
