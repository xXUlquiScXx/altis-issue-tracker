import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useVisibleAreaStyle } from '@/hooks/use-visible-area'

// visualViewport falso: un EventTarget con alto, desplazamiento y zoom.
class FakeViewport extends EventTarget {
  height = 800
  offsetTop = 0
  scale = 1
  change(patch: Partial<Pick<FakeViewport, 'height' | 'offsetTop' | 'scale'>>) {
    Object.assign(this, patch)
    this.dispatchEvent(new Event('resize'))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useVisibleAreaStyle', () => {
  it('centers and limits the dialog to the area that is really visible', () => {
    const viewport = new FakeViewport()
    vi.stubGlobal('visualViewport', viewport)
    const { result } = renderHook(() => useVisibleAreaStyle())
    expect(result.current).toEqual({ top: 400, maxHeight: 776 })
  })

  it('shrinks the dialog when the keyboard opens and restores it when it closes', () => {
    const viewport = new FakeViewport()
    vi.stubGlobal('visualViewport', viewport)
    const { result } = renderHook(() => useVisibleAreaStyle())

    // El teclado deja visible solo 360 px, y el navegador desplazó la vista 40 px.
    act(() => viewport.change({ height: 360, offsetTop: 40 }))
    expect(result.current).toEqual({ top: 220, maxHeight: 336 })

    act(() => viewport.change({ height: 800, offsetTop: 0 }))
    expect(result.current).toEqual({ top: 400, maxHeight: 776 })
  })

  it('does nothing while the user is zoomed in', () => {
    const viewport = new FakeViewport()
    vi.stubGlobal('visualViewport', viewport)
    const { result } = renderHook(() => useVisibleAreaStyle())
    act(() => viewport.change({ scale: 2 }))
    expect(result.current).toBeUndefined()
  })

  it('does nothing in browsers without visualViewport', () => {
    vi.stubGlobal('visualViewport', null)
    const { result } = renderHook(() => useVisibleAreaStyle())
    expect(result.current).toBeUndefined()
  })
})
