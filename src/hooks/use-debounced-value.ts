import { useEffect, useState } from 'react'

// Devuelve `value` pero solo después de que dejó de cambiar durante `delayMs`.
// Sirve para no pedir datos al servidor en cada tecla de un buscador.
export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
