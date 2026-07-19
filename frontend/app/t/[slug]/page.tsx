'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LandingPage } from '@/components/landing-page'
import { Theme2Storefront } from '@/components/theme2/theme2-storefront'
import { ProfileThemeThree } from '@/components/profile-theme3/profile-theme-three'
import { Theme4Layout } from '@/components/theme4/theme4-layout'
import { BoxLoader } from '@/components/box-loader'
import { loginHref } from '@/lib/login-path'
import { HomepageRenderer } from '@/components/content-hub/HomepageRenderer'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

/**
 * Ruta limpia y compartible de cada tienda: /t/<slug>.
 * Decide el tema de la tienda:
 *  - theme1 → LandingPage (diseño clásico actual, intacto)
 *  - theme2 → Theme2Storefront (nuevo estilo gastronómico)
 *  - theme3 → ProfileThemeThree (perfil público tipo red social)
 */
export default function StoreBySlugPage() {
  const params = useParams()
  const router = useRouter()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug as string)

  /**
   * "Volver" en móvil (sobre todo instalada como app): si se entra a la tienda
   * por enlace directo o como primera pantalla, no hay nada atrás y el botón
   * volver cerraba la app. Se agrega una entrada propia para que retroceder
   * lleve al inicio del marketplace en vez de salir.
   * Si el usuario ya venía navegando dentro de la app, no se toca nada.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    let vieneDeLaApp = false
    try {
      vieneDeLaApp = !!document.referrer && new URL(document.referrer).origin === window.location.origin
    } catch { /* referrer inválido → tratar como entrada directa */ }
    if (vieneDeLaApp) return

    try { window.history.pushState({ storeGuard: true }, '', window.location.href) } catch { return }
    // Navegación dura: con router.replace(), Next volvía a sincronizar la URL
    // de la tienda y el usuario se quedaba donde estaba. Ocurre una sola vez.
    const onPop = () => { window.location.replace('/') }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const [theme, setTheme] = useState<'theme1' | 'theme2' | 'theme3' | 'theme4' | null>(null)
  const [useHomepageRenderer, setUseHomepageRenderer] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [storeLogo, setStoreLogo] = useState<string | undefined>(undefined)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/storefront/store-config/${slug}`).then(r => r.json()).catch(() => null)
        const t = res?.data?.storeInfo?.theme
        if (alive) {
          setTheme(['theme2', 'theme3', 'theme4'].includes(t) ? t : 'theme1')
          setStoreName(res?.data?.storeInfo?.name || '')
          setStoreLogo(res?.data?.storeInfo?.logoUrl || undefined)
        }
        const homepageRes = await fetch(`${API_URL}/homepage/public?store=${slug}`).then(r => r.json()).catch(() => null)
        if (alive && homepageRes?.success && homepageRes?.data?.length > 0) {
          setUseHomepageRenderer(true)
        }
      } catch {
        if (alive) setTheme('theme1')
      }
    })()
    return () => { alive = false }
  }, [slug])

  if (theme === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]" style={{ ['--dz-bg' as any]: '#0a0a0a' }}>
        <BoxLoader />
      </div>
    )
  }

  if (useHomepageRenderer) {
    return <HomepageRenderer storeSlug={slug} storeName={storeName || slug} storeLogo={storeLogo} />
  }

  if (theme === 'theme2') return <Theme2Storefront slug={slug} />
  if (theme === 'theme3') return <ProfileThemeThree slug={slug} />
  if (theme === 'theme4') return <Theme4Layout slug={slug} />

  return <LandingPage onGoToLogin={() => router.push(loginHref())} />
}
