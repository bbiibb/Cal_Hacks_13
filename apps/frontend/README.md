# apps/frontend (ask-ray)

The patient-facing website: a landing page, a header with navigation, a list of interactive walkthroughs, an FAQs page, accounts, and a 3D walkthrough with a chat panel for each topic (TAVR, and an eye anatomy prototype).
It is a Vite app written in React and TypeScript, using three.js for 3D and React Router for pages.

## Run it

From the repository root:

```bash
pnpm install
pnpm dev:frontend        # http://localhost:5173
pnpm build:frontend      # type-checks and builds into apps/frontend/dist
pnpm --filter @cal-hacks/frontend lint
pnpm --filter @cal-hacks/frontend test
```

Open the page with a new query (for example `?v=2`) or hard-reload (Cmd+Shift+R) after changing code: the dev server can serve a browser-cached module otherwise.

`pnpm typecheck` at the root also type-checks this app.

## Source layout

```
src/
├── main.tsx                 Routes. Every page is rendered inside SiteLayout
├── layout/                  SiteLayout: the header stays on every page, pages render below it
├── site_header/             SiteHeader: logo, navigation, Sign up and Log in (or the user's name and Log out)
├── landing/                 The landing page, with the "Your progress" card
├── walkthroughs_list/       The list of walkthrough cards
├── faqs/                    The FAQs page
├── progress/                Saves and shows viewing progress (SpacetimeDB client, "Your progress" card)
├── walkthrough/             The TAVR 3D page
│   ├── chat/                Chat panel, chat clients, Slow / Fast switch, privacy panel, voice recorder
│   ├── privacy/             On-device privacy guard (see docs/privacy-layer.md)
│   ├── step_slider/         The timeline under the 3D view
│   └── visualization/       three.js scene, objects (glTF models, catheter, balloon, valve), camera controllers, scene director
├── eye/                     The eye anatomy prototype page and its content (see docs/eye-prototype.md)
├── devices_lab/             /devices-lab: the catheter, balloon and valve on their own
├── auth/                    Log in and Sign up pages, auth state, route guard, validation, `REQUIRE_AUTH`
└── coming_soon/             Placeholder for pages that are not built yet (About us, Contact)
public/models/               glTF (.glb) organ models; public/models/eye/ holds the eye parts
```

- Pages use CSS Modules (`*.module.css`). Folder and file names are `snake_case`.
- `SiteHeader` accepts `backgroundColor`, `textColor`, and `accentColor`. `SiteLayout` picks the look per page (`lookFor` in `src/layout/site_layout.tsx`).
- Routes that do not exist yet (About us, Contact) show the "Coming soon" page and keep the header.
- The header is kept short on purpose (about 66 px at desktop width) so the 3D view and the chat have room.

## Routes

| Route | Page | Needs sign-in |
|---|---|---|
| `/` | Landing page | no |
| `/walkthroughs-list` | Walkthrough cards (TAVR, eye anatomy prototype) | yes |
| `/walkthrough` | TAVR 3D walkthrough with chat; `?step=N` opens it at step N (0 is the introduction) | yes |
| `/walkthrough/eye` | Eye anatomy prototype | yes |
| `/faqs` | Frequently asked questions | no |
| `/devices-lab` | The delivery catheter, balloon and valve on their own, with sliders | no |
| `/login`, `/signup` | Accounts | no |
| anything else | "Coming soon" | no |

(Sign-in is only enforced when `VITE_CONVEX_URL` is set and `REQUIRE_AUTH` is `true`; see below.)

## Accounts (Convex Auth)

Username and password accounts use `@convex-dev/auth` (`signIn('password', formData)` with `flow`, `username`, `password`; sign-up adds `firstName`, `lastName`, `email`). The signed-in user comes from the query `users:viewer`, referenced in one place (`src/auth/viewer.ts`; switch it to `api.users.viewer` after `convex codegen`).

