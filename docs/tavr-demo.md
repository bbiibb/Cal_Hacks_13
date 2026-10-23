# TAVR 시연 계획 (1차 버전)

환자 교육용 데모의 첫 주제는 **TAVR (경피적 대동맥판막 치환술, Transcatheter Aortic Valve Replacement)** 입니다.
협착된 대동맥판막 안에 카테터로 새 판막을 넣는 시술을 4개 장면으로 단순화합니다.
`packages/shared/fixtures/procedure.tavr.json` (slug: `tavr`)이 이 계획의 더미 데이터입니다.
내용은 모두 **교육용 더미**이며 실제 환자 데이터나 의료 조언이 아닙니다.

## 장면 (Step)

| index | 제목 | 보여줄 것 | animation_clip |
|---|---|---|---|
| 0 | 협착된 원래 판막 | 석회화로 좁아진 원래 판막 | `native_valve_stenosis` (loop) |
| 1 | 새 판막 전달 | 가이드와이어와 전달 카테터로 접힌 새 판막을 판막 위치까지 운반 | `deliver_valve` |
| 2 | 새 판막 확장 | 새 판막이 펼쳐져 판륜에 고정되고 원래 첨판이 벽 쪽으로 밀려남 | `expand_valve` |
| 3 | 전달 장비 제거 후 최종 위치 | 카테터를 뺀 뒤 새 판막과 관상동맥 혈류 | `valve_function` (loop) |

## 3D 에셋 현황

`structure_id` 는 GLB 메시 이름과 1:1 이어야 합니다. 아래는 fixtures 가 가정하는 이름이며, **3D 담당자와 실제 메시 이름을 맞춰야 합니다.**

| 대상 | id | 상태 |
|---|---|---|
| 원래 대동맥판막 (첨판 3개, 석회화) | `aortic_valve`, `aortic_valve.leaflet_*`, `aortic_valve.calcification` | 후보 모델 확보 |
| 대동맥, 대동맥근부, 판륜, 좌심실, 관상동맥 | `aorta*`, `aortic_annulus`, `left_ventricle`, `*_coronary_artery` | 확인 필요 |
| 전달 장비 | `guidewire`, `delivery_catheter` (instrument) | 후보 모델 확보 |
| 새 판막 지지틀 | `transcatheter_valve.frame` | 확인 필요 |
| **새 판막 첨판** | `transcatheter_valve.leaflets` | **모델 없음 (TODO)** |

새 판막 첨판 모델이 없는 동안에는 `transcatheter_valve.leaflets` 를 숨기거나(opacity 0) 지지틀만 보여주는 임시 처리가 필요합니다.
모델이 준비되면 fixtures 의 opacity 를 조정하세요.

## 애니메이션과 계약

- 판막의 이동·확장은 `Scene.structures` 에 transform 이 없으므로 GLB 에 구운 애니메이션 클립(`animation_clip`)으로 표현합니다.
  클립 이름은 위 표를 기준으로 하며 3D 담당자와 확정합니다.
- 새 판막(`transcatheter_valve`)은 챗봇이 `focus`/`highlight` 로 가리킬 수 있어야 하므로 instrument 가 아니라 **structure** 로 둡니다.
  전달 장비는 위치가 단계마다 달라지므로 **instrument** 로 둡니다.

## 열린 질문

- 사용할 판막 종류: 풍선확장형인지 자가확장형인지 (확장 장면 연출과 instrument 구성이 달라짐)
- 접근 경로: 대퇴동맥 경유 등 어디까지 보여줄지 (1차 버전은 판막 부위만)
- 영상(참고 자료)의 출처와 라이선스, 그리고 `sources` 에 넣을 근거 자료
