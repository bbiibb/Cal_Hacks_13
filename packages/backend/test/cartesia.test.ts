import { describe, expect, it, vi } from "vitest";
import {
  CARTESIA_STT_MODEL,
  CARTESIA_STT_URL,
  CARTESIA_VERSION,
  MAX_AUDIO_BYTES,
  SttError,
  baseMimeType,
  transcribeWithCartesia,
  validateAudio,
  validateLanguage,
} from "../convex/lib/cartesia";

const audio = new Uint8Array([1, 2, 3, 4]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function expectSttError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SttError);
  expect((error as SttError).code).toBe(code);
  return error as SttError;
}

describe("validateLanguage", () => {
  it("defaults to English and normalizes case", () => {
    expect(validateLanguage(undefined)).toBe("en");
    expect(validateLanguage(" KO ")).toBe("ko");
  });

  it("rejects anything that is not a short language code", async () => {
    for (const bad of ["", "english", "en-US", "e", "en\r\nX-Evil: 1", "1a"]) {
      expect(() => validateLanguage(bad)).toThrow(SttError);
    }
  });
});

describe("validateAudio", () => {
  it("accepts common browser recordings and strips MIME parameters", () => {
    expect(validateAudio(100, "audio/webm;codecs=opus")).toEqual({ mime: "audio/webm", extension: "webm" });
    expect(validateAudio(100, "audio/mp4")).toEqual({ mime: "audio/mp4", extension: "mp4" });
    expect(baseMimeType("Audio/WAV; x=1")).toBe("audio/wav");
  });

  it("rejects empty, oversized, and non-audio files", async () => {
    await expectSttError(Promise.resolve().then(() => validateAudio(0, "audio/webm")), "audio_empty");
    await expectSttError(
      Promise.resolve().then(() => validateAudio(MAX_AUDIO_BYTES + 1, "audio/webm")),
      "audio_too_large",
    );
    await expectSttError(Promise.resolve().then(() => validateAudio(10, "image/png")), "unsupported_audio_type");
    await expectSttError(Promise.resolve().then(() => validateAudio(10, undefined)), "unsupported_audio_type");
  });
});

describe("transcribeWithCartesia", () => {
  const base = { apiKey: "test-key", audio, mime: "audio/webm", extension: "webm", language: "en" };

  it("posts the recording to Cartesia with the right headers and fields", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ text: "  Where is the valve?  ", language: "en", duration: 2.5 }));
    const result = await transcribeWithCartesia({ ...base, fetchImpl });

    expect(result).toEqual({ text: "Where is the valve?", language: "en", durationSeconds: 2.5 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(CARTESIA_STT_URL);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("test-key");
    expect(headers["Cartesia-Version"]).toBe(CARTESIA_VERSION);
    expect(headers["Content-Type"]).toMatch(/^multipart\/form-data; boundary=/);

    const text = new TextDecoder().decode(init.body as Uint8Array);
    expect(text).toContain(`name="model"\r\n\r\n${CARTESIA_STT_MODEL}`);
    expect(text).toContain('name="language"\r\n\r\nen');
    expect(text).toContain('filename="recording.webm"');
  });

  it("falls back to the requested language and null duration when Cartesia omits them", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ text: "hello" }));
    const result = await transcribeWithCartesia({ ...base, language: "ko", fetchImpl });
    expect(result).toEqual({ text: "hello", language: "ko", durationSeconds: null });
  });

  it("reports HTTP errors without leaking the key or the response body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("invalid key test-key", { status: 401 }));
    const error = await expectSttError(transcribeWithCartesia({ ...base, fetchImpl }), "stt_request_failed");
    expect(error.status).toBe(401);
    expect(error.message).not.toContain("test-key");
  });

  it("reports network failures", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expectSttError(transcribeWithCartesia({ ...base, fetchImpl }), "stt_request_failed");
  });

  it("times out when Cartesia does not answer", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    await expectSttError(
      transcribeWithCartesia({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 20 }),
      "stt_timeout",
    );
  });

  it("rejects unreadable or unexpected responses", async () => {
    await expectSttError(
      transcribeWithCartesia({ ...base, fetchImpl: vi.fn().mockResolvedValue(new Response("not json", { status: 200 })) }),
      "stt_bad_response",
    );
    await expectSttError(
      transcribeWithCartesia({ ...base, fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ transcript: "x" })) }),
      "stt_bad_response",
    );
  });
});
