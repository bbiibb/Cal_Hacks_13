# Product Roadmap and Backend Status (Simple Surgeries)

This document summarizes the team planning note (`New note.pdf`, not included in the repository) and what the team members described.
It records which features are planned, what the backend (`packages/backend`) has to do for them, and how far each one is implemented.
When the plan changes, update this document first. All content is educational dummy content and is not medical advice.

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
| F2 | **Select a part to see its explanation** | Give each part a variable (`structure_id`) and return the explanation of the selected part. Step-specific explanations use `annotations` | 🟡 Reading a part's explanation ✅ (`structures.getById`). Reading step-specific explanations ⬜ (only the `annotations` table exists) |
| F3 | **Highlight parts to match the AI answer** | Validate the `scene_actions` (focus, highlight, set_opacity, goto_step) the AI produces and pass them to the frontend | 🟡 Validator ✅ (`internal.sceneActions.validate`). The part where the chatbot produces actions ⬜ |
| F4 | Chatbot | See 3.1 below | ⬜ (only the `chatSessions` and `chatMessages` tables exist) |
| F5 | Choose the procedure name and approach (as guided by the hospital) | The same procedure is explained differently per approach, so store approach variants on the procedure and let the user choose | ⬜ Schema extension needed |
| F6 | Move between steps with the timeline | Provide the step order and a short label (`short_title`). The slider UI is frontend (`docs/frontend-backend-split.md`) | ✅ Decided: step-based. Continuous time (seconds) would add `duration_ms` if needed |
| F7 | Comprehension check and a list of "questions to ask the doctor in charge" | Build a short comprehension check and a question list from the conversation | ⬜ |
| F8 | Expand to other organs and tumors | A data model that can hold many structures and procedures | ✅ The model is general. Add content with the `seed-content` skill |
| F9 | Source material (RAG) and showing sources | Store documents and embeddings, vector search, attach `sources` to answers | ⬜ (only a TODO comment in `schema.ts`) |
| F10 | Cost and stability (API concern) | Request length limits, rate limits, response cache, a fallback answer on failure | ⬜ |
| F11 | **Add heart conditions** (more procedures per condition later) | Link conditions (`conditions`) and procedures (`procedures.condition_slug`) so the app grows by content, without code changes | ✅ Structure ready (only `aortic_stenosis` for now). Candidates to add: coronary artery disease (PCI, CABG) and others |
| F12 | **Voice questions** (a microphone button in the chatbot) | Turn a recording into text with Cartesia speech-to-text and delete the recording right away | 🟡 Backend ✅ (`speech.generateUploadUrl`, `speech.transcribe`; needs the `CARTESIA_API_KEY` environment variable). Microphone button in the frontend ⬜. Rate limiting ⬜ |

### 3.1 What the chatbot (F4) needs

Chatbot behavior the planning note asks for:
- Pick the explanation that matches the **procedure name and approach** the hospital guided.
- Help the patient check, step by step, where the problem is and what is put in or removed, by looking at it in 3D.
- Let the patient **ask in connection with the scene being watched**. Example: "Does the equipment you just put in remain in my body?"
- At the end, briefly check what the patient understood and organize the questions to ask the doctor in charge.

Decided building blocks: speech-to-text with **Cartesia** (F12, done on the backend) and answers from **OpenAI** (the approach of the Mana prototype: a JSON answer with `answer`, `highlight`, `safety`, `doctorQuestion`, and `urgent`).

Components needed:
1. **Request contract** (`ChatRequest`, proposed): `{ session_id, message, context: { procedure_slug, step_index, selected_structure_id | null } }`. The AI must know the current scene to answer questions like "the equipment you just put in". (⬜ not in `packages/shared` yet; add it with the `contract-change` skill)
2. **Session and message functions**: create a session, store messages, load a conversation (⬜)
3. **LLM-calling action**: call the LLM with the explanation of the current step in the prompt, built on the server (⬜. The API key only as a Convex environment variable)
4. **Assembling and validating the response**: build a `ChatResponse` from the LLM output and use only the `scene_actions` that pass the validator (validator ✅)
5. **Safety rules**: stay educational, say you do not know when there is no source, avoid wording that looks like a diagnosis or treatment advice, and flag urgent symptoms.

## 4. Feature proposed by a team member (original text)

> So, I plan to add a feature where each part of the heart is assigned a variable; this will allow the system to provide an explanation when a user selects a specific part. Additionally, I intend to implement a function that highlights the relevant part of the heart based on an AI-generated response. Although I haven't been able to implement this yet—as I don't have the 3D model—I have clearly defined the functionality, so it should be straightforward to handle the coding with the help of AI.

Interpretation from the backend point of view:
- "A variable for each part" = **`structure_id`**. It is already the shared key of the contract and matches a GLB mesh name one to one (`docs/contracts.md`).
- "An explanation when selected" = F2. The frontend passes the selected mesh name as `structure_id` to `structures.getById`.
- "Highlight based on the AI response" = F3. Put `highlight` or `focus` in the `scene_actions` of the chatbot response, and deliver only what passes validation.
- The 3D model does not exist yet, so the frontend work is on hold. The backend therefore **builds with dummy `structure_id` values first, and only the names are matched when the model arrives.**

### Open questions
- (Decided) The timeline (F6) moves by step. If continuous time is needed, add `duration_ms` to `steps`.
- Is selection a click or a mouse-over (drag)? (The backend handles both the same way with `getById`.)
- Whether to include approach variants (F5) in the first version, or start with TAVR's single approach.
- Budget limit and key management for the chatbot LLM (F10).

## 5. Heart part variables (`structure_id`) status

For the 15 TAVR-related structures currently in `packages/shared/fixtures/structures.json`, see `docs/tavr-demo.md`.
Candidates to add when extending "a variable for each part of the heart" are listed below. Add them **after the mesh names of the real 3D model are fixed**, matching those names.

| Candidate id (proposed) | Meaning | Note |
|---|---|---|
| `left_atrium`, `right_atrium` | Left atrium, right atrium | Not added |
| `right_ventricle` | Right ventricle | Not added |
| `interventricular_septum` | Interventricular septum | Not added |
| `mitral_valve`, `tricuspid_valve`, `pulmonary_valve` | Mitral, tricuspid, and pulmonary valves | Not added (the aortic valve already exists as `aortic_valve`) |
| `pulmonary_artery` | Pulmonary artery | Not added |
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

1. Add the `ChatRequest` contract (`contract-change` skill), agreeing with the frontend first
2. Session and message storage functions (`chatSessions`, `chatMessages`)
3. Reading step-specific part explanations (`annotations` seed and query)
4. The LLM-calling action and the safety rules (needs the OpenAI API key)
5. Rate limits and response length limits (this also protects the speech-to-text quota)
6. Source material (RAG) and sources, the comprehension check, and organizing questions for the doctor
