import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from '@/components/theme-toggle'
import { THEME_KEY, getTheme, themeInitScript, toggleTheme } from '@/lib/theme'

const html = document.documentElement

function stubSystemTheme(prefersDark: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches: prefersDark }))
}

// Ejecuta el mismo script que corre en el <head> antes de pintar la página.
function runInitScript() {
  new Function(themeInitScript)()
}

beforeEach(() => {
  html.classList.remove('dark')
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('toggleTheme', () => {
  it('switches between light and dark and remembers the choice', () => {
    expect(getTheme()).toBe('light')

    expect(toggleTheme()).toBe('dark')
    expect(html.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')

    expect(toggleTheme()).toBe('light')
    expect(html.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  })

  it('still switches when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => toggleTheme()).not.toThrow()
    expect(getTheme()).toBe('dark')
  })
})

describe('theme init script (runs before the page is painted)', () => {
  it('applies the saved dark theme, even if the system prefers light', () => {
    stubSystemTheme(false)
    localStorage.setItem(THEME_KEY, 'dark')
    runInitScript()
    expect(getTheme()).toBe('dark')
  })

  it('respects a saved light theme, even if the system prefers dark', () => {
    stubSystemTheme(true)
    localStorage.setItem(THEME_KEY, 'light')
    runInitScript()
    expect(getTheme()).toBe('light')
  })

  it('falls back to the system theme when nothing was saved', () => {
    stubSystemTheme(true)
    runInitScript()
    expect(getTheme()).toBe('dark')

    html.classList.remove('dark')
    stubSystemTheme(false)
    runInitScript()
    expect(getTheme()).toBe('light')
  })

  it('does not break the page when localStorage throws', () => {
    stubSystemTheme(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => runInitScript()).not.toThrow()
  })
})

describe('ThemeToggle', () => {
  it('toggles the theme when clicked', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const button = screen.getByRole('button', {
      name: 'Cambiar entre tema claro y oscuro',
    })

    await user.click(button)
    expect(getTheme()).toBe('dark')
    await user.click(button)
    expect(getTheme()).toBe('light')
  })
})
