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
    if (!isAuthenticated) return
    const isDefault = next === `/panel/${DEFAULT_SLUG}`
    const dest = isDefault && user?.role === 'comunidad_admin'
      ? '/comunidad/admin'
      : isDefault && user?.role === 'cliente'
        ? '/'                 // el cliente vive en su Consumer OS, no en el panel comerciante
        : next
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
