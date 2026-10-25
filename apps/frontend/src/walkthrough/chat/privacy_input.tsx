import { useId, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import type { PiiGuard } from '../privacy'
import { MAX_CHAT_MESSAGE_LENGTH } from './chat_types'
import { spansToSegments, summarizeTypes, typeLabel } from './privacy_format'
import { useDraftSpans } from './privacy_hooks'
import styles from './privacy.module.css'

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder: string
  guard: PiiGuard
}

/**
 * The question box with live highlighting. A hidden "mirror" behind the real textarea repeats the text with
 * the same font, padding and wrapping, and underlines what the guard thinks is personal information.
 * The textarea itself is untouched (typing, selection, IME and Enter-to-send all behave as before).
 */
export default function PrivacyInput({ id, value, onChange, onKeyDown, placeholder, guard }: Props) {
  const mirrorRef = useRef<HTMLDivElement>(null)
  const noteId = useId()
  const spans = useDraftSpans(guard, value)
  const segments = spansToSegments(value, spans)
  const found = summarizeTypes(spans)

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH))
  }

  function syncScroll(event: { currentTarget: HTMLTextAreaElement }) {
    const mirror = mirrorRef.current
    if (mirror) mirror.scrollTop = event.currentTarget.scrollTop
  }

  return (
    <div className={styles.inputWrap}>
      <div className={styles.field}>
        <div className={styles.mirror} ref={mirrorRef} aria-hidden="true">
          {segments.map((s, i) =>
            s.type ? (
              <mark key={i} className={styles.flag}>
                {s.text}
              </mark>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
          {'​'}
        </div>
        <textarea
          id={id}
          className={styles.textarea}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
          onFocus={() => guard.startFuzzy()}
          placeholder={placeholder}
          rows={2}
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          spellCheck={false}
          aria-describedby={found.length > 0 ? noteId : undefined}
        />
      </div>
      <p id={noteId} className={styles.found} aria-live="polite">
        {found.length > 0 && (
          <>
            <span className={styles.foundLabel}>Hidden before sending:</span>
            {found.map(({ type, count }) => (
              <span key={type} className={styles.typeChip}>
                {type}
                {count > 1 ? ` x${count}` : ''}
                <span className={styles.visuallyHidden}> ({typeLabel(type)})</span>
              </span>
            ))}
          </>
        )}
      </p>
    </div>
  )
}
