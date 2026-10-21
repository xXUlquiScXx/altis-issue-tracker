import type { ErrorCode } from './errors'

// La API responde en inglés; la UI muestra estos textos en español.
const ES: Record<string, string> = {
  // Acceso
  'Invalid email': 'El correo no es válido',
  'Email is too long': 'El correo es demasiado largo',
  'Password is too long': 'La contraseña es demasiado larga',
  'Name is required': 'El nombre es obligatorio',
  'Name is too long': 'El nombre es demasiado largo',
  'Password must have at least 8 characters':
    'La contraseña debe tener al menos 8 caracteres',
  'Password is required': 'La contraseña es obligatoria',
  'Email already registered': 'Ese correo ya está registrado',
  'Invalid email or password': 'Correo o contraseña incorrectos',
  'Too many attempts, try again later':
    'Demasiados intentos. Espera un minuto e intenta de nuevo',
  'Authentication required': 'Debes iniciar sesión',
  // Issues
  'Title is required': 'El título es obligatorio',
  'Title is too long': 'El título es demasiado largo (máximo 200 caracteres)',
  'Description is too long': 'La descripción es demasiado larga',
  'Label is empty': 'Hay una etiqueta vacía',
  'Label is too long': 'Una etiqueta es demasiado larga (máximo 30 caracteres)',
  'Too many labels': 'Demasiadas etiquetas (máximo 10)',
  'Assignee not found': 'La persona asignada no existe en tu organización',
  'Issue not found': 'El issue no existe o no tienes acceso a él',
  'You cannot create this issue': 'No puedes crear este issue',
  'You cannot edit this issue': 'No puedes editar este issue',
  'You cannot reassign issues': 'No puedes reasignar issues',
  'You cannot delete this issue': 'No puedes eliminar este issue',
  // Comentarios
  'Comment is required': 'El comentario no puede estar vacío',
  'Comment is too long': 'El comentario es demasiado largo',
  'Comment not found': 'El comentario no existe',
  'You cannot comment on this issue': 'No puedes comentar en este issue',
  'Only the author can edit this comment':
    'Solo el autor puede editar este comentario',
  'Only the author can delete this comment':
    'Solo el autor puede eliminar este comentario',
  // Generales
  'Invalid UUID': 'El identificador no es válido',
  'Invalid input': 'Los datos enviados no son válidos',
  'Internal server error': 'Ocurrió un error en el servidor. Intenta de nuevo',
}

// Si el mensaje no está en la lista, se usa un texto según el código del error.
const BY_CODE: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Tu sesión expiró. Inicia sesión de nuevo',
  FORBIDDEN: 'No tienes permiso para hacer esto',
  NOT_FOUND: 'No se encontró lo que buscas',
  VALIDATION: 'Los datos enviados no son válidos',
  RATE_LIMITED: 'Demasiados intentos. Espera un minuto e intenta de nuevo',
  INTERNAL: 'Ocurrió un error en el servidor. Intenta de nuevo',
}

const INVALID_VALUE = 'El valor no es válido'

// Mensaje de un campo (ej. "Title is required"). Si no se conoce, uno genérico.
export function translate(message: string) {
  return ES[message] ?? INVALID_VALUE
}

export function translateFields(fields: Record<string, string> = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([field, message]) => [
      field,
      translate(message),
    ]),
  )
}

// Mensaje general de un error de la API (sirve para toasts y avisos).
export function apiErrorMessage(error: { code: ErrorCode; message: string }) {
  return ES[error.message] ?? BY_CODE[error.code]
}
