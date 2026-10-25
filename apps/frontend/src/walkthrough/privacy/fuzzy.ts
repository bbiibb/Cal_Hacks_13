import { isPiiType } from './types'
import type { PiiSpan } from './types'

/*
 * Layer 2: the fuzzy "guard agent". It runs ON THIS DEVICE ONLY (transformers.js in a web worker), so the raw
 * text never leaves the browser. It is optional: when it is loading, slow or broken, Layer 1 still protects.
 */

export type FuzzyStatus = 'loading' | 'ready' | 'unavailable'

/** Finds personal information that fixed rules cannot, mostly names. Implementations must not send text anywhere. */
export interface FuzzyDetector {
  detect(text: string): Promise<PiiSpan[]>
  /** Absent means always ready (test doubles). The guard skips the detector unless this is "ready". */
  readonly status?: FuzzyStatus
  /** Tells the listener whenever `status` changes. Returns an unsubscribe function. */
  subscribe?(listener: (status: FuzzyStatus) => void): () => void
  /** Begins loading the model. Safe to call more than once. */
  start?(): void
  dispose?(): void
}

/**
 * Validates whatever a detector returned: a span needs a known type, integer offsets with
 * 0 <= start < end <= text length, and a confidence between 0 and 1. Invalid entries are dropped.
 * (Hand-written because `zod` is not a dependency of the frontend app.)
 */
export function parseFuzzySpans(raw: unknown, textLength: number): PiiSpan[] {
  if (!Array.isArray(raw)) return []
  const spans: PiiSpan[] = []
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) continue
    const { type, start, end, confidence } = item as Record<string, unknown>
    if (!isPiiType(type)) continue
    if (typeof start !== 'number' || typeof end !== 'number' || typeof confidence !== 'number') continue
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue
    if (start < 0 || end <= start || end > textLength) continue
    if (!(confidence >= 0 && confidence <= 1)) continue
    spans.push({ type, start, end, confidence, source: 'model' })
  }
  return spans
}

/** One token as transformers.js reports it (aggregation "none"). `start`/`end` may be null. */
export type NerToken = {
  entity: string
  score: number
  index?: number
  word: string
  start?: number | null
  end?: number | null
}

const ENTITY_TYPES: Record<string, PiiSpan['type']> = { PER: 'PERSON', LOC: 'ADDRESS' }

/**
 * Turns BIO-tagged word pieces into spans. Uses the offsets the library gives when present and otherwise
 * finds each piece in the text in order. Only people (PER) and places (LOC) are kept.
 */
export function entitiesToSpans(text: string, tokens: readonly NerToken[], minScore = 0.6): PiiSpan[] {
  type Group = { label: string; start: number; end: number; scores: number[] }
  const groups: Group[] = []
  const lower = text.toLowerCase()
  let cursor = 0
  let current: Group | null = null
  for (const token of tokens) {
    const label = token.entity.replace(/^[BI]-/, '')
    const isContinuation = token.word.startsWith('##')
    const piece = token.word.replace(/^##/, '')
    let start: number
    let end: number
    if (typeof token.start === 'number' && typeof token.end === 'number') {
      start = token.start
      end = token.end
    } else {
      start = lower.indexOf(piece.toLowerCase(), cursor)
      if (start < 0) {
        current = null
        continue
      }
      end = start + piece.length
    }
    cursor = end
    const startsNew = token.entity.startsWith('B-') && !isContinuation
    if (current && !startsNew && current.label === label && (isContinuation || /^\s*$/.test(text.slice(current.end, start)))) {
      current.end = end
      current.scores.push(token.score)
    } else {
      current = { label, start, end, scores: [token.score] }
      groups.push(current)
    }
  }
  const spans: PiiSpan[] = []
  for (const group of groups) {
    const type = ENTITY_TYPES[group.label]
    const confidence = group.scores.reduce((a, b) => a + b, 0) / group.scores.length
    if (type && confidence >= minScore) spans.push({ type, start: group.start, end: group.end, confidence: Math.min(1, confidence), source: 'model' })
  }
  return parseFuzzySpans(spans, text.length)
}

/* ---------- the transformers.js detector (browser only) ---------- */

/** Messages between the page and `fuzzy_worker.ts`. */
export type WorkerRequest = { kind: 'init'; model: string } | { kind: 'detect'; id: number; text: string }
export type WorkerResponse =
  | { kind: 'ready' }
  | { kind: 'error'; message: string }
  | { kind: 'result'; id: number; tokens: NerToken[] }
  | { kind: 'detect_error'; id: number; message: string }

/** The slice of the Worker API the detector uses, so tests can pass a fake. */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void
  terminate(): void
  onmessage: ((event: { data: WorkerResponse }) => void) | null
  onerror: ((event: unknown) => void) | null
}

