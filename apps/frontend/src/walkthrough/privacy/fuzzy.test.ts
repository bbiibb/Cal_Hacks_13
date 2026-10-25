import { describe, expect, it, vi } from 'vitest'
import { entitiesToSpans, parseFuzzySpans, TransformersFuzzyDetector } from './fuzzy'
import type { WorkerLike, WorkerRequest, WorkerResponse } from './fuzzy'

describe('parseFuzzySpans', () => {
  it('keeps valid spans and drops invalid ones', () => {
    const spans = parseFuzzySpans(
      [
        { type: 'PERSON', start: 0, end: 4, confidence: 0.9 },
        { type: 'NOPE', start: 0, end: 4, confidence: 0.9 },
        { type: 'PERSON', start: 3, end: 3, confidence: 0.9 },
        { type: 'PERSON', start: 0, end: 99, confidence: 0.9 },
        { type: 'PERSON', start: 0, end: 4, confidence: 1.5 },
        { type: 'PERSON', start: 0.5, end: 4, confidence: 0.5 },
        'junk',
        null,
      ],
      10,
    )
    expect(spans).toEqual([{ type: 'PERSON', start: 0, end: 4, confidence: 0.9, source: 'model' }])
    expect(parseFuzzySpans('nope', 10)).toEqual([])
  })
})

describe('entitiesToSpans', () => {
  it('joins word pieces and finds offsets when the library gives none', () => {
    const text = 'Please tell Maria Gonzalez about Boston'
    const spans = entitiesToSpans(text, [
      { entity: 'B-PER', score: 0.99, word: 'Maria' },
      { entity: 'B-PER', score: 0.98, word: 'Gon' },
      { entity: 'I-PER', score: 0.97, word: '##zal' },
      { entity: 'I-PER', score: 0.97, word: '##ez' },
      { entity: 'B-LOC', score: 0.95, word: 'Boston' },
      { entity: 'B-ORG', score: 0.99, word: 'Please' },
    ])
    expect(spans.map((s) => [s.type, text.slice(s.start, s.end)])).toEqual([
      ['PERSON', 'Maria'],
      ['PERSON', 'Gonzalez'],
      ['ADDRESS', 'Boston'],
    ])
  })

  it('drops low-confidence groups', () => {
    expect(entitiesToSpans('Maria', [{ entity: 'B-PER', score: 0.3, word: 'Maria' }])).toEqual([])
  })
})

/** A worker that answers like the real one. */
function fakeWorker(behavior: 'ok' | 'never-ready' | 'crash'): { worker: WorkerLike; sent: WorkerRequest[] } {
  const sent: WorkerRequest[] = []
  const reply = (worker: WorkerLike, data: WorkerResponse) => worker.onmessage?.({ data })
  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    terminate: () => undefined,
    postMessage(message) {
      sent.push(message)
      if (behavior === 'never-ready') return
      if (message.kind === 'init') {
        if (behavior === 'crash') reply(worker, { kind: 'error', message: 'x' })
        else reply(worker, { kind: 'ready' })
      } else {
        reply(worker, { kind: 'result', id: message.id, tokens: [{ entity: 'B-PER', score: 0.9, word: 'Maria' }] })
      }
    },
  }
  return { worker, sent }
}

describe('TransformersFuzzyDetector', () => {
  it('loads, detects, and reports status changes', async () => {
    const { worker, sent } = fakeWorker('ok')
    const detector = new TransformersFuzzyDetector({ createWorker: () => worker })
    const seen: string[] = []
    detector.subscribe((s) => seen.push(s))
    expect(detector.status).toBe('loading')
    await expect(detector.detect('Maria')).rejects.toThrow()
    detector.start()
    expect(detector.status).toBe('ready')
    expect(await detector.detect('Maria is here')).toEqual([{ type: 'PERSON', start: 0, end: 5, confidence: 0.9, source: 'model' }])
    expect(seen).toEqual(['ready'])
    expect(sent[0]).toMatchObject({ kind: 'init' })
  })

  it('becomes unavailable when the model fails to load', () => {
    const detector = new TransformersFuzzyDetector({ createWorker: () => fakeWorker('crash').worker })
    detector.start()
    expect(detector.status).toBe('unavailable')
  })

  it('becomes unavailable when loading times out', () => {
    vi.useFakeTimers()
    const detector = new TransformersFuzzyDetector({ createWorker: () => fakeWorker('never-ready').worker, loadTimeoutMs: 1000 })
    detector.start()
    vi.advanceTimersByTime(1001)
    expect(detector.status).toBe('unavailable')
    vi.useRealTimers()
  })
})
