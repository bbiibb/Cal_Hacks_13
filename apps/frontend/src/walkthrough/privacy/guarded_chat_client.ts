import type { ChatClient } from '../chat/chat_types'
import type { PiiGuard } from './guard'

/**
 * Wraps a chat client so personal information is replaced with placeholders before a question leaves the
 * device, and put back into the answer on the device.
 *
 * KNOWN GAP: `askByVoice` is forwarded as it is, because audio is transcribed on the server before any
 * text guard could run, so a spoken name or SSN reaches the backend unredacted (the backend still removes
 * emails, phone numbers, ID-like numbers and birth dates, and deletes the recording right away). Closing the
 * gap needs transcription on the device.
 *
 * Other optional methods (`close`) are forwarded unchanged.
 *
 * @throws PiiBlockedError from `ask` when the message still looks like it holds personal information
 */
export function guardedChatClient(inner: ChatClient, guard: PiiGuard): ChatClient {
  const innerClose = inner.close?.bind(inner)
  const innerVoice = inner.askByVoice?.bind(inner)
  return {
    mode: inner.mode,
    async ask(request) {
      const safe = await guard.protect(request.message)
      const reply = await inner.ask({ ...request, message: safe.text })
      return guard.rehydrateReply(reply)
    },
    ...(innerVoice ? { askByVoice: innerVoice } : {}),
    ...(innerClose ? { close: innerClose } : {}),
  }
}
