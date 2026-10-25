import type { LlmMessage } from "./chatPrompt";

/**
 * Client for any OpenAI-compatible chat completions endpoint.
 * Free options that work with it: Groq (open-weight models such as gpt-oss), OpenRouter (":free" models), and others.
 * Nothing here is tied to one provider; the endpoint, key, and model come from environment variables.
 */

export const DEFAULT_LLM_BASE_URL = "https://api.groq.com/openai/v1";
// Groq retired its Llama chat models on 2026-08-16. openai/gpt-oss-20b is a small, fast, free open-weight model there.
export const DEFAULT_LLM_MODEL = "openai/gpt-oss-20b";
export const LLM_TIMEOUT_MS = 25_000;

export type LlmErrorCode =
  | "llm_not_configured"
  | "llm_rate_limited"
  | "llm_timeout"
  | "llm_request_failed"
  | "llm_local_unavailable"
  | "llm_model_missing"
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
  /** Injected for tests. Defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
}

/** The longest we wait before retrying a rate-limited request, in milliseconds. */
export const MAX_RATE_LIMIT_WAIT_MS = 8000;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Reads the provider's Retry-After header (seconds). Null when it is missing or not a number. */
function retryAfterMs(response: Response): number | null {
  const seconds = Number(response.headers.get("retry-after"));
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.ceil(seconds * 1000) + 250;
}

/** Asks the model for one reply and returns its text. */
export async function completeChat(params: CompletionParams): Promise<string> {
  const {
    config,
    messages,
    temperature = 0.2,
    maxTokens = 800,
    fetchImpl = fetch,
    timeoutMs = LLM_TIMEOUT_MS,
    sleep = realSleep,
  } = params;

  // JSON mode makes most providers return valid JSON. Some models reject it, so we retry once without it.
  let jsonMode = true;
  // A short rate limit (for example "try again in 2 seconds") is waited out once.
  let waitedForRateLimit = false;
  // gpt-oss models think before they answer; a low effort keeps answers fast and cheap.
  const reasoning = config.model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};

  for (let attempt = 0; attempt < 4; attempt++) {
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
          ...reasoning,
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

    if (response.status === 400 && jsonMode) {
      jsonMode = false;
      continue;
    }
    if (response.status === 429) {
      const wait = retryAfterMs(response);
      if (!waitedForRateLimit && wait !== null && wait <= MAX_RATE_LIMIT_WAIT_MS) {
        waitedForRateLimit = true;
        await sleep(wait);
        continue;
      }
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

/** Which language model pipeline answers questions. */
export type LlmProvider = "groq" | "local";

/** Reads LLM_PROVIDER. "groq" (any OpenAI-compatible API) is the default; "local" is Llama through Ollama. */
export function selectProvider(env: { LLM_PROVIDER?: string }): LlmProvider {
  const value = (env.LLM_PROVIDER ?? "groq").trim().toLowerCase();
  if (value === "groq" || value === "") return "groq";
  if (value === "local") return "local";
  throw new LlmError("llm_not_configured", 'LLM_PROVIDER must be "groq" or "local".');
}
