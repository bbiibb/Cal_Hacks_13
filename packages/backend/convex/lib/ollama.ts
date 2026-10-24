import { LlmError } from "./llm";
import type { LlmMessage } from "./chatPrompt";

/**
 * Client for a local Ollama server: chat (with a JSON schema that constrains the reply) and embeddings.
 * Ollama runs on your own computer, so no API key and no cost. The Convex backend must be able to reach
 * it: a local Convex deployment can (http://localhost:11434); the Convex cloud cannot.
 */

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";
export const DEFAULT_EMBED_MODEL = "nomic-embed-text";
/** The first request loads the model into memory, which can take a while. */
export const OLLAMA_TIMEOUT_MS = 120_000;

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  embedModel: string;
}

export function resolveOllamaConfig(env: {
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  OLLAMA_EMBED_MODEL?: string;
}): OllamaConfig {
  return {
    baseUrl: (env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL).replace(/\/+$/, ""),
    model: env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
    embedModel: env.OLLAMA_EMBED_MODEL || DEFAULT_EMBED_MODEL,
  };
}

interface CallParams {
  config: OllamaConfig;
  /** Injected for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Sends a JSON request to Ollama and returns the parsed reply, with friendly errors. */
async function post(path: string, body: unknown, model: string, params: CallParams): Promise<unknown> {
  const { config, fetchImpl = fetch, timeoutMs = OLLAMA_TIMEOUT_MS } = params;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new LlmError("llm_timeout", "The local model took too long to answer. Please try again.");
    }
    throw new LlmError(
      "llm_local_unavailable",
      "Could not reach the local model. Is Ollama running, and can this backend reach it?",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    throw new LlmError("llm_model_missing", `The local model "${model}" is not installed. Run: ollama pull ${model}`, 404);
  }
  if (!response.ok) {
    throw new LlmError("llm_request_failed", `The local model failed (HTTP ${response.status}).`, response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new LlmError("llm_bad_response", "The local model returned an unreadable response.");
  }
}

export interface OllamaChatParams extends CallParams {
  messages: LlmMessage[];
  /** JSON schema that the reply must follow. Ollama constrains decoding to it. */
  schema?: Record<string, unknown>;
  temperature?: number;
}

/** Asks the local model for one reply and returns its text. */
export async function chatOllama(params: OllamaChatParams): Promise<string> {
  const { config, messages, schema, temperature = 0.1 } = params;
  const json = (await post(
    "/api/chat",
    {
      model: config.model,
      messages,
      stream: false,
      // A schema makes even a small model return valid JSON; plain "json" is the looser fallback
      format: schema ?? "json",
      options: { temperature, num_ctx: 4096 },
    },
    config.model,
    params,
  )) as { message?: { content?: unknown } };
  const content = json?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new LlmError("llm_bad_response", "The local model returned an empty response.");
  }
  return content;
}

export interface OllamaEmbedParams extends CallParams {
  input: string[];
}

/** Turns texts into vectors (one per text) with the local embedding model. */
export async function embedOllama(params: OllamaEmbedParams): Promise<number[][]> {
  const { config, input } = params;
  const json = (await post("/api/embed", { model: config.embedModel, input }, config.embedModel, params)) as {
    embeddings?: unknown;
  };
  const embeddings = json?.embeddings;
  const valid =
    Array.isArray(embeddings) &&
    embeddings.length === input.length &&
    embeddings.every((e) => Array.isArray(e) && e.every((n) => typeof n === "number"));
  if (!valid) {
    throw new LlmError("llm_bad_response", "The embedding model returned an unexpected response.");
  }
  return embeddings as number[][];
}
