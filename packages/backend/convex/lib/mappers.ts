import type { Infer } from "convex/values";
import type { Condition, Instrument, Step, Structure } from "@cal-hacks/shared";
import type {
  vCondition,
  vInstrument,
  vProcedureSummary,
  vStep,
  vStructure,
} from "../validators";

/**
 * Pure functions that convert between database documents (camelCase top-level fields) and the frontend contract (snake_case).
 * They do not touch the database, so they are easy to unit test.
 */

type StructureDoc = {
  structureId: string;
  nameEn: string;
  parentId?: string;
  description: string;
};

export function toStructure(doc: StructureDoc): Infer<typeof vStructure> {
  return {
    id: doc.structureId,
    name_en: doc.nameEn,
    parent_id: doc.parentId ?? null,
    description: doc.description,
  };
}

export function fromStructure(s: Structure): StructureDoc {
  const doc: StructureDoc = {
    structureId: s.id,
    nameEn: s.name_en,
    description: s.description,
  };
  // Convex does not treat undefined as a value, so the field is omitted instead of being null
  if (s.parent_id !== null) doc.parentId = s.parent_id;
  return doc;
}

type InstrumentDoc = {
  instrumentId: string;
  nameEn: string;
  description: string;
};

export function toInstrument(doc: InstrumentDoc): Infer<typeof vInstrument> {
  return {
    id: doc.instrumentId,
    name_en: doc.nameEn,
    description: doc.description,
  };
}

export function fromInstrument(i: Instrument): InstrumentDoc {
  return {
    instrumentId: i.id,
    nameEn: i.name_en,
    description: i.description,
  };
}

type ConditionDoc = {
  slug: string;
  nameEn: string;
  description: string;
};

export function toCondition(doc: ConditionDoc): Infer<typeof vCondition> {
  return {
    slug: doc.slug,
    name_en: doc.nameEn,
    description: doc.description,
  };
}

export function fromCondition(c: Condition): ConditionDoc {
  return {
    slug: c.slug,
    nameEn: c.name_en,
    description: c.description,
  };
}

type StepDoc = {
  index: number;
  title: string;
  shortTitle?: string;
  scene: Infer<typeof vStep>["scene"];
  sidePanel: Infer<typeof vStep>["side_panel"];
};

export function toStep(doc: StepDoc): Infer<typeof vStep> {
  return {
    index: doc.index,
    title: doc.title,
    // Documents saved earlier may not have shortTitle, so title is used instead
    short_title: doc.shortTitle ?? doc.title,
    scene: doc.scene,
    side_panel: doc.sidePanel,
  };
}

export function fromStep(s: Step): StepDoc {
  return {
    index: s.index,
    title: s.title,
    shortTitle: s.short_title,
    scene: s.scene,
    sidePanel: s.side_panel,
  };
}

export function toProcedureSummary(doc: {
  slug: string;
  title: string;
  summary: string;
  conditionSlug?: string;
  order?: number;
}): Infer<typeof vProcedureSummary> {
  return {
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    condition_slug: doc.conditionSlug ?? null,
    order: doc.order ?? 0,
  };
}
