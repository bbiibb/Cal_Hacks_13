# 프론트-백엔드 계약

프론트엔드(`apps/frontend`)와 백엔드(`packages/backend`)가 주고받는 데이터의 단일 기준 문서입니다.
실제 정의는 `packages/shared/src` 의 zod 스키마이며, 이 문서는 그 요약과 규칙을 설명합니다.
**스키마를 바꾸면 이 문서도 같은 커밋에서 갱신하세요.** (`.claude/skills/contract-change` 참고)

## 1. 식별자

| 이름 | 규칙 | 예시 |
|---|---|---|
| `StructureId` | 소문자 snake_case 세그먼트를 `.` 로 이어 계층 표현. **GLB 메시 이름과 1:1로 일치** | `aorta`, `aortic_valve`, `aortic_valve.calcification` |
| `InstrumentId` | 소문자 snake_case | `grasper`, `clip_applier` |
| `ProcedureSlug` | 소문자 snake_case | `tavr` |

## 2. Scene (한 단계의 3D 장면 상태)

수술 과정은 영상이 아니라 단계(Step)별 Scene 데이터로 표현합니다.

```ts
Scene = {
  camera: { position: [x,y,z], target: [x,y,z], duration_ms: number },
  structures: { id: StructureId, opacity: 0..1, highlight: boolean }[],
  instruments: { id: InstrumentId, transform: { position, rotation(라디안, 오일러), scale } }[],
  animation_clip: { name: string, loop: boolean } | null,
}
```

- `structures` 에 없는 구조물은 프론트의 기본 상태(불투명, 강조 없음)로 취급합니다.
- Step = `{ index, title, scene, side_panel }`, Procedure = `{ slug, title, summary, steps[] }`.

## 3. SceneAction (챗봇이 3D 화면에 내리는 명령)

`type` 으로 구분되는 유니온입니다.

| type | 필드 | 의미 |
|---|---|---|
| `goto_step` | `procedure_slug`, `step_index` | 해당 단계로 이동 |
| `focus` | `structure_id`, `duration_ms?` | 카메라를 구조물로 이동 |
| `highlight` | `structure_ids[]`, `enabled` | 강조 켜기/끄기 |
| `set_opacity` | `structure_id`, `opacity` | 투명도 변경 |

백엔드는 LLM이 만든 scene_actions 중 **zod 스키마 검증과 DB 존재 여부 검증을 통과한 것만** 전달합니다.
프론트는 이 보장을 믿되, 알 수 없는 id 를 받으면 무시하고 콘솔에 경고를 남기는 방어 코드를 권장합니다.

## 4. ChatResponse

```ts
ChatResponse = {
  message: string,
  scene_actions: SceneAction[],
  side_panel: { title, body_markdown, related_structure_ids[] } | null,
  sources: { title: string, url: string | null }[],
}
```

의료 정보는 교육용이며, 근거가 없으면 모른다고 답합니다 (`sources` 가 비어 있을 수 있음).

## 5. 예시 데이터

`packages/shared/fixtures/` 에 계약을 따르는 더미 데이터가 있고, `pnpm test` 가 스키마 준수와 id 참조 무결성을 검증합니다.

- `structures.json`, `instruments.json`
- `procedure.tavr.json` (TAVR 4개 장면. 장면 계획과 3D 에셋 현황은 [`docs/tavr-demo.md`](tavr-demo.md))
- `chat-response.example.json`

모든 내용은 **교육용 더미**이며 실제 환자 데이터가 아닙니다.

## 6. 저장 형태 (Convex)

DB에는 계약과 같은 snake_case 키 형태로 `scene`, `sidePanel`, `sceneActions` 를 저장합니다
(`packages/backend/convex/validators.ts`). 테이블 최상위 필드만 camelCase 입니다.

> TODO: zod 스키마와 Convex validator 가 어긋나지 않았는지 확인하는 자동 검사(테스트) 추가.

## 변경 이력

| 날짜 | 변경 | 영향 |
|---|---|---|
| 2026-10-23 | 최초 초안 | - |
| 2026-10-23 | 1차 시연 주제를 TAVR 로 확정. fixtures 와 예시 id 교체 (스키마 형식은 변경 없음) | 프론트: 기존 `procedure.cholecystectomy.json` 참조를 `procedure.tavr.json` 으로 변경 |
