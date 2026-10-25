# Chatbot: Free Language Model, Voice Input, and 3D Commands

How the chatbot works, which free language models it can use, and how the answers drive the 3D view (highlight, focus, zoom, rotate, step changes).

## Is a free, "less smart" model realistic?

Yes, for this job, because the model is asked to do something narrow:

- It only answers questions about content we give it (the steps and the parts of the model), in a few sentences.
- Its output is **checked by our code**, so a mistake cannot reach the screen: unknown part ids are dropped, step numbers outside the procedure are dropped, and numbers are clamped.
- Simple 3D commands ("zoom in", "rotate left 90 degrees", "go to step 3") and emergency symptoms are also **detected by plain rules**, without the model.

What a small model will do worse than a large one: nuance in medical explanations, very long conversations, and non-English answers. That is why the answer text is kept short and tied to our own text. It was tried with a real free model (`openai/gpt-oss-20b` on Groq): replies take about 2 seconds, the JSON was valid every time, and zoom, rotate, step, highlight, emergency symptoms, and off-topic questions all behaved as intended. The unit tests use fake model replies; real answers still need review by someone with medical knowledge before patients see them.

> What keeps answers safe (no medical advice, no invented facts, privacy) is described in [`docs/safety.md`](safety.md).
>
> A second, fully local pipeline (Llama 3.2 3B with Ollama and RAG) can answer instead of the cloud model. See [`docs/local-llm.md`](local-llm.md).

## Free options

