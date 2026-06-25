'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { useAuthStore } from '@/lib/auth-store'
import { DEFAULT_SLUG } from '@/lib/panel-sections'
import { FullPageLoader } from '@/components/box-loader'

/** Solo aceptamos destinos internos (evita open-redirects). */
function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return `/panel/${DEFAULT_SLUG}`
}

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isCheckingAuth, checkAuth, user } = useAuthStore()

  const next = safeNext(searchParams.get('next'))

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // En cuanto haya sesión (al cargar o tras login), va al destino solicitado.
  // Si no hay un `?next=` explícito (destino por defecto = panel comerciante),
  // se enruta por rol: cliente → su Consumer OS (`/`); comunidad_admin → su panel.
  useEffect(() => {
    // Espera a tener el usuario cargado para no enrutar con un rol indefinido.
    if (!isAuthenticated || !user) return
    const isDefault = next === `/panel/${DEFAULT_SLUG}`
    let dest: string
    if (user.role === 'cliente') {
      // El cliente vive en su Consumer OS, NUNCA en el panel de comerciante.
      // Solo respeta un `next` que no sea del panel (ej. deep-link a una tienda).
      dest = (isDefault || next.startsWith('/panel')) ? '/' : next
    } else if (isDefault && user.role === 'comunidad_admin') {
      dest = '/comunidad/admin'
    } else {
      dest = next
    }
    router.replace(dest)
  }, [isAuthenticated, user, next, router])

  if (isCheckingAuth || isAuthenticated) {
    return (
      <FullPageLoader />
    )
  }

  return <AuthForm />
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <FullPageLoader />
    }>
      <LoginInner />
    </Suspense>
  )
}
