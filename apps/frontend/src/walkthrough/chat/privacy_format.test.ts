import { describe, expect, it } from 'vitest'
import type { AuditEntry, PiiSpan } from '../privacy'
import { maskDob, maskSsn, spansToSegments, summarizeSent, summarizeTypes, typeLabel } from './privacy_format'

const span = (type: PiiSpan['type'], start: number, end: number): PiiSpan => ({ type, start, end, confidence: 1, source: 'rules' })

describe('spansToSegments', () => {
  it('returns one plain segment without spans', () => {
    expect(spansToSegments('hello', [])).toEqual([{ text: 'hello', type: null }])
    expect(spansToSegments('', [])).toEqual([])
  })

  it('splits around spans and joins back to the original text', () => {
    const text = "I'm Jane Doe, born 03/03/1985."
    const segments = spansToSegments(text, [span('DOB', 19, 29), span('PERSON', 4, 12)])
    expect(segments.map((s) => s.type)).toEqual([null, 'PERSON', null, 'DOB', null])
    expect(segments.map((s) => s.text).join('')).toBe(text)
    expect(segments[1]?.text).toBe('Jane Doe')
  })

  it('clamps out-of-range spans and drops empty or invalid ones', () => {
    const text = 'abcdef'
    const segments = spansToSegments(text, [span('SSN', -3, 2), span('PHONE', 4, 99), span('EMAIL', 3, 3), span('MRN', 1.5, 3)])
    expect(segments.map((s) => s.text).join('')).toBe(text)
    expect(segments).toEqual([
      { text: 'ab', type: 'SSN' },
      { text: 'cd', type: null },
      { text: 'ef', type: 'PHONE' },
    ])
  })

  it('cuts overlaps so each character appears once', () => {
    const segments = spansToSegments('abcdefgh', [span('PERSON', 0, 5), span('DOB', 3, 7)])
    expect(segments.map((s) => s.text).join('')).toBe('abcdefgh')
    expect(segments).toEqual([
      { text: 'abcde', type: 'PERSON' },
      { text: 'fg', type: 'DOB' },
      { text: 'h', type: null },
    ])
  })
})

describe('helpers', () => {
  it('summarizes kinds in order of appearance', () => {
    expect(summarizeTypes([span('DOB', 10, 12), span('PERSON', 0, 4), span('DOB', 20, 22)])).toEqual([
      { type: 'PERSON', count: 1 },
      { type: 'DOB', count: 2 },
    ])
    expect(typeLabel('SSN')).toBe('ID number')
  })

  it('masks an SSN and a date of birth', () => {
    expect(maskSsn('123-45-6789')).toBe('***-**-6789')
    expect(maskSsn('123456789')).toBe('***-**-6789')
    expect(maskSsn('12')).toBe('*********')
    expect(maskDob('03-03-1985')).toBe('**-**-1985')
    expect(maskDob('1985-03-03')).toBe('**-**-1985')
    expect(maskDob('soon')).toBe('**-**-****')
  })
})

describe('summarizeSent', () => {
  const entry = (over: Partial<AuditEntry>): AuditEntry => ({
    id: 1,
    timestamp: '2026-10-25T00:00:00.000Z',
    status: 'sent',
    sentText: 'plain question',
    redactions: [],
    blockedTypes: [],
    layer2: 'off',
    ...over,
  })

  it('counts replaced details and finds none in the text that was sent', () => {
    const entries = [
      entry({
        sentText: "I'm [PERSON_1], born [DOB_1], SSN [SSN_1]",
        redactions: [
          { type: 'PERSON', placeholder: '[PERSON_1]' },
          { type: 'DOB', placeholder: '[DOB_1]' },
          { type: 'SSN', placeholder: '[SSN_1]' },
        ],
      }),
      entry({ id: 2, sentText: 'What is a valve?' }),
    ]
    expect(summarizeSent(entries)).toEqual({ replaced: 3, sent: 0 })
  })

  it('counts a personal detail that did reach the sent text', () => {
    expect(summarizeSent([entry({ sentText: 'my ssn is 123-45-6789' })]).sent).toBe(1)
  })

  it('ignores blocked sends and empty lists', () => {
    expect(summarizeSent([])).toEqual({ replaced: 0, sent: 0 })
    expect(summarizeSent([entry({ status: 'blocked', sentText: null })]).sent).toBe(0)
  })
})
