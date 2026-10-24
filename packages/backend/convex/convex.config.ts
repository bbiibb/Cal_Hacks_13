import { defineApp } from "convex/server";
import { v } from "convex/values";

// Server environment variables. Set them with `npx convex env set NAME value`; never commit values.
const app = defineApp({
  env: {
    // Cartesia API key for speech-to-text. Without it, transcription is reported as "not configured".
    CARTESIA_API_KEY: v.optional(v.string()),
    // Chatbot language model: any OpenAI-compatible endpoint. Free option: Groq with a Llama model.
    // LLM_API_KEY is required; LLM_BASE_URL and LLM_MODEL fall back to Groq and llama-3.1-8b-instant.
    LLM_API_KEY: v.optional(v.string()),
    LLM_BASE_URL: v.optional(v.string()),
    LLM_MODEL: v.optional(v.string()),
  },
});

export default app;
