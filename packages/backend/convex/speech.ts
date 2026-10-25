import { v } from "convex/values";
import { action, internalMutation, mutation } from "./_generated/server";
import { transcribeStoredAudio } from "./lib/speechRun";

/**
 * Step 1 of voice input: the browser asks for a one-time upload URL, then POSTs the recording to it.
 * The upload response contains the `storageId` that is passed to `transcribe` (or `chat.askByVoice`).
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
    const result = await transcribeStoredAudio(ctx, args);
    return {
      text: result.text,
      language: result.language,
      duration_seconds: result.durationSeconds,
    };
  },
});

/**
 * Deletes recordings that were uploaded but never transcribed, for example when the browser lost its connection
 * between the upload and `chat.askByVoice`. A recording is a patient's voice, so it must not stay in storage.
 * It runs every hour (see crons.ts). Only voice recordings are kept in file storage, so every old file is removed.
 */
export const purgeOldRecordings = internalMutation({
  args: { olderThanMinutes: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - Math.max(args.olderThanMinutes, 0) * 60_000;
    const old = await ctx.db.system
      .query("_storage")
      .filter((q) => q.lt(q.field("_creationTime"), cutoff))
      .take(100);
    for (const file of old) await ctx.storage.delete(file._id);
    return old.length;
  },
});
