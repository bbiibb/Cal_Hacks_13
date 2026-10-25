import { ProcedureSchema, StructureSchema } from '@cal-hacks/shared'
import procedureJson from '@cal-hacks/shared/fixtures/procedure.tavr.json'
import structuresJson from '@cal-hacks/shared/fixtures/structures.json'

/*
 * The TAVI walkthrough content: steps, scenes, and part descriptions.
 * Read from the shared fixtures (the same data the backend seeds), checked against the contract on load.
 * When the frontend reads from Convex, replace this with `api.procedures.getBySlug({ slug: "tavr" })`
 * and `api.structures.list`.
 */
export const TAVI_PROCEDURE = ProcedureSchema.parse(procedureJson)
export const TAVI_STRUCTURES = StructureSchema.array().parse(structuresJson)

const NAMES = new Map(TAVI_STRUCTURES.map((s) => [s.id, s.name_en]))

/** The display name of a part, or its id when the part is unknown. */
export function structureName(structureId: string): string {
  return NAMES.get(structureId) ?? structureId
}

const BY_ID = new Map(TAVI_STRUCTURES.map((s) => [s.id, s]))

/** Name and description of a part, or null when the part is unknown. */
export function structureInfo(structureId: string): { name: string; description: string } | null {
  const structure = BY_ID.get(structureId)
  return structure ? { name: structure.name_en, description: structure.description } : null
}
