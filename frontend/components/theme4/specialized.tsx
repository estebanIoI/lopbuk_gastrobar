'use client'

import React, { useState } from 'react'
import { Bus, Car, Truck, MapPin, Clock, Users, Wifi, Snowflake, ArrowRight, ExternalLink, X, Code } from 'lucide-react'
import { formatCOP, type Fleet, type RouteItem, type Project } from './types'

const VEHICLE_ICON: Record<string, React.ElementType> = { bus: Bus, van: Truck, car: Car, other: Car }

// ── FLOTA (transporte) ────────────────────────────────────────────────────────
export function FleetShowcase({ fleet, accent }: { fleet: Fleet[]; accent: string }) {
  if (!fleet.length) return null
  return (
    <section className="py-14 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-slate-900">Nuestra flota</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {fleet.map(v => {
            const VIcon = (VEHICLE_ICON[v.vehicleType] || Car) as React.ComponentType<{ className?: string }>
            return (
              <div key={v.id} className="rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition">
                <div className="h-40 bg-gray-100">
                  {v.photoUrl ? <img src={v.photoUrl} alt={v.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><VIcon className="w-12 h-12" /></div>}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">{v.name}</h3>
                    {v.capacity != null && <span className="text-sm text-slate-500 inline-flex items-center gap-1"><Users className="w-4 h-4" /> {v.capacity} pax</span>}
                  </div>
                  {v.features && v.features.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {v.features.map((f, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-slate-600 inline-flex items-center gap-1">
                          {/wifi/i.test(f) ? <Wifi className="w-3 h-3" /> : /a\/c|aire/i.test(f) ? <Snowflake className="w-3 h-3" /> : null}{f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── RUTAS (transporte) ────────────────────────────────────────────────────────
export function RoutesPanel({ routes, accent }: { routes: RouteItem[]; accent: string }) {
  const [q, setQ] = useState('')
  if (!routes.length) return null
  const filtered = routes.filter(r => !q || `${r.origin} ${r.destination}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="py-14 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-slate-900">Rutas y horarios</h2>
        <div className="mt-6 mb-4 max-w-sm mx-auto">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar ruta (origen / destino)…" className="w-full border rounded-full px-4 py-2 text-sm outline-none" />
        </div>
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 inline-flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: accent }} /> {r.origin} → {r.destination}</h3>
                <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {(r.departureTime || r.arrivalTime) && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {r.departureTime}{r.arrivalTime ? ` – ${r.arrivalTime}` : ''}</span>}
                  {r.stops && r.stops.length > 0 && <span>Paradas: {r.stops.join(' · ')}</span>}
                </div>
              </div>
              <div className="text-right">
                {r.price != null && <p className="font-bold text-slate-900">{formatCOP(Number(r.price))}</p>}
                {r.bookingUrl && <a href={r.bookingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-white text-sm font-medium" style={{ background: accent }}>Reservar <ArrowRight className="w-3.5 h-3.5" /></a>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── PROYECTOS (software) ──────────────────────────────────────────────────────
export function ProjectsPortfolio({ projects, accent }: { projects: Project[]; accent: string }) {
  const [open, setOpen] = useState<Project | null>(null)
  if (!projects.length) return null
  return (
    <section className="py-14 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-slate-900">Proyectos</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map(p => (
            <button key={p.id} onClick={() => setOpen(p)} className="text-left rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition group">
              <div className="h-44 bg-gray-100 overflow-hidden">
                {p.screenshotUrls?.[0] ? <img src={p.screenshotUrls[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Code className="w-10 h-10" /></div>}
              </div>
              <div className="p-4">
                {p.category && <span className="text-[11px] uppercase tracking-wide text-slate-400">{p.category}</span>}
                <h3 className="font-bold text-slate-900">{p.title}</h3>
                {p.techStack && p.techStack.length > 0 && <p className="text-xs text-slate-500 mt-1 truncate">{p.techStack.join(' · ')}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setOpen(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="relative">
              {open.screenshotUrls?.[0] && <img src={open.screenshotUrls[0]} alt={open.title} className="w-full max-h-72 object-cover" />}
              <button onClick={() => setOpen(null)} className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-1.5"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {open.category && <span className="text-xs uppercase tracking-wide text-slate-400">{open.category}</span>}
              <h3 className="text-xl font-bold text-slate-900">{open.title}</h3>
              {open.description && <p className="text-slate-600 mt-2">{open.description}</p>}
              {open.techStack && open.techStack.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {open.techStack.map(t => <span key={t} className="px-2.5 py-0.5 rounded-full text-xs text-white" style={{ background: accent }}>{t}</span>)}
                </div>
              )}
              {open.screenshotUrls && open.screenshotUrls.length > 1 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {open.screenshotUrls.slice(1).map((s, i) => <img key={i} src={s} alt="" className="w-full rounded-lg" />)}
                </div>
              )}
              <div className="mt-5 flex gap-2">
                {open.caseStudyUrl && <a href={open.caseStudyUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg text-white font-medium inline-flex items-center gap-1.5" style={{ background: accent }}>Ver caso <ArrowRight className="w-4 h-4" /></a>}
                {open.liveUrl && <a href={open.liveUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-gray-100 text-slate-700 font-medium inline-flex items-center gap-1.5">Live demo <ExternalLink className="w-4 h-4" /></a>}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
