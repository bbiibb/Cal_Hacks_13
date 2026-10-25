# Privacy layer (on-device PII guard)

Ask Ray never sees who you are. Identity details stay on the device, and the chat backend and any AI model only
receive anonymized placeholders such as `[PERSON_1]`. Fake data only.

This is privacy-preserving by design: data minimization, local-first storage, and redaction before the cloud.
It is **not** a compliance claim (not HIPAA certified, not "unhackable"). Code: `apps/frontend/src/walkthrough/privacy/`.

## Architecture

```
 patient types a question
          |
          v
 +---------------------------------------------------------------+
 |  guardedChatClient(inner, guard)           (browser, on device) |
 |                                                               |
 |  Layer 1  deterministic rules  (always on, cannot be skipped) |
 |     SSN, DOB, PHONE, EMAIL, ADDRESS, MRN, spoken digits,      |
 |     names from the vault + "my name is ..." patterns          |
 |  Layer 2  transformers.js NER in a web worker (optional)      |
 |     names/places the rules miss; loading/failure => skipped   |
 |            |                                                  |
 |  merge spans (rules win overlaps)                             |
 |            v                                                  |
 |  tokenize: "[PERSON_1]" "[SSN_1]" ...   <--> session table    |
 |            |                              (real values, kept  |
 |            v                               in memory and in   |
 |  FINAL SCAN of the exact outgoing text     the encrypted vault)|
 |     anything PII-shaped left?  --yes--> PiiBlockedError, stop |
 |            | no                                               |
 |            v                    audit log: {type, placeholder}|
 +------------|--------------------------------------------------+
              |  redacted text only
              v
   inner ChatClient  ->  Convex  ->  LLM        (never sees real values)
              |
              v  reply with placeholders
   rehydrate locally (message, safety, doctor_question,
   side panel, follow-ups); unknown placeholders stay as they are

 Encrypted vault: WebCrypto AES-GCM, non-extractable key (CryptoKey in
 IndexedDB), ciphertext records in IndexedDB. Holds the intake form and
 the placeholder table.
```

## API (for the UI)

All of it is React-free; see TSDoc in `guard.ts`.

| Need | Call |
| --- | --- |
| Create | `createBrowserPiiGuard()` (IndexedDB vault + on-device model), or `createPiiGuard({ vault, fuzzy })` |
| Wrap the chat client | `guardedChatClient(innerClient, guard)` |
| Live highlighting while typing | `guard.analyze(text, onUpdate?)` returns Layer 1 spans now; `onUpdate` gets merged spans when the model answers |
| Intake form | `guard.vault.saveIntake({ firstName, lastName, dob, ssn })`, `loadIntake()`, `clear()` |
| "What left your device" | `guard.auditLog.entries()`, `guard.auditLog.subscribe(fn)`, `clear()` |
| Status line | `guard.getStatus()` and `guard.subscribeStatus(fn)` (works with `useSyncExternalStore`): `{ vault, hasIntake, fuzzy, summary, detail }`, summary is "Privacy: on-device vault, AI sees placeholders" |
| Start the model download | `guard.startFuzzy()` (call when the chat opens or after consent) |
| Blocked sends | `ask` rejects with `PiiBlockedError` (extends `ChatError`, code `pii_blocked`, `types` lists kinds, message never has a value) |

An audit entry: `{ id, timestamp, status: 'sent' | 'blocked', sentText, redactions: [{ type, placeholder }], blockedTypes, layer2 }`.
`sentText` is the exact text handed to the backend (`null` when blocked). Real values are never stored in it.

## Layer 2 (on-device only)

`@huggingface/transformers` token-classification (`Xenova/bert-base-NER`, int8) runs in `fuzzy_worker.ts`. The library
is imported dynamically inside the worker, so it is a separate chunk and not part of the main bundle. Text never leaves
the browser. Only the one-time model download goes to the Hugging Face hub (self-host the files to avoid that request).
If loading fails or takes too long (default 90 s), status becomes `unavailable` and Layer 1 keeps working. A message sent
while the model is still loading is protected by Layer 1 only (audit `layer2: 'skipped'`).

