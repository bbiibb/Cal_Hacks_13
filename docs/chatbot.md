# Chatbot: Free Language Model, Voice Input, and 3D Commands

How the chatbot works, which free language models it can use, and how the answers drive the 3D view (highlight, focus, zoom, rotate, step changes).

## Is a free, "less smart" model realistic?

Yes, for this job, because the model is asked to do something narrow:

- It only answers questions about content we give it (the steps and the parts of the model), in a few sentences.
- Its output is **checked by our code**, so a mistake cannot reach the screen: unknown part ids are dropped, step numbers outside the procedure are dropped, and numbers are clamped.
- Simple 3D commands ("zoom in", "rotate left 90 degrees", "go to step 3") and emergency symptoms are also **detected by plain rules**, without the model.

What a small model will do worse than a large one: nuance in medical explanations, very long conversations, and non-English answers. That is why the answer text is kept short and tied to our own text. This must be tried with a real key before it is shown to patients: the tests use fake model replies, not a real model.

## Free options

| Option | What it is | Notes |
|---|---|---|
| **Groq with a Llama model** (default) | Free API tier. OpenAI-compatible. `llama-3.1-8b-instant` or `llama-3.3-70b-versatile` | The free tier has limits per minute and per day (third-party pages list about 30 requests per minute, 6,000 to 12,000 tokens per minute, and 1,000 to 14,400 requests per day depending on the model). Check the limits in your Groq console, because they change. |
| OpenRouter free models | Models with a `:free` suffix, for example a Llama 3.3 70B instruct model | Free but strictly rate limited. Model names change often. |
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
pnpm exec convex env set LLM_MODEL llama-3.1-8b-instant
```

For speech-to-text, set `CARTESIA_API_KEY` the same way (see `docs/backend-api.md`).

## How one question is answered

```
patient (typed or spoken)
   | voice: speech.generateUploadUrl -> upload -> speech.transcribe (Cartesia)  -> text
   v
chat.ask({ message, context: { procedure_slug, step_index, selected_structure_id }, sessionId? })
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

## Prompt engineering used for small models

- Short, numbered rules instead of long prose.
- The list of allowed part ids is in the prompt, and ids not in the list are dropped afterwards.
- **The exact JSON format is repeated at the very end of the system prompt** ("OUTPUT FORMAT"), and two worked examples are given as earlier turns.
- Low temperature (0.2) and the provider's JSON mode (retried without it if the model rejects it).
- The screen state (`[Screen] Step 3 of 4 ... Selected part: ...`) is added to every question so "this valve" or "what you just put in" can be understood.
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

- **No rate limiting beyond one question per 1.5 seconds per session.** Anyone who knows the deployment URL could use up the free quota. Add a real limit before sharing the app.
- The free providers can answer slowly or return "busy" (error code `llm_rate_limited`).
- Answers are only as good as the content in the database. The dummy content is not medical advice.
- Conversation history is kept per session in `chatMessages`. There is no login, so sessions are anonymous.
- Not built yet: sources and citations (RAG), the comprehension quiz, and the "questions for your doctor" summary.
