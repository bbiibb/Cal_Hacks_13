import styles from './walkthrough_card.module.css'

type Props = {
  /** Name shown in the footer bar, e.g. "TAVI". Leave empty for a placeholder. */
  title?: string
  /** Illustration of the condition. A neutral block is shown when omitted. */
  imageSrc?: string
  imageAlt?: string
  /** Renders a non-clickable "Coming Soon" card. */
  comingSoon?: boolean
  onSelect?: () => void
}

function WalkthroughCard({ title, imageSrc, imageAlt = '', comingSoon = false, onSelect }: Props) {
  const body = (
    <>
      <div className={styles.media}>
        {comingSoon ? (
          <span className={styles.soon}>
            Coming Soon
          </span>
        ) : imageSrc ? (
          <img className={styles.image} src={imageSrc} alt={imageAlt} />
        ) : (
          <span className={styles.imagePlaceholder}>Image</span>
        )}
      </div>
      <div className={styles.footer}>{title ?? '—'}</div>
    </>
  )

  if (comingSoon) {
    return (
      <div className={`${styles.card} ${styles.disabled}`} aria-disabled="true">
        {body}
      </div>
    )
  }

  return (
    <button type="button" className={`${styles.card} ${styles.interactive}`} onClick={onSelect}>
      {body}
    </button>
  )
}

export default WalkthroughCard
