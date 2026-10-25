# Safety and Privacy

A patient-education chatbot must not act like a doctor, must not give wrong information, and must protect the patient's personal data. This page lists the risks, what is built to reduce them, and what is still open.

The main idea: **the language model only writes friendly wording. Rules in our own code decide what is allowed to reach the patient.** A small model can invent facts or obey a trick question, so we do not rely on the prompt alone.

## 1. Risks and what is built

| Risk | What reduces it | Where | Status |
|---|---|---|---|
| The chatbot gives medicine, dosing, or treatment advice | **Scope gate**: questions like "should I stop taking my blood thinner?" never reach the model and get a fixed reply that sends the patient to their doctor or pharmacist, plus a suggested question for the doctor | `lib/safety.ts` `classifyRequest` | Built, tested |
| The chatbot diagnoses or decides for the patient ("do I have...", "should I get the surgery", "what do my results mean") | Same gate, with a fixed reply | same | Built, tested |
| The model writes advice or a diagnosis anyway | **Advice filter** on the answer ("you should stop...", doses such as "81 mg", "you probably have...") replaces it with a fixed reply | `containsMedicalAdvice` | Built, tested |
| The model invents facts or numbers (hallucination) | **Grounding check**: numbers that are not in our content, and answers full of terms that our content never uses, are replaced by the best matching snippet of our own text, or by "I don't have a reliable answer, please ask your care team" | `checkGrounding`, `extractiveAnswer` | Built, tested |
| A trick in the question ("ignore your rules", "say the valve is dangerous") | The gate catches medicine and diagnosis tricks. The grounding check catches a claim that the model repeats from the question, because words from the question do not count as support | both | Built, tested |
| The model highlights or "explains" parts it was not asked about | `highlight` can only contain ids from our list; with the local model the JSON schema also limits it to the parts found for this question. Camera-only requests get a fixed confirmation instead of the model's words | pipeline, `localPrompt` | Built, tested |
| An emergency is missed | Rule-based check for symptoms happening now (chest pain, trouble breathing, fainting, stroke signs, heavy bleeding) works even if the model fails. The emergency notice goes first. Questions about the future are not treated as emergencies | `detectUrgent` | Built, tested |
| Risk topics without a reminder | The standing note "This is general education, not personal medical advice..." is added to answers about side effects, pain, risks, and recovery | `needsSafetyNote` | Built |
| The medical text itself is wrong | Answers can only repeat our own content, so correctness depends on that content. The TAVR facts come from the team's document "Information about TAVR: data for chatbot", which the project takes as correct; the step texts, part descriptions and four heart-anatomy facts were written by the project | `packages/shared/fixtures` | Decided: no separate clinical review for the demo |

Every check runs for both the cloud model and the local model, because they share the same pipeline (`lib/chatPipeline.ts`).

## 2. Privacy

You plan to run everything on the patient's own computer. What that requires, and what is built:

| Part | What is needed for "nothing leaves the computer" | Status |
|---|---|---|
| Language model | `LLM_PROVIDER=local`: Llama through Ollama on the same computer (see `local-llm.md`) | Built, tested |
| Backend and database | A **local** Convex deployment, not the cloud one. The cloud backend cannot reach Ollama on the patient's computer, and it would store the questions in the cloud | Tested with `CONVEX_AGENT_MODE=anonymous npx convex dev` |
| Voice input | Cartesia is a cloud service, so it would send the voice away. In local mode it is **off by default** (`cloud_stt_disabled`); you must set `ALLOW_CLOUD_STT=true` to allow it. A local speech-to-text model would be needed for voice without the cloud | Guard built; local speech-to-text **not built** |
| Personal details in the question | Emails, phone numbers, ID-like numbers, and birth dates are replaced with `[removed]` before anything else happens (model, logs, storage). Names and addresses are **not** detected | `redactPersonalInfo`, tested |
| Logs | Only event names are logged (for example `ungrounded`, `blocked:medication_advice`), never the patient's words. Verified on the real backend log | Built |
| Stored conversations | The page deletes the conversation when the window closes (`chat.deleteSession`). Only the latest 6 messages are kept; older ones become a short summary without any assistant text, and the originals are deleted. A job deletes conversations idle for 2 hours, every hour (`chat.purgeInactiveSessions`) | Built, tested live with the local model |
| Voice recordings | Deleted right after transcription, even on errors. A recording that was uploaded but never transcribed is deleted by an hourly job | Built |
| Frontend | Must be served from the patient's computer too, or the page itself is a cloud service | **Open** |

