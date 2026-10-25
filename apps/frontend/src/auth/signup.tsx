import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import '@fontsource/sora/400.css'
import '@fontsource/sora/600.css'
import { useAuth } from './auth_context'
import { PasswordField, TextField } from './auth_fields'
import {
  GENERAL_SIGNUP_ERROR,
  errorCode,
  mapSignupError,
  normalizeUsername,
  validateSignup,
  type SignupErrors,
  type SignupValues,
} from './validation'
import { safeNext } from './redirect'
import styles from './auth_page.module.css'

const NOT_AVAILABLE = 'Accounts are not available in this demo yet.'

function Signup() {
  const { configured, status, signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<SignupErrors>({})
  const [general, setGeneral] = useState('')
  const [notice, setNotice] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (status === 'signed_in') navigate(next, { replace: true })
  }, [status, next, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGeneral('')
    setNotice('')
    const data = new FormData(event.currentTarget)
    const read = (name: string) => String(data.get(name) ?? '')
    const values: SignupValues = {
      firstName: read('firstName').trim(),
      lastName: read('lastName').trim(),
      email: read('email').trim(),
      username: normalizeUsername(read('username')),
      password: read('password'),
    }

    const found = validateSignup(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    if (!configured) {
      setNotice(NOT_AVAILABLE)
      return
    }

    const form = new FormData()
    form.set('flow', 'signUp')
    for (const [name, value] of Object.entries(values)) form.set(name, value)
    setBusy(true)
    try {
      if (!(await signIn(form)) && mounted.current) setGeneral(GENERAL_SIGNUP_ERROR)
    } catch (caught) {
      if (!mounted.current) return
      const failure = mapSignupError(errorCode(caught))
      if (failure.field) setErrors({ [failure.field]: failure.message })
      else setGeneral(failure.message)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <main className={styles.main}>
      <section className={styles.card} aria-labelledby="signup-title">
        <h1 id="signup-title" className={`${styles.title} ${styles.centered}`}>
          Create your account
        </h1>
        <p className={`${styles.lead} ${styles.centered}`}>Join asX-ray in a minute.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.row}>
            <TextField label="First name" name="firstName" autoComplete="given-name" error={errors.firstName} />
            <TextField label="Last name" name="lastName" autoComplete="family-name" error={errors.lastName} />
          </div>
          <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
          <TextField label="Username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} error={errors.username} />
          <PasswordField label="Password" name="password" autoComplete="new-password" hint="At least 8 characters" error={errors.password} />
          <div role="status">
            {(notice || general) && <p className={styles.notice}>{notice || general}</p>}
          </div>
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account?{' '}
          <Link to="/login" className={styles.textLink}>
            Log in
          </Link>
        </p>
      </section>
    </main>
  )
}

export default Signup
