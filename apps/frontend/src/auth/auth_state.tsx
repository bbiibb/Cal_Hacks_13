import { useMemo, type ReactNode } from 'react'
import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react'
import { ConvexReactClient, useConvexAuth, useQuery } from 'convex/react'
import { AUTH_CONFIGURED, convexUrl } from './config'
import { viewerQuery } from './viewer'
import { AuthContext, UNCONFIGURED, type AuthState, type AuthStatus } from './auth_context'

function ConvexAuthState({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signIn, signOut } = useAuthActions()
  const viewer = useQuery(viewerQuery, isAuthenticated ? {} : 'skip')

  const value = useMemo<AuthState>(() => {
    // Authenticated but the profile has not arrived yet: still loading, so the UI does not flash.
    const status: AuthStatus = isLoading || (isAuthenticated && viewer === undefined)
      ? 'loading'
      : isAuthenticated && viewer
        ? 'signed_in'
        : 'signed_out'
    return {
      configured: true,
      status,
      user: status === 'signed_in' ? (viewer ?? null) : null,
      signIn: async (form) => (await signIn('password', form)).signingIn,
      signOut: () => signOut(),
    }
  }, [isLoading, isAuthenticated, viewer, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const client = AUTH_CONFIGURED ? new ConvexReactClient(convexUrl()) : null

/** Wraps the app. Without VITE_CONVEX_URL it skips Convex entirely and the app runs signed out. */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!client) return <AuthContext.Provider value={UNCONFIGURED}>{children}</AuthContext.Provider>
  return (
    <ConvexAuthProvider client={client}>
      <ConvexAuthState>{children}</ConvexAuthState>
    </ConvexAuthProvider>
  )
}
