import { Outlet, useLocation } from 'react-router-dom'
import SiteHeader from '../site_header/site_header'
import styles from './site_layout.module.css'

type HeaderLook = {
  backgroundColor: string
  textColor?: string
  accentColor?: string
  /** Pastel gradient background for the whole page, header included. */
  pastel: boolean
}

const DARK_LOOK: HeaderLook = {
  backgroundColor: '#000000',
  textColor: '#ffffff',
  accentColor: '#b9b6ff',
  pastel: false,
}
const PASTEL_LOOK: HeaderLook = { backgroundColor: 'transparent', pastel: true }

/** How the header (and the page behind it) looks on each page. */
function lookFor(pathname: string): HeaderLook {
  if (pathname === '/walkthrough') return DARK_LOOK
  return PASTEL_LOOK
}

/**
 * Shared frame for every page: the header stays at the top while the page changes below it.
 * Pages render inside <Outlet /> and fill the space under the header.
 */
function SiteLayout() {
  const { pathname } = useLocation()
  const look = lookFor(pathname)

  return (
    <div className={look.pastel ? `${styles.layout} ${styles.pastel}` : styles.layout}>
      <SiteHeader
        backgroundColor={look.backgroundColor}
        textColor={look.textColor}
        accentColor={look.accentColor}
      />
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  )
}

export default SiteLayout
