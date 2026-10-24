import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { env, type ActionCtx } from "../_generated/server";
import { SttError, transcribeWithCartesia, validateAudio, validateLanguage } from "./cartesia";

export interface SpeechResult {
  text: string;
  language: string;
  durationSeconds: number | null;
}

/**
 * Reads an uploaded recording, turns it into text with Cartesia, and always deletes the recording
 * afterwards (success or failure), because it is a patient's voice.
 * Errors are thrown as ConvexError with `{ code, message }`.
 */
export async function transcribeStoredAudio(
  ctx: ActionCtx,
  args: { storageId: Id<"_storage">; language?: string },
): Promise<SpeechResult> {
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

    return await transcribeWithCartesia({ apiKey, audio, mime, extension, language });
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
}
