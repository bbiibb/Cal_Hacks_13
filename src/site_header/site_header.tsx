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
  { label: 'About SS', to: '/about' },
  { label: 'FAQs', to: '/faqs' },
  { label: 'Contact', to: '/contact' },
]

function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo} aria-label="Simple Surgeries home">
        <span className={styles.orb} aria-hidden="true">
          SS
        </span>
        <span className={styles.name}>
          <span>Simple</span>
          <span>Surgeries</span>
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
