# Cal_Hacks_13

**asX-ray (Simple Surgeries)**: a patient-education website that shows a heart procedure in 3D, step by step, and lets the patient ask questions to a chatbot that answers safely and moves the 3D view. Built for Cal Hacks 13.

> All content is educational dummy data and is not medical advice. Do not use real patient data.

## Why we built it

Many patients go into a procedure without really understanding it. The explanations they get are short, full of jargon, and hard to remember, and the questions they think of later at home have no good place to go. An anxious patient who searches the web gets generic, sometimes frightening, answers.

asX-ray tries to close that gap. A patient can:

1. **Watch** the procedure as an interactive 3D scene, one calm step at a time, from the symptoms to the finished result.
2. **Point at any part** of the heart or the equipment to see its name and a plain-language description.
3. **Ask a question** in their own words, typed or spoken, and get a short answer that is tied to our own fact base, with sources, a safety note and a question to take to the care team. The answer also drives the 3D view: the camera moves, the parts it mentions light up, and the step changes.

Two ideas shape every decision: **the language model only writes friendly wording, and rules in our own code decide what reaches the patient**; and **personal details stay on the patient's device**.

## What we built

The first complete demo is **TAVR** (transcatheter aortic valve replacement). A second walkthrough, **eye anatomy**, is a prototype that shows the page works for other topics.

### The 3D walkthrough

- Six steps: step 0 is an introduction about the symptoms (only the heart is shown), steps 1 to 5 are the procedure: guiding a wire, bringing the new valve into position, expanding it with a balloon, removing the equipment, and how the new valve works. A slider under the 3D view moves between steps.
- The heart, the aorta and the old valve are 3D models. The delivery catheter, the balloon and the balloon-expandable valve are built in code, follow the step, and pass through the gap of the narrowed old valve.
- The heart model is one mesh, so its chambers and vessels are named by outlines on the model. Hovering shows a part's name, clicking pins it with its description, and the whole heart keeps one color until a part is pointed at.
- The eye prototype has 8 named parts (cornea, iris, lens, suspensory ligaments, sclera, choroid, retina, optic nerve) and 5 steps of placeholder text, in the same page layout.

### The chatbot

- Typed or spoken questions. Answers carry **sources** (the facts they are based on), a **safety note**, a **question for the care team** and follow-up buttons.
- The answer can move the 3D view: focus a part, highlight parts, zoom, rotate, reset the view, and go to a step. Every command is validated against our content before it reaches the browser.
- **Slow or Fast, chosen per question.** Slow runs a small model (Llama 3.2 3B through Ollama) on the same computer: free, and the question stays on that machine. Fast uses a cloud model through an OpenAI-compatible API (Google Gemini `gemini-3.1-flash-lite` in our tests): quicker, but a paid service, so the panel warns first.
- Simple commands such as "zoom in", "go to step 3" or "show me the right atrium" are read by rules and answered in about a second, with no model.
- **Voice questions**: a microphone button records up to 30 seconds; the recording is transcribed with Cartesia and deleted right away.

### Safety and privacy

