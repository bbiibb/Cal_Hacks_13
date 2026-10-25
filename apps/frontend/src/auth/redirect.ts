/** Where to go after signing in when no valid `next` was given. */
export const DEFAULT_AFTER_SIGN_IN = '/walkthroughs-list'

/** True only for an in-app path such as "/walkthrough?step=2". Blocks "//host", "/\host", and URLs. */
export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (typeof value !== 'string' || !value.startsWith('/')) return false
  if (value.startsWith('//') || value.startsWith('/\\')) return false
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\\]/.test(value)) return false
  return true
}

export function safeNext(value: string | null | undefined): string {
  return isSafeInternalPath(value) ? value : DEFAULT_AFTER_SIGN_IN
}

/** Login URL that returns the visitor to `path` after signing in. */
export function loginUrlFor(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`
}
