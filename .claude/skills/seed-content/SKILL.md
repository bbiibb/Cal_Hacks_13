---
name: seed-content
description: 더미 수술 콘텐츠(구조물, 수술 기구, 단계, 설명)를 추가하거나 수정하는 절차. 공개/합성 데이터만 사용하고 fixtures와 DB 시드를 일관되게 유지한다.
---

# 더미 콘텐츠 추가 절차

## 원칙
- 모든 콘텐츠는 **교육용 더미**다. 실제 환자 데이터 금지, 공개 자료 또는 직접 쓴 합성 설명만 쓴다.
- 설명 문구에는 "(더미 교육용 콘텐츠)"를 표시해 근거 자료가 아님을 분명히 한다.
- 외부 자료를 인용하면 출처를 `sources`/문서에 남긴다.

## 새 심장 질환(condition) 추가
질환은 코드 변경 없이 콘텐츠만으로 추가한다.
1. `packages/shared/fixtures/conditions.json`에 `{ slug, name_en, name_ko, description }` 추가 (`ConditionSlug` 규칙).
2. 그 질환을 치료하는 수술 fixtures(`procedure.*.json`)의 `condition_slug`에 같은 slug를 넣고 `order`를 정한다.
3. 시드(`convex/seed.ts`)가 새 procedure 파일을 읽도록 import를 추가하고(현재는 TAVR 하나), `pnpm test`로 참조 무결성을 확인한다.
4. 새 수술이 쓰는 구조물/기구는 아래 절차 1~2로 추가한다.

## 절차
1. **구조물 추가**: `packages/shared/fixtures/structures.json`에 항목 추가.
   - `id`는 `StructureId` 규칙(소문자 snake_case, `.`로 계층)을 따르고 **GLB 메시 이름과 1:1** 이어야 한다. 3D 담당자와 이름을 확인한다.
   - `parent_id`는 존재하는 구조물이거나 `null`.
2. **기구 추가**: `instruments.json`에 항목 추가 (`InstrumentId` 규칙).
3. **단계 추가**: `procedure.*.json`의 `steps`에 추가.
   - `index`는 0부터 연속. 각 step에 `scene`(camera, structures, instruments, animation_clip)과 `side_panel`이 있어야 한다.
   - `scene`과 `side_panel`이 참조하는 모든 id는 위 구조물/기구 fixtures에 존재해야 한다.
   - 새 수술이면 `slug`(소문자 snake_case)를 정하고 fixtures 파일을 `procedure.<name>.json`으로 만든다.
4. **타임라인 라벨**: 각 step에 `short_title`(타임라인 라벨용, 12자 이내)을 넣는다.
5. **테스트 갱신**: `packages/shared/test/fixtures.test.ts`가 새 파일/참조를 검증하게 하고 `pnpm test`로 확인한다.
6. **DB 시드**: 시드 mutation(`convex/seed.ts` 등, 필요하면 새로 만든다)은 fixtures를 읽어 `structures → instruments → procedures → steps` 순으로 넣는다. 재실행해도 중복되지 않게 `by_structure_id`/`by_slug` 인덱스로 upsert 한다. (`convex-function` skill 체크리스트 적용)
7. **문서**: 계약 형식이 바뀌면 `contract-change`를 따른다. 형식이 같고 내용만 늘었으면 `docs/contracts.md` 갱신은 필요 없다.
8. **검증**: `pnpm typecheck && pnpm test && pnpm lint`
