import type { LlmMessage } from "./chatPrompt";

/**
 * Client for any OpenAI-compatible chat completions endpoint.
 * Free options that work with it: Groq (Llama models), OpenRouter (":free" models), and others.
 * Nothing here is tied to one provider; the endpoint, key, and model come from environment variables.
 */

export const DEFAULT_LLM_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_LLM_MODEL = "llama-3.1-8b-instant";
export const LLM_TIMEOUT_MS = 25_000;

export type LlmErrorCode =
  | "llm_not_configured"
  | "llm_rate_limited"
  | "llm_timeout"
  | "llm_request_failed"
  | "llm_bad_response";

/** Error with a stable code. Messages never contain the API key or the provider's raw response. */
export class LlmError extends Error {
  readonly code: LlmErrorCode;
  readonly status: number | null;

  constructor(code: LlmErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "LlmError";
    this.code = code;
    this.status = status;
  }
}

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** Reads the configuration, falling back to the free Groq + Llama defaults. */
export function resolveLlmConfig(env: {
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
}): LlmConfig {
  if (!env.LLM_API_KEY) {
    throw new LlmError("llm_not_configured", "The chatbot is not configured on the server.");
  }
  return {
    apiKey: env.LLM_API_KEY,
    baseUrl: (env.LLM_BASE_URL || DEFAULT_LLM_BASE_URL).replace(/\/+$/, ""),
    model: env.LLM_MODEL || DEFAULT_LLM_MODEL,
  };
}

export interface CompletionParams {
  config: LlmConfig;
  messages: LlmMessage[];
  /** Low values make small models more consistent. */
  temperature?: number;
  maxTokens?: number;
  /** Injected for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Asks the model for one reply and returns its text. */
export async function completeChat(params: CompletionParams): Promise<string> {
  const { config, messages, temperature = 0.2, maxTokens = 600, fetchImpl = fetch, timeoutMs = LLM_TIMEOUT_MS } = params;

  // JSON mode makes most providers return valid JSON. Some models reject it, so we retry once without it.
  for (const jsonMode of [true, false]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new LlmError("llm_timeout", "The assistant took too long to answer. Please try again.");
      }
      throw new LlmError("llm_request_failed", "Could not reach the assistant service.");
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 400 && jsonMode) continue;
    if (response.status === 429) {
      throw new LlmError("llm_rate_limited", "The assistant is busy right now. Please try again in a minute.", 429);
    }
    if (!response.ok) {
      throw new LlmError("llm_request_failed", `The assistant service failed (HTTP ${response.status}).`, response.status);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new LlmError("llm_bad_response", "The assistant returned an unreadable response.");
    }
    const content = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new LlmError("llm_bad_response", "The assistant returned an empty response.");
    }
    return content;
  }

  throw new LlmError("llm_request_failed", "The assistant service rejected the request.", 400);
}
