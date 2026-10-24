import type { Infer } from "convex/values";
import type { Instrument, Step, Structure } from "@cal-hacks/shared";
import type {
  vInstrument,
  vProcedureSummary,
  vStep,
  vStructure,
} from "../validators";

/**
 * DB 문서(camelCase 최상위 필드)와 프론트 계약(snake_case)을 오가는 순수 함수들.
 * DB 접근이 없어서 단위 테스트가 쉽다.
 */

type StructureDoc = {
  structureId: string;
  nameEn: string;
  nameKo: string;
  parentId?: string;
  description: string;
};

export function toStructure(doc: StructureDoc): Infer<typeof vStructure> {
  return {
    id: doc.structureId,
    name_en: doc.nameEn,
    name_ko: doc.nameKo,
    parent_id: doc.parentId ?? null,
    description: doc.description,
  };
}

export function fromStructure(s: Structure): StructureDoc {
  const doc: StructureDoc = {
    structureId: s.id,
    nameEn: s.name_en,
    nameKo: s.name_ko,
    description: s.description,
  };
  // Convex 는 undefined 를 값으로 취급하지 않으므로 null 대신 필드를 생략한다
  if (s.parent_id !== null) doc.parentId = s.parent_id;
  return doc;
}

type InstrumentDoc = {
  instrumentId: string;
  nameEn: string;
  nameKo: string;
  description: string;
};

export function toInstrument(doc: InstrumentDoc): Infer<typeof vInstrument> {
  return {
    id: doc.instrumentId,
    name_en: doc.nameEn,
    name_ko: doc.nameKo,
    description: doc.description,
  };
}

export function fromInstrument(i: Instrument): InstrumentDoc {
  return {
    instrumentId: i.id,
    nameEn: i.name_en,
    nameKo: i.name_ko,
    description: i.description,
  };
}

type StepDoc = {
  index: number;
  title: string;
  scene: Infer<typeof vStep>["scene"];
  sidePanel: Infer<typeof vStep>["side_panel"];
};

export function toStep(doc: StepDoc): Infer<typeof vStep> {
  return {
    index: doc.index,
    title: doc.title,
    scene: doc.scene,
    side_panel: doc.sidePanel,
  };
}

export function fromStep(s: Step): StepDoc {
  return {
    index: s.index,
    title: s.title,
    scene: s.scene,
    sidePanel: s.side_panel,
  };
}

export function toProcedureSummary(doc: {
  slug: string;
  title: string;
  summary: string;
}): Infer<typeof vProcedureSummary> {
  return { slug: doc.slug, title: doc.title, summary: doc.summary };
}
