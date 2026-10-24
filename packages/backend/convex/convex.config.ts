import { defineApp } from "convex/server";
import { v } from "convex/values";

// Server environment variables. Set them with `npx convex env set NAME value`; never commit values.
const app = defineApp({
  env: {
    // Cartesia API key for speech-to-text. Without it, transcription is reported as "not configured".
    CARTESIA_API_KEY: v.optional(v.string()),
    // Chatbot language model: any OpenAI-compatible endpoint. Free option: Groq with a Llama model.
    // LLM_API_KEY is required; LLM_BASE_URL and LLM_MODEL fall back to Groq and openai/gpt-oss-20b.
    LLM_API_KEY: v.optional(v.string()),
    LLM_BASE_URL: v.optional(v.string()),
    LLM_MODEL: v.optional(v.string()),
    // Which language model pipeline answers: "groq" (default, any OpenAI-compatible API) or "local"
    // (Llama through Ollama plus RAG, no API key). See docs/local-llm.md.
    LLM_PROVIDER: v.optional(v.string()),
    OLLAMA_BASE_URL: v.optional(v.string()), // default http://localhost:11434
    OLLAMA_MODEL: v.optional(v.string()), // default llama3.2:3b
    OLLAMA_EMBED_MODEL: v.optional(v.string()), // default nomic-embed-text (768 dimensions)
  },
});

export default app;
