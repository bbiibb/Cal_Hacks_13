import { useEffect, useId, useState } from 'react'
import type { ChatSpeed } from './chat_types'
import styles from './speed_toggle.module.css'

type Props = {
  value: ChatSpeed
  onChange: (speed: ChatSpeed) => void
}

/**
 * Chooses which model answers: slow (the model on this computer, free) or fast (the cloud model, a paid service).
 * Choosing fast asks first, because every question then uses up paid API credit.
 */
function SpeedToggle({ value, onChange }: Props) {
  const [confirming, setConfirming] = useState(false)
  const warningId = useId()

  // Escape cancels the warning
  useEffect(() => {
    if (!confirming) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirming(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming])

  return (
    <div className={styles.wrap}>
      <div className={styles.group} role="radiogroup" aria-label="Answer speed">
        <button
          type="button"
          role="radio"
          aria-checked={value === 'slow'}
          className={value === 'slow' ? styles.optionOn : styles.option}
          onClick={() => {
            setConfirming(false)
            onChange('slow')
          }}
        >
          <span className={styles.name}>Slow</span>
          <span className={styles.hint}>on this computer · free</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value === 'fast'}
          aria-describedby={confirming ? warningId : undefined}
          className={value === 'fast' ? styles.optionOn : styles.option}
          onClick={() => {
            if (value !== 'fast') setConfirming(true)
          }}
        >
          <span className={styles.name}>Fast</span>
          <span className={styles.hint}>cloud model · paid</span>
        </button>
      </div>

      {confirming && (
        <div className={styles.warning} role="alertdialog" aria-labelledby={`${warningId}-title`} id={warningId}>
          <p className={styles.warningTitle} id={`${warningId}-title`}>
            Fast mode is a paid service
          </p>
          <p className={styles.warningText}>
            Every question uses up paid API credit, and your question is sent to a cloud service (personal details are
            still replaced first). Slow mode runs on this computer and costs nothing.
          </p>
          <div className={styles.warningActions}>
            <button
              type="button"
              className={styles.confirm}
              onClick={() => {
                setConfirming(false)
                onChange('fast')
              }}
            >
              Use fast mode
            </button>
            <button type="button" className={styles.cancel} onClick={() => setConfirming(false)}>
              Keep slow mode
            </button>
          </div>
        </div>
      )}

      {value === 'fast' && !confirming && (
        <p className={styles.note}>Fast mode is on: each question uses the paid API.</p>
      )}
    </div>
  )
}

export default SpeedToggle
