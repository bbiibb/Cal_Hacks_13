import { describe, expect, it, vi } from "vitest";
import { LlmError } from "../convex/lib/llm";
import {
  DEFAULT_EMBED_MODEL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  chatOllama,
  embedOllama,
  resolveOllamaConfig,
} from "../convex/lib/ollama";

const config = { baseUrl: "http://localhost:11434", model: "llama3.2:3b", embedModel: "nomic-embed-text" };
const messages = [{ role: "user" as const, content: "hi" }];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(LlmError);
  expect((error as LlmError).code).toBe(code);
  return error as LlmError;
}

describe("resolveOllamaConfig", () => {
  it("uses local defaults and trims the trailing slash", () => {
    expect(resolveOllamaConfig({})).toEqual({
      baseUrl: DEFAULT_OLLAMA_URL,
      model: DEFAULT_OLLAMA_MODEL,
      embedModel: DEFAULT_EMBED_MODEL,
    });
    expect(resolveOllamaConfig({ OLLAMA_BASE_URL: "http://host:1234/", OLLAMA_MODEL: "m", OLLAMA_EMBED_MODEL: "e" })).toEqual({
      baseUrl: "http://host:1234",
      model: "m",
      embedModel: "e",
    });
  });
});

describe("chatOllama", () => {
  it("sends the schema as `format` and returns the reply text", async () => {
    const schema = { type: "object" };
    const fetchImpl = vi.fn().mockResolvedValue(json({ message: { content: '{"answer":"hi"}' } }));
    await expect(chatOllama({ config, messages, schema, fetchImpl })).resolves.toBe('{"answer":"hi"}');

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("llama3.2:3b");
    expect(body.format).toEqual(schema);
    expect(body.stream).toBe(false);
    expect(body.options.temperature).toBe(0.1);
    expect(body.options.num_predict).toBe(300);
    expect(body.options.num_ctx).toBe(2048);
    expect(body.keep_alive).toBe("30m");
  });

  it("falls back to plain JSON mode without a schema", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ message: { content: "{}" } }));
    await chatOllama({ config, messages, fetchImpl });
    expect(JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string).format).toBe("json");
  });

  it("says Ollama may not be running when the connection fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const error = await expectCode(chatOllama({ config, messages, fetchImpl }), "llm_local_unavailable");
    expect(error.message).toContain("Ollama");
  });

  it("tells how to install a missing model", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ error: "model not found" }, 404));
    const error = await expectCode(chatOllama({ config, messages, fetchImpl }), "llm_model_missing");
    expect(error.message).toContain("ollama pull llama3.2:3b");
  });

  it("reports other failures, empty replies, and timeouts", async () => {
    await expectCode(chatOllama({ config, messages, fetchImpl: vi.fn().mockResolvedValue(json({}, 500)) }), "llm_request_failed");
    await expectCode(chatOllama({ config, messages, fetchImpl: vi.fn().mockResolvedValue(json({ message: { content: " " } })) }), "llm_bad_response");
    const hang = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_r, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    await expectCode(chatOllama({ config, messages, fetchImpl: hang as unknown as typeof fetch, timeoutMs: 20 }), "llm_timeout");
  });
});

describe("embedOllama", () => {
  it("returns one vector per text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ embeddings: [[1, 2], [3, 4]] }));
    await expect(embedOllama({ config, input: ["a", "b"], fetchImpl })).resolves.toEqual([[1, 2], [3, 4]]);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/embed");
    expect(JSON.parse(init.body as string)).toEqual({ model: "nomic-embed-text", input: ["a", "b"] });
  });

  it("rejects a wrong number of vectors or non-numbers", async () => {
    await expectCode(embedOllama({ config, input: ["a", "b"], fetchImpl: vi.fn().mockResolvedValue(json({ embeddings: [[1]] })) }), "llm_bad_response");
    await expectCode(embedOllama({ config, input: ["a"], fetchImpl: vi.fn().mockResolvedValue(json({ embeddings: [["x"]] })) }), "llm_bad_response");
    await expectCode(embedOllama({ config, input: ["a"], fetchImpl: vi.fn().mockResolvedValue(json({})) }), "llm_bad_response");
  });

  it("names the embedding model when it is missing", async () => {
    const error = await expectCode(
      embedOllama({ config, input: ["a"], fetchImpl: vi.fn().mockResolvedValue(json({}, 404)) }),
      "llm_model_missing",
    );
    expect(error.message).toContain("ollama pull nomic-embed-text");
  });
});
