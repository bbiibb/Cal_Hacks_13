# GitHub Repository Structure

A map of this repository: what each branch is for, who works where, how the code is laid out, and how the branches are meant to come together.

> Snapshot taken on 2026-10-24 (updated the same day). Branches change quickly. To see the current state, run `git fetch --all --prune && git branch -r`, or open the repository's branch list on GitHub.

## 1. Project in one paragraph

**Simple Surgeries** helps patients understand an upcoming heart procedure. The procedure is shown as a step-by-step 3D visualization with written explanations. Patients can select a part of the 3D model to read about it, and an AI chatbot answers follow-up questions and highlights the relevant parts. The first demo procedure is **TAVR/TAVI** (transcatheter aortic valve replacement). All content in this repository is educational dummy data, not medical advice.

## 2. Team and ownership

| Area | Owner | Where the work lives |
|---|---|---|
| 3D rendering, camera, 3D walkthrough page | Silas | `3d_visualization`, `website` |
| Some frontend pages (walkthroughs list, header, login and sign-up) | Siun | `walkthroughs_list_page` (based on Silas's work) |
| Backend (Convex), shared contract, content data | Siun | `backend/seed-and-validation`, `main` |

## 3. Branch map

| Branch | Purpose | Layout | Status |
|---|---|---|---|
| `main` (default) | Monorepo setup, shared contract, TAVR dummy content, docs | Monorepo (pnpm workspace) | Stable base. Contains no frontend app yet |
| `backend/seed-and-validation` | Convex read queries, content seeding, `scene_actions` validator, Cartesia speech-to-text, API docs, product roadmap. All text translated to English | Monorepo | Backend work in progress. Open as a pull request into `main` |
| `chore/monorepo-setup` | Frontend app after the monorepo and backend files were removed | Vite app at the repository root | Frontend-only branch. The name is historical |
| `website` | Initial React and TypeScript setup, router, 3D object system, orbit camera, favicon | Vite app at the repository root | Silas's main frontend line |
| `3d_visualization` | Model loading and lighting on top of the 3D object system | Vite app at the repository root | Silas's active 3D work |
| `walkthroughs_list_page` | Walkthroughs list page skeleton | Vite app at the repository root | Based on `website`. Still carries old monorepo files |
| `feat/tavr-content` | TAVR dummy content, docs, initial README | Monorepo | Merged into `main` (PR #1). No longer used |

### How the branches relate

```
                         main  (monorepo base: shared contract, TAVR content, docs)
                          ^
                          |  PR #1
                   feat/tavr-content

   backend/seed-and-validation   branches from the same base, adds backend code
   (not merged into main yet)

   chore/monorepo-setup  <---- PR #2 ----  website  <---- PR #3 ----  3d_visualization
   (frontend-only now)                      (Vite app)                  (model loading, lighting)
                                               |
                                               +--  walkthroughs_list_page  (list page)
```

Two separate lines of work currently exist: the **monorepo line** (`main`, `backend/seed-and-validation`) and the **frontend line** (`website` and the branches around it). They have different root layouts, so merging the frontend line into `main` needs a deliberate step (see section 6).

## 4. Code layout

### 4.1 Monorepo line (`main`, `backend/seed-and-validation`)

```
.
├── README.md
├── CLAUDE.md                  Shared working rules for AI-assisted development
├── .claude/skills/            Project skills (contract changes, Convex functions, ...)
├── docs/
│   ├── contracts.md           Frontend-backend contract
│   ├── tavr-demo.md           TAVR scenes and 3D asset status
│   └── github-structure.md    This file
├── apps/frontend/             Reserved for the frontend (README only on main)
└── packages/
    ├── shared/                Contract: zod schemas, types, dummy fixtures, tests
    └── backend/               Convex project (schema, functions, seed, validator)
```

- **`packages/shared`** is the single source of truth for data exchanged between frontend and backend. A `structure_id` is the key that links a database row to a mesh name in the 3D model.
- **`packages/backend`** is a Convex project. The backend branch also adds read queries, a seed mutation, and a validator that only lets valid `scene_actions` through.
- Tooling: pnpm workspace, TypeScript (strict), Vitest, ESLint.

### 4.2 Frontend line (`website`, `3d_visualization`, `chore/monorepo-setup`)

```
.
├── index.html
├── package.json               App name: ask-ray
├── vite.config.ts
└── src/
    ├── main.tsx               Routes
    ├── App.tsx                Landing page
    └── walkthrough/           3D walkthrough page
        └── visualization/     three.js scene, objects, camera controllers
```

- Stack: React, TypeScript, Vite, three.js, React Router. Pages use CSS Modules, and folder and file names are `snake_case`.
- The 3D code is built around a `SceneObject` base class and swappable camera controllers (an orbit controller today).

## 5. Pull request history

| PR | From | Into | State |
|---|---|---|---|
| #1 | `feat/tavr-content` | `main` | Merged |
| #2 | `website` | `chore/monorepo-setup` | Merged |
| #3 | `3d_visualization` | `website` | Merged |

## 6. Plan for bringing the lines together

1. Agree with the frontend owner to place the Vite app in `apps/frontend/` (the layout reserved in the monorepo), and to rename the package to match the monorepo (`@cal-hacks/frontend`).
2. Move the frontend line into that layout and restore the monorepo root files.
3. Merge `backend/seed-and-validation` into the result.
4. Open one pull request into `main`.

Until then, each person keeps working on their own line and pushes only to their own branches.

## 7. Conventions

- **Do not push directly to `main`.** Use a branch and a pull request. (This file and the initial README were placed on `main` directly on request.)
- **Never force-push** a shared branch.
- **No secrets in git.** API keys, tokens, and `.env*` files stay out of the repository. Server secrets live in Convex environment variables (`npx convex env set`). The variable names are listed in `.env.example`.
- **No real patient data.** Use public or synthetic data only.
- **Changing the contract** (`packages/shared`)? Update `docs/contracts.md` in the same change and tell the frontend owner what changed.
- **Everything is written in English**: code, comments, documentation, fixtures, and commit messages.

## 8. Open items

- The frontend app is not on `main` yet (see section 6).
- The app is called **Ask-Ray** in the frontend `package.json` and page title, and **Simple Surgeries** in the design and planning notes. The final name is undecided.
- `walkthroughs_list_page` still contains old monorepo files from before the cleanup.
- The chatbot is partly built: speech-to-text with Cartesia is implemented in the backend (it needs the `CARTESIA_API_KEY` environment variable and a microphone button in the frontend). Answers from OpenAI are planned but not implemented.

## 9. Related documents

| Document | Contents |
|---|---|
| [`contracts.md`](contracts.md) | Frontend-backend data contract |
| [`tavr-demo.md`](tavr-demo.md) | TAVR scenes and 3D asset status |
| [`frontend-backend-split.md`](frontend-backend-split.md) | Who builds what, with the timeline as an example |
| [`backend-api.md`](backend-api.md) | Backend functions the frontend can call, including voice input |
| [`product-roadmap.md`](product-roadmap.md) | Planned features and implementation status |
