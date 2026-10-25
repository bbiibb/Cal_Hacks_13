import type { AuditEntry, PiiSpan, PiiType } from '../privacy'
import { detectLayer1 } from '../privacy/detectors'

/** One slice of the draft text: plain, or covered by a detected span. */
export type Segment = { text: string; type: PiiType | null }

/**
 * Splits `text` into plain and flagged slices for the highlight overlay. The slices always join back to
 * exactly `text`. Spans are clamped to the text, sorted, and any overlap is cut so each character appears once.
 */
export function spansToSegments(text: string, spans: readonly PiiSpan[]): Segment[] {
  const sorted = spans
    .map((s) => ({ type: s.type, start: Math.max(0, s.start), end: Math.min(text.length, s.end) }))
    .filter((s) => Number.isInteger(s.start) && Number.isInteger(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const segments: Segment[] = []
  let cursor = 0
  for (const span of sorted) {
    const start = Math.max(span.start, cursor)
    if (span.end <= start) continue // fully inside an earlier span
    if (start > cursor) segments.push({ text: text.slice(cursor, start), type: null })
    segments.push({ text: text.slice(start, span.end), type: span.type })
    cursor = span.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), type: null })
  return segments
}

/** The kinds found in a draft, in order of first appearance, with how many of each. */
export function summarizeTypes(spans: readonly PiiSpan[]): { type: PiiType; count: number }[] {
  const counts = new Map<PiiType, number>()
  for (const s of [...spans].sort((a, b) => a.start - b.start)) counts.set(s.type, (counts.get(s.type) ?? 0) + 1)
  return [...counts].map(([type, count]) => ({ type, count }))
}

const TYPE_LABELS: Record<PiiType, string> = {
  PERSON: 'Name',
  SSN: 'ID number',
  DOB: 'Date of birth',
  PHONE: 'Phone',
  EMAIL: 'Email',
  ADDRESS: 'Address',
  MRN: 'Record number',
}

/** Plain-words name for a kind of personal information. */
export function typeLabel(type: PiiType): string {
  return TYPE_LABELS[type]
}

/** Shows only the last four digits of a US SSN, for example `***-**-6789`. Anything unexpected is fully hidden. */
export function maskSsn(ssn: string): string {
  const digits = ssn.replace(/\D/g, '')
  return digits.length === 9 ? `***-**-${digits.slice(5)}` : '*********'
}

/** Shows only the year of a date of birth, for example `**-**-1985`. Anything unexpected is fully hidden. */
export function maskDob(dob: string): string {
  const year = /(?:^|\D)(\d{4})(?:\D|$)/.exec(dob)?.[1]
  return year ? `**-**-${year}` : '**-**-****'
}

/**
 * Totals for the "what left your device" summary. `replaced` counts details swapped for placeholders.
 * `sent` re-checks the text that really left with the same rules, so it counts personal details that
 * were sent. By design it is 0; showing it lets a person verify that instead of trusting a claim.
 */
export function summarizeSent(entries: readonly AuditEntry[]): { replaced: number; sent: number } {
  let replaced = 0
  let sent = 0
  for (const entry of entries) {
    replaced += entry.redactions.length
    if (entry.status === 'sent' && entry.sentText !== null) sent += detectLayer1(entry.sentText).length
  }
  return { replaced, sent }
}
