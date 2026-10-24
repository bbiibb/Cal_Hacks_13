# apps/frontend

This is the frontend owner's area. There is no code here yet.

- A 3D organ view (Three.js family) with a side panel next to it that shows explanations.
- The data exchanged with the backend (Convex) follows [`docs/contracts.md`](../../docs/contracts.md) and
  the `@cal-hacks/shared` package (zod schemas, types, and fixtures).

## Connecting to the backend

Add the workspace packages to the `dependencies` in `package.json`.

```json
{
  "dependencies": {
    "@cal-hacks/shared": "workspace:*",
    "@cal-hacks/backend": "workspace:*"
  }
}
```

```ts
// Contract types and schemas
import { ChatResponseSchema, type Scene } from "@cal-hacks/shared";
// Example data
import procedure from "@cal-hacks/shared/fixtures/procedure.tavr.json";
// Convex generated api (use it once the backend owner has run `convex dev` at least once)
import { api } from "@cal-hacks/backend/api";
```

See the root `.env.example` for the environment variable names.
