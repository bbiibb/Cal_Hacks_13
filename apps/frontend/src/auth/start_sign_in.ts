/** Result of trying to start a sign-in. The page decides how to word each case. */
export type StartSignInResult = { status: 'not_configured' } | { status: 'redirecting' }

type EntraEnv = Record<string, unknown>

function readVar(env: EntraEnv, name: string): string {
  const value = env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The one place where sign-in begins.
 * Authentication will use Microsoft Entra External ID with its hosted sign-in page,
 * so this app never sees or stores a password. The client id and authority are not secrets.
 * `env` is a parameter only so tests can pass their own values.
 */
export function startSignIn(env: EntraEnv = import.meta.env): StartSignInResult {
  const clientId = readVar(env, 'VITE_ENTRA_CLIENT_ID')
  const authority = readVar(env, 'VITE_ENTRA_AUTHORITY')
  if (!clientId || !authority) return { status: 'not_configured' }

  // TODO(auth): add @azure/msal-browser here and call loginRedirect({ scopes: ['openid', 'profile'] })
  // with { clientId, authority }. Until then, signing in is treated as not set up.
  return { status: 'not_configured' }
}
