import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth_context'
import { REQUIRE_AUTH } from './config'
import { loginUrlFor } from './redirect'
import styles from './auth_page.module.css'

/** Route guard: signed-out visitors go to /login and come back here afterwards. */
function RequireAuth() {
  const { configured, status } = useAuth()
  const location = useLocation()

  if (!REQUIRE_AUTH || !configured) return <Outlet />
  if (status === 'loading') {
    return (
      <p className={styles.loading} role="status">
        Loading...
      </p>
    )
  }
  if (status === 'signed_out') {
    return <Navigate to={loginUrlFor(location.pathname + location.search)} replace />
  }
  return <Outlet />
}

export default RequireAuth
