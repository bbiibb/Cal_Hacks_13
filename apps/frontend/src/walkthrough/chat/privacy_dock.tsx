import { useEffect, useId, useState, type FormEvent } from 'react'
import type { AuditEntry, Intake, PiiGuard, PrivacyStatus } from '../privacy'
import { maskDob, maskSsn, typeLabel } from './privacy_format'
import { useAuditEntries, usePrivacyStatus } from './privacy_hooks'
import styles from './privacy.module.css'

const DETECTOR_LABEL: Record<PrivacyStatus['fuzzy'], { text: string; tone: 'ok' | 'busy' | 'off' }> = {
  disabled: { text: 'Name finder: rules only', tone: 'off' },
  loading: { text: 'Name finder: loading', tone: 'busy' },
  ready: { text: 'Name finder: ready', tone: 'ok' },
  unavailable: { text: 'Name finder: unavailable, rules only', tone: 'off' },
}

const LAYER2_LABEL: Record<AuditEntry['layer2'], string> = {
  used: 'Name finder used',
  skipped: 'Name finder not ready, rules only',
  failed: 'Name finder failed, rules only',
  off: 'Rules only',
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function AuditList({ entries, onClear }: { entries: readonly AuditEntry[]; onClear: () => void }) {
  if (entries.length === 0) {
    return <p className={styles.hint}>Nothing has been sent yet. After you ask a question, the exact text that left this device appears here.</p>
  }
  const newestFirst = [...entries].reverse()
  return (
    <>
      <ol className={styles.auditList}>
        {newestFirst.map((e) => (
          <li key={e.id} className={e.status === 'blocked' ? styles.auditBlocked : styles.auditSent}>
            <div className={styles.auditHead}>
              <span className={styles.auditStatus}>{e.status === 'sent' ? 'Sent' : 'Not sent (blocked)'}</span>
              <span className={styles.auditMeta}>
                {formatTime(e.timestamp)} · {LAYER2_LABEL[e.layer2]}
              </span>
            </div>
            {e.status === 'sent' && e.sentText !== null ? (
              <p className={styles.sentText}>{e.sentText}</p>
            ) : (
              <p className={styles.hint}>
                Nothing left your device.
                {e.blockedTypes.length > 0 && <> Still looked like: {e.blockedTypes.map(typeLabel).join(', ')}.</>}
              </p>
            )}
            {e.redactions.length > 0 && (
              <ul className={styles.redactions} aria-label="Replaced before sending">
                {e.redactions.map((r, i) => (
                  <li key={`${r.placeholder}-${i}`} className={styles.typeChip}>
                    {r.placeholder} <span className={styles.chipKind}>{typeLabel(r.type)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className={styles.linkButton} onClick={onClear}>
        Clear this list
      </button>
    </>
  )
}

type Saved = { name: string; dob: string; ssn: string }

const EMPTY: Intake = { firstName: '', lastName: '', dob: '', ssn: '' }

function IntakeForm({ guard, status }: { guard: PiiGuard; status: PrivacyStatus }) {
  const uid = useId()
  const [draft, setDraft] = useState<Intake>(EMPTY)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function toSaved(intake: Intake): Saved {
    return { name: `${intake.firstName} ${intake.lastName}`.trim(), dob: maskDob(intake.dob), ssn: maskSsn(intake.ssn) }
  }

  // Show what is already in the vault (only masked values are kept in state)
  useEffect(() => {
    let active = true
    void guard.ready
      .then(() => guard.vault.loadIntake())
      .then((intake) => {
        if (active && intake) setSaved(toSaved(intake))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [guard])

  const complete = Object.values(draft).every((v) => v.trim() !== '')
  const vaultDown = status.vault === 'unavailable'

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!complete || busy) return
    setBusy(true)
    setMessage('')
    try {
      const intake: Intake = {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        dob: draft.dob.trim(),
        ssn: draft.ssn.trim(),
      }
      await guard.vault.saveIntake(intake)
      setSaved(toSaved(intake))
      setDraft(EMPTY)
      setMessage('Saved in the encrypted vault on this device.')
    } catch {
      setMessage('Could not save. The on-device vault is not available in this browser.')
    } finally {
      setBusy(false)
    }
  }

  async function clearAll() {
    setBusy(true)
    try {
      await guard.vault.clear()
      setSaved(null)
      setDraft(EMPTY)
      setMessage('Cleared. Details and placeholders were deleted from this device.')
    } catch {
      setMessage('Could not clear the vault. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof Intake, label: string, placeholder: string, extra?: { inputMode?: 'numeric' | 'text' }) => (
    <div className={styles.formRow}>
      <label htmlFor={`${uid}-${key}`} className={styles.label}>
        {label}
      </label>
      <input
        id={`${uid}-${key}`}
        className={styles.textInput}
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        inputMode={extra?.inputMode}
      />
    </div>
  )

  return (
    <div>
      <p className={styles.demoNotice}>Demo data only - do not enter real information</p>
      <p className={styles.hint}>
        Saved only in an encrypted vault in this browser. Ask Ray never sees it. Try a fake example: Jane / Doe / 03-03-1985 /
        123-45-6789.
      </p>
      <form onSubmit={(e) => void save(e)} className={styles.form}>
        {field('firstName', 'First name', 'Jane')}
        {field('lastName', 'Last name', 'Doe')}
        {field('dob', 'Date of birth', '03-03-1985')}
        {field('ssn', 'ID number (SSN)', '123-45-6789', { inputMode: 'numeric' })}
        <div className={styles.formActions}>
          <button type="submit" className={styles.primary} disabled={!complete || busy || vaultDown}>
            Save to vault
          </button>
          <button type="button" className={styles.secondary} onClick={() => void clearAll()} disabled={busy || (!saved && !status.hasIntake)}>
            Clear
          </button>
        </div>
      </form>
      <p className={styles.status} role="status" aria-live="polite">
        {message}
      </p>
      {saved && (
        <dl className={styles.savedBox} aria-label="Saved in the vault">
          <div>
            <dt>Name</dt>
            <dd>{saved.name}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd>{saved.dob}</dd>
          </div>
          <div>
            <dt>ID number</dt>
            <dd>{saved.ssn}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

/** The privacy status line under the question box, with a drawer for the audit log and the demo intake form. */
export default function PrivacyDock({ guard }: { guard: PiiGuard }) {
  const status = usePrivacyStatus(guard)
  const entries = useAuditEntries(guard)
  const [open, setOpen] = useState(false)
  const drawerId = useId()
  const detector = DETECTOR_LABEL[status.fuzzy]
  const blockedCount = entries.filter((e) => e.status === 'blocked').length

  return (
    <section className={styles.dock} aria-label="Privacy">
      <div className={styles.statusRow}>
        <p className={styles.summary} title={status.detail}>
          {status.summary}
        </p>
        <span className={styles.detector} role="status" aria-live="polite">
          <span className={`${styles.dot} ${styles[`dot_${detector.tone}`]}`} aria-hidden="true" />
          {detector.text}
        </span>
      </div>
      <div className={styles.footRow}>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={drawerId} onClick={() => setOpen((v) => !v)}>
          <span aria-hidden="true" className={styles.chevron}>
            {open ? '▾' : '▸'}
          </span>
          What left your device
          {entries.length > 0 && <span className={styles.count}> ({entries.length}{blockedCount > 0 ? `, ${blockedCount} blocked` : ''})</span>}
        </button>
        <span className={styles.voiceNote}>Voice is off while the privacy layer is on.</span>
      </div>
      <div id={drawerId} hidden={!open} className={styles.drawer}>
        <p className={styles.hint}>{status.detail}</p>
        <h3 className={styles.drawerTitle}>What left your device</h3>
        <AuditList entries={entries} onClear={() => guard.auditLog.clear()} />
        <details className={styles.intake}>
          <summary className={styles.intakeSummary}>Demo patient details (stay on this device)</summary>
          <IntakeForm guard={guard} status={status} />
        </details>
      </div>
    </section>
  )
}
