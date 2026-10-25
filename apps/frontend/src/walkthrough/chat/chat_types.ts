import type { SceneAction as ContractSceneAction, SidePanel, Source } from '@cal-hacks/shared'

/*
 * The chat contract as the frontend uses it.
 *
 * The backend branches (`backend/seed-and-validation`, `feat/local-llm`) extend the shared contract with
 * zoom, rotate, and reset_view actions, a ChatRequest, and the safety fields below. Those changes are not on
 * `main` yet, so this file mirrors them. Once they are merged into `packages/shared`, replace these
 * definitions with imports from `@cal-hacks/shared`.
 */

export type ZoomAction = {
  type: 'zoom'
  direction: 'in' | 'out'
  amount: 'small' | 'medium' | 'large'
}

export const MIN_ROTATE_DEGREES = 5
export const MAX_ROTATE_DEGREES = 180

export type RotateAction = {
  type: 'rotate'
  direction: 'left' | 'right' | 'up' | 'down'
  /** Between MIN_ROTATE_DEGREES and MAX_ROTATE_DEGREES */
  degrees: number
}

export type ResetViewAction = { type: 'reset_view' }

/** Every command the chatbot can send to the 3D view. */
export type SceneAction = ContractSceneAction | ZoomAction | RotateAction | ResetViewAction

export type ChatResponse = {
  message: string
  scene_actions: SceneAction[]
  side_panel: SidePanel | null
  sources: Source[]
  /** One sentence the patient must know (side effects, precautions). Empty when not needed. */
  safety: string
  /** A question the patient could ask their doctor. Empty when not needed. */
  doctor_question: string
  /** True when the patient describes symptoms that need emergency help. */
  urgent: boolean
}

/** Longest question the backend accepts, in characters. */
export const MAX_CHAT_MESSAGE_LENGTH = 500

/** What the patient is looking at when they ask. */
export type ChatContext = {
  procedure_slug: string
  step_index: number
  /** The part the patient selected, if any. */
  selected_structure_id: string | null
}

/** "slow" answers with the model on this computer (free). "fast" uses the cloud model, a paid service. */
export type ChatSpeed = 'slow' | 'fast'

export type ChatRequest = {
  message: string
  context: ChatContext
  /** Which model answers. Without it the backend decides. The demo answers ignore it. */
  speed?: ChatSpeed
}

/** What the chat panel receives for one question: the answer plus follow-up questions to offer. */
export type ChatReply = {
  response: ChatResponse
  /** Short follow-up questions shown as buttons under the answer. */
  followUps: string[]
}

/** Something a chat backend can answer. The demo answers and the Convex backend both implement it. */
export interface ChatClient {
  /** "demo" for the built-in answers, "live" for the backend. Shown in the panel. */
  readonly mode: 'demo' | 'live'
  ask(request: ChatRequest): Promise<ChatReply>
  /**
   * Answer a spoken question. Absent when the backend cannot transcribe, so the panel hides the microphone.
   * `transcript` is what the backend heard, shown as the patient's message.
   */
  askByVoice?(audio: Blob, context: ChatContext, speed?: ChatSpeed): Promise<ChatReply & { transcript: string }>
  /**
   * Ends the conversation: the backend deletes it. Called when the page is closed or hidden, so it must not
   * wait for an answer. Absent for the demo answers, which keep nothing.
   */
  close?(): void
}

/** An error with a stable code, so the panel can show a friendly message. */
export class ChatError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ChatError'
    this.code = code
  }
}
