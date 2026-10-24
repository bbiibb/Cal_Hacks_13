---
name: convex-function
description: Checklist for creating a new Convex function (query, mutation, action, internal function, or HTTP action) in packages/backend. It keeps validators, indexes, permissions, and tests from being forgotten.
---

# New Convex function checklist

Before you start, read the Convex rules in `packages/backend/CLAUDE.md` and `convex/_generated/ai/guidelines.md` again.

## Choosing the kind
- [ ] Read: `query`. Write: `mutation`. **Calling an external API (LLM, speech-to-text, and so on): `action`.**
- [ ] A function that must not be exposed to clients: `internalQuery`, `internalMutation`, or `internalAction`.
- [ ] Use `httpAction` (`convex/http.ts`) only when an HTTP endpoint is really needed.

## Writing it
- [ ] Declare the `args` validator (`v.*`). Keep identifier strings consistent with the `packages/shared` rules where possible.
- [ ] Declare the `returns` validator (including `v.null()`; never omit it).
- [ ] If it returns a contract type (Scene, SceneAction, ChatResponse, and so on), reuse the validators in `convex/validators.ts`.
- [ ] Queries use `withIndex`. If the needed index does not exist, add it to `schema.ts`. Never scan whole tables with `filter()`.
- [ ] No unbounded `.collect()`: use `.take(n)` or pagination.
- [ ] An action accesses the database through `ctx.runQuery` or `ctx.runMutation` (internal functions).
- [ ] Put logic that does not need the database or the network in `convex/lib/` so it can be unit tested.

## Permissions and security
- [ ] There is no authentication yet. Decide whether anyone may call the function, and validate the input strictly in write functions.
- [ ] Read secrets only from Convex environment variables, declared in `convex/convex.config.ts` and read through `env`. Never hard-code them.
- [ ] Do not put secrets or internal details in error messages. Throw `ConvexError` with a stable `code` and a safe `message`.
- [ ] Anything that handles patient data (such as a voice recording) must be deleted when it is no longer needed.

## Verification
- [ ] Tests: add unit tests with `vitest` for the pure logic (discuss `convex-test` when it is needed).
- [ ] `pnpm typecheck && pnpm lint && pnpm test`
- [ ] For checks that need `convex dev`, guide the user (do not handle logins or deployments on their behalf).
