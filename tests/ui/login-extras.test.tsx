import { cleanup, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PasswordInput } from '@/components/password-input'
import { useRememberedEmail } from '@/hooks/use-remembered-email'
import {
  forgetEmail,
  getRememberedEmail,
  rememberEmail,
} from '@/lib/remembered-email'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('PasswordInput', () => {
  it('hides the password by default and toggles it with the eye button', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Contraseña" />)
    const input = screen.getByLabelText('Contraseña')
    expect(input).toHaveProperty('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(input).toHaveProperty('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(input).toHaveProperty('type', 'password')
  })

  it('does not submit the form when the eye button is clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    )
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Contraseña" />
      </form>,
    )
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('remembered email', () => {
  it('saves, reads and forgets the email', () => {
    expect(getRememberedEmail()).toBe('')
    rememberEmail('ana@acme.test')
    expect(getRememberedEmail()).toBe('ana@acme.test')
    forgetEmail()
    expect(getRememberedEmail()).toBe('')
  })

  it('exposes the saved email through the hook', () => {
    rememberEmail('luis@acme.test')
    const { result } = renderHook(() => useRememberedEmail())
    expect(result.current).toBe('luis@acme.test')
  })

  it('does not break when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getRememberedEmail()).toBe('')
    expect(() => rememberEmail('ana@acme.test')).not.toThrow()
  })
})
