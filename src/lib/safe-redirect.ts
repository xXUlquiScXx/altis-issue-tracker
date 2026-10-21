// Después de iniciar sesión se vuelve a la página que se quería abrir (por
// ejemplo, un issue que alguien compartió). Ese destino viene de la URL, o sea
// que cualquiera puede escribirlo: solo se aceptan rutas internas de la app.
// Si no, un enlace trampa podría mandar al usuario a un sitio malicioso.
export function safeRedirect(path: string | undefined): string | undefined {
  if (!path) return undefined
  // Debe empezar por "/" pero no por "//" ni "/\" (esas formas apuntan a otro sitio).
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.startsWith('/\\')
  ) {
    return undefined
  }
  // Sin caracteres de control (saltos de línea, etc.).
  for (const char of path) {
    const code = char.charCodeAt(0)
    if (code < 32 || code === 127) return undefined
  }
  // Volver al login o registro no tiene sentido.
  if (/^\/(login|register)(\/|\?|#|$)/.test(path)) return undefined
  return path
}
