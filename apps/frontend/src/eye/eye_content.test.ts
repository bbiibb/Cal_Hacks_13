import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DemoChatClient } from '../walkthrough/chat/demo_chat_client'
import { MODEL_BINDINGS } from '../walkthrough/visualization/scene_bindings'
import { EYE_DEMO_CONTENT, EYE_PROCEDURE, EYE_STRUCTURES } from './eye_content'

const client = new DemoChatClient(EYE_PROCEDURE, EYE_STRUCTURES, EYE_DEMO_CONTENT)
const context = { procedure_slug: EYE_PROCEDURE.slug, step_index: 0, selected_structure_id: null }

describe('eye anatomy prototype', () => {
  it('has a model file bound to every structure', () => {
    for (const structure of EYE_STRUCTURES) {
      const path = `/models/eye/eye_${structure.id}.glb`
      expect(MODEL_BINDINGS[path]?.structures).toEqual([structure.id])
      expect(existsSync(new URL(`../../public${path}`, import.meta.url))).toBe(true)
    }
  })

  it('answers a question that names a part and points the camera at it', () => {
    const { response } = client.answer({ message: 'What does the retina do?', context })
    expect(response.message).toContain('light-sensitive')
    expect(response.scene_actions).toContainEqual({ type: 'focus', structure_id: 'retina', duration_ms: 1000 })
  })

  it('answers general questions from its own topics, not from TAVR', () => {
    const { response, followUps } = client.answer({ message: 'How does the eye work?', context })
    expect(response.message).toContain('camera')
    expect(followUps.join(' ')).not.toMatch(/valve|TAVR/i)
  })

  it('moves between its own steps', () => {
    const { response } = client.answer({ message: 'go to step 3', context })
    expect(response.scene_actions).toContainEqual({ type: 'goto_step', procedure_slug: 'eye_anatomy', step_index: 3 })
  })
})
