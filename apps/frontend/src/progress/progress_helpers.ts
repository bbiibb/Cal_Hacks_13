/** Pure helpers for the "Your progress" feature. They have no browser or SpacetimeDB dependency, so they are easy to test. */

/** One person's saved progress in one procedure, as the UI uses it. */
export type ProgressRecord = {
  procedureSlug: string
  /** Zero-based index of the step the person last looked at. */
  currentStep: number
  /** Zero-based indexes of every step the person has looked at, ascending. */
  viewedSteps: number[]
  /** When the progress was last saved, in milliseconds since the Unix epoch. */
  updatedAtMs: number
}

export type ProgressSummary = {
  /** The step number to show people ("Step 3 of 5"). It is the step's index: step 0 is the introduction. */
  stepNumber: number
  totalSteps: number
  viewedCount: number
  /** One flag per step: has the person looked at it? */
  viewed: boolean[]
  /** Whole percent of steps viewed, 0 to 100. */
  percent: number
  /** True when every step has been viewed. */
  complete: boolean
}

/** The URL query parameter that opens the walkthrough at a step. It is the step number people see (step 0 is the introduction). */
export const STEP_PARAM = 'step'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago". Times in the future count as "just now". */
export function formatRelativeTime(thenMs: number, nowMs: number): string {
  const elapsed = Math.max(0, nowMs - thenMs)
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < 30 * DAY) return plural(Math.floor(elapsed / DAY), 'day')
  if (elapsed < 365 * DAY) return plural(Math.floor(elapsed / (30 * DAY)), 'month')
  return plural(Math.floor(elapsed / (365 * DAY)), 'year')
}

/**
 * Turns a saved record into what the card shows.
 * Steps outside the procedure (for example after the procedure got shorter) are ignored.
 */
export function summarizeProgress(record: ProgressRecord, totalSteps: number): ProgressSummary {
  const total = Math.max(1, Math.floor(totalSteps))
  const viewed = Array.from({ length: total }, (_, i) => record.viewedSteps.includes(i))
  const viewedCount = viewed.filter(Boolean).length
  const current = Math.min(Math.max(0, Math.floor(record.currentStep)), total - 1)
  return {
    stepNumber: current,
    totalSteps: total,
    viewedCount,
    viewed,
    percent: Math.round((viewedCount / total) * 100),
    complete: viewedCount === total,
  }
}

/**
 * Reads the `?step=` value (the step number people see, which is the step index) and returns the step index,
 * or null when it is missing or not a whole number inside the procedure.
 */
export function parseStepParam(value: string | null | undefined, totalSteps: number): number | null {
  if (value == null || !/^\d+$/.test(value.trim())) return null
  const index = Number(value.trim())
  if (!Number.isSafeInteger(index) || index < 0 || index >= totalSteps) return null
  return index
}

/** The walkthrough link that opens a given step. */
export function walkthroughPath(stepIndex: number): string {
  return `/walkthrough?${STEP_PARAM}=${stepIndex}`
}
