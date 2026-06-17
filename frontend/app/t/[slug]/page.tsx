'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LandingPage } from '@/components/landing-page'
import { Theme2Storefront } from '@/components/theme2/theme2-storefront'
import { ProfileThemeThree } from '@/components/profile-theme3/profile-theme-three'
import { Theme4Layout } from '@/components/theme4/theme4-layout'
import { BoxLoader } from '@/components/box-loader'

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

  const [theme, setTheme] = useState<'theme1' | 'theme2' | 'theme3' | 'theme4' | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/storefront/store-config/${slug}`).then(r => r.json()).catch(() => null)
        const t = res?.data?.storeInfo?.theme
        if (alive) setTheme(['theme2', 'theme3', 'theme4'].includes(t) ? t : 'theme1')
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

  if (theme === 'theme2') return <Theme2Storefront slug={slug} />
  if (theme === 'theme3') return <ProfileThemeThree slug={slug} />
  if (theme === 'theme4') return <Theme4Layout slug={slug} />

  return <LandingPage onGoToLogin={() => router.push('/login')} />
}
