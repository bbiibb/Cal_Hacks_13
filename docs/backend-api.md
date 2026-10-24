# Backend API (Convex)

The list of Convex functions the frontend can use today. The data shapes follow the contract in [`docs/contracts.md`](contracts.md) (snake_case).
They all return **educational dummy data**.

## How to use

```ts
import { useQuery } from "convex/react";
import { api } from "@cal-hacks/backend/api";

const procedure = useQuery(api.procedures.getBySlug, { slug: "tavr" });
```

- The result of `useQuery` is `undefined` while loading and `null` when there is no data.
- The deployment URL is injected through an environment variable (see `.env.example`).

## Read queries (public)

| Function | args | Returns |
|---|---|---|
| `api.structures.list` | none | `Structure[]` (ordered by id) |
| `api.structures.getById` | `{ id }` | `Structure \| null` |
| `api.instruments.list` | none | `Instrument[]` |
| `api.conditions.list` | none | `Condition[]` (heart conditions) |
| `api.conditions.getBySlug` | `{ slug }` | `Condition \| null` |
| `api.procedures.list` | none | `{ slug, title, summary, condition_slug, order }[]` |
| `api.procedures.listByCondition` | `{ conditionSlug }` | The same list as above (ordered by `order`) |
| `api.procedures.getBySlug` | `{ slug }` | `{ slug, title, summary, condition_slug, order, steps: Step[] } \| null` (steps ordered by index) |
| `api.procedures.getStep` | `{ slug, index }` | `Step \| null` |

`Structure`, `Instrument`, `Condition`, and `Step` have the same shape as the types in `@cal-hacks/shared`.
Convex does not check that the coordinates inside `scene` have length 3, so check them with `SceneSchema.parse` in the frontend if needed.

`Step.short_title` is the label for the timeline slider. See [`docs/frontend-backend-split.md`](frontend-backend-split.md) for how far the frontend's part of the slider goes.

## Voice input (speech-to-text with Cartesia)

Voice input takes two calls. The recording is always deleted right after transcription (success or failure), because it is a patient's voice.

| Function | Kind | args | Returns |
|---|---|---|---|
| `api.speech.generateUploadUrl` | mutation | none | A one-time upload URL (string) |
| `api.speech.transcribe` | action | `{ storageId, language? }` (`language` is a short code such as `"en"` or `"ko"`, default `"en"`) | `{ text, language, duration_seconds \| null }` |

```ts
// 1. Record with MediaRecorder, then ask for an upload URL
const uploadUrl = await generateUploadUrl();
// 2. Send the recording to that URL (the Content-Type must be the audio type, e.g. audio/webm)
const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
const { storageId } = await response.json();
// 3. Transcribe it
const { text } = await transcribe({ storageId, language: "en" });
```

- Accepted audio: webm, ogg, mp4, m4a, mp3, wav, flac. Up to 10 MB.
- Errors are thrown as `ConvexError` and carry `{ code, message }` in `error.data`. Codes: `stt_not_configured`, `invalid_language`, `audio_not_found`, `audio_too_large`, `audio_empty`, `unsupported_audio_type`, `stt_timeout`, `stt_request_failed`, `stt_bad_response`.
- The server needs the secret `CARTESIA_API_KEY` as a Convex environment variable (`npx convex env set CARTESIA_API_KEY <key>`). Without it the error code is `stt_not_configured`.
- Not built yet: sending the transcript to the chatbot, and rate limiting. Until rate limiting exists, anyone who knows the deployment URL could use up the speech-to-text quota.

## Internal functions (cannot be called from the frontend)

| Function | Purpose |
|---|---|
| `internal.seed.run` | Puts the fixtures into the database (upsert, safe to run many times). The backend owner runs it with `npx convex run seed:run` |
| `internal.sceneActions.validate` | Validates the `scene_actions` produced by the LLM with zod and the database existence check, and returns only those that pass. The chatbot action will use it |

## scene_action validation rules

- Reject anything that does not match the schema (`SceneActionSchema`)
- Reject if the referenced `structure_id`, or `procedure_slug` plus `step_index`, is not in the database (a `highlight` action is rejected as a whole if even one id is missing)
- At most 10 per response
- Rejected items are kept in `rejected` with an `index` and a `reason`

## Not built yet

The chatbot (calling the LLM), session and message storage, RAG, and authentication are not implemented.
