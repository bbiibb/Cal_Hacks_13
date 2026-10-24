---
name: convex-function
description: packages/backend에 새 Convex 함수(query/mutation/action/internal/HTTP action)를 만들 때의 체크리스트. validator, 인덱스, 권한, 테스트를 빠뜨리지 않게 한다.
---

# 새 Convex 함수 체크리스트

만들기 전에 `packages/backend/CLAUDE.md`의 Convex 규칙을 다시 확인한다.

## 종류 고르기
- [ ] 읽기 → `query`, 쓰기 → `mutation`, **외부 API(LLM 등) 호출 → `action`**
- [ ] 클라이언트에 노출하지 않을 함수는 `internalQuery`/`internalMutation`/`internalAction`
- [ ] HTTP 엔드포인트가 정말 필요한 경우에만 `httpAction` (`convex/http.ts`)

## 작성
- [ ] `args` validator 지정 (`v.*`). 식별자 문자열은 가능하면 `packages/shared` 규칙과 맞춘다.
- [ ] `returns` validator 지정 (`v.null()` 포함, 생략 금지)
- [ ] 계약 타입(Scene, SceneAction, ChatResponse 등)을 반환하면 `convex/validators.ts`의 validator를 재사용한다.
- [ ] 쿼리는 `withIndex` 사용. 필요한 인덱스가 없으면 `schema.ts`에 추가한다. `filter()`로 전체 훑기 금지.
- [ ] 무제한 `.collect()` 금지 → `.take(n)` 또는 페이지네이션
- [ ] action에서 DB 접근은 `ctx.runQuery`/`ctx.runMutation`(internal 함수)로 한다.

## 권한/보안
- [ ] 인증은 아직 없다. 누가 호출해도 되는 함수인지 판단하고, 쓰기 함수는 입력을 엄격히 검증한다.
- [ ] 시크릿은 `process.env`(Convex 환경변수)에서만 읽는다. 하드코딩 금지.
- [ ] 에러 메시지에 시크릿/내부 정보를 넣지 않는다.

## 검증
- [ ] 테스트: 순수 로직은 `vitest`로 단위 테스트를 추가한다 (convex-test 도입은 필요할 때 논의).
- [ ] `pnpm typecheck && pnpm lint && pnpm test`
- [ ] `convex dev`가 필요한 확인은 사용자에게 안내한다 (로그인/배포는 대신 처리하지 않는다).
