# 백엔드 API (Convex)

프론트엔드가 지금 쓸 수 있는 Convex 함수 목록입니다. 데이터 형태는 [`docs/contracts.md`](contracts.md)의 계약(snake_case)을 따릅니다.
모두 **교육용 더미 데이터**를 돌려줍니다.

## 사용 방법

```ts
import { useQuery } from "convex/react";
import { api } from "@cal-hacks/backend/api";

const procedure = useQuery(api.procedures.getBySlug, { slug: "tavr" });
```

- `useQuery` 결과는 로딩 중에는 `undefined`, 데이터가 없으면 `null` 입니다.
- 배포 URL 은 환경변수(`.env.example` 참고)로 주입합니다.

## 읽기 query (public)

| 함수 | args | 반환 |
|---|---|---|
| `api.structures.list` | 없음 | `Structure[]` (id 순) |
| `api.structures.getById` | `{ id }` | `Structure \| null` |
| `api.instruments.list` | 없음 | `Instrument[]` |
| `api.procedures.list` | 없음 | `{ slug, title, summary }[]` |
| `api.procedures.getBySlug` | `{ slug }` | `{ slug, title, summary, steps: Step[] } \| null` (steps 는 index 순) |
| `api.procedures.getStep` | `{ slug, index }` | `Step \| null` |

`Structure`, `Instrument`, `Step` 은 `@cal-hacks/shared` 의 타입과 같은 모양입니다.
`scene` 안의 좌표는 Convex 쪽에서 길이 3 검증을 하지 않으므로, 필요하면 프론트에서 `SceneSchema.parse` 로 확인하세요.

## 내부 함수 (프론트에서 호출 불가)

| 함수 | 용도 |
|---|---|
| `internal.seed.run` | fixtures 를 DB 에 넣는다 (upsert, 여러 번 실행해도 안전). 백엔드 담당자가 `npx convex run seed:run` 으로 실행 |
| `internal.sceneActions.validate` | LLM 이 만든 `scene_actions` 를 zod + DB 존재 여부로 검증해 통과한 것만 반환. 챗봇 action 이 사용 예정 |

## scene_action 검증 규칙

- 스키마(`SceneActionSchema`)에 맞지 않으면 거부
- 참조하는 `structure_id`, `procedure_slug`+`step_index` 가 DB 에 없으면 거부 (`highlight` 는 id 하나라도 없으면 action 전체 거부)
- 한 응답에서 최대 10개까지만 허용
- 거부된 항목은 `rejected` 에 `index` 와 `reason` 으로 남는다

## 아직 없는 것

챗봇(LLM 호출) 과 세션/메시지 저장, RAG, 인증은 구현하지 않았습니다.