- A **scope gate** answers medicine, dosing, diagnosis and personal-decision questions ("should I stop my blood thinner?", "am I too old for TAVR?", "ignore your rules") with a fixed reply that points to the care team. The model is not called.
- **Emergency symptoms happening now** (chest pain, trouble breathing, fainting, stroke signs, heavy bleeding) get a fixed emergency message from rules, even if the model would miss them.
- An **advice filter** and a **grounding check** run on every model answer: advice or doses are replaced, and numbers or terms that are not in our fact base are replaced by our own text or by "I don't have a reliable answer". Percentages always carry the note that they describe groups, not the patient.
- The fact base is 84 short facts (80 from the team's TAVR document, 4 heart-anatomy facts written by the project), found with keyword plus vector search.
- A **privacy guard in the browser** replaces names, birth dates, phone numbers, SSNs and similar details with placeholders such as `[PERSON_1]` before a question is sent, with a final scan that blocks the send if anything personal remains. Real values stay in an encrypted vault on the device, and a "What left your device" list shows exactly what was sent.
- Conversations are deleted when the page closes (and when idle for 2 hours); voice recordings are deleted right after transcription.
- Honest limits: spoken details cannot be redacted on the device yet, the content has not been clinically reviewed, answers are English only, and there is no rate limit yet. See [docs/safety.md](docs/safety.md) and [docs/privacy-layer.md](docs/privacy-layer.md).

### Accounts and progress

- Username and password accounts with Convex Auth, login and sign-up pages, and a route guard on the walkthroughs. The sign-up page also has a **Sign up with Microsoft** button; it is a preview for now and connects after deployment.
- The TAVR walkthrough remembers the step the patient reached (SpacetimeDB, anonymous identity, no names), and the landing page offers Continue and Start over.

## How it is built

| Part | Technology |
|---|---|
| Frontend (`apps/frontend`) | React, TypeScript (strict), Vite, three.js, React Router, CSS Modules |
| Backend (`packages/backend`) | Convex: queries, mutations, actions, vector search, scheduled jobs, file storage, Convex Auth |
| Contract (`packages/shared`) | zod schemas and fixtures shared by the frontend, the backend and the tests |
| Progress (`packages/progress`) | SpacetimeDB module |
| Models | Llama 3.2 3B and nomic-embed-text (Ollama), Gemini or Groq (cloud), Cartesia (speech-to-text), a small name-finder model in the browser (transformers.js) |

A procedure is not a video: each step is **3D scene state data** (camera, opacity, highlights, instruments), and the chatbot sends validated `scene_actions` that change that state. The architecture diagram is in [docs/diagrams/architecture.png](docs/diagrams/architecture.png).

## Try it (for judges)

**Live site:** https://blue-mushroom-0aa596510.4.azurestaticapps.net (the website on Azure Static Web Apps; sign-up and login run on a shared Convex dev deployment). The first load downloads about 200 MB of 3D models, so give it a minute.

1. **Sign up** with fake details (any username and password; no real data).
2. Open the **TAVR walkthrough** and drag the step slider. Hover over and click parts of the heart.
3. In the chat panel, ask "Will I need a pacemaker?"
4. Test the privacy layer: send `Hi, I'm Jane Doe, born 03/03/1985, my SSN is 123-45-6789`, then open **What left your device** at the bottom of the chat panel. It shows the text that was sent, with `[PERSON_1]`, `[DOB_1]` and `[SSN_1]` in place of the real details, and "0 personal details sent".

The hosted site shows the built-in demo answers in the chat; the live language model needs the backend's API keys (see below). To run everything on your own computer you need **Node 22 or newer**; if `pnpm` fails to start (a broken corepack on some machines), run `npm install -g pnpm@12.15.0` first.

## Run it

```bash
pnpm install
pnpm dev:frontend     # the website, http://localhost:5173
pnpm dev:backend      # optional: the Convex backend for the live chatbot (needs a login the first time)
```

- Without a backend, the 3D walkthrough and built-in demo answers still work. Sign-up and login use the shared dev deployment by default (`apps/frontend/.env.development`); to use your own local backend, set `VITE_CONVEX_URL` in `apps/frontend/.env.development.local`, which wins over `.env.development`.
- The live chatbot needs the backend's environment variables (set with `npx convex env set`, never in code): `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` for Fast, and `CARTESIA_API_KEY` for voice. Slow needs Ollama with `llama3.2:3b` and `nomic-embed-text`. See [docs/chatbot.md](docs/chatbot.md) and [docs/local-llm.md](docs/local-llm.md).
- Tests: `pnpm test` (509 tests across the shared package, the backend and the frontend), `pnpm typecheck`, `pnpm lint`.

## Status

Built and tested: the TAVR walkthrough, the chat with both models, voice, the safety layer, the privacy guard, accounts, progress, FAQs, and the eye prototype. Not done yet: a fully hosted backend (the website is on Azure Static Web Apps and sign-up uses a Convex dev deployment; Slow mode cannot run on a hosted backend), rate limits and a budget for Fast mode, voice that is redacted on the device, a real Microsoft sign-in, clinical review of the content, and more procedures. The full list is in [docs/product-roadmap.md](docs/product-roadmap.md).

## Documents

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System diagram, data map and open items |
| [docs/product-roadmap.md](docs/product-roadmap.md) | Features, backend needs and implementation status |
| [docs/github-structure.md](docs/github-structure.md) | Repository structure, branches, pull requests and ownership |
| [docs/chatbot.md](docs/chatbot.md), [docs/local-llm.md](docs/local-llm.md), [docs/knowledge-base.md](docs/knowledge-base.md), [docs/safety.md](docs/safety.md) | The chatbot: models, local mode, fact base, safety rules |
| [docs/privacy-layer.md](docs/privacy-layer.md), [docs/auth.md](docs/auth.md) | On-device privacy guard and accounts |
| [docs/contracts.md](docs/contracts.md), [docs/backend-api.md](docs/backend-api.md) | The frontend-backend contract and the backend functions |
| [docs/tavr-demo.md](docs/tavr-demo.md), [docs/eye-prototype.md](docs/eye-prototype.md) | The two walkthroughs and their 3D assets |
| [apps/frontend/README.md](apps/frontend/README.md) | The website: layout, routes, settings |

## Credits

The eye model is "Cross Section of Eye - Anatomy" by Erik Ao ([Sketchfab](https://sketchfab.com/3d-models/cross-section-of-eye-anatomy-4bf3236c8fe2407ea3f494a93b8f5aa2)), CC BY 4.0, simplified for the web. The TAVR facts come from the team's document "Information about TAVR: data for chatbot".
