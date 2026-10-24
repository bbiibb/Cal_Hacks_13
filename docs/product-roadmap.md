# 제품 로드맵과 백엔드 현황 (Simple Surgeries)

팀 기획 노트(`New note.pdf`, 저장소에는 포함하지 않음)와 팀원 설명을 정리한 문서입니다.
어떤 기능이 들어올 예정인지, 그중 백엔드(`packages/backend`)가 무엇을 해야 하는지, 지금 어디까지 구현됐는지를 기록합니다.
기획이 바뀌면 이 문서를 먼저 갱신하세요. 모든 콘텐츠는 교육용 더미이며 의료 조언이 아닙니다.

상태 표기: ✅ 구현됨 · 🟡 일부(스키마/데이터만 있음) · ⬜ 미구현

## 1. 제품 개요

환자가 곧 받을 수술에 대해 자세한 정보를 얻도록, 수술 과정을 **3D로 시각화**하고 **글 설명**을 함께 보여준다.

- 환자가 3D 모델 위에서 마우스를 움직이면(드래그/선택) 그 부위와 관련된 설명이 표시된다.
- 내장된 **AI 챗봇**으로 후속 질문을 하며, 부작용과 주의사항을 빠르게 이해한다.
- 1차 시연 주제는 **TAVR** (`docs/tavr-demo.md`). 확장 후보: 심장 외 다른 장기, 종양 등.

화면 구성(메인 페이지 목업): 왼쪽에 3D 이미지와 **타임라인(슬라이더, 00:00)**, 오른쪽 위에 현재 단계(Step N) 설명, 오른쪽 아래에 **질문/AI 답변 채팅**과 입력창.

## 2. 역할과 우려 사항

- UI(프론트엔드): Silas / 백엔드(Convex): Siun
- 기획 노트의 우려 사항: API 비용·GPU 자원, 역할 분담, 주제 차별화

## 3. 기능별 백엔드 필요 사항과 현황

| # | 기능 | 백엔드가 해야 할 일 | 현황 |
|---|---|---|---|
| F1 | 단계별 3D 장면 + 사이드 패널 설명 | 구조물/기구/과정/단계 저장과 조회, 더미 시드 | ✅ `procedures.*`, `structures.*`, `instruments.list`, `seed:run` |
| F2 | **부위 선택 → 설명** | 각 부위에 변수(`structure_id`)를 부여하고, 선택된 부위의 설명을 돌려줌. 단계별 맞춤 설명은 `annotations` 활용 | 🟡 부위 설명 조회 ✅ (`structures.getById`). 단계별 설명 조회 ⬜ (`annotations` 테이블만 있음) |
| F3 | **AI 응답에 맞춰 부위 하이라이트** | AI가 만든 `scene_actions`(focus/highlight/set_opacity/goto_step)를 검증해 프론트로 전달 | 🟡 검증기 ✅ (`internal.sceneActions.validate`). 챗봇이 action을 만드는 부분 ⬜ |
| F4 | 챗봇 | 아래 3.1 참고 | ⬜ (테이블 `chatSessions`/`chatMessages`만 있음) |
| F5 | 수술명·접근법 선택 (병원 안내 기준) | 같은 수술도 접근법별 설명이 다르므로 과정에 접근법 변형을 저장하고 선택 | ⬜ 스키마 확장 필요 |
| F6 | 타임라인으로 시간 이동 | 단계가 이산 `index`라서 시간축이 필요하면 단계별 시작 시간/길이를 제공 | ⬜ 열린 질문 (4절) |
| F7 | 이해 확인과 "담당 의사에게 물어볼 질문" 정리 | 대화 내용을 바탕으로 간단한 이해 확인과 질문 목록 생성 | ⬜ |
| F8 | 다른 장기/종양으로 확장 | 구조물/과정을 여러 개 담을 수 있는 데이터 모델 | ✅ 모델은 일반화돼 있음. 콘텐츠는 `seed-content` skill로 추가 |
| F9 | 근거 자료(RAG)와 출처 표시 | 문서/임베딩 저장, 벡터 검색, 답변에 `sources` 첨부 | ⬜ (`schema.ts`에 TODO 주석만) |
| F10 | 비용·안정성 (API 우려) | 요청 길이 제한, rate limit, 응답 캐시, 실패 시 대체 응답 | ⬜ |

### 3.1 챗봇(F4)에 필요한 것

기획 노트가 요구하는 챗봇 동작:
- 병원이 안내한 **수술명과 접근법에 맞는 설명**을 고른다.
- 3D에서 문제 부위, 넣거나 제거하는 것을 직접 보며 단계별로 확인하도록 돕는다.
- **지금 보고 있는 장면과 연결해서 질문**할 수 있다. 예: "방금 넣은 장비는 몸에 남나요?"
- 마지막에 이해한 내용을 간단히 확인하고, 담당 의사에게 물어볼 질문을 정리한다.

