# 프론트엔드와 백엔드의 역할 구분

"이건 누가 만들지?"를 판단하기 위한 문서입니다. 타임라인 슬라이더를 예로 설명합니다.

## 한 줄 기준

- **화면에서 그려지고 움직이는 것** → 프론트엔드 (apps/frontend)
- **어떤 데이터가 있고, 그 데이터가 올바른지** → 백엔드 (packages/backend)
- 둘이 주고받는 **형식** → 계약 (packages/shared, `docs/contracts.md`). 바꿀 때는 양쪽이 합의한다.

## 예시: 타임라인 슬라이더

참고 화면: 하단의 슬라이더 하나에 단계 라벨이 나란히 있고(예: `Narrowed art… / Inserting the… / Dye and gui… / Balloon wide… / Placing the… / Finish and re…`), 좌우 화살표로 이동한다. 현재 단계 라벨은 굵게, 지나온 구간은 색이 채워진다.

| 부분 | 담당 | 이유 |
|---|---|---|
| 슬라이더 막대, 채워지는 색, 동그란 손잡이 | 프론트 | 순수 화면 요소 |
| 좌우 화살표, 라벨 클릭, 키보드 조작 | 프론트 | 입력 처리 |
| 라벨이 길면 `…`으로 자르기, 좁은 화면에서 번호로 바꾸기 | 프론트 | 레이아웃 |
| "지금 몇 번째 단계인가" 상태 (`stepIndex`), 주소창(URL) 반영 | 프론트 | 화면 상태 |
| 단계가 바뀔 때 카메라 이동, 투명도 변화, 장비 나타나기 애니메이션 | 프론트 | 3D 렌더링 |
| **단계가 몇 개이고 순서가 어떤가** | **백엔드** | 콘텐츠 데이터 |
| **각 단계의 제목, 짧은 라벨(`short_title`), 설명** | **백엔드** | 콘텐츠 데이터 |
| **각 단계에서 3D가 어떤 상태여야 하는가** (`scene`: 카메라, 투명도, 기구 위치 등) | **백엔드** | 콘텐츠 데이터 |
| 챗봇이 "3단계로 가자"(`goto_step`)고 할 때 그 단계가 실제로 있는지 확인 | **백엔드** | 검증 |

즉 슬라이더 자체는 전부 프론트 일이에요. 백엔드는 슬라이더의 **눈금과 라벨이 될 데이터**를 `procedures.getBySlug`로 한 번에 내려줘요.

```ts
const procedure = useQuery(api.procedures.getBySlug, { slug: "tavr" });
// procedure.steps.map(s => s.short_title)  →  슬라이더 라벨
// procedure.steps.length                    →  슬라이더 눈금 수
// procedure.steps[stepIndex].scene          →  3D에 적용할 장면
```

### 백엔드가 하지 않는 것
- 슬라이더 위치를 서버에 저장하지 않는다. (나중에 "이어 보기"가 필요하면 `chatSessions`에 `currentStepIndex`를 저장하는 방식으로 추가 가능)
- 시간(초) 단위 이동은 지원하지 않는다. 지금 타임라인은 **단계 단위**다. 단계 사이를 연속적으로 재생하려면 `steps`에 `duration_ms`를 추가해야 하며, 필요해지면 `contract-change` 절차로 추가한다.

## 다른 기능에도 같은 기준 적용

| 기능 | 프론트 | 백엔드 |
|---|---|---|
| 부위 클릭 → 설명 | 클릭 감지(레이캐스트), 선택 하이라이트, 패널 UI | `structures.getById`로 이름·설명 제공 |
| AI 답변 → 부위 하이라이트 | 받은 `scene_actions`를 3D에 적용 | 챗봇 응답 생성, `scene_actions` 검증 후 전달 |
| 수술/질환 선택 메뉴 | 탭·드롭다운 UI | `conditions.list`, `procedures.listByCondition` |
| 퀴즈, 의사 질문 목록 | UI와 입력 | (예정) 저장과 조회 |
