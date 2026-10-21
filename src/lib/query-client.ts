import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isApiError } from './api'
import { apiErrorMessage } from './messages'

// Un 401 puede llegar de varias consultas a la vez: se atiende una sola vez.
const UNAUTHENTICATED_COOLDOWN_MS = 2_000

// Manejo central de errores de la API, por código:
//  - 401: se limpia la caché (datos privados) y se vuelve al login.
//  - 403 y 500 en acciones del usuario (mutaciones): toast. En consultas, cada
//    vista muestra su propio estado de error con "Reintentar".
//  - 400 (validación) y 404: los resuelve cada formulario o vista.
export function createQueryClient(onUnauthenticated: () => void) {
  let handlingUnauthenticated = false

  function handleUnauthenticated() {
    if (handlingUnauthenticated) return
    handlingUnauthenticated = true
    setTimeout(() => {
      handlingUnauthenticated = false
    }, UNAUTHENTICATED_COOLDOWN_MS)

    client.clear()
    toast.error(apiErrorMessage({ code: 'UNAUTHENTICATED', message: '' }))
    onUnauthenticated()
  }

  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isApiError(error, 'UNAUTHENTICATED')) handleUnauthenticated()
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (isApiError(error, 'UNAUTHENTICATED')) {
          handleUnauthenticated()
          return
        }
        // Algunas mutaciones (como mover una tarjeta) muestran su propio aviso.
        if (mutation.meta?.skipErrorToast) return
        if (!isApiError(error)) {
          toast.error(apiErrorMessage({ code: 'INTERNAL', message: '' }))
        } else if (error.code === 'FORBIDDEN' || error.code === 'INTERNAL') {
          toast.error(apiErrorMessage(error))
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Al volver a la pestaña, lo que ya tenga más de `staleTime` se actualiza solo:
        // así se enteran de cambios hechos por otras personas o en otra ventana.
        refetchOnWindowFocus: true,
        // Reintenta una vez solo si el fallo pudo ser pasajero (red o 500).
        retry: (failureCount, error) =>
          failureCount < 1 && (!isApiError(error) || error.code === 'INTERNAL'),
      },
    },
  })

  return client
}
