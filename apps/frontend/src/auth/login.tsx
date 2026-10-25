import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import '@fontsource/sora/400.css'
import '@fontsource/sora/600.css'
import { useAuth } from './auth_context'
import { PasswordField, TextField } from './auth_fields'
import { LOGIN_ERROR, normalizeUsername } from './validation'
import { safeNext } from './redirect'
import styles from './auth_page.module.css'

const NOT_AVAILABLE = 'Accounts are not available in this demo yet.'

function Login() {
  const { configured, status, signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Signed in (just now, or already): go where the visitor wanted to go
  useEffect(() => {
    if (status === 'signed_in') navigate(next, { replace: true })
  }, [status, next, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!configured) {
      setNotice(NOT_AVAILABLE)
      return
    }
    const data = new FormData(event.currentTarget)
    const form = new FormData()
    form.set('flow', 'signIn')
    form.set('username', normalizeUsername(String(data.get('username') ?? '')))
    form.set('password', String(data.get('password') ?? ''))
    setBusy(true)
    try {
      // Any failure gets the same message, so usernames are never revealed
      if (!(await signIn(form)) && mounted.current) setError(LOGIN_ERROR)
    } catch {
      if (mounted.current) setError(LOGIN_ERROR)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <main className={styles.main}>
      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title" className={styles.title}>
          Log in
        </h1>
        <p className={styles.lead}>Welcome back to asX-ray.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <TextField label="Username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} />
          <PasswordField label="Password" name="password" autoComplete="current-password" error={error} />
          <div role="status">{notice && <p className={styles.notice}>{notice}</p>}</div>
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className={styles.switch}>
          New here?{' '}
          <Link to="/signup" className={styles.textLink}>
            Create an account
          </Link>
        </p>
      </section>
    </main>
  )
}

export default Login
