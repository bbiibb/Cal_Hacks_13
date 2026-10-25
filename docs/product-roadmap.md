# Product Roadmap and Backend Status (Simple Surgeries)

This document summarizes the team planning note (`New note.pdf`, not included in the repository) and what the team members described.
It records which features are planned, what the backend (`packages/backend`) has to do for them, and how far each one is implemented.
When the plan changes, update this document first. All content is educational and is not medical advice. The 80 TAVR facts come from the team's document "Information about TAVR: data for chatbot", which the project takes as correct. The step texts, the part descriptions and the four heart-anatomy facts (right atrium, right ventricle, superior vena cava, pulmonary artery) were written by the project, not taken from that document.

The demo is **English only**: the chatbot's rules (camera commands, emergency symptoms, the scope gate, personal-detail removal) read English.

Status markers: ✅ implemented · 🟡 partly (only the schema or data exists) · ⬜ not implemented

## 1. Product overview

To help patients get detailed information about an upcoming procedure, the procedure is **visualized in 3D** and shown together with **written explanations**.

- When a patient moves the mouse over the 3D model (drag or select), the explanation for that part is shown.
- With the built-in **AI chatbot**, patients ask follow-up questions and quickly understand side effects and precautions.
- The first demo topic is **TAVR** (`docs/tavr-demo.md`). Expansion candidates: other organs besides the heart, tumors, and so on.

Screen layout (main page mockup): on the left the 3D image with a **timeline (slider, 00:00)**; on the upper right the explanation of the current step (Step N); on the lower right a **question and AI answer chat** with an input box.

## 2. Roles and concerns

- UI (frontend): Silas / Backend (Convex): Siun
- Concerns in the planning note: API cost and GPU resources, division of roles, differentiating the topic

## 3. Backend needs and status per feature

