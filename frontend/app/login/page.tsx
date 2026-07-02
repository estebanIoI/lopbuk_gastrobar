import { notFound } from 'next/navigation'
import { LOGIN_KEY } from '@/lib/login-path'
import LoginView from '@/components/login-view'

// Ruta pública de login. Si se configuró NEXT_PUBLIC_LOGIN_KEY, el login se mueve
// a /acceso/<key> y esta ruta deja de existir (404) → login no discoverable.
export default function LoginPage() {
  if (LOGIN_KEY) notFound()
  return <LoginView />
}