| Option | What it is | Notes |
|---|---|---|
| **Groq** (default) | Free API tier. OpenAI-compatible. Chat models available to us: `openai/gpt-oss-20b` (default), `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` | Groq **retired its Llama chat models** (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`) on 2026-08-16 ([deprecations page](https://console.groq.com/docs/deprecations)), so Llama is no longer available there. The free tier limits requests and tokens per minute: in testing, about four questions in quick succession were enough to hit the limit. Check the limits in your Groq console, because they change. |
| OpenRouter free models | Models with a `:free` suffix, some of them Llama | Free but strictly rate limited. Model names change often. |
| Hugging Face Inference Providers | Llama 3.1 8B Instruct through `https://router.huggingface.co/v1` with a Hugging Face token | Free accounts get only a very small monthly credit. |
| Grok (xAI) | API with promotional free credits that depend on the account | Not a stable free option. Check console.x.ai before relying on it. |
| Llama on your own computer (Ollama) | Truly free | Works only if the backend can reach your computer. The Convex cloud cannot reach `localhost`, so it is not usable with the deployed backend. |

Any provider that offers an **OpenAI-compatible chat completions endpoint** works without code changes. Only environment variables change.

Sources for the limits above (secondary pages, not official): [eesel.ai Groq pricing](https://eesel.ai/blog/groq-pricing), [free LLM API resources](https://mintlify.com/cheahjs/free-llm-api-resources/guides/rate-limits), [xAI pricing overview](https://www.eesel.ai/en/blog/xai-pricing).

## Setting it up

Get a free API key from the provider (an account is needed, which only you can create), then set these Convex environment variables. Never put the key in code or in a file in the repository.

```bash
cd packages/backend
pnpm exec convex env set LLM_API_KEY <your key>
# Optional. These defaults are used when they are not set:
pnpm exec convex env set LLM_BASE_URL https://api.groq.com/openai/v1
pnpm exec convex env set LLM_MODEL openai/gpt-oss-20b
```

For the **Fast** choice in the chat panel, point the three variables at any OpenAI-compatible provider, for example Google Gemini:

```bash
pnpm exec convex env set LLM_API_KEY <your Google AI Studio key>
pnpm exec convex env set LLM_BASE_URL https://generativelanguage.googleapis.com/v1beta/openai
pnpm exec convex env set LLM_MODEL gemini-2.5-flash-lite
```

`gemini-2.5-flash-lite` is the cheapest current Gemini text model (about $0.10 per million input and $0.40 per million output tokens on third-party price lists; check Google's pricing page). For Gemini 2.5 models the backend sends `reasoning_effort: "none"` so no thinking tokens are paid for. Other Gemini models get `reasoning_effort: "low"` and an output limit of at least 2048 tokens, because Gemini counts its thinking tokens against the limit. Or set `LLM_MODEL` to the Qwen model you want from the Groq list above, next to `LLM_API_KEY`. The **Slow** choice uses the local Llama through Ollama and needs no key (see [`local-llm.md`](local-llm.md)). Both choices work at the same time on a local backend that can reach Ollama: the patient picks per question. Fast mode is a paid service, so the panel asks before it is turned on.

For speech-to-text, set `CARTESIA_API_KEY` the same way (see `docs/backend-api.md`).

## How one question is answered

```
patient (typed or spoken)
   | voice: speech.generateUploadUrl -> upload -> speech.transcribe (Cartesia)  -> text
   v
chat.ask({ message, context: { procedure_slug, step_index, selected_structure_id }, sessionId? })
   (a spoken question uses chat.askByVoice, which does the speech-to-text step and then this same flow)
   1. check the message (1 to 500 characters)
   2. load the procedure, steps, and parts from the database  (what is on screen)
   3. build the prompt: rules + parts list + two worked examples + recent history
   4. call the language model (low temperature, JSON mode)
   5. read the reply forgivingly; if it is not JSON, retry once
   6. build 3D commands from the reply, plus rule-based fallbacks
   7. validate the commands (schema + existence in our content), drop the rest
   8. add the safety net (emergency symptoms), build the side panel from OUR content
   9. save the exchange if there is a session, return the response
```

The pure logic is in `packages/backend/convex/lib/` (`chatPrompt`, `chatParse`, `chatActions`, `chatPipeline`, `llm`) and is covered by unit tests. `convex/chat.ts` only connects it to the database and the network.

## Conversation memory

A conversation lasts until the window is closed. The model sees only the latest messages (6 for the cloud model, 4 for the local one), because a small model has a short memory and every extra token costs seconds on a local computer. Older messages are not simply lost; they are folded into a short summary.

**How it works** (`convex/lib/chatSummary.ts`, `convex/chatStore.ts`)

1. After each answer, only the latest 6 messages stay in the database in full. Older ones are folded into the session's `summary` and **deleted**.
2. The summary holds two lists, built by rules: the patient's earlier questions (each cut to 90 characters, the newest 8 kept) and the topics already explained (the titles of the reference facts that earlier answers cited, the newest 6 kept). It never keeps the assistant's own sentences.
3. It is rendered as one paragraph of at most 600 characters (the oldest questions are dropped first) and added to the prompt as `EARLIER IN THIS CONVERSATION (older messages, shortened): The patient earlier asked: "..."; "...". Already explained: ...`.
4. A pure camera command ("zoom in", "can you zoom in?", "show me the right atrium") is read from the patient's words by rules: no model is asked and nothing is embedded or searched, so it answers in under a second. A part is found by its name; a question that asks for an explanation ("what is the right atrium?") still goes to the model. Such a command is not stored, so it does not use up the memory. Any single earlier message is cut at 300 characters in the prompt.
5. The conversation ends when the window closes: the page asks the backend to delete it (`chat.deleteSession`, sent with `keepalive` on `pagehide`). Because a browser may not send that request, a job deletes every conversation that was idle for 2 hours, every hour (`chat.purgeInactiveSessions`, `convex/crons.ts`). A question that arrives with the id of a deleted conversation is still answered, without history, and does not bring the conversation back.

### Decision record: why the summary is built by rules and not by a model

Status: accepted. Date: 2026-10-24. Context: the chatbot runs a 3B model on the patient's own computer (Llama 3.2 3B through Ollama), with a 2048-token window, and answers medical questions.

The obvious way to shorten a conversation is to ask the language model to summarize it. We chose not to, for these reasons:

| Reason | Detail |
|---|---|
| **Latency** | A model summary is a second generation. On the local 3B model one answer already takes 10 to 20 seconds, so a summary would add about 10 seconds more (in the background it competes with the next question for the same model, because the computer has memory for one). The rules take well under a millisecond. |
| **Errors would last** | A summary that contains a wrong claim is copied into every following prompt. The grounding check only compares an answer with our reference facts, so a mistake in the summary would not be caught, and a small model reading its own wrong summary tends to repeat it. A wrong sentence in a normal answer is seen once; in a summary it would be repeated for the rest of the conversation. |
| **Prompt injection would last** | Text the patient types is untrusted. A model that summarizes it can turn "ignore your rules" into a lasting instruction. The rule-based summary only copies a shortened question as quoted text, and it never copies the assistant's sentences. |
| **No medical claims are stored** | The summary lists topics by the title of the reference fact (for example "Risk: stroke"), not by the sentence that was said. Medical wording therefore always comes from our reference text, never from a summary. |
| **Privacy** | The original messages are deleted once folded, and the summary is smaller and contains no assistant text. Less patient data is kept. Personal details were already removed from the questions before they were stored. |
| **Predictable and testable** | Every rule has a unit test (length limits, duplicates, oldest dropped first, nothing from the assistant). A model summary can only be checked by reading examples. |
| **Fits the window** | The summary has a hard limit (600 characters), and a test builds the largest possible prompt to check that it still fits 2048 tokens together with the 300-token answer. A model summary can vary in length. |

What we give up: the summary does not understand the conversation. It cannot say "the patient is worried about pain"; it only lists what was asked and which topics were explained. For a patient-education chatbot that is enough to avoid repeating itself and to understand "and the other one?", and the latest 4 to 6 messages are kept in full for the reference words ("it", "that").

Alternatives considered:

- **Model summary in the background.** Rejected for the reasons above. It can be reconsidered if the cloud model is the only provider, where a second call costs little and the model is stronger.
- **Keep everything and send a longer history.** Rejected: the local window is 2048 tokens, and long prompts slow every answer.
- **Embedding-based memory** (retrieve earlier messages that are similar to the new question). Rejected for now: more moving parts, and it would store the assistant's earlier text again. Reconsider if conversations become long enough that the listed questions are not enough.

When to revisit: if real conversations often need details from more than 8 questions ago, if the local model is replaced by a larger one, or if clinicians ask for the summary to keep the patient's concerns in their own words.

## Prompt engineering used for small models

- Short, numbered rules instead of long prose.
- The list of allowed part ids is in the prompt, and ids not in the list are dropped afterwards.
- **The exact JSON format is repeated at the very end of the system prompt** ("OUTPUT FORMAT"), and two worked examples are given as earlier turns.
- Low temperature (0.2) and the provider's JSON mode (retried without it if the model rejects it). For gpt-oss and Gemini models the reasoning effort is set to low, which keeps answers fast.
- A rule that keeps the model on topic: other subjects get a polite "I can only help with the procedure, the heart, and the 3D model".
- The screen state (`[Screen] Step 3 of 5 ... Selected part: ...`) is added to every question so "this valve" or "what you just put in" can be understood.
- Prompt size is kept small because free tiers limit tokens per minute.

## The JSON the model must return

```json
{"answer": "...", "highlight": ["aortic_valve"], "step": null,
 "zoom": "in", "rotate": {"direction": "left", "degrees": 45}, "reset_view": false,
 "safety": "", "doctor_question": "", "urgent": false}
```

Our code turns it into `scene_actions` (see `docs/contracts.md`). Fields the model leaves out get safe defaults.

## 3D commands the frontend must handle

| Action | Meaning | Suggested frontend behavior |
|---|---|---|
| `focus` | Look at one part | Move the orbit target and camera toward the part |
| `highlight` | Highlight parts | Pulse or glow the meshes with those `structure_id` names |
| `goto_step` | Show another step | Set the step index (slider moves too) |
| `zoom` (`in`/`out`, `small`/`medium`/`large`) | Closer or further | Scale the camera distance, for example by 0.85, 0.7, or 0.5 for "in" and the inverse for "out" |
| `rotate` (`left`/`right`/`up`/`down`, `degrees`) | Turn the model | Change the orbit azimuth (left/right) or polar angle (up/down) by `degrees` |
| `reset_view` | Default view | Return to the starting camera |
| `set_opacity` | Make a part see-through | Set the material opacity (not produced by the chatbot yet) |

Animate these over about 0.5 to 1 second so the change is easy to follow.

## Safety nets that do not depend on the model

- **Emergency symptoms** (chest pain, trouble breathing, fainting, stroke signs, heavy bleeding) said as happening now set `urgent` to true and put the emergency notice first, even if the model misses it, and even if the model fails completely. Questions about the future ("Will I have chest pain afterwards?") are not treated as emergencies.
- The model is told not to diagnose or advise about medicines. Medical text in the side panel comes from our own content.
- If the reply cannot be read after one retry, the patient gets a plain "please try again" answer and no commands.

## Limits and what is not built

- **No rate limiting beyond one question per 1.5 seconds per session.** The wait only applies when a session id is sent, and creating sessions or upload URLs is not limited. Anyone who knows the deployment URL could use up the quota. Add a real limit before sharing the app, and a daily budget for fast mode.
- The free providers return "busy" (error code `llm_rate_limited`) when too many questions arrive in a minute. The server waits up to 8 seconds once when the provider says when to retry, then gives up. The UI should show a friendly message and let the patient try again.
- Answers are only as good as the content in the database. The TAVR facts come from the team's document and are taken as correct; none of it is medical advice.
- **English only.** The rules that do not depend on the model (camera commands, part names, emergency symptoms, the scope gate, personal-detail removal) read English, so other languages are not supported.
- Conversation history is kept per session in `chatMessages` (the latest 6 messages) plus a short summary (see "Conversation memory"). There is no login yet, so sessions are anonymous; they will be tied to the user database a teammate is building.
- Sources are built (the reference facts and how they are found: [`knowledge-base.md`](knowledge-base.md)). Not built yet: the comprehension quiz and the "questions for your doctor" summary.
