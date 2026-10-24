# apps/frontend (ask-ray)

The patient-facing website: a header with navigation, a list of interactive walkthroughs, and a 3D viewer for the organ models.
It is a Vite app written in React and TypeScript, using three.js for 3D and React Router for pages.

## Run it

From the repository root:

```bash
pnpm install
pnpm dev:frontend        # http://localhost:5173
pnpm build:frontend      # type-checks and builds into apps/frontend/dist
pnpm --filter @cal-hacks/frontend lint
```

`pnpm typecheck` at the root also type-checks this app.

## Source layout

```
src/
├── main.tsx                 Routes. Every page is rendered inside SiteLayout
├── layout/                  SiteLayout: the header stays on every page, pages render below it
├── site_header/             SiteHeader: logo, navigation, Sign up and Log in
├── walkthroughs_list/       The list of walkthrough cards
├── walkthrough/             The 3D page
│   └── visualization/       three.js scene, objects (cubes, glTF models), camera controllers
└── coming_soon/             Placeholder for pages that are not built yet
public/models/               glTF (.glb) organ models
```

- Pages use CSS Modules (`*.module.css`). Folder and file names are `snake_case`.
- `SiteHeader` accepts `backgroundColor`, `textColor`, and `accentColor`. `SiteLayout` picks the look per page (`lookFor` in `src/layout/site_layout.tsx`).
- Routes that do not exist yet (About us, FAQs, Contact, Log in, Sign up) show the "Coming soon" page and keep the header.

## 3D models

The models in `public/models/` are large (about 130 MB in total, and `aortic_arch.glb` alone is about 72 MB). GitHub rejects files over 100 MB, so move them to Git LFS before they grow.
Mesh names must match the `structure_id` values of the contract (see `docs/contracts.md`) so the chatbot can highlight parts.

## Connecting to the backend

The app does not call the backend yet. When it does, use the workspace packages:

```ts
// Contract types and schemas
import { ChatResponseSchema, type Scene } from "@cal-hacks/shared";
// Example data
import procedure from "@cal-hacks/shared/fixtures/procedure.tavr.json";
// Convex generated api
import { api } from "@cal-hacks/backend/api";
```

Add `"@cal-hacks/shared": "workspace:*"` and `"@cal-hacks/backend": "workspace:*"` to this package's dependencies first.
The functions the frontend can call are listed in `docs/backend-api.md`.
