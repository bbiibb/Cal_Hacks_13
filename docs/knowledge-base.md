# Knowledge Base for the Chatbot (RAG)

The chatbot answers from a small library of patient-education facts instead of from the model's memory. This document describes what the library contains, how the chatbot finds the right fact, how the prompts keep the reply in the required JSON format, and how to change the content.

The first library is built from the team's document **"Information about TAVR: data for chatbot"** (18 pages). The project takes that document as correct and does not review it separately. Four heart-anatomy facts (right atrium, right ventricle, superior vena cava, pulmonary artery) were written by the project and are labeled that way as their source. All of it is educational text, never personal medical advice (see [`safety.md`](safety.md)).

## What is in it

`packages/shared/fixtures/knowledge.tavr.json`: 84 short chunks (about 300 characters each, at most 600). One chunk answers one kind of question, with the answer first. This matters for a 3B model: it quotes a short, single-topic chunk well, and it mixes up a long chunk that lists many items (a test showed a "kidney disease" question being answered with the sentence about leg arteries from the same list, so lists were split into one chunk per item).

| Topic | Chunks | Content from the document |
|---|---|---|
| `overview` | 4 | What TAVR/TAVI is, how it works in principle, benefits, effectiveness |
| `condition` | 3 | Aortic stenosis, symptoms, why TAVR is done |
| `candidacy` | 20 | Indications, evaluation, one chunk per unsuitable factor (infection, lung, heart failure, kidney or liver, leg arteries, earlier surgery, anatomy, frailty), the heart team, and the questions on older adults, pregnancy, children, obesity, diabetes, blood pressure, earlier heart surgery |
| `anatomy` | 10 | Femoral artery, aorta, aortic arch, aortic valve, left ventricle, left atrium, plus right atrium, right ventricle, superior vena cava and pulmonary artery (written by the project) |
| `procedure` | 4 | How the valve is delivered, no chest incision, the approaches (transfemoral, transapical, transaortic, subclavian) |
| `comparison` | 7 | TAVR compared with open-heart surgery (SAVR): overall, younger and older patients, life expectancy and health, anatomy and other heart problems, blood thinners, how long the valve lasts |
| `instruments` | 6 | Introducer sheath, guidewire, delivery catheter, balloon, the new valve, temporary pacemaker |
| `risks` | 10 | An overview and nine risks with the published percentages and why each happens |
| `preparation` | 10 | Tests, dental check, medicines, recovery planning, fasting, diet, what to bring and why, what to remove (lenses, dentures, glasses, jewelry, nail polish) |
| `recovery` | 8 | Hospital stay, eating, exercise, follow-up, lifestyle, travel, anxiety, dental care |
| `safety` | 2 | When to get emergency help, warning signs after TAVR |

Each chunk (schema `KnowledgeChunkSchema` in `packages/shared/src/knowledge.ts`):

| Field | Meaning |
|---|---|
| `id` | Stable id such as `risk.stroke` |
| `topic` | One of the topics above |
| `title` | Short heading. Also the source title shown to the patient |
| `text` | The facts, answer first. Percentages are copied exactly from the document |
| `questions` | Questions a patient might ask. Used only to find the chunk, never shown |
| `keywords` | Synonyms, abbreviations, and everyday words ("groin", "dying", "CT scan") |
| `structure_ids` | Parts of the 3D model the chunk is about. The chatbot may highlight them. Only ids that exist in `structures.json` (a test checks this) |
| `source` | Name of the document |

### Choices made while organizing the document

- **Risk percentages stay exactly as written** (for example "3% to 8%", "8% to 20%"). Every risk chunk says they describe groups of patients and are not the patient's personal risk, as the document itself says.
- **Contradiction resolved.** One passage of the document says the primary deciding factor between TAVR and surgery is whether the patient can take a blood thinner. A later, more careful passage says it is one consideration among age, health, anatomy, life expectancy, and preference. The library uses the later passage.
- **Medicines.** The document says not to stop or change any medicine, including blood thinners, unless the care team says so. This sentence is in a chunk and in the fixed reply to medicine questions. The chatbot never advises on medicines.
- **"How long does the valve last"** has its own chunk that says the document gives **no fixed number of years**. Without it, a small model invented "20 to 30 years" in testing.
- The `seed-content` rule to mark texts "(Dummy educational content)" is not applied here, because this is the team's real source text. Clinical review is the next step before real patients use it.

## How the chatbot finds a fact

```
question
  |-- keyword search (BM25 over title, keywords, example questions, text; works without any model)
  |-- vector search (local mode only: nomic-embed-text + Convex vector index)
  v
fused ranking (reciprocal rank fusion) -> top 4  +  the step on screen  +  the selected part
  v
prompt (up to 6 numbered facts, each with the part ids it is about)
```

