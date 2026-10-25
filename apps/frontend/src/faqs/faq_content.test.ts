import { describe, expect, it } from 'vitest'
import { FAQ_GROUPS } from './faq_content'

describe('FAQ content', () => {
  const faqs = FAQ_GROUPS.flatMap((g) => g.faqs)

  it('has several groups with questions and answers', () => {
    expect(FAQ_GROUPS.length).toBeGreaterThanOrEqual(3)
    expect(faqs.length).toBeGreaterThanOrEqual(10)
    for (const faq of faqs) {
      expect(faq.question.trim().endsWith('?')).toBe(true)
      expect(faq.answer.length).toBeGreaterThan(0)
      for (const paragraph of faq.answer) expect(paragraph.trim()).not.toBe('')
    }
  })

  it('gives every group and question its own id', () => {
    const groupIds = FAQ_GROUPS.map((g) => g.id)
    expect(new Set(groupIds).size).toBe(groupIds.length)
    const ids = faqs.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never promises personal medical advice', () => {
    const text = faqs.map((f) => f.answer.join(' ')).join(' ').toLowerCase()
    expect(text).not.toMatch(/you should (stop|start|take)/)
    expect(text).toContain('not medical advice')
  })
})
