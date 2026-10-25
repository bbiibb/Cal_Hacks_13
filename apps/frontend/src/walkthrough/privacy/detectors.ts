import type { PiiSpan, PiiType } from './types'

/*
 * Layer 1: deterministic detectors. Plain TypeScript, no dependencies, always on.
 * Every detector returns offsets into the exact text it was given.
 */

const PRIORITY: Record<PiiType, number> = {
  EMAIL: 0,
  MRN: 1,
  SSN: 2,
  PHONE: 3,
  DOB: 4,
  ADDRESS: 5,
  PERSON: 6,
}

const WORD_DIGITS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
}
const MONTH_PATTERN = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec'

function span(type: PiiType, start: number, end: number, confidence = 1): PiiSpan {
  return { type, start, end, confidence, source: 'rules' }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** True when `pattern` appears in the `window` characters before `index`. */
function hasContextBefore(text: string, index: number, pattern: RegExp, window = 30): boolean {
  return pattern.test(text.slice(Math.max(0, index - window), index))
}

/* ---------- validators (also used by the tests) ---------- */

/** A US social security number: area not 000, 666 or 9xx; group not 00; serial not 0000. */
export function isValidSsn(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false
  const area = Number(digits.slice(0, 3))
  const group = Number(digits.slice(3, 5))
  const serial = Number(digits.slice(5))
  return area !== 0 && area !== 666 && area < 900 && group !== 0 && serial !== 0
}

function isPlausibleDate(a: number, b: number): boolean {
  return (a >= 1 && a <= 12 && b >= 1 && b <= 31) || (b >= 1 && b <= 12 && a >= 1 && a <= 31)
}

/* ---------- spoken digits ---------- */

const DIGIT_TOKEN = `(?:\\b(?:${Object.keys(WORD_DIGITS).join('|')})\\b|\\d+)`
const SPOKEN_RUN = new RegExp(`(?<![\\w])${DIGIT_TOKEN}(?:[\\s,.\\-]+${DIGIT_TOKEN})*(?![\\w])`, 'gi')

/**
 * Turns "one two three, 4 5, six seven eight nine" into "123456789" when the whole text is digits and
 * digit words. Returns null when anything else is in the way.
 */
export function normalizeSpokenDigits(text: string): string | null {
  const tokens = text.toLowerCase().match(new RegExp(DIGIT_TOKEN, 'g'))
  if (!tokens) return null
  const rest = text.toLowerCase().replace(new RegExp(DIGIT_TOKEN, 'g'), '').replace(/[\s,.-]/g, '')
  if (rest !== '') return null
  return tokens.map((token) => WORD_DIGITS[token] ?? token).join('')
}

/** Runs of digits where at least one digit is spelled out. 9 digits is an SSN, 10 or 11 a phone, 7+ an ID. */
function detectSpokenRuns(text: string): PiiSpan[] {
  const found: PiiSpan[] = []
  for (const match of text.matchAll(SPOKEN_RUN)) {
    const run = match[0]
    if (!/[a-z]/i.test(run)) continue // plain digits are handled by the numeric detectors
    const digits = normalizeSpokenDigits(run)
    if (digits === null) continue
    const start = match.index
    const end = start + run.length
    if (digits.length === 9) found.push(span(isValidSsn(digits) ? 'SSN' : 'MRN', start, end, 0.95))
    else if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) found.push(span('PHONE', start, end, 0.95))
    else if (digits.length >= 7) found.push(span('MRN', start, end, 0.8))
  }
  return found
}

/* ---------- numeric detectors ---------- */

function detectEmail(text: string): PiiSpan[] {
  const found: PiiSpan[] = []
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
    found.push(span('EMAIL', m.index, m.index + m[0].length))
  }
  return found
}

function detectSsn(text: string): PiiSpan[] {
  const found: PiiSpan[] = []
  for (const m of text.matchAll(/(?<![\d-])(\d{3})([-\s]?)(\d{2})\2(\d{4})(?![\d-]\d|\d)/g)) {
    const digits = `${m[1]}${m[3]}${m[4]}`
    const valid = isValidSsn(digits)
    // A number labelled as an SSN is redacted even when it fails validation (typos are still private).
    if (valid || hasContextBefore(text, m.index, /ssn|social|security/i)) {
      found.push(span('SSN', m.index, m.index + m[0].length, valid ? 1 : 0.8))
    }
  }
  return found
}

