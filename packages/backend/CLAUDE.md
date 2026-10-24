# packages/backend — Convex 백엔드

루트 `CLAUDE.md`의 규칙을 먼저 따른다. 이 파일은 백엔드에만 해당하는 규칙이다.

## Convex 규칙
- **모든 함수에 `args`와 `returns` validator를 반드시 지정한다.** (`query`/`mutation`/`action`/`internal*` 모두)
- 쿼리는 인덱스를 쓴다. `filter()`로 전체 테이블을 훑지 않고 `withIndex`를 사용하며, 필요한 인덱스는 `convex/schema.ts`에 정의한다.
- **외부 API(LLM 등) 호출은 `action`에서만** 한다. query/mutation에서는 호출하지 않는다. DB 읽기/쓰기는 action에서 `ctx.runQuery`/`ctx.runMutation`으로 한다.
- 외부에 노출하지 않을 함수는 `internalQuery`/`internalMutation`/`internalAction`으로 만든다.
- 시크릿은 **Convex 환경변수로만** 관리한다 (`npx convex env set NAME value`, 코드에서는 `process.env`). 코드/`.env.local`/fixtures에 넣지 않는다.
- `convex/_generated/`는 직접 수정하지 않는다.
- 새 함수를 만들 때는 `convex-function` skill의 체크리스트를 따른다.

## 도메인 규칙
- **`structure_id`는 GLB 메시 이름과 1:1로 일치하는 공통 키**다. 임의로 만들거나 이름을 바꾸지 않는다. 바꿔야 하면 프론트/3D 에셋 담당자와 합의하고 `contract-change` skill을 따른다.
- **LLM이 만든 `scene_actions`는 (1) `packages/shared`의 zod 스키마 검증, (2) DB 존재 여부 검증(structure/instrument/procedure/step 등)을 모두 통과한 것만 프론트로 전달**한다. 실패한 항목은 버리고 로그를 남긴다. 새 action 타입이나 검증 규칙을 바꿀 때는 `chat-action-validation` skill을 따른다.
- 의료 정보는 **교육용**이다. 근거 자료가 없으면 추측하지 말고 모른다고 답한다. 진단/치료 조언처럼 보이는 표현을 피하고, 응답에 교육용임을 알 수 있게 한다.
- 더미 콘텐츠를 추가할 때는 `seed-content` skill을 따른다. 실제 환자 데이터는 쓰지 않는다.

## 계약과의 관계
- 프론트와 주고받는 형식의 기준은 `packages/shared`(zod)와 `docs/contracts.md`다.
- `convex/validators.ts`는 그 계약을 Convex validator로 옮긴 것이다. 계약이 바뀌면 함께 맞춘다.

## 명령어
```bash
pnpm --filter @cal-hacks/backend dev        # convex dev
pnpm --filter @cal-hacks/backend typecheck
pnpm --filter @cal-hacks/backend test
pnpm --filter @cal-hacks/backend exec convex run seed:run    # fixtures 시드 (개발 배포 확인 후)
```

## 구조
- `convex/*.ts`: 함수 파일 (`structures`, `instruments`, `procedures`, `seed`, `sceneActions`). 프론트용 API 는 `docs/backend-api.md` 에 정리한다.
- `convex/lib/`: DB 접근이 없는 순수 로직(`mappers`, `sceneActions`). 단위 테스트는 `test/` 에 둔다.
- `convex/_generated/`: Convex 권장대로 커밋한다. `convex dev` 가 갱신하므로 직접 수정하지 않는다.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
