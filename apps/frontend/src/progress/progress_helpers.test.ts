import { describe, expect, it } from 'vitest'
import {
  formatRelativeTime,
  parseStepParam,
  summarizeProgress,
  walkthroughPath,
  type ProgressRecord,
} from './progress_helpers'

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('says just now for the last minute and for future times', () => {
    expect(formatRelativeTime(NOW - 20_000, NOW)).toBe('just now')
    expect(formatRelativeTime(NOW + 5 * MIN, NOW)).toBe('just now')
  })
  it('uses minutes, hours, days, months and years', () => {
    expect(formatRelativeTime(NOW - MIN, NOW)).toBe('1 minute ago')
    expect(formatRelativeTime(NOW - 59 * MIN, NOW)).toBe('59 minutes ago')
    expect(formatRelativeTime(NOW - 2 * HOUR - 5 * MIN, NOW)).toBe('2 hours ago')
    expect(formatRelativeTime(NOW - 3 * DAY, NOW)).toBe('3 days ago')
    expect(formatRelativeTime(NOW - 45 * DAY, NOW)).toBe('1 month ago')
    expect(formatRelativeTime(NOW - 800 * DAY, NOW)).toBe('2 years ago')
  })
})

describe('summarizeProgress', () => {
  const record: ProgressRecord = { procedureSlug: 'tavr', currentStep: 2, viewedSteps: [0, 1, 2], updatedAtMs: NOW }

  it('counts viewed steps and numbers the current step from one', () => {
    const s = summarizeProgress(record, 5)
    expect(s.stepNumber).toBe(3)
    expect(s.totalSteps).toBe(5)
    expect(s.viewedCount).toBe(3)
    expect(s.viewed).toEqual([true, true, true, false, false])
    expect(s.percent).toBe(60)
    expect(s.complete).toBe(false)
  })
  it('ignores steps outside the procedure and clamps the current step', () => {
    const s = summarizeProgress({ ...record, currentStep: 9, viewedSteps: [0, 7] }, 3)
    expect(s.stepNumber).toBe(3)
    expect(s.viewedCount).toBe(1)
  })
  it('knows when every step was viewed', () => {
    expect(summarizeProgress({ ...record, viewedSteps: [0, 1, 2] }, 3).complete).toBe(true)
  })
})

describe('parseStepParam', () => {
  it('turns a one-based value into a zero-based index', () => {
    expect(parseStepParam('1', 5)).toBe(0)
    expect(parseStepParam('5', 5)).toBe(4)
  })
  it('rejects anything else', () => {
    for (const bad of [null, undefined, '', '0', '6', '-1', '2.5', 'abc', '1e1', '99999999999999999999']) {
      expect(parseStepParam(bad, 5)).toBeNull()
    }
  })
  it('round-trips with walkthroughPath', () => {
    expect(walkthroughPath(2)).toBe('/walkthrough?step=3')
    expect(parseStepParam('3', 5)).toBe(2)
  })
})
