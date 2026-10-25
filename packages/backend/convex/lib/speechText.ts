import { MAX_CHAT_MESSAGE_LENGTH } from "@cal-hacks/shared";

/**
 * Turns what the speech-to-text heard into a question the chatbot accepts.
 * The frontend records up to 30 seconds, which a fast speaker can fill with more than the 500 characters a
 * typed question may have. Instead of failing with "please type a shorter question" for a spoken one, the text
 * is cut at the last sentence end (or word) that fits.
 */
export function voiceQuestion(transcript: string, max: number = MAX_CHAT_MESSAGE_LENGTH): string {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;

  const head = text.slice(0, max);
  // Prefer a whole sentence, as long as it keeps most of the question
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  if (sentenceEnd >= max * 0.5) return head.slice(0, sentenceEnd + 1).trim();
  const wordEnd = head.lastIndexOf(" ");
  return (wordEnd > 0 ? head.slice(0, wordEnd) : head).trim();
}
