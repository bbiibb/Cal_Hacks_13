/**
 * Vector size of the embedding model. It must match the model set in OLLAMA_EMBED_MODEL
 * (nomic-embed-text produces 768 numbers). If you switch to a model with another size,
 * change this value, push the schema, and index the content again.
 */
export const EMBEDDING_DIMENSIONS = 768;
