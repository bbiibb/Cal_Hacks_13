import { z } from "zod";
import { ProcedureSlugSchema, StructureIdSchema } from "./ids";

/**
 * Knowledge base for the chatbot (RAG): short, self-contained facts about a procedure, written for patients.
 * One chunk answers one kind of question, with the answer first, so a small model can quote it.
 * The chunks are not shown in the UI as they are; the chatbot reads them and cites their titles in `sources`.
 */
export const KNOWLEDGE_TOPICS = [
  "overview", // what the procedure is and why it is done
  "condition", // the disease and its symptoms
  "candidacy", // who can have it and who cannot
  "anatomy", // the parts of the body involved
  "procedure", // how it is done, approaches
  "comparison", // compared with other treatments
  "instruments", // the tools and devices
  "risks", // complications, with group statistics
  "preparation", // before the procedure
  "recovery", // after the procedure, daily life
  "safety", // warning signs and when to call
] as const;
export const KnowledgeTopicSchema = z.enum(KNOWLEDGE_TOPICS);
export type KnowledgeTopic = z.infer<typeof KnowledgeTopicSchema>;

export const KnowledgeChunkSchema = z.object({
  /** Stable id, for example `risk.stroke`. Lower-case words joined with `.` or `_` */
  id: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, "Invalid knowledge id (example: risk.stroke)"),
  procedure_slug: ProcedureSlugSchema,
  topic: KnowledgeTopicSchema,
  /** Short heading. Shown as the source title when the chatbot uses this chunk */
  title: z.string().min(3).max(80),
  /** The patient-facing facts. Answer first. Keep percentages exactly as in the source document */
  text: z.string().min(40).max(900),
  /** Questions a patient might ask that this chunk answers. Used only to find the chunk */
  questions: z.array(z.string().min(5).max(120)).max(6),
  /** Extra search words (synonyms, abbreviations, everyday words) */
  keywords: z.array(z.string().min(2).max(40)).max(12),
  /** Parts of the 3D model this chunk is about; the chatbot may highlight them */
  structure_ids: z.array(StructureIdSchema).max(4),
  /** Name of the document the facts come from */
  source: z.string().min(3).max(80),
});
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;

/** The chunk as a source line for the chat reply */
export function knowledgeSourceTitle(chunk: Pick<KnowledgeChunk, "title" | "source">): string {
  return `${chunk.title} (${chunk.source})`;
}
