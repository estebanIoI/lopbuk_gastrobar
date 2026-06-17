'use client'

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { theme4Api, type Theme4Data } from './types'
import { BoxLoader } from '@/components/box-loader'
import {
  Theme4Hero, StatsBanner, ServicesGrid, ProcessSteps, TeamGrid,
  TestimonialsCarousel, ContactSection, CommunityBar, TechStack,
} from './sections'
import { FleetShowcase, RoutesPanel, ProjectsPortfolio } from './specialized'

/**
 * Theme4Layout — orquesta el Tema 4. Acepta `data` (preview del editor) o hace
 * fetch por `slug`. Renderiza secciones según business_type y flags show_*.
 */
export function Theme4Layout({ slug, data }: { slug: string; data?: Theme4Data }) {
  const [payload, setPayload] = useState<Theme4Data | null>(data ?? null)
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data) { setPayload(data); return }
    let alive = true
    setLoading(true); setError(null)
    theme4Api.getPublic(slug)
      .then(d => { if (alive) setPayload(d) })
      .catch(e => { if (alive) setError(e?.message || 'No disponible') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [slug, data])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900" style={{ ['--dz-bg' as any]: '#0f172a' }}><BoxLoader /></div>
  if (error || !payload) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-2 px-4 text-center">
        <p className="text-gray-700 font-medium">{error || 'Perfil no encontrado'}</p>
        <p className="text-sm text-gray-400">Este perfil aún no está publicado.</p>
      </div>
    )
  }

  const { config, tenant } = payload
  const accent = config.accentColor || '#0ea5e9'
  const isTransport = config.businessType === 'transport'
  const isSoftware = config.businessType === 'software'

  // Stack agregado a partir de los proyectos (no hay tabla dedicada de stack).
  const techGroups = (() => {
    const all = new Set<string>()
    payload.projects.forEach(p => (p.techStack || []).forEach(t => all.add(t)))
    return [{ label: 'Tecnologías', items: Array.from(all) }]
  })()

  return (
    <div className="min-h-screen bg-white">
      <Theme4Hero config={config} name={tenant.name} />
      {config.showStats && <StatsBanner stats={payload.stats} accent={accent} />}
      {config.showServices && <ServicesGrid services={payload.services} accent={accent} />}

      {/* Sección especializada */}
      {isTransport && <><RoutesPanel routes={payload.routes} accent={accent} /><FleetShowcase fleet={payload.fleet} accent={accent} /></>}
      {isSoftware && <><ProjectsPortfolio projects={payload.projects} accent={accent} /><TechStack groups={techGroups} accent={accent} /></>}

      {config.showProcess && <ProcessSteps steps={payload.steps} accent={accent} />}
      {config.showTeam && <TeamGrid team={payload.team} />}
      {config.showTestimonials && <TestimonialsCarousel testimonials={payload.testimonials} />}
      {config.showContact && <ContactSection config={config} accent={accent} />}
      {config.showCommunity && (
        <CommunityBar slug={tenant.slug} accent={accent}
          initial={{ likes: config.likes, saves: config.saves, liked: payload.reaction.liked, saved: payload.reaction.saved }} />
      )}

      <footer className="py-8 text-center text-xs text-gray-400">{tenant.name}</footer>
    </div>
  )
}

export default Theme4Layout
