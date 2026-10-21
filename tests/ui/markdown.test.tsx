import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Markdown } from '@/components/markdown'

afterEach(cleanup)

describe('Markdown', () => {
  it('renders headings, bold text, lists, tables and task lists', () => {
    const { container } = render(
      <Markdown>
        {`## Pasos\n\n1. Abrir\n2. **Guardar**\n\n- [x] listo\n\n| a | b |\n|---|---|\n| 1 | 2 |`}
      </Markdown>,
    )
    expect(screen.getByRole('heading', { name: 'Pasos' })).toBeTruthy()
    expect(container.querySelector('strong')?.textContent).toBe('Guardar')
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    expect(container.querySelector('table')).toBeTruthy()
    expect(container.querySelector('input[type="checkbox"]')).toBeTruthy()
  })

  it('never turns raw HTML into elements (no script injection)', () => {
    const { container } = render(
      <Markdown>
        {`<script>window.__pwned = true</script>\n\n<img src=x onerror="window.__pwned = true">\n\nTexto normal`}
      </Markdown>,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined()
    expect(screen.getByText('Texto normal')).toBeTruthy()
  })

  it('neutralizes javascript: links', () => {
    const { container } = render(
      <Markdown>{'[click](javascript:alert(1))'}</Markdown>,
    )
    const link = container.querySelector('a')
    expect(link?.getAttribute('href') ?? '').not.toContain('javascript:')
  })

  it('opens normal links in a new tab without leaking the opener', () => {
    render(<Markdown>{'[Docs](https://example.com/docs)'}</Markdown>)
    const link = screen.getByRole('link', { name: 'Docs' })
    expect(link.getAttribute('href')).toBe('https://example.com/docs')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('does not load images from markdown', () => {
    const { container } = render(
      <Markdown>{'![logo](https://example.com/a.png)'}</Markdown>,
    )
    expect(container.querySelector('img')).toBeNull()
  })
})
