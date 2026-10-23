# apps/frontend

프론트엔드 담당자 영역입니다. 아직 코드가 없습니다.

- 3D 장기 화면(Three.js 계열)과 화면 옆 사이드 패널(설명 표시)
- 백엔드(Convex)와 주고받는 데이터 형식은 [`docs/contracts.md`](../../docs/contracts.md) 와
  `@cal-hacks/shared` 패키지(zod 스키마·타입·fixtures)를 따릅니다.

## 백엔드 연결 방법

`package.json` 의 dependencies 에 워크스페이스 패키지를 추가합니다.

```json
{
  "dependencies": {
    "@cal-hacks/shared": "workspace:*",
    "@cal-hacks/backend": "workspace:*"
  }
}
```

```ts
// 계약 타입 / 스키마
import { ChatResponseSchema, type Scene } from "@cal-hacks/shared";
// 예시 데이터
import procedure from "@cal-hacks/shared/fixtures/procedure.cholecystectomy.json";
// Convex generated api (백엔드 담당자가 `convex dev` 를 한 번 실행한 뒤 사용 가능)
import { api } from "@cal-hacks/backend/api";
```

환경변수 이름은 루트 `.env.example` 을 참고하세요.
