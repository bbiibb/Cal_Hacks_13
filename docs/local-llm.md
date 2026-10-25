# Local Language Model (Llama 3.2 3B with Ollama and RAG)

A second way to answer questions that needs **no API key and no internet for the model**: Llama 3.2 3B runs on your own computer through [Ollama](https://ollama.com), and the answer is based on text snippets found with Convex vector search (RAG).
The default pipeline (Groq, any OpenAI-compatible API) is unchanged. You choose with one environment variable.

> Status: **tested end to end** on an Apple M2 with 16 GB, using Llama 3.2 3B and nomic-embed-text through Ollama, a local Convex deployment, and Convex vector search. Results are in "What was tested" below.

## Is it feasible?

Yes, with these conditions:

| Question | Answer |
|---|---|
| Can a 3B model do this job? | Mostly, because the job is narrow. Two things make it reliable: Ollama **constrains the reply to a JSON schema** (the reply is always valid JSON, and `highlight` can only contain ids from the allowed list), and camera commands (zoom, rotate, step, reset) are **read from the patient's words by rules**, not asked from the model. Expect weaker wording and less nuance than the cloud model. |
| Does the computer have enough power? | This computer is an Apple M2 with 16 GB of memory, which runs a 3B model comfortably. Disk is the tight part: about 13 GB are free, and the models need about 2.3 GB. |
| Can the Convex cloud reach Ollama? | **No.** The cloud deployment cannot reach `http://localhost:11434` on your computer. The backend must run **locally** (`npx convex dev --local`, a beta feature) or Ollama must be exposed through a tunnel. |
| Does vector search work on a local Convex deployment? | **Yes, tested.** The 768-dimension vector index is accepted and returns the closest document first. If the vector search ever fails, the pipeline still answers with the keyword results plus the step on screen and the selected part. |
| Is RAG needed at this size? | Yes now: there are about 100 snippets (15 parts, 4 steps, 80 patient-education facts from the team's TAVR document, see [`knowledge-base.md`](knowledge-base.md)). RAG keeps the prompt short for a small model and lets the content grow without changing the code. |

## How it works

```
chat.ask / chat.askByVoice            (same arguments and same reply as before)
   |
   v
answerQuestion -> prepareModel   reads LLM_PROVIDER
   |                               |
   | "groq" (default)              | "local"
   v                               v
 full prompt, any                1. embed the question with nomic-embed-text (Ollama)
 OpenAI-compatible API           2. Convex vector search in medicalDocs -> top 4 snippets
                                 3. add the step on screen and the selected part ("pinned" context)
                                 4. short prompt + JSON schema -> Llama 3.2 3B (Ollama /api/chat)
   |                               |
   +---------------+---------------+
                   v
 same pipeline: read JSON -> build 3D commands -> validate -> response
```

- **Nothing changes for the frontend.** `chat.ask` and `chat.askByVoice` keep their arguments and their reply. The only visible difference is extra error codes (below).
- Safety stays the same in both modes: the validator, the emergency-symptom rule, the safety layer ([`safety.md`](safety.md)), and a side panel taken from our own content.
- In local mode, voice input through Cartesia is **off by default** (error `cloud_stt_disabled`), because it would send the patient's voice to a cloud service. Set `ALLOW_CLOUD_STT=true` to allow it.
- Voice input still uses Cartesia (`CARTESIA_API_KEY`), which is a cloud service. For a fully offline setup, speech-to-text would also need a local model; that is not built.

## Set it up

1. **Install Ollama and the two models** (about 2.3 GB in total).

```bash
brew install ollama
```

```bash
ollama serve
```

```bash
ollama pull llama3.2:3b
```

```bash
ollama pull nomic-embed-text
```

2. **Run the backend locally** so it can reach Ollama. This uses a separate local deployment with its own empty database. The command below needs no Convex login. Do it in a separate copy of the repository, because it writes its own `.env.local` and would replace the one that points to the cloud deployment. Keep it running: the local backend stops when the command stops.

```bash
cd packages/backend && CONVEX_AGENT_MODE=anonymous npx convex dev
```

(`npx convex dev --local` also works; it asks you to choose a project.) Add `CONVEX_AGENT_MODE=anonymous` in front of the `npx convex ...` commands below as well, so they reach the local deployment.

3. **Fill it with content and build the index** (the local deployment starts empty).

```bash
npx convex run seed:run
```

```bash
npx convex run rag:indexContent '{"procedureSlug":"tavr"}'
```

This embeds the parts, the steps, and the knowledge facts (99 documents). Run it again after changing the content.

4. **Switch to the local model.** No API key is needed.

```bash
npx convex env set LLM_PROVIDER local
```

Optional: `OLLAMA_BASE_URL` (default `http://localhost:11434`), `OLLAMA_MODEL` (default `llama3.2:3b`), `OLLAMA_EMBED_MODEL` (default `nomic-embed-text`).

5. **Ask a question** and check the reply.

```bash
npx convex run chat:ask '{"message":"What is the aortic annulus?","context":{"procedure_slug":"tavr","step_index":2,"selected_structure_id":null}}'
```

To go back to Groq: `npx convex env remove LLM_PROVIDER`.

**Alternative to a local backend:** keep the cloud deployment and expose Ollama with a tunnel (for example Cloudflare Tunnel or ngrok), then set `OLLAMA_BASE_URL` to the tunnel address. The tunnel is public, so protect it.

## What was tested

Tested on 2026-10-24 with `llama3.2:3b` (2.0 GB) and `nomic-embed-text` (274 MB):

- Ollama returns a reply that follows the JSON schema, and embeddings have 768 dimensions. About 37 tokens per second on the M2.
- Local Convex accepted the schema with the vector index. Indexing the TAVR content made 19 snippets. A search with a fake vector returned the matching document first.
- Ten real questions through `chat.ask`: parts and definitions, "zoom in", "go to step 3 and rotate left 90 degrees", a part selected in the view, an emergency symptom, a question about the future, a question the content does not answer, an attempt to override the rules, an off-topic request, and a multi-part question. All returned valid replies with correct highlights, camera commands, and side panels.
- Speed: the first question after starting Ollama takes about 10 seconds. Later simple questions take 4 to 5 seconds (the model stays in memory for 30 minutes). The cloud model answers in about 2 seconds.

Weak spots seen with the 3B model:
- It can word things loosely. For "Does the equipment you just put in stay in my body?" it began with "No", although the new valve stays; the cloud model handled this better.
- It sometimes adds general knowledge that is not in the context ("usually mild and temporary").
- It once put a refusal sentence in the `doctor_question` field. A reply is now accepted in that field only if it ends with a question mark.

## Use it from the website's chat panel

The chat panel in `apps/frontend` already talks to `chat.createSession` and `chat.ask`, so the local model needs no frontend code change. Only settings:

1. Start Ollama and the local backend as described above, with `LLM_PROVIDER=local`.
2. Create `apps/frontend/.env.local`:

```
VITE_CHAT_BACKEND=convex
VITE_CONVEX_URL=http://127.0.0.1:3210
VITE_CHAT_TIMEOUT_MS=120000
```

3. Start the website and open the walkthrough page. The panel shows **Live** when it uses the backend.

```bash
pnpm dev:frontend
```

Tested on 2026-10-24 in this way (browser panel, local Convex, Llama 3.2 3B): the answer, the "Shown in 3D" part, the follow-up buttons, and the camera zoom all worked, and the browser's cross-origin check passed.

**Speed when the 3D page is open.** On a 16 GB Apple M2 laptop, the 3D page (about 130 MB of models), the model (2 GB), and the backend share memory, and the computer started swapping. The same question that took 4 to 5 seconds alone took 10 to 40 seconds next to the 3D page. What helps: close other applications, use a computer with more memory, keep `VITE_CHAT_TIMEOUT_MS` high, and use smaller 3D models. The model's context window is set to 2048 tokens (enough for this prompt) to save memory.

## Files

| File | Purpose |
|---|---|
| `convex/schema.ts` | `medicalDocs` table with a vector index (768 dimensions) |
| `convex/rag.ts` | `rag:indexContent` (build the index), plus the internal save and read functions |
| `convex/lib/rag.ts` | Pure helpers: snippets from content and knowledge, pinned context, merging, rank fusion, allowed ids, sources |
| `convex/lib/knowledge.ts` | Loads the knowledge facts and searches them by keyword (BM25) |
| `convex/lib/ragRun.ts` | Embeds the question, runs the vector search, and fuses it with the keyword search |
| `convex/lib/ollama.ts` | Ollama client: chat with a JSON schema, and embeddings |
| `convex/lib/localPrompt.ts` | The short prompt for the 3B model and the JSON schema |
| `convex/lib/modelRoute.ts` | Chooses the pipeline from `LLM_PROVIDER` |

## Limits

- The 3B model gives shorter, plainer answers and may be less accurate than the cloud model. Medical answers still need review by a clinician.
- The first question after Ollama starts is slow (the model loads into memory). The model download itself took about 30 minutes on a 1 to 2 MB/s connection.
- If you change the embedding model, set the new vector size in `convex/lib/ragConfig.ts`, push the schema, and index again.
- New error codes: `llm_local_unavailable` (Ollama not reachable) and `llm_model_missing` (run `ollama pull <model>`).
