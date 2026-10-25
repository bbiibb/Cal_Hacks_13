import { createContext, useContext } from 'react'
import type { Viewer } from './viewer'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'

export type AuthState = {
  /** False when VITE_CONVEX_URL is missing: accounts are not available. */
  configured: boolean
  status: AuthStatus
  user: Viewer | null
  /** Resolves true when the sign-in worked. Rejects with the backend error. */
  signIn: (form: FormData) => Promise<boolean>
  signOut: () => Promise<void>
}

export const UNCONFIGURED: AuthState = {
  configured: false,
  status: 'signed_out',
  user: null,
  signIn: () => Promise.resolve(false),
  signOut: () => Promise.resolve(),
}

export const AuthContext = createContext<AuthState>(UNCONFIGURED)

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

