---
name: chat-action-validation
description: 챗봇의 새 scene_action 타입을 추가하거나 LLM 출력(scene_actions) 검증 규칙을 바꿀 때의 절차. zod 검증과 DB 존재 여부 검증을 항상 함께 유지한다.
---

# scene_action / LLM 출력 검증 절차

원칙: **LLM이 만든 scene_actions는 (1) zod 스키마 검증, (2) DB 존재 여부 검증을 모두 통과한 것만 프론트로 전달한다.** 실패한 항목은 버리고 로그를 남긴다.

## 새 action 타입을 추가할 때
1. 계약 변경이므로 먼저 `contract-change` skill의 절차를 따른다 (`packages/shared`의 `SceneActionSchema` 유니온에 추가).
2. `packages/backend/convex/validators.ts`의 `vSceneAction`에 같은 형태를 추가한다.
3. **DB 존재 검증 규칙을 정의한다**: 이 action이 참조하는 id가 무엇이고(structure_id, instrument_id, procedure_slug+step_index 등) 어떤 테이블/인덱스로 확인할지 정한다.
4. 검증 함수에 반영한다. 검증은 `internalQuery`로 DB를 조회하고, LLM을 호출하는 `action`에서 그 결과로 필터링한다.
5. 테스트를 추가한다: 통과 케이스 / 알 수 없는 type / 존재하지 않는 id / 범위 밖 값(opacity, step_index) / 빈 배열.
6. fixtures(`chat-response.example.json`)와 `docs/contracts.md`를 갱신한다.

## 검증 규칙을 바꿀 때
- 규칙을 **느슨하게** 하는 변경(검증 제거/완화)은 이유를 적고 사용자 승인을 받는다.
- 프롬프트에서 허용 action 목록·id 목록을 LLM에 알려주더라도, 서버 검증은 그대로 둔다 (프롬프트는 안전장치가 아니다).
- LLM 출력 파싱 실패 시 동작: `scene_actions: []`로 대체하고 `message`만 안전하게 전달한다.

## 응답 규칙
- 근거(sources)가 없는 의료 정보는 단정하지 않고 모른다고 답한다. 교육용임을 유지한다.
- 프론트로 가는 최종 `ChatResponse`는 항상 `ChatResponseSchema.parse`를 통과해야 한다.

## 검증
- `pnpm typecheck && pnpm test && pnpm lint`
- 프론트 영향이 있으면 `contract-change`의 "프론트 전달용 변경 요약"을 출력한다.
