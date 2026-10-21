const KEY = 'remembered-email'

// localStorage puede fallar (modo privado, datos bloqueados): nunca debe romper el login.
export function getRememberedEmail() {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberEmail(email: string) {
  try {
    localStorage.setItem(KEY, email)
  } catch {
    // Sin almacenamiento, simplemente no se recuerda el correo.
  }
}

export function forgetEmail() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nada que borrar.
  }
}

export function subscribeToRememberedEmail(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}
