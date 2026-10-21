import { describe, expect, it } from 'vitest'
import { safeRedirect } from '@/lib/safe-redirect'

describe('safeRedirect', () => {
  it('accepts internal paths, with query and hash', () => {
    expect(safeRedirect('/issues/abc')).toBe('/issues/abc')
    expect(safeRedirect('/?status=done&page=2')).toBe('/?status=done&page=2')
    expect(safeRedirect('/issues/abc?x=1#h')).toBe('/issues/abc?x=1#h')
  })

  it.each([
    ['nothing', undefined],
    ['an empty string', ''],
    ['an absolute URL', 'https://evil.com/phishing'],
    ['a protocol-relative URL', '//evil.com'],
    ['a backslash trick', '/\\evil.com'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a path without leading slash', 'issues/1'],
    ['a path with a line break', '/issues/1\nSet-Cookie: x=1'],
    ['the login page itself', '/login'],
    ['the login page with params', '/login?redirect=/'],
    ['the register page', '/register'],
  ])('rejects %s', (_name, value) => {
    expect(safeRedirect(value)).toBeUndefined()
  })
})