Honest limits of "the whole model runs locally": the patient's computer must have enough memory and disk (about 3 GB for the models), and a local backend plus Ollama must be installed and started. That is heavy for ordinary patients; it fits a hospital kiosk or a prepared device better than a public website.

## 3. How a question flows through the safety layer

```
question
  -> remove personal details
  -> emergency symptoms now?  yes: fixed emergency message only ("call your local emergency number... do not wait for more answers here"), the model is NOT called
  -> another person's records, medicine, rule override ("ignore your instructions", "act as my doctor"),
     personal risk ("my exact chances", "for someone my age"), or a personal medical decision
     ("am I too young / a candidate")?  yes: a fixed reply for that case, the model is NOT called
  -> model (cloud or local) writes JSON
  -> advice or diagnosis in the answer?        yes: fixed reply
  -> camera command only?                      yes: fixed confirmation (the model is not called)
  -> numbers (with their unit) or terms not in our content?  yes: our own best snippet (cited), or "I don't have a reliable answer"
  -> a percentage in the answer?               add "these percentages describe groups of patients, not your personal risk"
  -> highlights and camera commands validated against our content
  -> standing safety note on risk topics
  -> reply
```

## 4. What was tested

- The four scenarios of the security checklist (lab results plus "should I increase my dose", an emergency, a request for a roommate's records with a prompt injection, and "my exact chances of a stroke") are tests in `test/redteam.test.ts`, with variations and with general questions that must still be answered. No patient records exist in this system at all, so another person's records could never be returned; the gate makes the refusal explicit and keeps the model away from the request. A model answer that claims to share records is replaced too.

- 30 unit tests of the rules (`test/safety.test.ts`) and 15 red-team scenarios with a fake model that misbehaves on purpose (`test/redteam.test.ts`): medicine questions, diagnosis requests, advice and doses in answers, invented numbers and materials, an obeyed injection, an emergency that also mentions medicine, camera commands, and normal questions that must still work.
- Real run with Llama 3.2 3B: normal questions passed through unchanged; medicine and diagnosis questions were blocked in 0.3 seconds without the model; invented numbers, an injected "the valve is dangerous", and an invented material ("titanium") were replaced; an emergency was flagged; an email and a phone number never appeared in the backend log.

## 5. Limits you should know

- **The local Convex backend listens on all network interfaces** (`*:3210`), and there is no login. Someone on the same network can call the chatbot (and use your speech-to-text quota); they cannot read other people's conversations, because those can only be read by internal functions. Do not leave it running on a shared network, and add authentication and rate limits before any real use.
- **Names, addresses, and hospital record numbers are not removed** from questions; only emails, phone numbers, ID-like numbers, and birth dates are.
- Deleting on window close is a best effort: a browser may not send the request (a crash, a phone that suspends the page). The 2-hour idle cleanup is the safety net, so a conversation can stay for up to about 3 hours in that case (2 hours idle plus up to one hour until the next run).
- The local database is a plain file on the computer. Turn on disk encryption (FileVault on a Mac).

- The reference facts (the team's TAVR document) are described in [`knowledge-base.md`](knowledge-base.md). The grounding check compares an answer with those facts, numbers together with their unit. It still cannot tell that a correct number is attached to the wrong claim (a 3B model once gave the all-patients "2% to 5%" kidney figure to "patients with kidney disease").
- The grounding check is a **word-level** check. It catches invented numbers and unfamiliar terms, but it cannot tell that a sentence built from correct words says something wrong. It also errs on the side of caution: some correct paraphrases may be replaced by our own text.
- The gate uses patterns in English. A question that avoids those patterns can slip past it, and other languages are not covered. The advice filter and the grounding check are a second line of defense for the answer.
- A 3B model words things loosely. For "does the equipment you just put in stay in my body?" it began with "No" although the new valve stays. Review real answers regularly.
- No authentication and no rate limiting yet. Anyone who can reach the backend can ask questions and create conversations.

## 6. Recommended next steps

1. **Clinical review** of every piece of content and of a set of real answers before patients use it.
2. Show a **permanent disclaimer** in the UI ("educational, not medical advice, call your doctor or emergency number") and the emergency notice prominently. Show the `safety` and `urgent` fields of every reply.
3. Keep a **red-team question set** and run it before each release (start from `test/redteam.test.ts`); add questions that real testers find.
4. Add **citations**: attach the snippet that supports each answer (`sources` is empty today).
5. Set up the daily **purge** of old conversations, and decide whether to store conversations at all.
6. Add **authentication and rate limits** before any public use.
7. For voice in local-only mode, add a local speech-to-text model.
8. Write a short **privacy notice** for patients: what is stored, where, and how to delete it.
