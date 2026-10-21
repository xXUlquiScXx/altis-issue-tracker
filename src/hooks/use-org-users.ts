import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { listOrgUsers } from '@/server/issues/functions'

// Personas de la org: para el selector de assignee y el filtro de la lista.
export function useOrgUsers() {
  return useQuery({
    queryKey: queryKeys.orgUsers,
    queryFn: () => api(() => listOrgUsers()),
    staleTime: 5 * 60_000,
  })
}
