import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { queryKeys } from '@/lib/query-keys'

// Marca como "viejas" la lista y el tablero de issues para que se vuelvan a pedir
// (la que esté en pantalla, ya; las demás, cuando se vuelva a abrirlas). Sirve
// cuando nos enteramos de que un issue cambió o desapareció por culpa de otra
// persona, por ejemplo un 404 al abrirlo.
export function useRefreshIssueLists() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists })
    void queryClient.invalidateQueries({ queryKey: queryKeys.issues.boards })
  }, [queryClient])
}
