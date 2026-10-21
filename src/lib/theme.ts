export const THEME_KEY = 'theme'

export type Theme = 'light' | 'dark'

// Script que corre en el <head> ANTES de pintar la página. Sin él, quien eligió
// el tema oscuro vería un destello blanco mientras carga React.
// Si nunca eligió, se usa el tema de su sistema operativo.
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

export function getTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

// Cambia el tema y lo guarda en el navegador para la próxima visita.
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.classList.toggle('dark', next === 'dark')
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    // Sin almacenamiento, el tema sigue funcionando pero no se recuerda.
  }
  return next
}
