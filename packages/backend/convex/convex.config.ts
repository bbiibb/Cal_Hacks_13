import { defineApp } from "convex/server";
import { v } from "convex/values";

// Server environment variables. Set them with `npx convex env set NAME value`; never commit values.
const app = defineApp({
  env: {
    // Cartesia API key for speech-to-text. Without it, transcription is reported as "not configured".
    CARTESIA_API_KEY: v.optional(v.string()),
  },
});

export default app;
