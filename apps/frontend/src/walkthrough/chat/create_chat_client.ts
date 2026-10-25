import type { Procedure, Structure } from '@cal-hacks/shared'
import type { ChatClient } from './chat_types'
import { ConvexChatClient } from './convex_chat_client'
import { DemoChatClient } from './demo_chat_client'

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
