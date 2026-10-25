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
├── progress/                Saves and shows viewing progress (SpacetimeDB client, "Your progress" card)
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

## TAVR walkthrough page

- **Step slider** (`src/walkthrough/step_slider/`): along the bottom of the 3D view. Drag the handle, click a label, or use the arrows or keyboard to change step. The filled part shows how far along the patient is. On narrow screens the labels become step numbers.
- **Pointing at parts** (`src/walkthrough/visualization/part_picker.ts`): hovering over a model shows its name next to the pointer and its description in the panel. A click (not a drag) pins it, and the pinned part is sent to the chatbot as context. A whole model stands in for its parts until the GLB mesh names match the contract.
- **Steps** come from `packages/shared/fixtures/procedure.tavr.json`: the five steps of the team's patient explanation.

## TAVR chat panel

The walkthrough page has a chat panel next to the 3D view. Patients ask about TAVR and its side effects, and each answer can move the 3D view: change the step, focus on or highlight a part, zoom, rotate, or reset the camera. Answers also show a safety note, a question to ask the care team, and suggested follow-up questions.

- `src/walkthrough/chat/`: the panel, the chat clients, and the frontend copy of the chat contract (`chat_types.ts`)
- `src/walkthrough/visualization/scene_director.ts`: applies the answer's `scene_actions` to the models and the camera
- `src/walkthrough/visualization/scene_bindings.ts`: which `structure_id` values each model file stands for. The current GLB mesh names do not match the contract yet, so a whole model stands in for its structures

Where answers come from, set in `apps/frontend/.env.local`:

| Setting | Answers |
|---|---|
| nothing (default) | Built-in demo answers about TAVR (`chat/demo_answers.ts`), with simple commands such as "zoom in", "rotate left 90 degrees", or "go to step 3". Works offline |
| `VITE_CHAT_BACKEND=convex` and `VITE_CONVEX_URL=https://<deployment>.convex.cloud` | The backend chatbot (`chat.createSession` and `chat.ask`). Needs the backend's chat functions deployed |
| `VITE_CHAT_BACKEND=convex` and `VITE_CONVEX_URL=http://127.0.0.1:3210` | The chatbot with the **model on your own computer** (Llama through Ollama and a local Convex backend). See `docs/local-llm.md` |
| `VITE_CHAT_TIMEOUT_MS=120000` (optional) | How long the chat waits for an answer. The default is 30 seconds, which is too short for a local model next to the 3D view |

**Privacy layer in the panel.** The chat client (live and demo) is wrapped by the on-device PII guard (`src/walkthrough/privacy/`, see `docs/privacy-layer.md`). The panel shows the question box with live underlines on detected personal information, a status line with the on-device detector state, a collapsible "What left your device" list (the exact redacted text sent, never real values), and a demo intake form that saves fake details only into the encrypted browser vault. The model for the name finder downloads only after the question box is focused. Voice is off while the privacy layer is on, because audio is transcribed on the server and cannot be redacted first. UI code: `chat/privacy_input.tsx`, `chat/privacy_dock.tsx`, `chat/privacy_hooks.ts`, `chat/privacy_format.ts` (tested helpers).

**Conversation lifetime.** With the Convex backend, a conversation lasts until the window is closed: the page asks the backend to delete it when it is hidden or closed (`pagehide`, `ConvexChatClient.close`). The backend also deletes conversations idle for 2 hours. Older messages are shortened by the backend, see `docs/chatbot.md` ("Conversation memory").

**Voice questions.** With the Convex backend, a microphone button next to Send records up to 30 seconds. The recording is uploaded (`speech.generateUploadUrl`), then `chat.askByVoice` transcribes and answers it. The heard text appears as your message, and the answer moves the 3D view like a typed one. The demo answers do not support voice, so the button is hidden; in browsers without microphone recording it is disabled with an explanation. Needs the backend's `CARTESIA_API_KEY`, a secure page (https or localhost), and microphone permission. Code: `chat/voice_recorder.ts`, `ConvexChatClient.askByVoice`.

The demo answers are educational dummy content and must be reviewed by someone with medical knowledge before patients see them. Tests for the demo answers and response checks: `pnpm --filter @cal-hacks/frontend test`.


## Viewing progress (SpacetimeDB)

The walkthrough saves which step the patient is on, and the landing page shows a "Your progress" card with a Continue button (`?step=N` opens the walkthrough at step N, counting from 1) and a Start over button.
It talks to the module in `packages/progress`. The identity is anonymous: the server gives the browser a token, kept in localStorage, and no names or personal details are sent. Without the server, the database, or localStorage, the card stays hidden and everything else works; the app retries quietly in the background (2 s, doubling up to 60 s).

| Setting (`apps/frontend/.env.local`) | Default | Meaning |
|---|---|---|
| `VITE_SPACETIME_URI` | `ws://127.0.0.1:3000` | SpacetimeDB server |
| `VITE_SPACETIME_DB` | `ask-ray-progress` | Database name or address |

Try it locally: `spacetime start`, then `spacetime publish ask-ray-progress --server local --module-path packages/progress/spacetimedb --yes`. If the local server is wiped, clear the site's localStorage so the old token is not reused.
Typed bindings in `src/progress/module_bindings/` are generated; after changing the module, run `spacetime generate --lang typescript --out-dir apps/frontend/src/progress/module_bindings --module-path packages/progress/spacetimedb`.
Pure helpers (relative time, summary, step parsing) are tested in `src/progress/progress_helpers.test.ts`.

The app does not call the Convex backend directly yet. When it does, use the workspace packages:

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
