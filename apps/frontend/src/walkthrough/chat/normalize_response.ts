import type { SidePanel, Source } from '@cal-hacks/shared'
import type { ChatResponse, SceneAction } from './chat_types'
import { MAX_ROTATE_DEGREES, MIN_ROTATE_DEGREES } from './chat_types'

/*
 * The backend already validates its answers, but the contract asks the frontend to stay defensive:
 * anything malformed is dropped with a console warning instead of breaking the page.
 */

const ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/

type Json = Record<string, unknown>

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

/** Returns the action in contract shape, or null if it is malformed. */
export function normalizeSceneAction(raw: unknown): SceneAction | null {
  if (!isRecord(raw)) return null
  switch (raw.type) {
    case 'goto_step':
      return isId(raw.procedure_slug) && isNumber(raw.step_index) && raw.step_index >= 0
        ? { type: 'goto_step', procedure_slug: raw.procedure_slug, step_index: Math.floor(raw.step_index) }
        : null
    case 'focus':
      if (!isId(raw.structure_id)) return null
      return isNumber(raw.duration_ms) && raw.duration_ms >= 0
        ? { type: 'focus', structure_id: raw.structure_id, duration_ms: raw.duration_ms }
        : { type: 'focus', structure_id: raw.structure_id }
    case 'highlight':
      return Array.isArray(raw.structure_ids) &&
        raw.structure_ids.length > 0 &&
        raw.structure_ids.every(isId) &&
        typeof raw.enabled === 'boolean'
        ? { type: 'highlight', structure_ids: raw.structure_ids, enabled: raw.enabled }
        : null
    case 'set_opacity':
      return isId(raw.structure_id) && isNumber(raw.opacity)
        ? { type: 'set_opacity', structure_id: raw.structure_id, opacity: Math.min(1, Math.max(0, raw.opacity)) }
        : null
    case 'zoom':
      return oneOf(raw.direction, ['in', 'out'] as const) && oneOf(raw.amount, ['small', 'medium', 'large'] as const)
        ? { type: 'zoom', direction: raw.direction, amount: raw.amount }
        : null
    case 'rotate':
      return oneOf(raw.direction, ['left', 'right', 'up', 'down'] as const) && isNumber(raw.degrees)
        ? {
            type: 'rotate',
            direction: raw.direction,
            degrees: Math.min(MAX_ROTATE_DEGREES, Math.max(MIN_ROTATE_DEGREES, raw.degrees)),
          }
        : null
    case 'reset_view':
      return { type: 'reset_view' }
    default:
      return null
  }
}

function normalizeSidePanel(raw: unknown): SidePanel | null {
  if (!isRecord(raw) || typeof raw.title !== 'string' || raw.title === '') return null
  return {
    title: raw.title,
    body_markdown: typeof raw.body_markdown === 'string' ? raw.body_markdown : '',
    related_structure_ids: Array.isArray(raw.related_structure_ids) ? raw.related_structure_ids.filter(isId) : [],
  }
}

function normalizeSources(raw: unknown): Source[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): Source[] => {
    if (!isRecord(item) || typeof item.title !== 'string' || item.title === '') return []
    return [{ title: item.title, url: typeof item.url === 'string' ? item.url : null }]
  })
}

/** Turns whatever the backend returned into a ChatResponse, dropping the parts that do not fit. */
export function normalizeChatResponse(raw: unknown): ChatResponse {
  const data = isRecord(raw) ? raw : {}
  const rawActions = Array.isArray(data.scene_actions) ? data.scene_actions : []
  const actions = rawActions.flatMap((item) => {
    const action = normalizeSceneAction(item)
    if (!action) console.warn('Chat: dropped a malformed scene action', item)
    return action ? [action] : []
  })

  return {
    message: typeof data.message === 'string' ? data.message : '',
    scene_actions: actions,
    side_panel: normalizeSidePanel(data.side_panel),
    sources: normalizeSources(data.sources),
    safety: typeof data.safety === 'string' ? data.safety : '',
    doctor_question: typeof data.doctor_question === 'string' ? data.doctor_question : '',
    urgent: data.urgent === true,
  }
}
