# packages/backend — Convex backend

Follow the rules in the root `CLAUDE.md` first. This file holds the rules that apply only to the backend.

## Convex rules
- **Every function must declare `args` and `returns` validators.** (`query`, `mutation`, `action`, and all `internal*` functions)
- Queries use indexes. Do not scan whole tables with `filter()`; use `withIndex`, and define the needed indexes in `convex/schema.ts`.
- **Call external APIs (LLM, speech-to-text, and so on) only from an `action`.** Never from a query or mutation. An action reads and writes the database with `ctx.runQuery` and `ctx.runMutation`.
- Make functions that must not be exposed publicly with `internalQuery`, `internalMutation`, or `internalAction`.
- Manage secrets **only as Convex environment variables** (`npx convex env set NAME value`). Declare each one in `convex/convex.config.ts` and read it through `env` from `./_generated/server`. Never put secrets in code, `.env.local`, or fixtures.
- Do not edit `convex/_generated/` by hand.
- When you create a new function, follow the checklist in the `convex-function` skill.

## Domain rules
- **`structure_id` is the shared key that matches a GLB mesh name one to one.** Do not invent or rename it freely. If it must change, agree with the frontend and 3D asset owners and follow the `contract-change` skill.
- **Pass `scene_actions` produced by the LLM to the frontend only if they pass both (1) the zod schema check in `packages/shared` and (2) the existence check in the database (structure, instrument, procedure, step, and so on).** Drop failed items and log them. When you add an action type or change the validation rules, follow the `chat-action-validation` skill.
- Medical information is **educational**. If there is no source, do not guess; say you do not know. Avoid wording that looks like a diagnosis or treatment advice, and make it clear in responses that the content is educational.
- When you add dummy content, follow the `seed-content` skill. Never use real patient data.
- Patient voice recordings are deleted right after transcription (`convex/speech.ts`). Keep it that way.

## Roadmap
The feature table (F1 to F12) in `docs/product-roadmap.md` is the reference for what is implemented and what remains. When you implement a feature, update the status in that table.

## Relationship to the contract
- The reference for the data exchanged with the frontend is `packages/shared` (zod) and `docs/contracts.md`.
- `convex/validators.ts` is that contract expressed as Convex validators. Change it together with the contract.

## Commands
```bash
pnpm --filter @cal-hacks/backend dev        # convex dev
pnpm --filter @cal-hacks/backend typecheck
pnpm --filter @cal-hacks/backend test
pnpm --filter @cal-hacks/backend exec convex run seed:run    # seed the fixtures (after checking the target is a development deployment)
```

## Layout
- `convex/*.ts`: function files (`structures`, `instruments`, `conditions`, `procedures`, `seed`, `sceneActions`, `speech`, `chat`, `chatContext`, `chatStore`). The API meant for the frontend is documented in `docs/backend-api.md`.
- `convex/lib/`: pure logic that does not touch the database or the network by itself (`mappers`, `sceneActions`, `cartesia`, `multipart`, `llm`, `chatPrompt`, `chatParse`, `chatActions`, `chatPipeline`). Unit tests live in `test/`.
- `convex/_generated/`: committed, as Convex recommends. `convex dev` updates it, so do not edit it by hand.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
