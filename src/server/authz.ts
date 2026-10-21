import type { Role } from '@/lib/types'

export type Action =
  | 'issue:create'
  | 'issue:update'
  | 'issue:assign'
  | 'issue:delete'
  | 'comment:create'
  | 'comment:update'
  | 'comment:delete'

interface Actor {
  id: string
  orgId: string
  role: Role
}

// Lo que hay que saber de un issue (o de uno por crear) para decidir permisos.
export interface IssueResource {
  orgId: string
  assigneeId: string | null
}

export interface CommentResource {
  orgId: string
  authorId: string
}

type Resource = IssueResource | CommentResource

// Único lugar donde se deciden los permisos. Es una función pura (sin BD ni
// request), así la UI puede usarla para ocultar botones y el servidor para
// rechazar de verdad: la UI nunca es la única barrera.
export function can(user: Actor, action: Action, resource: Resource): boolean {
  // Nadie toca recursos de otra organización.
  if (resource.orgId !== user.orgId) return false

  switch (action) {
    case 'issue:create':
    case 'issue:update':
      // El member solo crea y edita issues asignados a sí mismo.
      return user.role === 'admin' || isAssignedTo(resource, user.id)
    case 'issue:assign':
    case 'issue:delete':
      return user.role === 'admin'
    case 'comment:create':
      return true
    case 'comment:update':
    case 'comment:delete':
      // Solo el autor, aunque otro usuario sea admin.
      return 'authorId' in resource && resource.authorId === user.id
  }
}

function isAssignedTo(resource: Resource, userId: string) {
  return 'assigneeId' in resource && resource.assigneeId === userId
}
