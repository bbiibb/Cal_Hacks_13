import { ConvexError, v } from "convex/values";
import { action, env, mutation } from "./_generated/server";
import {
  SttError,
  transcribeWithCartesia,
  validateAudio,
  validateLanguage,
} from "./lib/cartesia";

/**
 * Step 1 of voice input: the browser asks for a one-time upload URL, then POSTs the recording to it.
 * The upload response contains the `storageId` that is passed to `transcribe`.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Step 2: turn the uploaded recording into text with Cartesia speech-to-text.
 * The recording is always deleted afterwards (success or failure), because it is a patient's voice.
 * Errors are thrown as ConvexError with `{ code, message }` so the UI can show a friendly message.
 */
export const transcribe = action({
  args: {
    storageId: v.id("_storage"),
    /** Short language code, e.g. "en" or "ko". Defaults to "en". */
    language: v.optional(v.string()),
  },
  returns: v.object({
    text: v.string(),
    language: v.string(),
    duration_seconds: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    try {
      const language = validateLanguage(args.language);

      const apiKey = env.CARTESIA_API_KEY;
      if (!apiKey) {
        throw new SttError("stt_not_configured", "Speech-to-text is not configured on the server.");
      }

      const blob = await ctx.storage.get(args.storageId);
      if (!blob) throw new SttError("audio_not_found", "The recording could not be found.");

      const { mime, extension } = validateAudio(blob.size, blob.type);
      const audio = new Uint8Array(await blob.arrayBuffer());

      const result = await transcribeWithCartesia({ apiKey, audio, mime, extension, language });
      return {
        text: result.text,
        language: result.language,
        duration_seconds: result.durationSeconds,
      };
    } catch (error) {
      if (error instanceof SttError) {
        throw new ConvexError({ code: error.code, message: error.message });
      }
      throw error;
    } finally {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // Already deleted or never existed: nothing left to clean up.
      }
    }
  },
});
