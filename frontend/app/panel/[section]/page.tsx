'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { MerchantPanel } from '@/components/merchant-panel'
import { sectionForSlug, DEFAULT_SLUG } from '@/lib/panel-sections'
import { FullPageLoader } from '@/components/box-loader'

/**
 * Ruta canónica y compartible de cada página del comerciante: /panel/<slug>.
 * - Si no hay sesión, redirige a /login?next=/panel/<slug> y, tras iniciar
 *   sesión, el usuario vuelve automáticamente a esta página.
 * - Sincroniza el slug de la URL con activeSection para que el sidebar y el
 *   render muestren la sección correcta.
 */
export default function PanelSectionPage() {
  const params = useParams()
  const router = useRouter()
  const slug = Array.isArray(params?.section) ? params.section[0] : (params?.section as string)

  const { setActiveSection } = useStore()
  const { isAuthenticated, isCheckingAuth, checkAuth } = useAuthStore()

  const [ready, setReady] = useState(false)

  // Verifica el token al montar
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Mapea el slug -> sección interna y la fija como activa
  useEffect(() => {
    const section = sectionForSlug(slug)
    if (!section) {
      // slug desconocido -> manda al panel por defecto
      router.replace(`/panel/${DEFAULT_SLUG}`)
      return
    }
    setActiveSection(section)
  }, [slug, router, setActiveSection])

  // Guard de auth: si no hay sesión, manda al login conservando el destino
  useEffect(() => {
    if (isCheckingAuth) return
    if (!isAuthenticated) {
      const next = encodeURIComponent(`/panel/${slug}`)
      router.replace(`/login?next=${next}`)
      return
    }
    setReady(true)
  }, [isAuthenticated, isCheckingAuth, slug, router])

  if (isCheckingAuth || !ready) {
    return <FullPageLoader />
  }

  return <MerchantPanel />
}
