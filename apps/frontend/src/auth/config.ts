/**
 * When true, /walkthrough and /walkthroughs-list need a signed-in account.
 * It has no effect while Convex is not configured (no VITE_CONVEX_URL): the demo then stays open.
 */
export const REQUIRE_AUTH = true

/** The Convex deployment URL, or an empty string when accounts are not set up. */
export function convexUrl(): string {
  const value: unknown = import.meta.env.VITE_CONVEX_URL
  return typeof value === 'string' ? value.trim() : ''
}

export const AUTH_CONFIGURED = convexUrl() !== ''
