---
name: contract-change
description: Procedure to follow when adding, changing, or removing a zod schema in packages/shared (Scene, SceneAction, ChatResponse, identifiers, and so on). Use it for any work that changes the frontend-backend contract.
---

# Procedure for changing the contract (packages/shared)

A change to `packages/shared` affects the frontend owner. The work is done only when every step below is finished.

1. **Plan first**: write down what changes and why, and its effect on the frontend (breaking change or backward compatible), and get the user's approval.
2. **Change the schema**: edit the zod schemas in `packages/shared/src/*.ts` and check the exports in `src/index.ts`. Prefer backward compatibility where possible (a new field should be `optional` or `nullable`).
3. **Update the fixtures**: change `packages/shared/fixtures/*.json` so they follow the new schema. There is no generator script, so edit the JSON by hand. Use dummy data only.
4. **Tests**: add passing and rejecting cases for the new rule in `packages/shared/test/fixtures.test.ts`.
5. **Sync the backend**: update `packages/backend/convex/validators.ts` and `schema.ts` to the new contract. If a required field is removed from `schema.ts`, documents already stored will no longer match: temporarily turn schema validation off (`schemaValidation: false`), reseed with `seed:run`, then turn it back on.
6. **Update the docs**: update the relevant section of `docs/contracts.md` and the "Change history" table at the bottom (date, change, impact).
7. **Verify**: `pnpm typecheck && pnpm test && pnpm lint` must pass.
8. **Print a change summary for the frontend**: at the end, print it in the format below.

```
## Change summary for the frontend
- What changed: (per schema or field)
- Breaking change: yes/no (if yes, what the frontend must change)
- New or changed fixtures: (file names)
- Reference: docs/contracts.md#...
```

Do not modify `apps/frontend`. Write any frontend change that is needed only in the summary.
