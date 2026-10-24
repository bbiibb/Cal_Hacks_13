# Cal_Hacks_13 — 3D 인간 장기 + 수술 과정 시연 웹사이트

## 프로젝트 개요
- 프론트: 3D 장기 화면(Three.js 계열) + 화면 옆 사이드 패널(설명 표시)
- 수술 과정은 영상이 아니라 **단계(Step)별 3D 장면 상태 데이터(JSON)** 로 표현한다.
- 챗봇: 질문에 답하면서 3D 제어 명령(`scene_actions`)을 함께 내려 카메라 이동/하이라이트/투명도/단계 이동과 사이드 패널을 동기화한다.
- 백엔드는 Convex를 사용하고 별도 서버는 두지 않는 것이 기본이다 (query/mutation/action, HTTP action, file storage, vector search).
- pnpm workspace 모노레포, TypeScript(strict).

## 폴더 구조와 소유권
```
.
├── CLAUDE.md                 # 이 파일 (루트 공통 규칙)
├── .claude/skills/           # 프로젝트 skills
├── docs/contracts.md         # 프론트-백엔드 계약 문서
├── apps/frontend/            # 프론트 담당자 영역
├── packages/backend/         # Convex 프로젝트 (convex/ 포함) — 백엔드 담당자(사용자) 영역
└── packages/shared/          # 계약: zod 스키마 + 타입 + 예시 fixtures
```

- `packages/backend`: 사용자(백엔드 담당) 영역. 자유롭게 수정한다. 세부 규칙은 `packages/backend/CLAUDE.md`.
- `apps/frontend`: **사용자가 요청하지 않으면 수정하지 않는다.**
- `packages/shared`: 변경이 양쪽에 영향을 준다. 바꿀 때는 반드시 `docs/contracts.md`를 함께 갱신하고, **프론트 담당자에게 전달할 변경 요약을 출력**한다. (`contract-change` skill 참고)

## 자주 쓰는 명령어
```bash
pnpm install                 # 설치
pnpm dev:backend             # = convex dev (최초 1회 로그인/프로젝트 생성 필요, 아래 보안 참고)
pnpm typecheck               # 모든 패키지 tsc
pnpm lint                    # eslint (apps/frontend 제외)
pnpm test                    # vitest (packages/shared 등)
pnpm --filter @cal-hacks/shared test   # 패키지 단위 실행
```
프론트 개발 서버 명령은 프론트 담당자가 `apps/frontend`에 정의한다.

## 코드/문서 규칙
- 코드, 식별자, 커밋 타입 접두사는 **영어**. 문서(`*.md`)와 주석은 **한국어**.
- 공통 식별자 규칙은 `docs/contracts.md`가 기준이다 (`structure_id`는 GLB 메시 이름과 1:1).
- 패키지 이름은 `@cal-hacks/*` scope를 쓴다.

## 작업 방식
- 큰 변경은 구현 전에 **계획을 먼저** 제시하고 승인을 받는다.
- 커밋은 작게 나눈다. 커밋 메시지는 `type(scope): 요약` 형식 (예: `feat(backend): ...`).
- **main에 직접 커밋/푸시하지 않는다.** 항상 작업 브랜치에서 한다.
- 타입체크/테스트가 깨진 채로 커밋하지 않는다.

## 보안
- API 키, 토큰, 시크릿은 절대 커밋하지 않는다. `.env.local`은 gitignore 대상이고, 필요한 변수 목록은 `.env.example`에 둔다.
- 서버 시크릿(LLM 키 등)은 Convex 환경변수(`npx convex env set`)로만 관리한다.
- `npx convex dev` 등이 계정 로그인이나 프로젝트 생성을 요구하면 멈추고 사용자에게 안내한다. 로그인/시크릿을 대신 처리하지 않는다.
- 실제 환자 데이터는 사용하지 않는다. 공개 데이터 또는 합성(더미) 데이터만 쓴다.
