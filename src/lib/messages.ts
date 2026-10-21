import type { ApiError } from './errors'

// La API responde en inglés; la UI muestra estos textos en español.
const ES: Record<string, string> = {
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
}

const FALLBACK = 'Ocurrió un error inesperado. Intenta de nuevo'

export function translate(message: string) {
  return ES[message] ?? FALLBACK
}

export function translateFields(fields: Record<string, string> = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([field, message]) => [
      field,
      translate(message),
    ]),
  )
}

export function apiErrorMessage(error: ApiError) {
  return translate(error.message)
}
