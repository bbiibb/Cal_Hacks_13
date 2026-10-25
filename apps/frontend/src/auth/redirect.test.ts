import { describe, expect, it } from 'vitest'
import { DEFAULT_AFTER_SIGN_IN, isSafeInternalPath, loginUrlFor, safeNext } from './redirect'

describe('safeNext', () => {
  it('keeps internal paths', () => {
    expect(safeNext('/walkthrough?step=2')).toBe('/walkthrough?step=2')
  })
  it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'walkthrough', '', null, undefined, '/a\nb'])(
    'rejects %s',
    (value) => {
      expect(isSafeInternalPath(value)).toBe(false)
      expect(safeNext(value)).toBe(DEFAULT_AFTER_SIGN_IN)
    },
  )
  it('builds an encoded login url', () => {
    expect(loginUrlFor('/walkthrough?step=2')).toBe('/login?next=%2Fwalkthrough%3Fstep%3D2')
  })
})
