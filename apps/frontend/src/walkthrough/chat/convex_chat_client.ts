import type { ChatClient, ChatReply, ChatRequest } from './chat_types'
import { ChatError } from './chat_types'
import { followUpsForStep } from './follow_ups'
import { normalizeChatResponse } from './normalize_response'

/** How long to wait for an answer by default. Free model tiers can be slow when busy. */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * A model that runs on the patient's own computer can need more time, especially next to the 3D view.
 * Set VITE_CHAT_TIMEOUT_MS (milliseconds, at least 5000) in apps/frontend/.env.local to wait longer.
 */
function requestTimeoutMs(): number {
  const configured = Number(import.meta.env.VITE_CHAT_TIMEOUT_MS)
  return Number.isFinite(configured) && configured >= 5_000 ? configured : DEFAULT_TIMEOUT_MS
}

type ConvexResult =
  | { status: 'success'; value: unknown }
  | { status: 'error'; errorMessage?: string; errorData?: unknown }

/**
 * Talks to the chatbot in the Convex backend (`chat.createSession` and `chat.ask`).
 * It uses Convex's HTTP API, so the frontend needs no extra library.
 */
export class ConvexChatClient implements ChatClient {
  readonly mode = 'live' as const
  private readonly baseUrl: string
  private readonly procedureSlug: string
  private session: Promise<string | null> | null = null

  constructor(deploymentUrl: string, procedureSlug: string) {
    this.baseUrl = deploymentUrl.replace(/\/+$/, '')
    this.procedureSlug = procedureSlug
  }

  async ask(request: ChatRequest): Promise<ChatReply> {
    const sessionId = await this.sessionId()
    const value = await this.call('action', 'chat:ask', {
      message: request.message,
      context: request.context,
      ...(sessionId ? { sessionId } : {}),
    })
    const response = normalizeChatResponse(value)
    const stepAction = response.scene_actions.find((a) => a.type === 'goto_step')
    const stepIndex = stepAction?.type === 'goto_step' ? stepAction.step_index : request.context.step_index
    return { response, followUps: response.urgent ? [] : followUpsForStep(stepIndex) }
  }

  /**
   * A session keeps the conversation history, so follow-up questions are understood.
   * Created on the first question. If it cannot be created, questions are still answered without history.
   */
  private sessionId(): Promise<string | null> {
    this.session ??= this.call('mutation', 'chat:createSession', { procedureSlug: this.procedureSlug })
      .then((id) => (typeof id === 'string' ? id : null))
      .catch((error: unknown) => {
        console.warn('Chat: could not start a session; answering without history', error)
        this.session = null // try again on the next question
        return null
      })
    return this.session
  }

  private async call(kind: 'action' | 'mutation', path: string, args: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs())

    let httpResponse: Response
    try {
      httpResponse = await fetch(`${this.baseUrl}/api/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, args, format: 'json' }),
        signal: controller.signal,
      })
    } catch {
      throw controller.signal.aborted
        ? new ChatError('timeout', 'The assistant took too long to answer. Please try again.')
        : new ChatError('network', 'Could not reach the assistant. Check your connection and try again.')
    } finally {
      clearTimeout(timer)
    }

    let result: ConvexResult
    try {
      result = (await httpResponse.json()) as ConvexResult
    } catch {
      throw new ChatError('bad_response', `The assistant returned an unreadable answer (HTTP ${httpResponse.status}).`)
    }

    if (result.status === 'success') return result.value

    // Errors the backend raises on purpose carry { code, message }
    const data = result.errorData
    if (typeof data === 'object' && data !== null && 'code' in data) {
      const { code, message } = data as { code: unknown; message?: unknown }
      throw new ChatError(String(code), typeof message === 'string' ? message : 'The assistant could not answer.')
    }
    throw new ChatError('server_error', result.errorMessage ?? 'The assistant could not answer.')
  }
}
