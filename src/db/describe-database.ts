// A qué base apunta una URL, sin mostrar usuario ni contraseña: "host:5432/postgres".
export function describeDatabase(url: string) {
  try {
    const { hostname, port, pathname } = new URL(url)
    return `${hostname}:${port || '5432'}${pathname}`
  } catch {
    return '(URL no reconocible)'
  }
}