| # | Feature | What the backend has to do | Status |
|---|---|---|---|
| F1 | 3D scene per step with a side-panel explanation | Store and read structures, instruments, procedures, and steps; dummy seed | ✅ `procedures.*`, `structures.*`, `instruments.list`, `seed:run` |
| F2 | **Select a part to see its explanation** | Give each part a variable (`structure_id`) and return the explanation of the selected part. Step-specific explanations use `annotations` | 🟡 Part names and explanations ✅: hovering a part shows its name and clicking pins it with its explanation (`structures.getById` content), also for single chambers inside the one-mesh heart model (`heart_regions.ts`). Step-specific explanations ⬜ (only the `annotations` table exists) |
| F3 | **Highlight parts to match the AI answer** | Validate the `scene_actions` (focus, highlight, set_opacity, goto_step) the AI produces and pass them to the frontend | ✅ Validator and the chatbot that produces `focus`, `highlight`, `goto_step`, `zoom`, `rotate`, and `reset_view`. Frontend handling ✅ (`SceneDirector`): the parts an answer points at change color and the camera moves to them, including single chambers inside the heart model; the next answer replaces them |
| F4 | Chatbot | See 3.1 below | ✅ Backend (`chat.createSession`, `chat.ask`, `chat.askByVoice`, 3D commands, safety nets) and the frontend chat panel (answers, follow-up buttons, parts shown in 3D, sources, voice, privacy layer, Slow / Fast switch). A command that only moves the view is answered by rules without a model |
| F5 | Choose the procedure name and approach (as guided by the hospital) | The same procedure is explained differently per approach, so store approach variants on the procedure and let the user choose | ⬜ Schema extension needed |
| F6 | Move between steps with the timeline | Provide the step order and a short label (`short_title`). The slider UI is frontend (`docs/frontend-backend-split.md`) | ✅ Step-based slider built. Step 0 is an introduction about the symptoms with only the heart on screen; steps 1 to 5 are the procedure. Continuous time (seconds) would add `duration_ms` if needed |
| F7 | Comprehension check and a list of "questions to ask the doctor in charge" | Build a short comprehension check and a question list from the conversation | ⬜ |
| F8 | Expand to other organs and tumors | A data model that can hold many structures and procedures | ✅ The model is general. Add content with the `seed-content` skill |
| F9 | Source material (RAG) and showing sources | Store documents and embeddings, vector search, attach `sources` to answers | ✅ 84 TAVR and anatomy facts (`docs/knowledge-base.md`), keyword plus vector search, both models read them, `sources` is filled in each answer and shown under it in the chat panel. The facts from the team's document are taken as correct |
| F10 | Cost and stability (API concern) | Request length limits, rate limits, response cache, a fallback answer on failure | 🟡 Length limit and a 1.5 s wait between questions of one session exist, but a question without a session id, new sessions and upload URLs have no limit. Fast mode (paid cloud model) asks the patient first. Real rate limit, usage log and a daily budget ⬜ |
| F14 | **Safety and privacy** (no medical advice, no invented facts, personal data) | Scope gate, advice filter, grounding check, personal-detail removal, local-only mode, conversation deletion | 🟡 Built and tested (see `docs/safety.md`): scope gate, advice filter, grounding, personal-detail removal on the server and an on-device PII guard in the frontend, local-only mode, deletion of conversations including a scheduled purge, UI disclaimer, citations. Authentication 🟡 backend built (Convex Auth, username + password, see `docs/auth.md`), needs the one-time setup commands and the frontend form |
| F11 | **Add heart conditions** (more procedures per condition later) | Link conditions (`conditions`) and procedures (`procedures.condition_slug`) so the app grows by content, without code changes | ✅ Structure ready (only `aortic_stenosis` for now). Candidates to add: coronary artery disease (PCI, CABG) and others |
| F12 | **Voice questions** (a microphone button in the chatbot) | Turn a recording into text with Cartesia speech-to-text and delete the recording right away | ✅ Microphone button (PR #11) and backend: `speech.generateUploadUrl` -> upload -> `chat.askByVoice`; needs `CARTESIA_API_KEY`, and `ALLOW_CLOUD_STT=true` when the model runs locally. The panel hides the microphone while the on-device privacy layer is on, because audio cannot be redacted. Rate limiting ⬜ |
| F13 | **3D control by the chatbot** (zoom, rotate, highlight, go to a step) | Produce validated camera and step commands from the model's answer and from simple spoken commands | ✅ Backend (`zoom`, `rotate`, `reset_view`, `focus`, `highlight`, `goto_step`) and frontend. "Zoom in", "can you zoom in?" and "show me the right atrium" are read by rules, so they answer in under a second |
| F15 | **Choose how the chatbot answers** (slow or fast) | Answer with the local Llama (slow, free) or the cloud model (fast, paid) as the patient chooses per question | ✅ `speed` argument of `chat.ask` and `chat.askByVoice`, and a Slow / Fast switch under the chat that warns before fast mode |

### 3.1 What the chatbot (F4) needs

Chatbot behavior the planning note asks for:
- Pick the explanation that matches the **procedure name and approach** the hospital guided.
- Help the patient check, step by step, where the problem is and what is put in or removed, by looking at it in 3D.
- Let the patient **ask in connection with the scene being watched**. Example: "Does the equipment you just put in remain in my body?"
- At the end, briefly check what the patient understood and organize the questions to ask the doctor in charge.

Decided building blocks: speech-to-text with **Cartesia** (F12, done on the backend) and answers from a **free open-weight model through Groq** (`openai/gpt-oss-20b`; Groq retired its Llama models; any OpenAI-compatible endpoint works), using the JSON answer format of the Mana prototype (`answer`, `highlight`, `safety`, `doctorQuestion`, `urgent`) extended with `zoom`, `rotate`, `step`, and `reset_view`. See `docs/chatbot.md`.

Components needed:
1. **Request contract** (`ChatRequest`): `{ message, context: { procedure_slug, step_index, selected_structure_id | null } }` ✅ in `packages/shared`.
2. **Session and message functions**: create a session, store messages, load history ✅
3. **LLM-calling action**: the prompt is built on the server from the current step and the parts of the model ✅ (the API key is only a Convex environment variable)
4. **Assembling and validating the response**: a `ChatResponse` is built from the model's JSON, and only `scene_actions` that pass the validator are used ✅
5. **Safety rules**: educational tone, "I do not know" when unsure, no diagnosis or medicine advice, and urgent symptoms flagged by a rule-based safety net as well ✅
6. **Still open**: try it with a real free key and add a real rate limit. Sources (RAG) are done: see `docs/knowledge-base.md`.

## 4. Feature proposed by a team member (original text)

> So, I plan to add a feature where each part of the heart is assigned a variable; this will allow the system to provide an explanation when a user selects a specific part. Additionally, I intend to implement a function that highlights the relevant part of the heart based on an AI-generated response. Although I haven't been able to implement this yet—as I don't have the 3D model—I have clearly defined the functionality, so it should be straightforward to handle the coding with the help of AI.

Interpretation from the backend point of view:
- "A variable for each part" = **`structure_id`**. It is already the shared key of the contract and matches a GLB mesh name one to one (`docs/contracts.md`).
- "An explanation when selected" = F2. The frontend passes the selected mesh name as `structure_id` to `structures.getById`.
- "Highlight based on the AI response" = F3. Put `highlight` or `focus` in the `scene_actions` of the chatbot response, and deliver only what passes validation.
- The 3D models now exist (`apps/frontend/public/models`). The heart is one mesh, so its parts are named by position instead of by mesh name (section 5).

### Open questions
- (Decided) The timeline (F6) moves by step. If continuous time is needed, add `duration_ms` to `steps`.
- (Decided) Hovering a part shows its name; clicking pins it and shows its explanation. The backend handles both the same way with `getById`.
- Whether to include approach variants (F5) in the first version, or start with TAVR's single approach.
- Budget limit and key management for the chatbot LLM (F10): fast mode is paid; a daily cap is not built yet.

## 5. Heart part variables (`structure_id`) status

For the 19 structures currently in `packages/shared/fixtures/structures.json`, see `docs/tavr-demo.md`.
The heart model is a single mesh, so a heart part is named by an outline on the model (`heart_regions.ts`, checked in `regions.test.ts`) instead of by a mesh name. If the 3D owner exports one mesh per part, bind the mesh names instead and delete the outlines. Parts still missing are listed below.

| Candidate id (proposed) | Meaning | Note |
|---|---|---|
| `left_atrium` | Left atrium | Not added |
| `right_atrium`, `right_ventricle`, `superior_vena_cava`, `pulmonary_artery` | Right atrium, right ventricle, superior vena cava, pulmonary artery | ✅ Added; located inside `heart_part_2.glb` by position (`heart_regions.ts`), borders are approximate |
| `interventricular_septum` | Interventricular septum | Not added |
| `mitral_valve`, `tricuspid_valve`, `pulmonary_valve` | Mitral, tricuspid, and pulmonary valves | Not added (the aortic valve already exists as `aortic_valve`) |
| `left_ventricle`, `aorta`, `aortic_valve`, `left_coronary_artery`, `right_coronary_artery` | Left ventricle, aorta, aortic valve, left and right coronary arteries | ✅ Already there |

## 6. Data flow

**Select a part, see its explanation (F2)**
1. The frontend reads the selected mesh name from the 3D view (= `structure_id`).
2. It calls `api.structures.getById({ id })` and shows the name and explanation in the side panel.
3. If a step-specific explanation is needed, it reads `annotations` (structure plus step) (⬜ a function must be added).

**Ask a question, get an answer and a highlight (F3, F4)**
1. The frontend sends the question and the current context (procedure, step, selected part). For a voice question it first sends the recording to `speech.transcribe` (F12).
2. A backend action calls the LLM with the context.
3. The `scene_actions` in the response are validated with `internal.sceneActions.validate` (zod plus database existence).
4. Only what passes is delivered to the frontend as a `ChatResponse` (`message`, `scene_actions`, `side_panel`, `sources`).
5. The frontend applies the camera move, highlight, transparency, and step change.

## 7. Suggested next work (in priority order)

1. Real rate limits, including questions without a session id, new sessions and upload URLs, and a daily budget for fast mode (F10)
2. Keep the vector index in step with the content: today `seed:run` and `rag:indexContent` must be run by hand after every content change
3. A usage log (provider, speed, latency, camera-only or model, safety events; never the patient's words) so cost and speed can be seen
4. Tie sessions to the user database a teammate is building (login)
5. Reading step-specific part explanations (`annotations` seed and query) (F2)
6. The comprehension check and organizing questions for the doctor (F7)
7. Approach variants of a procedure (F5)
8. Models and step scenes for the guidewire, catheter and balloon (a teammate)
9. More named heart parts (left atrium, valves, pulmonary veins): they need exported meshes or clear outlines
