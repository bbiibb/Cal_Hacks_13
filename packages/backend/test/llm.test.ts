import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  LlmError,
  completeChat,
  resolveLlmConfig,
} from "../convex/lib/llm";

const config = { apiKey: "test-key", baseUrl: "https://llm.example.com/v1", model: "test-model" };
const messages = [{ role: "user" as const, content: "hi" }];

function reply(content: unknown, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

async function expectLlmError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(LlmError);
  expect((error as LlmError).code).toBe(code);
  return error as LlmError;
}

describe("resolveLlmConfig", () => {
  it("requires an API key", () => {
    expect(() => resolveLlmConfig({})).toThrow(LlmError);
  });

  it("falls back to the free Groq + Llama defaults and trims the trailing slash", () => {
    expect(resolveLlmConfig({ LLM_API_KEY: "k" })).toEqual({
      apiKey: "k",
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
    });
    expect(resolveLlmConfig({ LLM_API_KEY: "k", LLM_BASE_URL: "https://x.test/v1/", LLM_MODEL: "m" })).toEqual({
      apiKey: "k",
      baseUrl: "https://x.test/v1",
      model: "m",
    });
  });
});

describe("completeChat", () => {
  it("sends an OpenAI-style request and returns the reply text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply('{"answer":"hi"}'));
    const text = await completeChat({ config, messages, fetchImpl });
    expect(text).toBe('{"answer":"hi"}');

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://llm.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("test-model");
    expect(body.messages).toEqual(messages);
    expect(body.temperature).toBe(0.2);
    expect(body.stream).toBe(false);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("retries once without JSON mode when the model rejects it", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("response_format not supported", { status: 400 }))
      .mockResolvedValueOnce(reply("plain text"));
    await expect(completeChat({ config, messages, fetchImpl })).resolves.toBe("plain text");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(secondBody.response_format).toBeUndefined();
  });

  it("reports rate limits so the UI can ask the patient to wait", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("slow down test-key", { status: 429 }));
    const error = await expectLlmError(completeChat({ config, messages, fetchImpl }), "llm_rate_limited");
    expect(error.message).not.toContain("test-key");
  });

  it("reports other HTTP failures without leaking the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("secret details", { status: 500 }));
    const error = await expectLlmError(completeChat({ config, messages, fetchImpl }), "llm_request_failed");
    expect(error.status).toBe(500);
    expect(error.message).not.toContain("secret");
  });

  it("reports network failures and empty replies", async () => {
    await expectLlmError(
      completeChat({ config, messages, fetchImpl: vi.fn().mockRejectedValue(new TypeError("fetch failed")) }),
      "llm_request_failed",
    );
    await expectLlmError(completeChat({ config, messages, fetchImpl: vi.fn().mockResolvedValue(reply("  ")) }), "llm_bad_response");
    await expectLlmError(
      completeChat({ config, messages, fetchImpl: vi.fn().mockResolvedValue(new Response("not json", { status: 200 })) }),
      "llm_bad_response",
    );
  });

  it("times out", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    await expectLlmError(
      completeChat({ config, messages, fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 20 }),
      "llm_timeout",
    );
  });
});
