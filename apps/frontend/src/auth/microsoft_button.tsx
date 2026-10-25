import styles from './auth_page.module.css'

type Props = {
  label: string
  onClick: () => void
}

/** The four-square Microsoft mark, drawn inline so it needs no image file. */
function MicrosoftLogo() {
  return (
    <svg className={styles.microsoftLogo} viewBox="0 0 21 21" width="20" height="20" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

/** A "Continue with Microsoft" button. It is a preview for now: the page decides what a click does. */
function MicrosoftButton({ label, onClick }: Props) {
  return (
    <button type="button" className={styles.microsoft} onClick={onClick}>
      <MicrosoftLogo />
      <span>{label}</span>
    </button>
  )
}

export default MicrosoftButton