- `VITE_CONVEX_URL`: the Convex deployment URL. `pnpm dev:frontend` reads a default from the committed `apps/frontend/.env.development` (the shared dev deployment, not a secret), so sign-up and login work after a plain `pnpm install`. Set it in `apps/frontend/.env.local` to use your own deployment (that file wins), or clear the value in `.env.development` to run in demo mode. Production builds do not read `.env.development`. If it is missing, the app still runs: there is no auth provider, the pages show "Accounts are not available in this demo yet." on submit, and no route is guarded.
- `REQUIRE_AUTH` (`src/auth/config.ts`, default `true`): protects `/walkthrough`, `/walkthrough/eye` and `/walkthroughs-list`. Signed-out visitors go to `/login?next=<path>` and return after signing in. `next` must be an internal path (`src/auth/redirect.ts`). It has no effect without `VITE_CONVEX_URL`. Set it to `false` to open the walkthroughs to everyone.
- Log in shows one message for every failure ("Incorrect username or password"), so usernames are never revealed. Sign up validates in the browser first (`src/auth/validation.ts`) and maps backend error codes to messages under the right field.
- Passwords are never stored or logged. Name and email are used only for the auth calls and the header greeting, and are never sent to the chat or any AI prompt.

## 3D models

The TAVR models in `public/models/` are large (about 130 MB in total, and `aortic_arch.glb` alone is about 72 MB). GitHub rejects files over 100 MB, so move them to Git LFS before they grow. The eight eye parts in `public/models/eye/` are small (about 3.5 MB together).
Ideally mesh names match the `structure_id` values of the contract (see `docs/contracts.md`) so the chatbot can highlight parts. The TAVR models are single meshes, so `scene_bindings.ts` maps each model file to the structures it stands for, and the heart's chambers are told apart by outlines (`heart_regions.ts`). The eye parts are one file per part, bound the same way.

## TAVR walkthrough page

- **Step slider** (`src/walkthrough/step_slider/`): along the bottom of the 3D view. Drag the handle, click a label, or use the arrows or keyboard to change step. The filled part shows how far along the patient is. On narrow screens the labels become step numbers.
- **Pointing at parts** (`src/walkthrough/visualization/part_picker.ts`): hovering over a model shows its name next to the pointer and its description in the panel. A click (not a drag) pins it, and the pinned part is sent to the chatbot as context. A whole model stands in for its parts until the GLB mesh names match the contract.
- **Steps** come from `packages/shared/fixtures/procedure.tavr.json`: step 0 is an introduction about the symptoms (only the heart is shown), and steps 1 to 5 are the team's patient explanation. The step number people see is the step's index.
- **Delivery equipment** (`visualization/objects/`): the catheter, balloon and balloon-expandable valve are built in code (`DeliveryCatheter`, `Balloon`, `TavrValve`, `TavrDeliverySystem`) and follow the step. `walkthrough.tsx` holds the catheter path and where the valve ends up; they pass through the gap of the narrowed old valve. See `docs/tavr-demo.md`.
- **Naming the heart's parts**: the heart is one mesh, so its chambers and vessels are named by outlines in `heart_regions.ts`. Open the page with `?regions` to see each outline in its own color.
- **Colors**: the whole heart has one color; a part changes color (a pulsing glow) only when it is pointed at, pinned, highlighted by the step, or mentioned by an answer.

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

With the live chatbot, a **Slow / Fast** switch under the question box (`chat/speed_toggle.tsx`) chooses the model per question: Slow uses the local Llama (free), Fast uses the cloud model set in the backend (for example Gemini or Groq; a paid service, so the panel warns first). The demo answers have no switch. A command that only moves the view ("zoom in", "go to step 3", "show me the right atrium") is answered by rules in about a second, without a model.

The eye prototype always uses the built-in demo answers (with its own content in `src/eye/eye_content.ts`).
| `VITE_CHAT_TIMEOUT_MS=120000` (optional) | How long the chat waits for an answer. The default is 30 seconds, which is too short for a local model next to the 3D view |

