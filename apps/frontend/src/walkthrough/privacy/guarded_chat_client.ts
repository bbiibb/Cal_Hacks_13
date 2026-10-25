import type { ChatClient } from '../chat/chat_types'
import type { PiiGuard } from './guard'

/**
 * Wraps a chat client so personal information is replaced with placeholders before a question leaves the
 * device, and put back into the answer on the device.
 *
 * KNOWN GAP: `askByVoice` is deliberately NOT forwarded. Audio is transcribed on the server before any
 * text guard could run, so a spoken name or SSN would reach the backend unredacted. Leaving it undefined
 * makes the chat panel hide the microphone. Voice can be added only after transcription runs on the device.
 *
 * Other optional methods (`close`) are forwarded unchanged.
 *
 * @throws PiiBlockedError from `ask` when the message still looks like it holds personal information
 */
export function guardedChatClient(inner: ChatClient, guard: PiiGuard): ChatClient {
  const innerClose = inner.close?.bind(inner)
  return {
    mode: inner.mode,
    async ask(request) {
      const safe = await guard.protect(request.message)
      const reply = await inner.ask({ ...request, message: safe.text })
      return guard.rehydrateReply(reply)
    },
    ...(innerClose ? { close: innerClose } : {}),
  }
}
