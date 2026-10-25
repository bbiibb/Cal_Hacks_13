import { describe, expect, it } from 'vitest'
import {
  errorCode,
  mapSignupError,
  normalizeUsername,
  validateEmail,
  validateName,
  validatePassword,
  validateSignup,
  validateUsername,
} from './validation'

describe('username', () => {
  it('normalizes case and spaces', () => expect(normalizeUsername('  Ray_01 ')).toBe('ray_01'))
  it('accepts 3-20 letters, numbers, underscores', () => {
    expect(validateUsername('Ray_01')).toBeNull()
    expect(validateUsername('a'.repeat(20))).toBeNull()
  })
  it.each(['', 'ab', 'a'.repeat(21), 'has space', 'dash-ed', 'ünï'])('rejects %j', (value) => {
    expect(validateUsername(value)).not.toBeNull()
  })
})

describe('other fields', () => {
  it('requires trimmed names', () => {
    expect(validateName('   ', 'first name')).not.toBeNull()
    expect(validateName(' Ana ', 'first name')).toBeNull()
  })
  it('checks email format', () => {
    expect(validateEmail('a@b.co')).toBeNull()
    expect(validateEmail('a@b')).not.toBeNull()
    expect(validateEmail('')).not.toBeNull()
  })
  it('needs 8+ password characters', () => {
    expect(validatePassword('1234567')).not.toBeNull()
    expect(validatePassword('12345678')).toBeNull()
  })
  it('collects errors per field', () => {
    const errors = validateSignup({ firstName: '', lastName: 'B', email: 'x', username: 'ok_name', password: 'short' })
    expect(Object.keys(errors).sort()).toEqual(['email', 'firstName', 'password'])
  })
})

describe('error mapping', () => {
  it('reads the code from a ConvexError-like value', () => {
    expect(errorCode({ data: { code: 'username_taken' } })).toBe('username_taken')
    expect(errorCode(new Error('boom'))).toBeNull()
    expect(errorCode(null)).toBeNull()
  })
  it('maps known codes to fields', () => {
    expect(mapSignupError('username_taken').field).toBe('username')
    expect(mapSignupError('invalid_email').field).toBe('email')
    expect(mapSignupError('weak_password').field).toBe('password')
    expect(mapSignupError('invalid_name').field).toBe('firstName')
  })
  it('maps unknown codes to a general message', () => {
    expect(mapSignupError('something_else').field).toBeNull()
    expect(mapSignupError(null).field).toBeNull()
  })
})
