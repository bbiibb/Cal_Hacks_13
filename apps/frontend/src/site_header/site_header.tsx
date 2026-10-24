import type { CSSProperties } from 'react'
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
  /** Color of the header text and lines. Falls back to the page theme. */
  textColor?: string
  /** Color of the highlighted "X" in the logo. Falls back to the page theme. */
  accentColor?: string
}

/** Site-wide header. It stretches across the whole width of the page. */
function SiteHeader({ backgroundColor = 'transparent', textColor, accentColor }: Props) {
  // Custom properties let one component work on light, dark, and transparent backgrounds
  const style = {
    backgroundColor,
    ...(textColor ? { '--header-ink': textColor } : {}),
    ...(accentColor ? { '--header-accent': accentColor } : {}),
  } as CSSProperties

  return (
    <header className={styles.header} style={style}>
      {/* The name is "ask-ray": the "k" is drawn as an "X", so it reads like "X-ray" */}
      <Link to="/" className={styles.logo} aria-label="ask-ray home">
        <span aria-hidden="true">
          as<span className={styles.x}>X</span>-ray
        </span>
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
