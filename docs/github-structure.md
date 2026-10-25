# GitHub Repository Structure

A map of this repository: who works where, how the code is laid out, what the branches are for, and how work comes together.

> Snapshot taken on 2026-10-25, after pull request #44. Branches change quickly. To see the current state, run `git fetch --all --prune && git branch -r`, or open the repository's branch list on GitHub.

## 1. Project in one paragraph

**Simple Surgeries** (the website is called **ask-ray**, logo "asX-ray") helps patients understand an upcoming heart procedure. The procedure is shown as a step-by-step 3D visualization with written explanations. Patients can select a part of the 3D model to read about it, and an AI chatbot answers follow-up questions and highlights the relevant parts. The first demo procedure is **TAVR/TAVI** (transcatheter aortic valve replacement); an **eye anatomy** prototype shows that the page works for other topics. All content in this repository is educational dummy data, not medical advice.

## 2. Team and ownership

| Area | Owner | Where the work lives |
|---|---|---|
| 3D rendering, camera, the 3D scene objects | Silas | `website`, `3d_visualization`, `apps/frontend/src/walkthrough/visualization` |
| Chat panel, voice recording, privacy guard, accounts, viewing progress, architecture notes | Abdur | `apps/frontend/src/walkthrough/chat`, `.../privacy`, `apps/frontend/src/auth`, `packages/progress` |
| Backend (Convex), shared contract, content data, chatbot safety layer, 3D part naming, delivery-device models, FAQs, eye prototype | Siun | `packages/backend`, `packages/shared`, `docs`, parts of `apps/frontend` |

The roles are a guide: contributors work across areas, and the pull request list (section 5) shows who did what.

## 3. Code layout

```
.
├── README.md                  What the project is and how to run it
├── CLAUDE.md                  Shared working rules for AI-assisted development
├── .claude/                   Agents and skills (contract changes, Convex functions, ...)
├── docs/                      All documents (see section 8)
├── apps/frontend/             The ask-ray website (Vite, React, three.js)
└── packages/
    ├── shared/                Contract: zod schemas, types, fixtures (TAVR and eye), tests
    ├── backend/               Convex project: schema, content queries, chatbot, speech-to-text, accounts, seed
    └── progress/              SpacetimeDB module that stores which step a patient is on
```

- **`packages/shared`** is the single source of truth for data exchanged between frontend and backend. A `structure_id` is the key that links a database row to a part of the 3D model.
- **`packages/backend`** is a Convex project: read queries, the seed, the `scene_actions` validator, the chat pipeline (cloud or local model, safety layer, source retrieval), Cartesia speech-to-text, and Convex Auth accounts.
- **`apps/frontend`** is the website. Its layout is described in `apps/frontend/README.md`: landing page, walkthrough list, FAQs, accounts, the TAVR walkthrough (`src/walkthrough`), the eye prototype (`src/eye`), and the devices lab.
- Tooling: pnpm workspace, TypeScript (strict), Vitest, ESLint (packages) and oxlint (frontend). Pages use CSS Modules, and frontend folder and file names are `snake_case`.

## 4. Branches

`main` (the default branch) holds everything that has been merged. Work happens on short-lived branches and comes in through pull requests; the branches stay on GitHub after they merge, so most remote branches are history.

