'use client'

// Ruta OCULTA de login: /acceso/<key>. Solo sirve el login si <key> coincide con
// NEXT_PUBLIC_LOGIN_KEY; cualquier otro valor → 404. Así el login no se descubre
// solo (no aparece en /login) y la ruta real es no adivinable.
import { useParams, notFound } from 'next/navigation'
import { LOGIN_KEY } from '@/lib/login-path'
import LoginView from '@/components/login-view'

export default function AccesoOcultoPage() {
  const params = useParams()
  const key = Array.isArray(params?.key) ? params.key[0] : (params?.key as string)
  // Si no hay key configurada, esta ruta no aplica (login vive en /login).
  if (!LOGIN_KEY || key !== LOGIN_KEY) notFound()
  return <LoginView />
}
