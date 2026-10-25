import { describe, expect, it } from 'vitest'
import { startSignIn } from './start_sign_in'

describe('startSignIn', () => {
  it('reports not_configured when both variables are unset', () => {
    expect(startSignIn({})).toEqual({ status: 'not_configured' })
  })

  it('reports not_configured when only one variable is set', () => {
    expect(startSignIn({ VITE_ENTRA_CLIENT_ID: 'abc' })).toEqual({ status: 'not_configured' })
    expect(startSignIn({ VITE_ENTRA_AUTHORITY: 'https://example.invalid' })).toEqual({ status: 'not_configured' })
  })

  it('treats blank values as unset', () => {
    expect(startSignIn({ VITE_ENTRA_CLIENT_ID: ' ', VITE_ENTRA_AUTHORITY: '' })).toEqual({ status: 'not_configured' })
  })
})