**Privacy layer in the panel.** The chat client (live and demo) is wrapped by the on-device PII guard (`src/walkthrough/privacy/`, see `docs/privacy-layer.md`). The panel shows the question box with live underlines on detected personal information, a status line with the on-device detector state, a collapsible "What left your device" list (the exact redacted text sent, never real values), and a demo intake form that saves fake details only into the encrypted browser vault. The model for the name finder downloads only after the question box is focused. The microphone stays available while the layer is on, but spoken questions are transcribed on the server and cannot be redacted first (a known gap). UI code: `chat/privacy_input.tsx`, `chat/privacy_dock.tsx`, `chat/privacy_hooks.ts`, `chat/privacy_format.ts` (tested helpers).

**Conversation lifetime.** With the Convex backend, a conversation lasts until the window is closed: the page asks the backend to delete it when it is hidden or closed (`pagehide`, `ConvexChatClient.close`). The backend also deletes conversations idle for 2 hours. Older messages are shortened by the backend, see `docs/chatbot.md` ("Conversation memory").

**Voice questions.** With the Convex backend, a microphone button next to Send records up to 30 seconds. The recording is uploaded (`speech.generateUploadUrl`), then `chat.askByVoice` transcribes and answers it. The heard text appears as your message, and the answer moves the 3D view like a typed one. The demo answers do not support voice, so the button is hidden; in browsers without microphone recording it is disabled with an explanation. Needs the backend's `CARTESIA_API_KEY` (and `ALLOW_CLOUD_STT=true` when the model runs locally), a secure page (https or localhost), and microphone permission. Code: `chat/voice_recorder.ts`, `ConvexChatClient.askByVoice`.

The demo answers are educational dummy content and must be reviewed by someone with medical knowledge before patients see them. Tests for the demo answers and response checks: `pnpm --filter @cal-hacks/frontend test`.


## Viewing progress (SpacetimeDB)

The TAVR walkthrough saves which step the patient is on, and the landing page shows a "Your progress" card with a Continue button (`?step=N` opens the walkthrough at step N, where step 0 is the introduction) and a Start over button.
It talks to the module in `packages/progress`. The identity is anonymous: the server gives the browser a token, kept in localStorage, and no names or personal details are sent. Without the server, the database, or localStorage, the card stays hidden and everything else works; the app retries quietly in the background (2 s, doubling up to 60 s).

| Setting (`apps/frontend/.env.local`) | Default | Meaning |
|---|---|---|
| `VITE_SPACETIME_URI` | `ws://127.0.0.1:3000` | SpacetimeDB server |
| `VITE_SPACETIME_DB` | `ask-ray-progress` | Database name or address |

Try it locally: `spacetime start`, then `spacetime publish ask-ray-progress --server local --module-path packages/progress/spacetimedb --yes`. If the local server is wiped, clear the site's localStorage so the old token is not reused.
Typed bindings in `src/progress/module_bindings/` are generated; after changing the module, run `spacetime generate --lang typescript --out-dir apps/frontend/src/progress/module_bindings --module-path packages/progress/spacetimedb`.
Pure helpers (relative time, summary, step parsing) are tested in `src/progress/progress_helpers.test.ts`.

## Using the shared package

The app reads the walkthrough content from the shared fixtures (checked against the contract when the page loads), and talks to Convex for the chatbot (`chat/convex_chat_client.ts`) and accounts (`auth/`):

```ts
// Contract types and schemas
import { ChatResponseSchema, type Scene } from "@cal-hacks/shared";
// Example data
import procedure from "@cal-hacks/shared/fixtures/procedure.tavr.json";
```

Moving the step and part content from the fixtures to Convex queries (`procedures.getBySlug`, `structures.list`) is not done yet. The functions the frontend can call are listed in `docs/backend-api.md`.
