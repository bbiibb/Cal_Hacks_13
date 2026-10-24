import styles from './coming_soon.module.css'

/** Placeholder for pages that are linked from the header but not built yet. */
function ComingSoon() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Coming soon</h1>
      <p className={styles.text}>This page is not ready yet.</p>
    </main>
  )
}

export default ComingSoon