export type TransformersDetectorOptions = {
  /** A token-classification model on the Hugging Face hub in ONNX form. */
  model?: string
  /** Gives up loading (download plus compile) after this many ms and stays "unavailable". */
  loadTimeoutMs?: number
  /** Gives up on one detect call after this many ms. */
  detectTimeoutMs?: number
  minScore?: number
  createWorker?: () => WorkerLike
}

export const DEFAULT_NER_MODEL = 'Xenova/bert-base-NER'

/**
 * Runs token-classification NER with transformers.js inside a web worker. The library and the model are
 * loaded lazily: nothing is downloaded until `start()` is called, and the library is a separate chunk.
 */
export class TransformersFuzzyDetector implements FuzzyDetector {
  private current: FuzzyStatus = 'loading'
  private started = false
  private worker: WorkerLike | null = null
  private nextId = 1
  private readonly listeners = new Set<(status: FuzzyStatus) => void>()
  private readonly pending = new Map<number, { resolve: (tokens: NerToken[]) => void; reject: (error: Error) => void }>()
  private loadTimer: ReturnType<typeof setTimeout> | undefined
  private readonly options: Required<Omit<TransformersDetectorOptions, 'createWorker'>> & Pick<TransformersDetectorOptions, 'createWorker'>

  constructor(options: TransformersDetectorOptions = {}) {
    this.options = {
      model: options.model ?? DEFAULT_NER_MODEL,
      loadTimeoutMs: options.loadTimeoutMs ?? 90_000,
      detectTimeoutMs: options.detectTimeoutMs ?? 3_000,
      minScore: options.minScore ?? 0.6,
      createWorker: options.createWorker,
    }
  }

  get status(): FuzzyStatus {
    return this.current
  }

  subscribe(listener: (status: FuzzyStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.started) return
    this.started = true
    try {
      this.worker =
        this.options.createWorker?.() ??
        (new Worker(new URL('./fuzzy_worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike)
    } catch {
      this.fail()
      return
    }
    this.worker.onmessage = (event) => this.handle(event.data)
    this.worker.onerror = () => this.fail()
    this.loadTimer = setTimeout(() => this.fail(), this.options.loadTimeoutMs)
    this.worker.postMessage({ kind: 'init', model: this.options.model })
  }

  detect(text: string): Promise<PiiSpan[]> {
    const worker = this.worker
    if (this.current !== 'ready' || !worker) return Promise.reject(new Error('The on-device detector is not ready.'))
    const id = this.nextId++
    return new Promise<NerToken[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('The on-device detector timed out.'))
      }, this.options.detectTimeoutMs)
      this.pending.set(id, {
        resolve: (tokens) => {
          clearTimeout(timer)
          resolve(tokens)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
      worker.postMessage({ kind: 'detect', id, text })
    }).then((tokens) => entitiesToSpans(text, tokens, this.options.minScore))
  }

  dispose(): void {
    this.fail()
  }

  private handle(message: WorkerResponse): void {
    if (message.kind === 'ready') {
      clearTimeout(this.loadTimer)
      this.set('ready')
    } else if (message.kind === 'error') {
      this.fail()
    } else if (message.kind === 'result') {
      this.pending.get(message.id)?.resolve(message.tokens)
      this.pending.delete(message.id)
    } else {
      this.pending.get(message.id)?.reject(new Error('The on-device detector failed.'))
      this.pending.delete(message.id)
    }
  }

  private fail(): void {
    clearTimeout(this.loadTimer)
    this.worker?.terminate()
    this.worker = null
    for (const waiter of this.pending.values()) waiter.reject(new Error('The on-device detector stopped.'))
    this.pending.clear()
    this.set('unavailable')
  }

  private set(status: FuzzyStatus): void {
    if (status === this.current) return
    this.current = status
    for (const listener of this.listeners) listener(status)
  }
}
