import { SceneActionSchema, type SceneAction } from "@cal-hacks/shared";

/** 한 응답에서 허용하는 scene_action 최대 개수. LLM 폭주 방지용 */
export const MAX_SCENE_ACTIONS = 10;

/** DB 존재 여부를 물어보는 인터페이스. 실제 구현은 ctx.db 를, 테스트는 가짜를 쓴다. */
export interface SceneActionLookup {
  structureExists(structureId: string): Promise<boolean>;
  stepExists(procedureSlug: string, stepIndex: number): Promise<boolean>;
}

export interface RejectedSceneAction {
  /** 입력 배열에서의 위치. 배열 자체가 잘못되면 -1 */
  index: number;
  reason: string;
}

export interface SceneActionValidationResult {
  accepted: SceneAction[];
  rejected: RejectedSceneAction[];
}

/**
 * LLM 이 만든 scene_actions 를 검증한다.
 * (1) zod 스키마 → (2) DB 존재 여부 순서로 확인하고, 둘 다 통과한 것만 accepted 에 담는다.
 * 실패한 항목은 버리고 reason 을 남긴다 (호출한 쪽에서 로그).
 * 한 action 안에 존재하지 않는 id 가 하나라도 있으면 그 action 전체를 거부한다.
 */
export async function validateSceneActions(
  raw: unknown,
  lookup: SceneActionLookup,
): Promise<SceneActionValidationResult> {
  if (!Array.isArray(raw)) {
    return {
      accepted: [],
      rejected: [{ index: -1, reason: "scene_actions 가 배열이 아님" }],
    };
  }

  const accepted: SceneAction[] = [];
  const rejected: RejectedSceneAction[] = [];

  for (const [index, item] of raw.entries()) {
    if (index >= MAX_SCENE_ACTIONS) {
      rejected.push({ index, reason: `최대 ${MAX_SCENE_ACTIONS}개 초과` });
      continue;
    }

    const parsed = SceneActionSchema.safeParse(item);
    if (!parsed.success) {
      rejected.push({ index, reason: `스키마 검증 실패: ${parsed.error.issues[0]?.message ?? "unknown"}` });
      continue;
    }

    const missing = await findMissingReference(parsed.data, lookup);
    if (missing) {
      rejected.push({ index, reason: missing });
      continue;
    }
    accepted.push(parsed.data);
  }

  return { accepted, rejected };
}

/** 존재하지 않는 참조가 있으면 사유 문자열을, 모두 존재하면 null 을 반환 */
async function findMissingReference(
  action: SceneAction,
  lookup: SceneActionLookup,
): Promise<string | null> {
  switch (action.type) {
    case "goto_step":
      return (await lookup.stepExists(action.procedure_slug, action.step_index))
        ? null
        : `존재하지 않는 단계: ${action.procedure_slug}#${action.step_index}`;
    case "focus":
    case "set_opacity":
      return (await lookup.structureExists(action.structure_id))
        ? null
        : `존재하지 않는 structure_id: ${action.structure_id}`;
    case "highlight":
      for (const id of action.structure_ids) {
        if (!(await lookup.structureExists(id))) {
          return `존재하지 않는 structure_id: ${id}`;
        }
      }
      return null;
  }
}
