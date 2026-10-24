# Frontend and Backend Responsibilities

A document for deciding "who builds this?". It uses the timeline slider as the example.

## One-line rule

- **What is drawn and moves on the screen** → frontend (apps/frontend)
- **What data exists, and whether that data is correct** → backend (packages/backend)
- The **format** the two exchange → the contract (packages/shared, `docs/contracts.md`). Both sides agree before it changes.

## Example: the timeline slider

Reference screen: one slider at the bottom with the step labels lined up along it (for example `Narrowed art… / Inserting the… / Dye and gui… / Balloon wide… / Placing the… / Finish and re…`), and arrows on both sides to move. The label of the current step is bold, and the part already passed is filled with color.

| Part | Owner | Why |
|---|---|---|
| The slider bar, the filled color, the round handle | Frontend | Pure screen element |
| The left and right arrows, clicking a label, keyboard control | Frontend | Input handling |
| Cutting a long label with `…`, switching to numbers on a narrow screen | Frontend | Layout |
| The "which step are we on" state (`stepIndex`) and reflecting it in the URL | Frontend | Screen state |
| Camera movement, transparency changes, and equipment appearing when the step changes | Frontend | 3D rendering |
| **How many steps there are and in what order** | **Backend** | Content data |
| **The title, the short label (`short_title`), and the explanation of each step** | **Backend** | Content data |
| **What state the 3D view must be in at each step** (`scene`: camera, transparency, instrument positions, and so on) | **Backend** | Content data |
| Checking that the step really exists when the chatbot says "go to step 3" (`goto_step`) | **Backend** | Validation |

So the slider itself is entirely frontend work. The backend hands over the **data that becomes the ticks and labels of the slider** in one call to `procedures.getBySlug`.

```ts
const procedure = useQuery(api.procedures.getBySlug, { slug: "tavr" });
// procedure.steps.map(s => s.short_title)  ->  slider labels
// procedure.steps.length                    ->  number of slider ticks
// procedure.steps[stepIndex].scene          ->  the scene to apply to the 3D view
```

### What the backend does not do
- It does not store the slider position on the server. (If "resume where you left off" is needed later, it can be added by saving `currentStepIndex` in `chatSessions`.)
- It does not support moving by time (seconds). The timeline today moves **by step**. Playing continuously between steps would need `duration_ms` on `steps`, which can be added with the `contract-change` procedure when it is needed.

## The same rule applies to other features

| Feature | Frontend | Backend |
|---|---|---|
| Click a part to see its explanation | Detecting the click (raycasting), the selection highlight, the panel UI | Provides the name and explanation with `structures.getById` |
| AI answer highlights parts | Applies the received `scene_actions` to the 3D view | Builds the chatbot answer and passes on `scene_actions` after validation |
| Procedure and condition picker | Tabs and dropdown UI | `conditions.list`, `procedures.listByCondition` |
| Voice question (microphone button) | Recording with MediaRecorder, the button and its states, uploading the recording | `speech.generateUploadUrl` and `speech.transcribe` (speech-to-text with Cartesia, recording deleted afterwards) |
| Quiz and doctor-question list | UI and input | (planned) storage and retrieval |
