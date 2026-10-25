# Frontend-Backend Contract

The single reference for the data exchanged between the frontend (`apps/frontend`) and the backend (`packages/backend`).
The actual definitions are the zod schemas in `packages/shared/src`; this document summarizes them and explains the rules.
**When you change a schema, update this document in the same commit** (see `.claude/skills/contract-change`).

## 1. Identifiers

| Name | Rule | Examples |
|---|---|---|
| `StructureId` | Lower-case snake_case segments joined with `.` to express hierarchy. **Matches a GLB mesh name one to one** | `aorta`, `aortic_valve`, `aortic_valve.calcification` |
| `InstrumentId` | Lower-case snake_case | `guidewire`, `delivery_catheter` |
| `ProcedureSlug` | Lower-case snake_case | `tavr` |
| `ConditionSlug` | Lower-case snake_case. The heart condition a procedure treats | `aortic_stenosis` |

## 2. Scene (the 3D scene state of one step)

A procedure is represented not as a video but as Scene data for each step.

```ts
Scene = {
  camera: { position: [x,y,z], target: [x,y,z], duration_ms: number },
  structures: { id: StructureId, opacity: 0..1, highlight: boolean }[],
  instruments: { id: InstrumentId, transform: { position, rotation (radians, Euler), scale } }[],
  animation_clip: { name: string, loop: boolean } | null,
}
```

- A structure that is not listed in `structures` is treated as being in the frontend's default state (opaque, not highlighted).
- Step = `{ index, title, short_title, scene, side_panel }`. `short_title` is a short name for the timeline label, and `index` is a tick on the slider.
- The step number people see is the step's `index`, so step 0 is allowed to be an introduction: TAVR's step 0 shows only the heart and explains the symptoms, and steps 1 to 5 are the procedure. The chatbot's "go to step 3" and the slider use the same numbers.
- Procedure = `{ slug, title, summary, condition_slug, order, steps[] }`. `condition_slug` is the condition it treats (null if none), and `order` is the display order within the same condition.
- Condition = `{ slug, name_en, description }`. A new heart condition only needs new content (a fixtures entry and a database row); no code change is needed.
- Structure = `{ id, name_en, parent_id, description }` and Instrument = `{ id, name_en, description }`. Names are in English. If another language is needed later, add it as a new field (for example `name_ko`) through the `contract-change` procedure.

## 3. SceneAction (commands the chatbot sends to the 3D view)

A union discriminated by `type`.

| type | Fields | Meaning |
|---|---|---|
| `goto_step` | `procedure_slug`, `step_index` | Jump to that step |
| `focus` | `structure_id`, `duration_ms?` | Move the camera to a structure |
| `highlight` | `structure_ids[]`, `enabled` | Turn highlighting on or off |
| `set_opacity` | `structure_id`, `opacity` | Change transparency |
| `zoom` | `direction` (`in` or `out`), `amount` (`small`, `medium`, `large`) | Move the camera closer or further |
| `rotate` | `direction` (`left`, `right`, `up`, `down`), `degrees` (5 to 180) | Orbit the camera around the model |
| `reset_view` | none | Return to the default camera |

The backend passes along only the scene_actions from the LLM that **pass both the zod schema check and the database existence check**.
The frontend can rely on that guarantee, but we still recommend defensive code that ignores an unknown id and logs a warning to the console.

## 4. ChatResponse

```ts
ChatResponse = {
  message: string,
  scene_actions: SceneAction[],
  side_panel: { title, body_markdown, related_structure_ids[] } | null,
  sources: { title: string, url: string | null }[],
  safety: string,          // one sentence the patient must know, or ""
  doctor_question: string, // a question to ask the doctor, or ""
  urgent: boolean,         // true when the patient describes an emergency
}
```

### ChatRequest

```ts
ChatRequest = {
  message: string, // 1 to 500 characters
  context: { procedure_slug: string, step_index: number, selected_structure_id: string | null },
}
```

`context` tells the chatbot what the patient is looking at, so questions like "what you just put in" can be answered. The conversation id (`sessionId`) is a separate argument of `api.chat.ask`. See [`docs/chatbot.md`](chatbot.md).

