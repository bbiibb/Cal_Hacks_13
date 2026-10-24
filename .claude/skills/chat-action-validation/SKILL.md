---
name: chat-action-validation
description: Procedure for adding a new chatbot scene_action type or changing the validation rules for LLM output (scene_actions). Always keep zod validation and database existence checks together.
---

# scene_action and LLM output validation procedure

Principle: **only scene_actions produced by the LLM that pass both (1) the zod schema check and (2) the existence check in the database are passed to the frontend.** Failed items are dropped and logged.

## When adding a new action type
1. This is a contract change, so first follow the `contract-change` skill (add it to the `SceneActionSchema` union in `packages/shared`).
2. Add the same shape to `vSceneAction` in `packages/backend/convex/validators.ts`.
3. **Define the database existence rule**: what ids the action references (structure_id, instrument_id, procedure_slug plus step_index, and so on) and which table and index confirm them.
4. Reflect it in the validation function. Validation reads the database with an `internalQuery`, and the `action` that calls the LLM filters with that result.
5. Add tests: a passing case, an unknown type, an id that does not exist, out-of-range values (opacity, step_index), and an empty array.
6. Update the fixtures (`chat-response.example.json`) and `docs/contracts.md`.

## When changing validation rules
- A change that **loosens** the rules (removing or relaxing validation) needs a written reason and the user's approval.
- Even if the prompt tells the LLM the allowed action list and id list, keep the server-side validation as it is (a prompt is not a safety mechanism).
- When parsing the LLM output fails: replace `scene_actions` with `[]` and deliver only a safe `message`.

## Response rules
- Do not state medical information that has no source (`sources`) as fact; say you do not know. Keep the content educational.
- The final `ChatResponse` sent to the frontend must always pass `ChatResponseSchema.parse`.

## Verification
- `pnpm typecheck && pnpm test && pnpm lint`
- If the frontend is affected, print the "change summary for the frontend" from `contract-change`.
