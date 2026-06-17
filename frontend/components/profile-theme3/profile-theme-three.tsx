'use client'

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { API_URL } from './types'
import type { ProfilePayload } from './types'
import { BoxLoader } from '@/components/box-loader'
import { ProfileHeader } from './profile-header'
import { ProfileSectionRenderer } from './section-renderer'
import { ProductsShowcase } from './products-showcase'

/**
 * TEMA 3 — Perfil Público del Tenant.
 * Layout completo: cabecera (banner/foto/links) → secciones dinámicas →
 * mini-catálogo de productos. Si `data` se pasa como prop (preview del editor),
 * no hace fetch.
 */
export function ProfileThemeThree({ slug, data }: { slug: string; data?: ProfilePayload }) {
  const [payload, setPayload] = useState<ProfilePayload | null>(data ?? null)
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data) { setPayload(data); return }
    let alive = true
    setLoading(true); setError(null)
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/profile/${encodeURIComponent(slug)}`).then(r => r.json()).catch(() => null)
        if (!alive) return
        if (res?.success && res.data) setPayload(res.data)
        else setError(res?.error || 'Perfil no disponible')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [slug, data])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50" style={{ ['--dz-bg' as any]: '#f9fafb' }}><BoxLoader /></div>
  }
  if (error || !payload) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-2 px-4 text-center">
        <p className="text-gray-700 font-medium">{error || 'Perfil no encontrado'}</p>
        <p className="text-sm text-gray-400">Este negocio aún no ha publicado su perfil.</p>
      </div>
    )
  }

  const accent = payload.profile.accentColor || '#10b981'
  const sections = [...payload.sections].sort((a, b) => a.orderIndex - b.orderIndex)

  return (
    <div className="min-h-screen bg-gray-50" style={{ ['--accent' as any]: accent }}>
      <ProfileHeader profile={payload.profile} />

      {sections.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
          {sections.map(s => (
            <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
              <ProfileSectionRenderer section={s} />
            </div>
          ))}
        </div>
      )}

      <ProductsShowcase slug={payload.tenant.slug} />

      <footer className="py-8 text-center text-xs text-gray-400">
        {payload.tenant.name} · Perfil público
      </footer>
    </div>
  )
}

export default ProfileThemeThree