- **Why both searches.** Vector search finds meaning ("Why does my heart race during it?" finds the rapid-pacing fact). Keyword search finds exact terms ("pacemaker", "COPD", "dentist") and still works when the embedding model is off. A fact found by both ranks first.
- **Whole-question match.** If a patient asks (nearly) one of a chunk's example questions, that chunk goes first. This is needed for questions with a single searchable word, such as "What is TAVR?".
- **The text always comes from the fixture file**, not from the database index. If the index is old, the chatbot still quotes the current text.
- **Cloud model.** The cloud prompt already lists every step and part, so it gets the best 3 facts as a `REFERENCE` section by keyword search only. The same facts are used to cite sources.
- **Quality check.** `test/knowledge.test.ts` holds 49 patient questions with the chunk that must be among the top 3 keyword results. When you add a question there and it fails, improve the chunk's `questions` or `keywords`.

## Sources in the reply

`ChatResponse.sources` now lists the facts the answer was based on, for example `Risk: stroke (TAVR patient information guide)` with `url: null`. The model is **not asked to cite** (a 3B model cites wrongly). Instead the backend compares the final answer with the facts in the prompt and cites the one (or two nearly equal ones) whose words the answer actually uses. Refusals, camera replies, and "I don't have an answer" carry no source. When the answer is replaced by our own snippet, that snippet's source is cited.

## Prompt engineering and the JSON format

The reply must always be the JSON object the pipeline reads. Three layers make that reliable:

1. **Prompt.** The format line is the last line of the system prompt, and two worked examples (as earlier chat turns) show the exact keys: one answers from the facts, one says "I am not sure" when the facts do not contain the answer.
2. **Schema (local model).** Ollama is given a JSON schema, so decoding itself is constrained: the reply is always valid JSON with the five keys `answer`, `highlight`, `urgent`, `safety`, `doctor_question`, and `highlight` can only contain the part ids of the facts in the prompt.
3. **Parser.** A forgiving parser (text around the JSON, code fences) plus one retry with a reminder. In about 25 live questions with Llama 3.2 3B, no reply needed the retry or fell back.

The local rules (in `convex/lib/localPrompt.ts`):

1. At most 3 short sentences in plain words, answer first, begin with Yes or No only if the context says so.
2. Use only facts, numbers, and percentages written in the context. If the context does not answer, say you are not sure and suggest the care team.
3. A percentage describes groups of patients, not the patient's own risk. Copy it exactly and say so.
4. Never diagnose. Never tell the patient to start, stop, or change a medicine.
5. Emergency symptoms now: `urgent` true and call the local emergency number.
6. Only help with this procedure, the heart, and the 3D model.
7. `highlight` only from the allowed ids. 8. `doctor_question` is one short question for the care team, or empty.

Size: the whole prompt is kept under about 1500 tokens, so it fits the 2048-token window together with the 300-token answer (a test builds the worst case).

## Safety checks that use the library

- **Grounding.** An answer may only contain words and numbers that the facts contain. Numbers are compared **with their unit**: "8 pm" does not borrow the "8%" of the material, and "20 to 30 years" is not made true by a "20%" and a "30-day" elsewhere. "3 to 8 percent" and "3%-8%" match "3% to 8%". A failing answer is replaced by the best matching snippet of the library (first sentences, cited).
- **Group statistics.** Whenever an answer contains a percentage and does not already say it describes groups, the sentence "These percentages describe groups of patients, not your personal risk." is added by rule.
- **"Do not stop your medicine unless your care team says so"** is recognized as the safe message and is not mistaken for advice to stop. Real advice ("You should stop taking your aspirin") is still blocked, even next to that sentence.
- **Personal suitability.** "Am I too young for TAVR?" and "Am I a good candidate?" get the fixed reply (eligibility is the care team's decision), and a model answer such as "You may be too young" is replaced.
- **Camera commands** ("zoom in", "rotate left 60 degrees") no longer call the model at all; they are read from the words and answered with a fixed sentence. On the local model this saves about ten seconds.

## Change the content

1. Edit the chunks (the fixture is generated text; edit the JSON directly): keep one topic per chunk, answer first, a few example `questions`, everyday `keywords`, and copy numbers exactly.
2. `pnpm test` checks the schema, unique ids, that `structure_ids` exist, that risk chunks keep their percentages, and the retrieval questions.
3. Local mode: rebuild the vector index. Cloud mode needs nothing else (the fixture is bundled).

```bash
npx convex run rag:indexContent '{"procedureSlug":"tavr"}'
```

A new procedure needs its own file next to `knowledge.tavr.json` and a line in `convex/lib/knowledge.ts` that loads it.

## Limits

- The checks are word-level. They cannot tell that a correct number is attached to the wrong claim. Example seen in testing: "Can I have TAVR if I have kidney disease?" once got "2% to 5% of patients with kidney disease may experience temporary kidney injury", while the 2% to 5% is for all patients. Splitting chunks and the group-statistics note reduce this, but only a larger model or a clinician reading real answers removes it.
- The document is the only source. Questions outside it get "I don't have a reliable answer" or a related snippet, with the care team as the next step.
- Latency of the local model is 10 to 17 seconds per answer, and up to about 30 seconds when the computer is short of memory. Camera commands answer in about 1 second.
