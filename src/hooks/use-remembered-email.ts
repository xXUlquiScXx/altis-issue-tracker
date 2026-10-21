import { useSyncExternalStore } from 'react'
import {
  getRememberedEmail,
  subscribeToRememberedEmail,
} from '@/lib/remembered-email'

// Lee el correo guardado sin causar errores de hidratación: en el servidor
// (que no tiene localStorage) devuelve '' y en el navegador, el valor real.
export function useRememberedEmail() {
  return useSyncExternalStore(
    subscribeToRememberedEmail,
    getRememberedEmail,
    () => '',
  )
}
