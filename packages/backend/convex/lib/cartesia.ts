import { z } from "zod";
import { buildMultipartBody } from "./multipart";

/** Cartesia batch speech-to-text endpoint. */
export const CARTESIA_STT_URL = "https://api.cartesia.ai/stt";
export const CARTESIA_VERSION = "2025-04-16";
export const CARTESIA_STT_MODEL = "ink-whisper";

/** Largest audio file we accept, in bytes. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** How long we wait for Cartesia before giving up. */
export const STT_TIMEOUT_MS = 30_000;
export const DEFAULT_STT_LANGUAGE = "en";

/** Audio types a browser recorder (MediaRecorder) or an upload can produce. */
const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
};

/** ISO-639-1 style language code, e.g. "en" or "ko". */
const LANGUAGE_PATTERN = /^[a-z]{2,3}$/;

export type SttErrorCode =
  | "stt_not_configured"
  | "cloud_stt_disabled"
  | "invalid_language"
  | "audio_not_found"
  | "audio_too_large"
  | "audio_empty"
  | "unsupported_audio_type"
  | "stt_timeout"
  | "stt_request_failed"
  | "stt_bad_response";

/** Error with a stable code the frontend can react to. Messages never contain secrets. */
export class SttError extends Error {
  readonly code: SttErrorCode;
  readonly status: number | null;

  constructor(code: SttErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "SttError";
    this.code = code;
    this.status = status;
  }
}

/** Returns the bare MIME type without parameters, lower-cased ("audio/webm;codecs=opus" -> "audio/webm"). */
export function baseMimeType(contentType: string | undefined): string {
  return (contentType ?? "").split(";")[0]!.trim().toLowerCase();
}

export function validateLanguage(language: string | undefined): string {
  const value = (language ?? DEFAULT_STT_LANGUAGE).trim().toLowerCase();
  if (!LANGUAGE_PATTERN.test(value)) {
    throw new SttError("invalid_language", "Language must be a short code such as \"en\" or \"ko\".");
  }
  return value;
}

/** Checks size and type of the recorded audio before anything is sent to Cartesia. */
export function validateAudio(size: number, contentType: string | undefined): { mime: string; extension: string } {
  if (size <= 0) throw new SttError("audio_empty", "The recording is empty.");
  if (size > MAX_AUDIO_BYTES) {
    throw new SttError("audio_too_large", `The recording is larger than ${MAX_AUDIO_BYTES / (1024 * 1024)} MB.`);
  }
  const mime = baseMimeType(contentType);
  const extension = AUDIO_TYPES[mime];
  if (!extension) {
    throw new SttError("unsupported_audio_type", `Unsupported audio type: ${mime || "unknown"}.`);
  }
  return { mime, extension };
}

const SttResponseSchema = z.object({
  text: z.string(),
  language: z.string().optional(),
  duration: z.number().optional(),
});

export interface TranscribeParams {
  apiKey: string;
  audio: Uint8Array;
  /** MIME type of the audio, e.g. "audio/webm" */
  mime: string;
  /** File extension without the dot, e.g. "webm" */
  extension: string;
  language: string;
  /** Injected for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface TranscribeResult {
  text: string;
  language: string;
  durationSeconds: number | null;
}

/** Sends one recording to Cartesia and returns the transcript. */
export async function transcribeWithCartesia(params: TranscribeParams): Promise<TranscribeResult> {
  const { apiKey, audio, mime, extension, language, fetchImpl = fetch, timeoutMs = STT_TIMEOUT_MS } = params;

  const { body, contentType } = buildMultipartBody(
    { model: CARTESIA_STT_MODEL, language },
    { field: "file", filename: `recording.${extension}`, contentType: mime, data: audio },
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(CARTESIA_STT_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Cartesia-Version": CARTESIA_VERSION,
        "Content-Type": contentType,
      },
      body: body as unknown as BodyInit,
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new SttError("stt_timeout", "Speech-to-text took too long. Please try again.");
    }
    throw new SttError("stt_request_failed", "Could not reach the speech-to-text service.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // The response body is not forwarded: it is not needed by the client and may echo request details.
    throw new SttError("stt_request_failed", `Speech-to-text failed (HTTP ${response.status}).`, response.status);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new SttError("stt_bad_response", "Speech-to-text returned an unreadable response.");
  }
  const parsed = SttResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new SttError("stt_bad_response", "Speech-to-text returned an unexpected response.");
  }

  return {
    text: parsed.data.text.trim(),
    language: parsed.data.language ?? language,
    durationSeconds: parsed.data.duration ?? null,
  };
}
