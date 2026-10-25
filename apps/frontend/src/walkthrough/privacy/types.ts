/** The kinds of personal information the guard recognizes. Each gets its own placeholder, e.g. `[SSN_1]`. */
export const PII_TYPES = ['PERSON', 'SSN', 'DOB', 'PHONE', 'EMAIL', 'ADDRESS', 'MRN'] as const
export type PiiType = (typeof PII_TYPES)[number]

export function isPiiType(value: unknown): value is PiiType {
  return typeof value === 'string' && (PII_TYPES as readonly string[]).includes(value)
}

/** Which layer found a span. Deterministic rules win over the on-device model when they overlap. */
export type PiiSource = 'rules' | 'model'

/** A piece of text that looks like personal information. Offsets are UTF-16 indexes into the analyzed text. */
export type PiiSpan = {
  type: PiiType
  /** Inclusive start offset. */
  start: number
  /** Exclusive end offset. */
  end: number
  /** 0 to 1. Validated rules report 1, context-only matches report less. */
  confidence: number
  source: PiiSource
}

/** One replaced value as the audit log records it. It never holds the value itself. */
export type Redaction = { type: PiiType; placeholder: string }

/** Matches `[PERSON_1]`, `[SSN_2]`, and so on. */
export const PLACEHOLDER_PATTERN = new RegExp(`\\[(${PII_TYPES.join('|')})_(\\d+)\\]`, 'g')
