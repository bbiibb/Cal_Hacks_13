import { env, type ActionCtx } from "../_generated/server";
import { buildMessages as buildCloudMessages, type ChatTurn, type LlmMessage, type PromptData } from "./chatPrompt";
import { completeChat, LlmError, resolveLlmConfig, selectProvider } from "./llm";
import { buildLocalMessages, buildLocalSchema } from "./localPrompt";
import { chatOllama, resolveOllamaConfig } from "./ollama";
import {
  CLOUD_REFERENCE_LIMIT,
  allowedStructureIds,
  keywordDocs,
  mergeDocs,
  pinnedDocs,
  type RetrievedDoc,
} from "./rag";
import { retrieveDocs } from "./ragRun";

export interface ModelRoute {
  provider: "groq" | "local";
  /** Sends messages to the chosen model and returns its raw text. */
  callModel: (messages: LlmMessage[]) => Promise<string>;
  /** Builds the messages. Undefined means the default (cloud) prompt without reference facts. */
  buildMessages?: (data: PromptData, history: ChatTurn[], message: string) => LlmMessage[];
  /** The documents the model was given for this question; used to cite sources in the reply. */
  contextDocs: RetrievedDoc[];
}

/**
 * For a pure camera command: no model is asked, so nothing is embedded or searched either.
 * The pipeline answers such a command from the patient's words and never calls `callModel`.
 */
export function cameraOnlyRoute(): ModelRoute {
  return {
    provider: selectProvider(env),
    callModel: async () => {
      throw new Error("A camera command does not ask the model.");
    },
    contextDocs: [],
  };
}

/**
 * Chooses how this question is answered, from the LLM_PROVIDER environment variable:
 * - "groq" (default): any OpenAI-compatible API, with the full prompt plus the best-matching reference facts
 * - "local": Llama through Ollama, with retrieved context (vector plus keyword search) and a JSON schema
 * The caller does not care which one runs: both return raw text that the same pipeline reads.
 */
export async function prepareModel(ctx: ActionCtx, data: PromptData, message: string): Promise<ModelRoute> {
  const provider = selectProvider(env);

  if (provider === "groq") {
    const config = resolveLlmConfig(env);
    const reference = keywordDocs(data, message, CLOUD_REFERENCE_LIMIT);
    return {
      provider,
      callModel: (messages) => completeChat({ config, messages }),
      buildMessages: (d, history, userMessage) => buildCloudMessages(d, history, userMessage, reference),
      contextDocs: reference,
    };
  }

  const ollama = resolveOllamaConfig(env);
  const found = await retrieveDocs(ctx, ollama, data, message, undefined, (error) => {
    // A missing or unreachable model is a real problem the patient can be told about
    if (error instanceof LlmError) throw error;
    // Any other search problem (for example an empty index): keyword search and the pinned context still work
    console.log("Vector search failed; using keyword search and the current step and selected part.", String(error));
  });
  const docs = mergeDocs(pinnedDocs(data), found);
  const existing = new Set(data.structures.map((s) => s.id));
  const allowedIds = allowedStructureIds(docs, existing);
  const schema = buildLocalSchema(allowedIds);

  return {
    provider,
    callModel: (messages) => chatOllama({ config: ollama, messages, schema }),
    buildMessages: (d, history, userMessage) => buildLocalMessages(d, history, userMessage, docs, allowedIds),
    contextDocs: docs,
  };
}