필요한 구성 요소:
1. **요청 계약** (`ChatRequest`, 제안): `{ session_id, message, context: { procedure_slug, step_index, selected_structure_id | null } }` — 현재 장면을 AI가 알아야 "방금 넣은 장비" 같은 질문에 답할 수 있다. (⬜ 아직 `packages/shared`에 없음, `contract-change` skill로 추가)
2. **세션/메시지 함수**: 세션 생성, 메시지 저장, 대화 불러오기 (⬜)
3. **LLM 호출 action**: 현재 단계의 장면/설명을 프롬프트에 넣고 호출 (⬜. API 키는 Convex 환경변수로만)
4. **응답 조립과 검증**: LLM 출력을 `ChatResponse`로 만들고 `scene_actions`는 검증기를 통과한 것만 사용 (검증기 ✅)
5. **안전 규칙**: 교육용임을 유지하고, 근거 없으면 모른다고 답하며, 진단/치료 조언처럼 보이는 표현을 피한다.

## 4. 팀원이 제안한 기능 (원문)

> So, I plan to add a feature where each part of the heart is assigned a variable; this will allow the system to provide an explanation when a user selects a specific part. Additionally, I intend to implement a function that highlights the relevant part of the heart based on an AI-generated response. Although I haven't been able to implement this yet—as I don't have the 3D model—I have clearly defined the functionality, so it should be straightforward to handle the coding with the help of AI.

백엔드 관점의 해석:
- "부위마다 변수" = **`structure_id`**. 이미 계약의 공통 키이며 GLB 메시 이름과 1:1로 맞춘다 (`docs/contracts.md`).
- "선택 시 설명" = F2. 프론트가 선택된 메시 이름을 `structure_id`로 `structures.getById`에 넘기면 된다.
- "AI 응답에 따른 하이라이트" = F3. 챗봇 응답의 `scene_actions`에 `highlight`/`focus`를 담고, 검증을 통과한 것만 전달한다.
- 3D 모델이 아직 없어서 프론트 구현은 보류 상태이므로, 백엔드는 **더미 `structure_id`로 먼저 만들고 모델이 오면 이름만 맞춘다.**

### 열린 질문
- 타임라인(F6)은 단계 단위 이동인가, 연속 시간(초)인가? 연속이면 `steps`에 `start_ms`/`duration_ms`가 필요하다.
- 선택은 클릭인가 마우스 오버(드래그)인가? (백엔드는 동일하게 `getById`로 처리 가능)
- 접근법 변형(F5)을 1차 버전에 넣을지, TAVR 한 가지로 시작할지.
- 챗봇 LLM 제공자와 키 관리 방식, 예산 상한 (F10).

## 5. 심장 부위 변수(`structure_id`) 현황

현재 `packages/shared/fixtures/structures.json`에 있는 TAVR 관련 구조물 15개는 `docs/tavr-demo.md`를 참고한다.
"심장 부위마다 변수"를 확장할 때의 추가 후보는 아래와 같다. **실제 3D 모델의 메시 이름이 확정된 뒤에** 이름을 맞춰 추가한다.

| 후보 id (제안) | 한글 | 비고 |
|---|---|---|
| `left_atrium`, `right_atrium` | 좌심방, 우심방 | 미추가 |
| `right_ventricle` | 우심실 | 미추가 |
| `interventricular_septum` | 심실중격 | 미추가 |
| `mitral_valve`, `tricuspid_valve`, `pulmonary_valve` | 승모판, 삼첨판, 폐동맥판 | 미추가 (대동맥판은 `aortic_valve`로 있음) |
| `pulmonary_artery` | 폐동맥 | 미추가 |
| `left_ventricle`, `aorta`, `aortic_valve`, `left_coronary_artery`, `right_coronary_artery` | 좌심실, 대동맥, 대동맥판막, 좌/우 관상동맥 | ✅ 이미 있음 |

## 6. 데이터 흐름

**부위 선택 → 설명 (F2)**
1. 프론트가 3D에서 선택된 메시 이름을 읽는다 (= `structure_id`).
2. `api.structures.getById({ id })` 호출 → 이름과 설명을 사이드 패널에 표시.
3. 단계별 맞춤 설명이 필요하면 `annotations`(구조물+단계)를 조회한다 (⬜ 함수 추가 필요).

**질문 → 답변 + 하이라이트 (F3, F4)**
1. 프론트가 질문과 현재 맥락(과정, 단계, 선택된 부위)을 보낸다.
2. 백엔드 action이 맥락을 넣어 LLM을 호출한다.
3. 응답의 `scene_actions`를 `internal.sceneActions.validate`로 검증한다 (zod + DB 존재 여부).
4. 통과한 것만 `ChatResponse`(`message`, `scene_actions`, `side_panel`, `sources`)로 프론트에 전달한다.
5. 프론트가 카메라 이동, 하이라이트, 투명도, 단계 이동을 적용한다.

## 7. 다음 작업 제안 (우선순위)

1. `ChatRequest` 계약 추가 (`contract-change` skill) — 프론트와 먼저 합의
2. 세션/메시지 저장 함수 (`chatSessions`, `chatMessages`)
3. 단계별 부위 설명 조회 (`annotations` 시드와 query)
4. LLM 호출 action과 안전 규칙 (API 키 필요)
5. rate limit과 응답 길이 제한
6. 근거 자료(RAG)와 출처, 이해 확인/의사 질문 정리
