import { Link } from 'react-router-dom'
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
        <span className={styles.mark}>SS</span>
        <span className={styles.name}>
          Simple
          <br />
          Surgeries
        </span>
      </Link>
      <nav className={styles.nav} aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className={styles.link}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

export default SiteHeader
