# Cal_Hacks_13 — 3D human organ and surgical procedure demo website

## Project overview
- Frontend: a 3D organ view (Three.js family) with a side panel next to it that shows explanations.
- A surgical procedure is represented not as a video but as **3D scene state data (JSON) for each step**.
- Chatbot: it answers questions and also sends 3D control commands (`scene_actions`) that move the camera, highlight parts, change transparency, jump between steps, and keep the side panel in sync.
- The backend uses Convex, and by default there is no separate server (queries, mutations, actions, HTTP actions, file storage, vector search).
- pnpm workspace monorepo, TypeScript (strict).

## Product context
The app is called **Simple Surgeries**. A patient watches a procedure in 3D, selects a part to read about it, and asks a chatbot that answers in the context of the current scene and highlights the related parts.
`docs/product-roadmap.md` is the reference for the feature list, backend needs, and implementation status. When you build a feature or the plan changes, update that document too. `docs/architecture.md` shows how the parts fit together.

## Folder structure and ownership
```
.
├── CLAUDE.md                 # This file (shared root rules)
├── .claude/skills/           # Project skills
├── docs/                     # Documents (contracts.md is the frontend-backend contract)
├── apps/frontend/            # Frontend owner's area
├── packages/backend/         # Convex project (includes convex/) — backend owner's (the user's) area
├── packages/shared/          # Contract: zod schemas, types, and example fixtures
└── packages/progress/        # SpacetimeDB module that stores viewing progress (see its README)
```

- `packages/backend`: the user's (backend owner's) area. Edit freely. Detailed rules are in `packages/backend/CLAUDE.md`.
- `apps/frontend`: **do not modify unless the user asks.**
- `packages/shared`: changes affect both sides. Whenever you change it, update `docs/contracts.md` in the same change and **print a change summary to hand to the frontend owner** (see the `contract-change` skill).

## Common commands
```bash
pnpm install                 # install
pnpm dev:backend             # = convex dev (first run needs a login and project creation; see Security below)
pnpm dev:frontend            # the ask-ray website (Vite dev server)
pnpm build:frontend          # type-check and build the website
pnpm typecheck               # tsc in every package
pnpm lint                    # eslint for the packages, oxlint for apps/frontend
pnpm test                    # vitest (packages/shared, packages/backend, apps/frontend)
pnpm --filter @cal-hacks/shared test   # run one package
```
The frontend is a Vite app (React, TypeScript, three.js). See `apps/frontend/README.md`.

## Code and documentation rules
- **Everything is written in English**: code, identifiers, comments, documentation (`*.md`), UI text, fixtures, and commit messages.
- Common identifier rules are defined in `docs/contracts.md` (`structure_id` matches a GLB mesh name one to one).
- Package names use the `@cal-hacks/*` scope.

## Way of working
- For a big change, **present a plan first** and get approval before implementing.
- Keep commits small. Commit messages use the form `type(scope): summary` (for example `feat(backend): ...`).
- **Do not commit or push directly to main.** Always work on a working branch.
- Do not commit with a broken typecheck or failing tests.

## Security
- Never commit API keys, tokens, or secrets. `.env.local` is gitignored, and the list of required variables lives in `.env.example`.
- Manage server secrets (LLM and speech-to-text keys, etc.) only through Convex environment variables (`npx convex env set`).
- If `npx convex dev` or similar asks for an account login or project creation, stop and guide the user. Do not handle logins or secrets on their behalf.
- Never use real patient data. Use only public or synthetic (dummy) data.
