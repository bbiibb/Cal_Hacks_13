/*
 * Web worker for Layer 2. It runs a small token-classification model on this device with transformers.js.
 * The library is imported dynamically so it is its own chunk and never part of the main bundle.
 * Text arrives from the page and results go back to the page; nothing here talks to a server except the
 * one-time download of the model files from the Hugging Face hub.
 */
import type { NerToken, WorkerRequest, WorkerResponse } from './fuzzy'

type Ner = (text: string) => Promise<NerToken[]>
type PipelineFn = (task: string, model: string, options: object) => Promise<unknown>

const scope = self as unknown as {
  postMessage(message: WorkerResponse): void
  onmessage: ((event: { data: WorkerRequest }) => void) | null
}

let ner: Ner | null = null

async function init(model: string): Promise<void> {
  const library = await import('@huggingface/transformers')
  library.env.allowLocalModels = false
  const pipeline = library.pipeline as unknown as PipelineFn
  ner = (await pipeline('token-classification', model, { dtype: 'q8' })) as Ner
}

scope.onmessage = (event) => {
  const message = event.data
  if (message.kind === 'init') {
    init(message.model).then(
      () => scope.postMessage({ kind: 'ready' }),
      () => scope.postMessage({ kind: 'error', message: 'The model could not be loaded.' }),
    )
  } else if (ner) {
    const { id, text } = message
    ner(text).then(
      (tokens) => scope.postMessage({ kind: 'result', id, tokens: tokens.map(({ entity, score, index, word, start, end }) => ({ entity, score, index, word, start, end })) }),
      () => scope.postMessage({ kind: 'detect_error', id, message: 'Detection failed.' }),
    )
  } else {
    scope.postMessage({ kind: 'detect_error', id: message.kind === 'detect' ? message.id : 0, message: 'Not ready.' })
  }
}