| Branch | State |
|---|---|
| `main` | The current product. Never push to it directly |
| `feat/*`, `fix/*`, `docs/*` | One branch per pull request; all merged except the ones below |
| `docs/judge-quick-start` | Open (Abdur): a quick start for judges (demo mode, what to try, what needs setup) |
| `feat/azure-static-web-apps` | Open (Abdur): Azure Static Web Apps config and a deployment guide |
| `website`, `3d_visualization`, `walkthroughs_list_page`, `chore/monorepo-setup`, `backend/seed-and-validation` | The first frontend-only line and the first backend branch. Their work is merged (see PRs #2 to #6); the branch names are historical |

## 5. Pull request history

| PR | What it brought into `main` |
|---|---|
| #1 | Monorepo setup and the first TAVR demo content |
| #2, #3, #5 | The frontend line: React and TypeScript setup, 3D visualization, the walkthrough list (merged into `website` and `chore/monorepo-setup` first) |
| #4 | Backend: Cartesia speech-to-text, conditions, seed and `scene_actions` validator |
| #6 | The ask-ray website moved into `apps/frontend` |
| #7, #8 | The TAVI chat panel and the step slider |
| #9 | Chatbot backend (cloud and local Llama), safety layer, TAVR knowledge base |
| #10, #15, #17 | Landing page and the TAVR walkthrough card |
| #11, #12 | Voice questions: the microphone button and the matching backend |
| #13 | Conversation memory and deletion |
| #14 | 3D visualization: hollowing and slicing |
| #16 | Build fix for the orbit camera |
| #18 | On-device privacy guard |
| #19 | Viewing progress with SpacetimeDB |
| #20, #21, #23, #24, #27 | Aorta placement, naming the parts of the heart, one heart color with colored mentions, full coverage of the regions |
| #22, #40, #42 | Login and sign-up pages, then Convex Auth accounts and the route guard, and a default Convex URL for local development |
| #25, #26, #29 | Camera-only commands without the model, the Slow / Fast switch, automatic refresh of the vector index |
| #28, #41 | Roadmap and safety notes brought up to date, the architecture document |
| #30, #31 | FAQs page and step 0 (introduction) |
| #32, #33, #36, #38 | 3D models of the delivery catheter, balloon and valve, passed through the gap of the narrowed old valve and tilted to lie along it |
| #34, #35 | Gemini for Fast mode and the model id fix |
| #37, #39 | Shorter header, wider chat, compact privacy panel |
| #43 | The microphone stays available with the privacy layer on |
| #44 | Eye anatomy prototype |

## 6. Conventions

- **Do not push directly to `main`.** Use a branch and a pull request.
- **Never force-push** a shared branch.
- **No secrets in git.** API keys, tokens, and `.env*` files stay out of the repository (the one committed exception is `apps/frontend/.env.development`, which holds only the public URL of the shared dev deployment). Server secrets live in Convex environment variables (`npx convex env set`). The variable names are listed in `.env.example`.
- **No real patient data.** Use public or synthetic data only.
- **Changing the contract** (`packages/shared`)? Update `docs/contracts.md` in the same change and tell the frontend owner what changed.
- **Commit messages** use `type(scope): summary`, for example `feat(backend): ...`.
- **Everything is written in English**: code, comments, documentation, fixtures, and commit messages.

## 7. Open items

- The TAVR 3D models are large (about 130 MB). Move them to Git LFS before any file reaches GitHub's 100 MB limit.
- `docs/.Rhistory` is a stray file that does not belong in the repository.
- The name: the website is **ask-ray**, while the planning notes and some documents say **Simple Surgeries**. Align them.
- Hosting is not decided; see `docs/architecture.md` ("Environments" and "Open items") and the open Azure branch.
- Rate limits and a budget for Fast mode are not built (`docs/product-roadmap.md`, F10).

## 8. Related documents

| Document | Contents |
|---|---|
| [`architecture.md`](architecture.md) | System diagram, data map and open items |
| [`product-roadmap.md`](product-roadmap.md) | Planned features and implementation status |
| [`contracts.md`](contracts.md) | Frontend-backend data contract |
| [`backend-api.md`](backend-api.md) | Backend functions the frontend can call |
| [`frontend-backend-split.md`](frontend-backend-split.md) | Who builds what, with the timeline as an example |
| [`chatbot.md`](chatbot.md), [`local-llm.md`](local-llm.md), [`knowledge-base.md`](knowledge-base.md), [`safety.md`](safety.md) | The chatbot |
| [`privacy-layer.md`](privacy-layer.md), [`auth.md`](auth.md) | Privacy guard and accounts |
| [`tavr-demo.md`](tavr-demo.md), [`eye-prototype.md`](eye-prototype.md) | The two walkthroughs |