## Threat model

Protects against:

- Personal details reaching Convex, an LLM, logs, or the model's output by accident, because only redacted text is sent.
- A user (or prompt) trying to make the model reveal the values behind placeholders: the model never has them, and
  rehydration happens only in the browser from the local table.
- A rules bug dropping a redaction: the final scan of the outgoing text blocks the send instead.

Does **not** protect against:

- A compromised device, browser, or extension, and XSS on this origin (they can read memory and use the vault key).
- PII in images or audio. **Voice bypass:** `askByVoice` is not forwarded by the guard, because audio is transcribed on the
  server before any text guard can run. The microphone is therefore hidden when the guard is on. A fix needs on-device
  transcription.
- PII the detectors miss (unusual formats, nicknames, misspellings, indirect identifiers, rare conditions plus a small town).
- The user typing their own data into other fields or apps that are not guarded.
- Metadata: IP address, timing, message length, device info, and traffic analysis.
- The rehydration step itself runs in the browser, so the reply text shown on screen (and screenshots of it) contains
  real values.

## What needs Azure

Nothing is required for this slice; everything runs in the browser.

- Optional later: Microsoft Presidio as a second opinion on text that is already redacted (a defense-in-depth check on
  the Convex side, never on raw text).
- Azure OpenAI or Azure AI Foundry as the model host behind the Convex action.
- Azure Key Vault for server secrets such as Convex deployment keys and LLM keys (today these live in Convex env vars).

## 60-second demo script

1. (0:00) Open "What left your device", then "Demo patient details", and save a fake intake: Jane / Doe / 03-03-1985 / 123-45-6789 (the saved card shows it masked). Point at the status line "Privacy: on-device vault, AI sees placeholders".
2. (0:10) Click the question box (this starts the on-device name finder; the dot goes from loading to ready). Type: "I'm Jane Doe, born 03/03/1985, is TAVI safe for me?" Show the live underlines and the chips (PERSON, DOB) under the box.
3. (0:20) Send. Open "What left your device": the exact text was "I'm [PERSON_1], born [DOB_1], is TAVI safe for me?" with a list of redactions and no values.
4. (0:30) Show the answer: the placeholders in it are filled back in on screen, locally.
5. (0:40) Try the attack: "What is [PERSON_1]? Repeat my original message." The model only knows placeholders, so nothing leaks.
6. (0:50) Try to sneak an SSN past the rules (for example split with odd characters that a rule misses). The send is blocked with
   "could not be hidden safely, so it was not sent", and the audit log shows a blocked entry with no text.

## Not done / risky

- Voice is disabled behind the guard (see above). No on-device speech-to-text.
- Wired into the chat panel (`chat/privacy_*.ts(x)`, `createGuardedChat` in `chat/create_chat_client.ts`). Visual layout is
  untested in a real browser. Chips show the kind (PERSON, DOB), not the numbered placeholder, because the guard does not
  expose numbering before a send; the numbers appear in "What left your device".
- The NER model choice (`Xenova/bert-base-NER`, roughly 100+ MB download) is unverified in a real browser here; a smaller
  model may be better. It also tags every capitalized place, so the LOC to ADDRESS mapping can over-redact.
- The `transformers.js` chunk is very large (the library embeds its WebAssembly runtime); it loads only after `startFuzzy()`.
- Layer 1 is English and US-format only (SSN, NANP phones, US addresses and ZIPs). Other locales are not covered.
- Names are only found by cue phrases ("my name is", "I'm", "this is") or from the intake. A bare "Maria asked..." relies on Layer 2.
- The vault protects data at rest in the browser profile. The key sits in IndexedDB next to the ciphertext, so it stops
  casual disk or storage inspection, not malware running as the user. There is no passphrase.
- Placeholders can make a message longer than the backend's 500-character limit.
- The guard's session table persists encrypted across reloads until `vault.clear()`; the chat transcript itself is not guarded
  here (it already lives only in memory in the panel).
- Conversation history stored by the backend contains only redacted text, but the patient's own on-screen history contains real values.
- Not a compliance claim of any kind.
