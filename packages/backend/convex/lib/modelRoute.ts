import { env, type ActionCtx } from "../_generated/server";
import type { ChatTurn, LlmMessage, PromptData } from "./chatPrompt";
import { completeChat, LlmError, resolveLlmConfig, selectProvider } from "./llm";
import { buildLocalMessages, buildLocalSchema } from "./localPrompt";
import { chatOllama, resolveOllamaConfig } from "./ollama";
import { allowedStructureIds, mergeDocs, pinnedDocs } from "./rag";
import { retrieveDocs } from "./ragRun";

export interface ModelRoute {
  provider: "groq" | "local";
  /** Sends messages to the chosen model and returns its raw text. */
  callModel: (messages: LlmMessage[]) => Promise<string>;
  /** Builds the messages. Undefined means the default (cloud) prompt. */
  buildMessages?: (data: PromptData, history: ChatTurn[], message: string) => LlmMessage[];
}

/**
 * Chooses how this question is answered, from the LLM_PROVIDER environment variable:
 * - "groq" (default): any OpenAI-compatible API, with the full prompt
 * - "local": Llama through Ollama, with retrieved context (RAG) and a JSON schema
 * The caller does not care which one runs: both return raw text that the same pipeline reads.
 */
export async function prepareModel(ctx: ActionCtx, data: PromptData, message: string): Promise<ModelRoute> {
  const provider = selectProvider(env);

  if (provider === "groq") {
    const config = resolveLlmConfig(env);
    return { provider, callModel: (messages) => completeChat({ config, messages }) };
  }

  const ollama = resolveOllamaConfig(env);
  let found: Awaited<ReturnType<typeof retrieveDocs>> = [];
  try {
    found = await retrieveDocs(ctx, ollama, message);
  } catch (error) {
    // A missing or unreachable model is a real problem the patient can be told about
    if (error instanceof LlmError) throw error;
    // Any other search problem (for example an empty index): continue with the pinned context only
    console.log("Vector search failed; using only the current step and selected part.", String(error));
  }
  const docs = mergeDocs(pinnedDocs(data), found);
  const schema = buildLocalSchema(allowedStructureIds(docs));

  return {
    provider,
    callModel: (messages) => chatOllama({ config: ollama, messages, schema }),
    buildMessages: (d, history, userMessage) => buildLocalMessages(d, history, userMessage, docs),
  };
}
