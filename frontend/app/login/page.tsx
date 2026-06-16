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
  // El rol comunidad_admin tiene su propio panel: /comunidad/admin.
  useEffect(() => {
    if (!isAuthenticated) return
    const dest = user?.role === 'comunidad_admin' && next === `/panel/${DEFAULT_SLUG}`
      ? '/comunidad/admin'
      : next
    router.replace(dest)
  }, [isAuthenticated, user, next, router])

  if (isCheckingAuth || isAuthenticated) {
    return (
      <FullPageLoader />
    )
  }

  return <AuthForm onGoBack={() => router.push('/')} />
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
