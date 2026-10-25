import { useState } from 'react'
import { Link } from 'react-router-dom'
import '@fontsource/sora/400.css'
import '@fontsource/sora/600.css'
import { startSignIn } from './start_sign_in'
import styles from './auth_page.module.css'

/** The Microsoft four-square mark, drawn from four rectangles so no outside asset is needed. */
function MicrosoftMark() {
  return (
    <svg className={styles.logo} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

function Login() {
  const [notConfigured, setNotConfigured] = useState(false)

  function handleContinue() {
    const result = startSignIn()
    if (result.status === 'not_configured') setNotConfigured(true)
  }

  return (
    <main className={styles.main}>
      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title" className={styles.title}>
          Welcome back
        </h1>
        <p className={styles.lead}>Sign in to pick up where you left off. Your progress follows you across devices.</p>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={handleContinue}>
            <MicrosoftMark />
            Continue with Microsoft
          </button>
          <Link to="/walkthroughs-list" className={styles.secondary}>
            Continue without signing in
          </Link>
        </div>

        {/* role="status" must exist before its text changes, so screen readers announce it */}
        <div role="status">
          {notConfigured && (
            <p className={styles.status}>
              Sign-in is not set up yet in this demo. You can still use the walkthrough without an account.
            </p>
          )}
        </div>

        <p className={styles.switch}>
          New here?{' '}
          <Link to="/signup" className={styles.textLink}>
            Sign up
          </Link>
        </p>

        <div className={styles.note}>
          <p>We never ask for medical or ID numbers. Your name stays on your device.</p>
          <p>Educational, not medical advice.</p>
        </div>
      </section>
    </main>
  )
}

export default Login
