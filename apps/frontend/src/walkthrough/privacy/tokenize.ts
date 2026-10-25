import { PII_TYPES, PLACEHOLDER_PATTERN } from './types'
import type { PiiSpan, PiiType, Redaction } from './types'

/** Month name (first three letters, lowercase) to month number. */
const MONTHS_BY_NAME: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/**
 * Per-session placeholder table. The same value (normalized) always gets the same placeholder, so the model
 * can follow "[PERSON_1]" across a conversation without ever seeing the name. Real values stay in this object
 * (and, encrypted, in the vault); they are only used to rehydrate replies on this device.
 */
export class PlaceholderSession {
  private readonly byKey = new Map<string, string>()
  private readonly values = new Map<string, string>()
  private readonly counters = new Map<PiiType, number>()

  /**
   * Replaces each span with its placeholder. Spans must not overlap and must fit the text.
   * Text without spans comes back unchanged.
   */
  tokenize(text: string, spans: readonly PiiSpan[]): { text: string; redactions: Redaction[] } {
    const ordered = [...spans].sort((a, b) => a.start - b.start)
    const redactions: Redaction[] = []
    let out = ''
    let cursor = 0
    for (const span of ordered) {
      if (span.start < cursor) continue
      const raw = text.slice(span.start, span.end)
      const placeholder = this.placeholderFor(span.type, raw)
      out += text.slice(cursor, span.start) + placeholder
      cursor = span.end
      if (!redactions.some((r) => r.placeholder === placeholder)) redactions.push({ type: span.type, placeholder })
    }
    return { text: out + text.slice(cursor), redactions }
  }

  /** Puts real values back for placeholders this session knows. Unknown placeholders stay as they are. */
  rehydrate(text: string): string {
    return text.replace(PLACEHOLDER_PATTERN, (whole) => this.values.get(whole) ?? whole)
  }

  /** The table as plain data, for the encrypted vault. It contains real values: never log it. */
  snapshot(): { entries: [string, string, string][] } {
    const entries: [string, string, string][] = []
    for (const [key, placeholder] of this.byKey) entries.push([key, placeholder, this.values.get(placeholder) ?? ''])
    return { entries }
  }

  restore(data: unknown): void {
    const entries = (data as { entries?: unknown } | null)?.entries
    if (!Array.isArray(entries)) return
    for (const entry of entries as unknown[]) {
      if (!Array.isArray(entry) || entry.length !== 3 || !entry.every((x) => typeof x === 'string')) continue
      const [key, placeholder, value] = entry as [string, string, string]
      const match = /^\[([A-Z]+)_(\d+)\]$/.exec(placeholder)
      const type = PII_TYPES.find((t) => t === match?.[1])
      if (!type || this.byKey.has(key)) continue
      this.byKey.set(key, placeholder)
      this.values.set(placeholder, value)
      this.counters.set(type, Math.max(this.counters.get(type) ?? 0, Number(match?.[2])))
    }
  }

  clear(): void {
    this.byKey.clear()
    this.values.clear()
    this.counters.clear()
  }

  private placeholderFor(type: PiiType, raw: string): string {
    const key = `${type}:${normalizeValue(type, raw)}`
    const existing = this.byKey.get(key)
    if (existing) return existing
    const n = (this.counters.get(type) ?? 0) + 1
    this.counters.set(type, n)
    const placeholder = `[${type}_${n}]`
    this.byKey.set(key, placeholder)
    this.values.set(placeholder, raw)
    return placeholder
  }
}

/** Canonical form of a value, so "123-45-6789" and "123 45 6789" share a placeholder. */
export function normalizeValue(type: PiiType, raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, ' ').toLowerCase()
  if (type === 'SSN' || type === 'MRN') return collapsed.replace(/[^a-z0-9]/g, '')
  if (type === 'PHONE') {
    const digits = collapsed.replace(/\D/g, '')
    return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  }
  if (type === 'DOB') return normalizeDate(collapsed)
  return collapsed
}

function normalizeDate(value: string): string {
  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value)
  if (numeric) return `${numeric[1]!.padStart(2, '0')}/${numeric[2]!.padStart(2, '0')}/${numeric[3]}`
  const named = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+['’]?(\d{2}|\d{4})$/.exec(value)
  const month = named ? MONTHS_BY_NAME[named[1]!.slice(0, 3)] : undefined
  if (named && month) return `${String(month).padStart(2, '0')}/${named[2]!.padStart(2, '0')}/${named[3]}`
  return value
}
