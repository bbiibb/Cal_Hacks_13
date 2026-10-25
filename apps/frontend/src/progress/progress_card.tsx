import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TAVI_PROCEDURE } from '../walkthrough/tavi_content'
import { formatRelativeTime, summarizeProgress, walkthroughPath } from './progress_helpers'
import { resetProgress, useProgress } from './progress_store'
import styles from './progress_card.module.css'

/** The procedures that have a walkthrough, by slug. */
const PROCEDURES: Record<string, { name: string; totalSteps: number }> = {
  [TAVI_PROCEDURE.slug]: { name: 'TAVR walkthrough', totalSteps: TAVI_PROCEDURE.steps.length },
}

type Props = {
  /**
   * OPTIONAL SLOT for a future login/signup feature. When given, the card says "Welcome back, <name>".
   * Nothing reads or stores a real name today: progress is saved against an anonymous identity.
   */
  displayName?: string
}

/**
 * "Your progress": where the person stopped, with a button to continue.
 * It is hidden while there is no saved progress or no connection to the progress service.
 */
function ProgressCard({ displayName }: Props) {
  const { status, records } = useProgress()
  // Time moves on only when the page is shown again, which is precise enough for "2 hours ago"
  const [now] = useState(() => Date.now())

  if (status !== 'live') return null
  const slug = Object.keys(records).find((s) => PROCEDURES[s])
  if (!slug) return null

  const record = records[slug]
  const procedure = PROCEDURES[slug]
  const summary = summarizeProgress(record, procedure.totalSteps)
  const stepTitle = TAVI_PROCEDURE.slug === slug ? TAVI_PROCEDURE.steps[summary.stepNumber]?.short_title : undefined

  return (
    <section className={styles.card} aria-labelledby="progress-title">
      {displayName ? <p className={styles.welcome}>Welcome back, {displayName}</p> : null}
      <p className={styles.eyebrow}>Your progress</p>
      <h2 id="progress-title" className={styles.title}>
        {procedure.name}
      </h2>
      <p className={styles.step}>
        Step {summary.stepNumber} of {summary.totalSteps - 1}
        {stepTitle ? <span> · {stepTitle}</span> : null}
      </p>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label={`Steps viewed: ${summary.viewedCount} of ${summary.totalSteps}`}
        aria-valuemin={0}
        aria-valuemax={summary.totalSteps}
        aria-valuenow={summary.viewedCount}
      >
        {summary.viewed.map((seen, i) => (
          <span key={i} className={seen ? `${styles.seg} ${styles.segOn}` : styles.seg} />
        ))}
      </div>
      <p className={styles.meta}>
        {summary.viewedCount} of {summary.totalSteps} steps viewed · Last seen{' '}
        {formatRelativeTime(record.updatedAtMs, now)}
      </p>
      <div className={styles.actions}>
        <Link to={walkthroughPath(summary.stepNumber)} className={styles.primary}>
          Continue
          <span aria-hidden="true">→</span>
        </Link>
        <button type="button" className={styles.secondary} onClick={() => resetProgress(slug)}>
          Start over
        </button>
      </div>
    </section>
  )
}

export default ProgressCard
