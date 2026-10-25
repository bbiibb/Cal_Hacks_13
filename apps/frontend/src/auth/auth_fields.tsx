import { useId, useState, type ComponentProps } from 'react'
import styles from './auth_page.module.css'

type FieldProps = {
  label: string
  error?: string
  hint?: string
} & Omit<ComponentProps<'input'>, 'className'>

/** A labelled input with an inline error and optional hint, wired up for screen readers. */
export function TextField({ label, error, hint, ...input }: FieldProps) {
  const id = useId()
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ')
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        {...input}
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

/** Password input with a show/hide toggle. */
export function PasswordField({ label, error, hint, ...input }: FieldProps) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ')
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.passwordWrap}>
        <input
          {...input}
          id={id}
          type={shown ? 'text' : 'password'}
          className={`${styles.input} ${styles.passwordInput}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        <button
          type="button"
          className={styles.eye}
          onClick={() => setShown((value) => !value)}
          aria-label="Show password"
          aria-pressed={shown}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {shown && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
