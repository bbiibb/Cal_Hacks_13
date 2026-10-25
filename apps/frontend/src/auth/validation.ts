/** Pure form checks and error mapping for the Log in and Sign up pages. */

export const PASSWORD_MIN_LENGTH = 8

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

export function validateUsername(value: string): string | null {
  const name = normalizeUsername(value)
  if (name === '') return 'Enter a username.'
  if (!/^[a-z0-9_]{3,20}$/.test(name)) {
    return 'Use 3 to 20 letters, numbers, or underscores.'
  }
  return null
}

export function validateName(value: string, label: string): string | null {
  return value.trim() === '' ? `Enter your ${label}.` : null
}

export function validateEmail(value: string): string | null {
  const email = value.trim()
  if (email === '') return 'Enter your email.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email, like name@example.com.'
  return null
}

export function validatePassword(value: string): string | null {
  if (value === '') return 'Enter a password.'
  if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  return null
}

export type SignupField = 'firstName' | 'lastName' | 'email' | 'username' | 'password'
export type SignupErrors = Partial<Record<SignupField, string>>

export type SignupValues = Record<SignupField, string>

export function validateSignup(values: SignupValues): SignupErrors {
  const errors: SignupErrors = {}
  const checks: [SignupField, string | null][] = [
    ['firstName', validateName(values.firstName, 'first name')],
    ['lastName', validateName(values.lastName, 'last name')],
    ['email', validateEmail(values.email)],
    ['username', validateUsername(values.username)],
    ['password', validatePassword(values.password)],
  ]
  for (const [field, message] of checks) if (message) errors[field] = message
  return errors
}

export const LOGIN_ERROR = 'Incorrect username or password'
export const GENERAL_SIGNUP_ERROR = 'We could not create your account right now. Please try again in a moment.'

/** Result of mapping a backend error: a message under one field, or a general message. */
export type SignupFailure = { field: SignupField | null; message: string }

/** Turns a backend error code (ConvexError `data.code`) into a friendly message. */
export function mapSignupError(code: string | null): SignupFailure {
  switch (code) {
    case 'invalid_username':
      return { field: 'username', message: 'Use 3 to 20 letters, numbers, or underscores.' }
    case 'username_taken':
      return { field: 'username', message: 'That username is taken. Try another one.' }
    case 'invalid_name':
      return { field: 'firstName', message: 'Check your first and last name.' }
    case 'invalid_email':
      return { field: 'email', message: 'Enter a valid email, like name@example.com.' }
    case 'weak_password':
      return { field: 'password', message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` }
    default:
      return { field: null, message: GENERAL_SIGNUP_ERROR }
  }
}

/** Reads `data.code` from a thrown ConvexError without trusting its shape. */
export function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null
  const data = (error as { data: unknown }).data
  if (typeof data !== 'object' || data === null || !('code' in data)) return null
  const code = (data as { code: unknown }).code
  return typeof code === 'string' ? code : null
}
