import { Link, NavLink } from 'react-router-dom'
// Sora: open-source font (SIL Open Font License), bundled through @fontsource
import '@fontsource/sora/400.css'
import '@fontsource/sora/600.css'
import styles from './site_header.module.css'

type NavItem = {
  label: string
  to: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'About us', to: '/about' },
  { label: 'FAQs', to: '/faqs' },
  { label: 'Contact', to: '/contact' },
]

type Props = {
  /** Any CSS color, e.g. "#000" or "rgba(255, 255, 255, 0.4)". Defaults to transparent. */
  backgroundColor?: string
}

/** Site-wide header. It stretches across the whole width of the page. */
function SiteHeader({ backgroundColor = 'transparent' }: Props) {
  return (
    <header className={styles.header} style={{ backgroundColor }}>
      <Link to="/" className={styles.logo} aria-label="ask-ray home">
        ask-<span className={styles.accent}>ray</span>
      </Link>
      <nav className={styles.nav} aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.auth}>
        <Link to="/signup" className={styles.signUp}>
          Sign up
        </Link>
        <Link to="/login" className={styles.logIn}>
          Log in
        </Link>
      </div>
    </header>
  )
}

export default SiteHeader
