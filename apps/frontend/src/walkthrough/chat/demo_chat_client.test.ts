import { describe, expect, it } from 'vitest'
import { TAVI_PROCEDURE, TAVI_STRUCTURES } from '../tavi_content'
import type { ChatReply, SceneAction } from './chat_types'
import { DemoChatClient } from './demo_chat_client'
import { DEMO_TOPICS, FALLBACK_MESSAGE } from './demo_answers'
import { STARTER_QUESTIONS, STEP_FOLLOW_UPS } from './follow_ups'
import { normalizeChatResponse } from './normalize_response'

const client = new DemoChatClient(TAVI_PROCEDURE, TAVI_STRUCTURES)
const ask = (message: string, stepIndex = 0, selected: string | null = null): ChatReply =>
  client.answer({
    message,
    context: { procedure_slug: TAVI_PROCEDURE.slug, step_index: stepIndex, selected_structure_id: selected },
  })
const ofType = <T extends SceneAction['type']>(reply: ChatReply, type: T) =>
  reply.response.scene_actions.filter((a): a is Extract<SceneAction, { type: T }> => a.type === type)

describe('demo answers', () => {
  const suggested = new Set([
    ...STARTER_QUESTIONS,
    ...STEP_FOLLOW_UPS.flat(),
    ...DEMO_TOPICS.flatMap((t) => t.followUps),
  ])

  it.each([...suggested])('every suggested question gets a prepared answer: %s', (question) => {
    expect(ask(question, 1).response.message).not.toBe(FALLBACK_MESSAGE)
  })

  it('answers side-effect questions with a safety note and a question for the doctor', () => {
    const reply = ask('What are the side effects of TAVI?')
    expect(reply.response.message).toContain('pacemaker')
    expect(reply.response.safety).not.toBe('')
    expect(reply.response.doctor_question).not.toBe('')
    expect(reply.followUps.length).toBeGreaterThan(0)
  })

  it('only refers to parts and steps that exist', () => {
    const ids = new Set(TAVI_STRUCTURES.map((s) => s.id))
    for (const topic of DEMO_TOPICS) {
      expect(TAVI_PROCEDURE.steps[topic.step]).toBeDefined()
      for (const action of topic.actions) {
        if (action.type === 'focus' || action.type === 'set_opacity') expect(ids.has(action.structure_id)).toBe(true)
        if (action.type === 'highlight') for (const id of action.structure_ids) expect(ids.has(id)).toBe(true)
      }
    }
  })

  it('falls back politely for questions it has no answer for', () => {
    const reply = ask('What is the capital of France?')
    expect(reply.response.message).toBe(FALLBACK_MESSAGE)
    expect(reply.response.scene_actions).toEqual([])
  })
})

describe("answers from the team's step explanations", () => {
  it.each([
    ['What does the guidewire do?', 0],
    ['How is the valve compressed to fit?', 1],
    ['How does the balloon work?', 2],
    ['How is the catheter withdrawn?', 3],
    ['How does my new valve work?', 4],
    ['What happens in step 2?', 1],
  ])('answers "%s" with step %i word for word', (question, index) => {
    const reply = ask(question)
    const step = TAVI_PROCEDURE.steps[index]!
    expect(reply.response.message).toContain(step.side_panel.body_markdown)
    expect(reply.response.message).toContain(`Step ${index + 1} of 5: ${step.title}`)
    expect(ofType(reply, 'goto_step')[0]?.step_index).toBe(index)
  })

  it('has follow-up questions for every step', () => {
    expect(STEP_FOLLOW_UPS).toHaveLength(TAVI_PROCEDURE.steps.length)
  })

  it('still answers risk questions with the side-effect answer, not a step', () => {
    expect(ask('Can the balloon cause a stroke?').response.message).toContain('stroke')
    expect(ask('Can the balloon cause a stroke?').response.safety).not.toBe('')
  })
})

describe('emergency symptoms', () => {
  it.each(["I'm having chest pain", 'I have trouble breathing right now', 'my face is drooping'])(
    'flags symptoms happening now: %s',
    (message) => {
      const reply = ask(message)
      expect(reply.response.urgent).toBe(true)
      expect(reply.response.scene_actions).toEqual([])
    }
  )

  it.each(['Will I have chest pain afterwards?', 'Is fainting a risk after TAVI?'])(
    'does not flag questions about the future: %s',
    (message) => {
      expect(ask(message).response.urgent).toBe(false)
    }
  )
})

describe('view commands', () => {
  it('zooms with the requested amount', () => {
    expect(ofType(ask('zoom in a lot'), 'zoom')).toEqual([{ type: 'zoom', direction: 'in', amount: 'large' }])
    expect(ofType(ask('zoom out a little'), 'zoom')).toEqual([{ type: 'zoom', direction: 'out', amount: 'small' }])
  })

  it('rotates by the requested degrees, within limits', () => {
    expect(ofType(ask('rotate left 90 degrees'), 'rotate')).toEqual([{ type: 'rotate', direction: 'left', degrees: 90 }])
    expect(ofType(ask('turn it around'), 'rotate')).toEqual([{ type: 'rotate', direction: 'right', degrees: 180 }])
    expect(ofType(ask('rotate up 999 degrees'), 'rotate')[0]?.degrees).toBe(180)
  })

  it('moves between steps and stays inside the walkthrough', () => {
    expect(ofType(ask('go to step 3'), 'goto_step')[0]?.step_index).toBe(2)
    expect(ofType(ask('next step', 1), 'goto_step')[0]?.step_index).toBe(2)
    expect(ofType(ask('next step', 3), 'goto_step')[0]?.step_index).toBe(4)
    expect(ofType(ask('next step', 4), 'goto_step')).toEqual([])
    expect(ofType(ask('go to step 9'), 'goto_step')).toEqual([])
  })

  it('does not mistake everyday phrases for commands', () => {
    expect(ofType(ask('How long until I can go back to work?', 2), 'goto_step')[0]?.step_index).toBe(4)
    expect(ofType(ask('turn off the highlights'), 'rotate')).toEqual([])
    expect(ofType(ask('What is this walkthrough?'), 'goto_step')).toEqual([])
  })

  it('focuses on a part the patient asks to see', () => {
    const reply = ask('Show me the annulus')
    expect(ofType(reply, 'focus')[0]?.structure_id).toBe('aortic_annulus')
    expect(reply.response.side_panel?.title).toBe('Aortic annulus')
  })

  it('explains the current step and the selected part', () => {
    const reply = ask('What is happening in this step?', 2, 'aortic_annulus')
    expect(reply.response.message).toContain('Step 3 of 5')
    expect(reply.response.message).toContain('aortic annulus')
  })
})

describe('normalizeChatResponse', () => {
  it('keeps valid actions, drops malformed ones, and fills in defaults', () => {
    const response = normalizeChatResponse({
      message: 'Hi',
      scene_actions: [
        { type: 'zoom', direction: 'in', amount: 'medium' },
        { type: 'rotate', direction: 'left', degrees: 720 },
        { type: 'explode' },
        { type: 'focus', structure_id: 'Not An Id' },
      ],
    })
    expect(response.scene_actions).toEqual([
      { type: 'zoom', direction: 'in', amount: 'medium' },
      { type: 'rotate', direction: 'left', degrees: 180 },
    ])
    expect(response).toMatchObject({ safety: '', doctor_question: '', urgent: false, side_panel: null, sources: [] })
  })

  it('survives a reply that is not an object', () => {
    expect(normalizeChatResponse('oops').scene_actions).toEqual([])
  })
})