function detectMrn(text: string): PiiSpan[] {
  const found: PiiSpan[] = []
  const pattern = /\b(?:mrn|medical\s+record(?:\s+(?:number|no\.?|#))?|med(?:ical)?\s*rec(?:ord)?\s*(?:number|no\.?|#)?)\s*(?:is|:|#|number|no\.?)?\s*[:#]?\s*((?=[A-Z0-9-]*\d{4})[A-Z0-9][A-Z0-9-]{4,14})\b/gid
  for (const m of text.matchAll(pattern)) {
    const group = m.indices?.[1]
    if (group) found.push(span('MRN', group[0], group[1]))
  }
  return found
}

function detectPhone(text: string): PiiSpan[] {
  const found: PiiSpan[] = []
  for (const m of text.matchAll(/(?<![\d])(\+?1[\s.-]?)?(\(\d{3}\)|\d{3})[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/g)) {
    const raw = m[0]
    const area = m[2]!.replace(/\D/g, '')
    const formatted = /[\s.()+-]/.test(raw)
    // Bare 10-digit numbers must look like a North American number; formatted ones are accepted as typed.
    if (!formatted && !/^[2-9]/.test(area)) continue
    found.push(span('PHONE', m.index, m.index + raw.length))
  }
  for (const m of text.matchAll(/(?<!\d)\d{3}[-.\s]\d{4}(?!\d)/g)) {
    if (hasContextBefore(text, m.index, /phone|call|cell|mobile|tel|number|reach/i, 25)) {
      found.push(span('PHONE', m.index, m.index + m[0].length, 0.85))
    }
  }
  return found
}

function detectDob(text: string): PiiSpan[] {
  const found: PiiSpan[] = []
  const push = (m: RegExpExecArray, confidence = 1): void => {
    found.push(span('DOB', m.index, m.index + m[0].length, confidence))
  }
  // 03/03/1985, 3-3-85, 03.03.1985
  for (const m of text.matchAll(/(?<![\d/.-])(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?!\d|[/.-]\d)/g)) {
    if (isPlausibleDate(Number(m[1]), Number(m[3]))) push(m)
  }
  // 1985-03-03
  for (const m of text.matchAll(/(?<![\d/.-])((?:19|20)\d{2})([/.-])(\d{1,2})\2(\d{1,2})(?!\d|[/.-]\d)/g)) {
    if (Number(m[3]) >= 1 && Number(m[3]) <= 12 && Number(m[4]) >= 1 && Number(m[4]) <= 31) push(m)
  }
  // March 3, 1985 / Mar 3rd '85 / March 3rd, 85 after "born"
  const monthFirst = new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,\\s*|\\s+)(\\d{4}|['’]\\d{2}|\\d{2}(?!\\d))`, 'gi')
  for (const m of text.matchAll(monthFirst)) {
    const day = Number(m[2])
    const year = m[3]!
    if (!MONTHS[m[1]!.toLowerCase()] || day < 1 || day > 31) continue
    if (/^\d{2}$/.test(year) && !hasContextBefore(text, m.index, /born|dob|birth/i, 40)) continue
    push(m)
  }
  // 3 March 1985 / 3rd of March, '85
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_PATTERN})\\.?,?\\s+(\\d{4}|['’]\\d{2})\\b`, 'gi')
  for (const m of text.matchAll(dayFirst)) {
    const day = Number(m[1])
    if (day >= 1 && day <= 31) push(m)
  }
  // born in 1985 / born March 1985
  const bornYear = new RegExp(`\\bborn\\s+(?:in\\s+|on\\s+)?((?:(?:${MONTH_PATTERN})\\.?\\s+)?(?:19|20)\\d{2})\\b`, 'gid')
  for (const m of text.matchAll(bornYear)) {
    const g = m.indices?.[1]
    if (g) found.push(span('DOB', g[0], g[1], 0.9))
  }
  // dob 03031985
  for (const m of text.matchAll(/\b(?:dob|born|birth\w*)\W{0,5}(\d{8})(?!\d)/gid)) {
    const g = m.indices?.[1]
    if (g && isPlausibleDate(Number(m[1]!.slice(0, 2)), Number(m[1]!.slice(2, 4)))) found.push(span('DOB', g[0], g[1], 0.9))
  }
  return found
}

const STREET_SUFFIX = 'street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|ter|parkway|pkwy|circle|cir|highway|hwy'

function detectAddress(text: string): PiiSpan[] {
  const found: PiiSpan[] = []
  const unit = '(?:,?\\s*(?:apt|apartment|unit|suite|ste|#)\\.?\\s*[A-Za-z0-9-]+)?'
  const street = new RegExp(`\\b\\d{1,6}\\s+(?:[A-Za-z0-9.'’-]+\\s+){1,4}?(?:${STREET_SUFFIX})\\b\\.?${unit}`, 'gi')
  const cityStateZip = /,\s*[A-Z][A-Za-z.]*(?:\s[A-Z][A-Za-z.]*){0,3},?\s+[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?\b/y
  for (const m of text.matchAll(street)) {
    let end = m.index + m[0].length
    cityStateZip.lastIndex = end
    const tail = cityStateZip.exec(text)
    if (tail) end += tail[0].length
    found.push(span('ADDRESS', m.index, end))
  }
  for (const m of text.matchAll(/\bP\.?\s?O\.?\s+Box\s+\d+\b/gi)) found.push(span('ADDRESS', m.index, m.index + m[0].length))
  for (const m of text.matchAll(/\b[A-Z]{2}\s+(\d{5}(?:-\d{4})?)\b/g)) {
    found.push(span('ADDRESS', m.index, m.index + m[0].length, 0.85))
  }
  for (const m of text.matchAll(/\bzip(?:\s*code)?\s*(?:is|:)?\s*(\d{5}(?:-\d{4})?)\b/gid)) {
    const g = m.indices?.[1]
    if (g) found.push(span('ADDRESS', g[0], g[1], 0.9))
  }
  return found
}

/* ---------- names ---------- */

const NAME_STOP_WORDS = new Set(
  (
    'and but or i im my is was the a an born from live lives have had need want what when how can could should so because who with to in on at for dob ssn mrn am are not very just also still really here there ' +
    'allergic afraid worried nervous scared fine okay ok sorry having feeling going taking getting looking trying concerned curious wondering planning pregnant diabetic anxious sick tired dizzy unsure interested done sure glad happy ' +
    'asking writing calling telling hoping thinking about after before if it that this these those yes no please thanks thank hello hi'
  ).split(' '),
)

type NameRule = { trigger: RegExp; requireCapital: boolean; min: number; max: number }

const NAME_RULES: NameRule[] = [
  { trigger: /\bmy\s+(?:full\s+|first\s+|last\s+)?name\s+is\b/gi, requireCapital: false, min: 1, max: 3 },
  { trigger: /\b(?:my\s+)?name\s*:/gi, requireCapital: true, min: 1, max: 3 },
  { trigger: /\bcall\s+me\b/gi, requireCapital: true, min: 1, max: 2 },
  { trigger: /\bi(?:'|’)m\b|\bi\s+am\b/gi, requireCapital: true, min: 1, max: 3 },
  { trigger: /\bthis\s+is\b/gi, requireCapital: true, min: 2, max: 3 },
]

/** Reads up to `max` name-like words after `from`. Returns the range, or null when fewer than `min` were found. */
function readNameWords(text: string, from: number, rule: NameRule): { start: number; end: number } | null {
  let cursor = from
  let start = -1
  let end = -1
  let count = 0
  while (count < rule.max) {
    const gap = /^[ \t]+/.exec(text.slice(cursor))
    if (!gap && count > 0) break
    const wordStart = cursor + (gap ? gap[0].length : 0)
    const word = /^[A-Za-z][A-Za-z'’-]*/.exec(text.slice(wordStart))
    if (!word) break
    const lower = word[0].toLowerCase().replace(/['’]s$/, '')
    if (NAME_STOP_WORDS.has(lower)) break
    if (rule.requireCapital && !/^[A-Z]/.test(word[0])) break
    if (count === 0) start = wordStart
    end = wordStart + word[0].length
    cursor = end
    count++
  }
  return count >= rule.min ? { start, end } : null
}

function detectNames(text: string, knownNames: readonly string[]): PiiSpan[] {
  const found: PiiSpan[] = []
  for (const rule of NAME_RULES) {
    for (const m of text.matchAll(rule.trigger)) {
      const range = readNameWords(text, m.index + m[0].length, rule)
      if (range) found.push(span('PERSON', range.start, range.end, 0.9))
    }
  }
  for (const name of knownNames) {
    const trimmed = name.trim()
    if (trimmed.length < 2) continue
    const body = trimmed.split(/\s+/).map(escapeRegExp).join('\\s+')
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu')
    for (const m of text.matchAll(pattern)) found.push(span('PERSON', m.index, m.index + m[0].length))
  }
  return found
}

/* ---------- combining ---------- */

/**
 * Drops overlapping rule spans (lower priority number wins, then the longer span) and joins people whose
 * names touch ("Jane" "Doe" becomes one PERSON).
 */
export function resolveSpans(spans: readonly PiiSpan[], text: string): PiiSpan[] {
  const ordered = [...spans].sort(
    (a, b) => PRIORITY[a.type] - PRIORITY[b.type] || b.end - b.start - (a.end - a.start) || a.start - b.start,
  )
  const accepted: PiiSpan[] = []
  for (const candidate of ordered) {
    if (!accepted.some((s) => candidate.start < s.end && s.start < candidate.end)) accepted.push(candidate)
  }
  accepted.sort((a, b) => a.start - b.start)
  const joined: PiiSpan[] = []
  for (const s of accepted) {
    const last = joined[joined.length - 1]
    if (last && last.type === 'PERSON' && s.type === 'PERSON' && /^[ \t]+$/.test(text.slice(last.end, s.start))) {
      joined[joined.length - 1] = { ...last, end: s.end, confidence: Math.min(last.confidence, s.confidence) }
    } else {
      joined.push(s)
    }
  }
  return joined
}

/**
 * Layer 1. Finds personal information with deterministic rules and validators.
 * @param knownNames first names, last names or full names from the on-device intake form
 * @returns non-overlapping spans sorted by position
 */
export function detectLayer1(text: string, knownNames: readonly string[] = []): PiiSpan[] {
  if (text === '') return []
  return resolveSpans(
    [
      ...detectEmail(text),
      ...detectSpokenRuns(text),
      ...detectSsn(text),
      ...detectMrn(text),
      ...detectPhone(text),
      ...detectDob(text),
      ...detectAddress(text),
      ...detectNames(text, knownNames),
    ],
    text,
  )
}
