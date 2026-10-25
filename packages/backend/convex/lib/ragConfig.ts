/**
 * Vector size of the embedding model. It must match the model set in OLLAMA_EMBED_MODEL
 * (nomic-embed-text produces 768 numbers). If you switch to a model with another size,
 * change this value, push the schema, and index the content again.
 */
export const EMBEDDING_DIMENSIONS = 768;

/** Prefixes that nomic-embed-text was trained with: they make search clearly more accurate. */
export const QUERY_PREFIX = "search_query: ";
export const DOCUMENT_PREFIX = "search_document: ";
