---
name: seed-content
description: Procedure for adding or changing dummy surgical content (structures, instruments, steps, explanations). Use only public or synthetic data, and keep the fixtures and the database seed consistent.
---

# Procedure for adding dummy content

## Principles
- All content is **educational dummy content**. Real patient data is forbidden; use only public material or synthetic text written by us.
- Mark explanation text with "(Dummy educational content)" so it is clear that it is not a reference source.
- If you quote an outside source, record it in `sources` or in the docs.
- Everything is written in English.

## Adding a new heart condition
A condition is added with content only, without code changes.
1. Add `{ slug, name_en, description }` to `packages/shared/fixtures/conditions.json` (follow the `ConditionSlug` rule).
2. In the procedure fixtures (`procedure.*.json`) that treat it, set `condition_slug` to the same slug and choose an `order`.
3. Add an import so the seed (`convex/seed.ts`) reads the new procedure file (today it reads only TAVR), and run `pnpm test` to check referential integrity.
4. Add the structures and instruments that the new procedure uses with steps 1 and 2 below.

## Procedure
1. **Add a structure**: add an entry to `packages/shared/fixtures/structures.json`.
   - `id` follows the `StructureId` rule (lower-case snake_case, `.` for hierarchy) and **must match a GLB mesh name one to one**. Confirm the name with the 3D owner.
   - `parent_id` is an existing structure or `null`.
2. **Add an instrument**: add an entry to `instruments.json` (`InstrumentId` rule).
3. **Add a step**: add it to `steps` in `procedure.*.json`.
   - `index` is consecutive from 0. Every step needs a `scene` (camera, structures, instruments, animation_clip) and a `side_panel`.
   - Every id referenced by `scene` and `side_panel` must exist in the structure and instrument fixtures above.
   - For a new procedure, choose a `slug` (lower-case snake_case) and name the fixtures file `procedure.<name>.json`.
4. **Timeline label**: give every step a `short_title` (a short timeline label, 16 characters or fewer).
5. **Update the tests**: make `packages/shared/test/fixtures.test.ts` check the new file and references, and confirm with `pnpm test`.
6. **Seed the database**: the seed mutation (`convex/seed.ts`; create a new one if needed) reads the fixtures and inserts them in the order `structures`, `instruments`, `procedures`, `steps`. Upsert with the `by_structure_id` and `by_slug` indexes so that running it again creates no duplicates (apply the `convex-function` checklist).
7. **Docs**: if the contract format changes, follow `contract-change`. If the format is the same and only the content grew, `docs/contracts.md` does not need an update.
8. **Verify**: `pnpm typecheck && pnpm test && pnpm lint`
