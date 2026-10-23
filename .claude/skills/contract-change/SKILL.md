---
name: contract-change
description: packages/shared의 zod 스키마(Scene, SceneAction, ChatResponse, 식별자 등)를 추가·수정·삭제할 때 따르는 절차. 프론트-백엔드 계약이 바뀌는 모든 작업에서 사용한다.
---

# 계약(packages/shared) 변경 절차

`packages/shared` 변경은 프론트 담당자에게 영향을 준다. 아래 순서를 모두 끝내야 완료다.

1. **계획 먼저**: 무엇을 왜 바꾸는지, 프론트에 미치는 영향(깨지는 변경인지 하위 호환인지)을 먼저 적어 사용자 승인을 받는다.
2. **스키마 수정**: `packages/shared/src/*.ts`의 zod 스키마를 고치고 `src/index.ts` export를 확인한다. 가능하면 하위 호환(필드 추가는 `optional`/`nullable`)으로 한다.
3. **fixtures 갱신**: `packages/shared/fixtures/*.json`이 새 스키마를 따르도록 고친다. 생성 스크립트가 없으니 JSON을 직접 수정한다. 더미 데이터만 쓴다.
4. **테스트**: `packages/shared/test/fixtures.test.ts`에 새 규칙의 통과/거부 케이스를 추가한다.
5. **백엔드 동기화**: `packages/backend/convex/validators.ts`와 `schema.ts`를 새 계약에 맞춘다.
6. **문서 갱신**: `docs/contracts.md`의 해당 절과 하단 "변경 이력" 표(날짜, 변경, 영향)를 갱신한다.
7. **검증**: `pnpm typecheck && pnpm test && pnpm lint`가 통과해야 한다.
8. **프론트 전달용 변경 요약 출력**: 마지막에 아래 형식으로 출력한다.

```
## 프론트 전달용 변경 요약
- 변경 내용: (스키마/필드 단위)
- 깨지는 변경 여부: 예/아니오 (예라면 프론트에서 바꿔야 할 것)
- 새/바뀐 fixtures: (파일명)
- 참고 문서: docs/contracts.md#...
```

`apps/frontend`는 수정하지 않는다. 필요한 프론트 변경은 요약에만 적는다.