Medical information is educational, and when there is no source the chatbot says it does not know (`sources` can be empty).

### KnowledgeChunk (reference material for the chatbot)

```ts
KnowledgeChunk = {
  id: string,              // "risk.stroke"
  procedure_slug: string,
  topic: "overview" | "condition" | "candidacy" | "anatomy" | "procedure" | "comparison" | "instruments" | "risks" | "preparation" | "recovery" | "safety",
  title: string,           // short heading, also the source title
  text: string,            // patient-facing facts, answer first
  questions: string[],     // example questions, used only for search
  keywords: string[],      // search words
  structure_ids: StructureId[], // parts of the 3D model it is about
  source: string,
}
```

The frontend does not need this type. It is used by the backend and is described in [`docs/knowledge-base.md`](knowledge-base.md). The only visible effect is that `ChatResponse.sources` is now filled, for example `{ title: "Risk: stroke (TAVR patient information guide)", url: null }`.

## 5. Example data

`packages/shared/fixtures/` holds dummy data that follows the contract, and `pnpm test` checks schema conformance and referential integrity of ids.

- `structures.json`, `instruments.json`
- `conditions.json`
- `procedure.tavr.json` (TAVR, an introduction as step 0 and five steps; see [`docs/tavr-demo.md`](tavr-demo.md) for the scene plan and 3D asset status)
- `knowledge.tavr.json` (the chatbot's reference facts, see [`docs/knowledge-base.md`](knowledge-base.md))
- `chat-response.example.json`, `chat-request.example.json`

Everything is **educational dummy content** and not real patient data.

## 6. Storage format (Convex)

The database stores `scene`, `sidePanel`, and `sceneActions` with the same snake_case keys as the contract
(`packages/backend/convex/validators.ts`). Only the top-level fields of a table are camelCase.

> TODO: add an automatic check (a test) that the zod schemas and the Convex validators have not drifted apart.

## Change history

| Date | Change | Impact |
|---|---|---|
| 2026-10-23 | First draft | - |
| 2026-10-23 | Chose TAVR as the first demo procedure. Replaced fixtures and example ids (no change to the schema format) | Frontend: change references from `procedure.cholecystectomy.json` to `procedure.tavr.json` |
| 2026-10-23 | Added `Condition`, added `condition_slug` and `order` to `Procedure`, added `short_title` to `Step` (fields only added; existing fields unchanged) | Frontend: `short_title` can be used as a timeline label. New functions to list conditions and procedures |
| 2026-10-25 | Added the `zoom`, `rotate`, and `reset_view` scene actions, `ChatRequest`, and the `safety`, `doctor_question`, and `urgent` fields of `ChatResponse` (additions only) | Frontend: handle the three new actions in the 3D view and show `safety` and `urgent` in the chat. See `docs/chatbot.md` |
| 2026-10-24 | Replaced the four dummy TAVR steps with the five steps of the team's patient explanation, and added the `balloon` instrument (content only; the schema format is unchanged) | Backend: re-run `seed:run`. The chatbot prompt test on the backend branches expects "Step 2 of 4" and "Delivering the new valve" and needs updating |
| 2026-10-24 | Removed the Korean name field `name_ko` from `Structure`, `Instrument`, and `Condition`, and translated all fixtures to English | **Breaking**: frontend code must not read `name_ko`. Use `name_en` |
| 2026-10-24 | Added `KnowledgeChunkSchema` and the fixture `knowledge.tavr.json` (the chatbot's reference facts). `ChatResponse.sources` is now filled with the facts an answer is based on (the field already existed) | Frontend: no change needed. Optionally show `sources` under an answer |
| 2026-10-25 | Added step 0 to the TAVR procedure: an introduction about the symptoms, with only the heart on screen. The existing steps moved from indexes 0 to 4 to 1 to 5, and the number shown to people is now the index (they keep the numbers 1 to 5). The schema is unchanged | Backend: re-run `seed:run` (it also rebuilds the vector index). Frontend and chatbot: step numbers are the index, no longer index plus one |
