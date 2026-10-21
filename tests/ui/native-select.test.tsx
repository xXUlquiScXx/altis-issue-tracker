import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { NativeSelect } from '@/components/ui/native-select'

afterEach(cleanup)

function Example({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('a')
  return (
    <NativeSelect
      aria-label="Letra"
      value={value}
      disabled={disabled}
      onChange={(event) => setValue(event.target.value)}
    >
      <option value="a">A</option>
      <option value="b">B</option>
    </NativeSelect>
  )
}

describe('NativeSelect', () => {
  it('is still a real, labelled <select> that changes its value', async () => {
    const user = userEvent.setup()
    render(<Example />)
    const select = screen.getByLabelText('Letra') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')

    await user.selectOptions(select, 'b')
    expect(select.value).toBe('b')
  })

  it('hides the browser arrow and draws its own, with room for it', () => {
    const { container } = render(<Example />)
    const select = screen.getByLabelText('Letra')
    // Sin la flecha del navegador (que no respeta el padding)...
    expect(select.className).toContain('appearance-none')
    expect(select.className).toContain('pr-8')
    // ...y con una flecha propia, decorativa: no recibe clics ni la lee un lector de pantalla.
    const arrow = container.querySelector('svg')!
    expect(arrow.getAttribute('aria-hidden')).toBe('true')
    expect(arrow.getAttribute('class')).toContain('pointer-events-none')
    expect(arrow.getAttribute('class')).toContain('right-2.5')
  })

  it('can be disabled', () => {
    render(<Example disabled />)
    expect((screen.getByLabelText('Letra') as HTMLSelectElement).disabled).toBe(
      true,
    )
  })
})
