// Ruta de login CENTRALIZADA y opcionalmente OCULTA.
//
// Si defines NEXT_PUBLIC_LOGIN_KEY, el login se sirve en /acceso/<key> (ruta
// no adivinable) y /login responde 404. Si NO la defines, todo sigue en /login
// (comportamiento por defecto → cero riesgo de lockout).
//
// Todos los redirects internos deben usar loginHref() en vez de '/login' fijo,
// para apuntar automáticamente a la ruta correcta.

export const LOGIN_KEY = process.env.NEXT_PUBLIC_LOGIN_KEY || ''

/** Ruta base del login (oculta si hay key configurada). */
export const LOGIN_PATH = LOGIN_KEY ? `/acceso/${LOGIN_KEY}` : '/login'

/** URL de login con un `?next=` opcional (destino tras iniciar sesión). */
export function loginHref(next?: string): string {
  if (!next) return LOGIN_PATH
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`
}
