import type { Procedure, Structure } from '@cal-hacks/shared'
import type { ChatClient } from './chat_types'
import { ConvexChatClient } from './convex_chat_client'
import { DemoChatClient } from './demo_chat_client'
import { createBrowserPiiGuard, guardedChatClient } from '../privacy'
import type { PiiGuard } from '../privacy'

/**
 * Picks the chat backend from environment variables (in apps/frontend/.env.local):
 *   VITE_CHAT_BACKEND=convex  and  VITE_CONVEX_URL=https://<deployment>.convex.cloud  -> the live chatbot
 *   anything else                                                                      -> the built-in demo answers
 * The live chatbot needs the backend's `chat` functions to be deployed.
 */
export function createChatClient(procedure: Procedure, structures: readonly Structure[]): ChatClient {
  const backend = import.meta.env.VITE_CHAT_BACKEND
  const convexUrl = import.meta.env.VITE_CONVEX_URL
  if (backend === 'convex' && typeof convexUrl === 'string' && convexUrl !== '') {
    return new ConvexChatClient(convexUrl, procedure.slug)
  }
  return new DemoChatClient(procedure, structures)
}

let pageGuard: PiiGuard | null = null

/** One privacy guard per page, created on first use. Nothing heavy starts until `guard.startFuzzy()`. */
export function getPageGuard(): PiiGuard {
  pageGuard ??= createBrowserPiiGuard()
  return pageGuard
}

/** Releases the page guard (the on-device model worker and listeners). Call it when the page is really going away. */
export function disposePageGuard(): void {
  pageGuard?.dispose()
  pageGuard = null
}

/**
 * The chat backend wrapped by the privacy layer, plus the guard the panel's privacy UI talks to.
 * Both the live and the demo client are wrapped, so redaction behaves the same either way. The wrapper
 * hides `askByVoice`, so the microphone is off while the privacy layer is on.
 */
export function createGuardedChat(
  procedure: Procedure,
  structures: readonly Structure[],
): { client: ChatClient; guard: PiiGuard } {
  const guard = getPageGuard()
  return { client: guardedChatClient(createChatClient(procedure, structures), guard), guard }
}
