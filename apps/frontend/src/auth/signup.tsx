import { Link } from 'react-router-dom'
import '@fontsource/sora/400.css'
import '@fontsource/sora/600.css'
import styles from './auth_page.module.css'

/** Placeholder until sign-up with Microsoft is built, so the header link is not a dead end. */
function Signup() {
  return (
    <main className={styles.main}>
      <section className={styles.card} aria-labelledby="signup-title">
        <h1 id="signup-title" className={styles.title}>
          Sign-up is coming soon
        </h1>
        <p className={styles.lead}>
          You do not need an account to use the walkthroughs. An account will only save your progress across devices.
        </p>
        <div className={styles.actions}>
          <Link to="/walkthroughs-list" className={styles.primary}>
            Browse walkthroughs
          </Link>
        </div>
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
