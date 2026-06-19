'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ArrowRight, Star, Heart, Bookmark, Share2, MessageCircle,
  Phone, Mail, MapPin, Linkedin, Truck, Code, Briefcase, Zap, Shield, Clock,
  Users, Award, Headphones, Rocket, CheckCircle2,
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { theme4Api, type Theme4Config, type Service, type Stat, type Step, type TeamMember, type Testimonial } from './types'

const ICONS: Record<string, React.ElementType> = {
  truck: Truck, code: Code, briefcase: Briefcase, zap: Zap, shield: Shield, clock: Clock,
  users: Users, award: Award, headphones: Headphones, rocket: Rocket, star: Star, check: CheckCircle2,
}
function Icon({ name, className }: { name?: string; className?: string }) {
  const C = ((name && ICONS[name.toLowerCase()]) || Zap) as React.ComponentType<{ className?: string }>
  return <C className={className} />
}

// ── HERO ──────────────────────────────────────────────────────────────────────
export function Theme4Hero({ config, name }: { config: Theme4Config; name: string }) {
  const accent = config.accentColor || '#0ea5e9'
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  return (
    <section className="relative min-h-[78vh] flex items-center justify-center text-white overflow-hidden">
      <div className="absolute inset-0 bg-slate-900">
        {config.heroImageUrl && <img src={config.heroImageUrl} alt="" className="w-full h-full object-cover opacity-60" />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}cc, #0f172aee)` }} />
      </div>
      <div className="relative z-10 text-center px-4 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">{config.heroTitle || name}</h1>
        {config.heroSubtitle && <p className="mt-4 text-lg sm:text-xl text-white/80">{config.heroSubtitle}</p>}
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <button onClick={() => scrollTo('servicios')} className="px-6 py-3 rounded-full bg-white/15 backdrop-blur border border-white/25 font-medium inline-flex items-center gap-2 hover:bg-white/25">
            Ver servicios <ChevronDown className="w-4 h-4" />
          </button>
          {(config.ctaLabel || config.ctaUrl) && (
            <a href={config.ctaUrl || '#contacto'} onClick={e => { if (!config.ctaUrl) { e.preventDefault(); scrollTo('contacto') } }}
              className="px-6 py-3 rounded-full font-semibold inline-flex items-center gap-2 text-slate-900" style={{ background: '#fff' }}>
              {config.ctaLabel || 'Cotizar'} <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

// ── STATS BANNER ────────────────────────────────────────────────────────────────
export function StatsBanner({ stats, accent }: { stats: Stat[]; accent: string }) {
  if (!stats.length) return null
  return (
    <section className="py-8" style={{ background: accent }}>
      <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-white text-center">
        {stats.map(s => (
          <div key={s.id}>
            <div className="flex justify-center mb-1"><Icon name={s.icon} className="w-6 h-6" /></div>
            <p className="text-2xl sm:text-3xl font-extrabold">{s.value}</p>
            <p className="text-sm text-white/80">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── SERVICIOS ────────────────────────────────────────────────────────────────
export function ServicesGrid({ services, accent }: { services: Service[]; accent: string }) {
  if (!services.length) return null
  return (
    <section id="servicios" className="py-14 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-slate-900">Servicios</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map(s => (
            <div key={s.id} className={`rounded-2xl border p-6 transition hover:shadow-lg ${s.isFeatured ? 'border-2' : 'border-gray-100'}`} style={s.isFeatured ? { borderColor: accent } : undefined}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4" style={{ background: accent }}><Icon name={s.icon} className="w-6 h-6" /></div>
              <h3 className="font-bold text-lg text-slate-900">{s.title}</h3>
              {s.description && <p className="text-slate-600 text-sm mt-1">{s.description}</p>}
              {s.priceLabel && <p className="mt-3 font-semibold" style={{ color: accent }}>{s.priceLabel}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── PROCESO ──────────────────────────────────────────────────────────────────
export function ProcessSteps({ steps, accent }: { steps: Step[]; accent: string }) {
  if (!steps.length) return null
  const sorted = [...steps].sort((a, b) => a.stepNumber - b.stepNumber)
  return (
    <section className="py-14 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-slate-900">¿Cómo trabajamos?</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sorted.map((s, i) => (
            <div key={s.id} className="text-center">
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ background: accent }}>{s.stepNumber || i + 1}</div>
              <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
              {s.description && <p className="text-sm text-slate-600 mt-1">{s.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── EQUIPO ───────────────────────────────────────────────────────────────────
export function TeamGrid({ team }: { team: TeamMember[] }) {
  if (!team.length) return null
  return (
    <section className="py-14 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-slate-900">Nuestro equipo</h2>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {team.map(m => (
            <div key={m.id} className="text-center">
              <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-gray-100">
                {m.photoUrl ? <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-300">{m.name.charAt(0)}</div>}
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">{m.name}</h3>
              {m.role && <p className="text-sm text-slate-500">{m.role}</p>}
              {m.linkedinUrl && <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex mt-1 text-sky-600"><Linkedin className="w-4 h-4" /></a>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── TESTIMONIOS ──────────────────────────────────────────────────────────────
export function TestimonialsCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const [idx, setIdx] = useState(0)
  if (!testimonials.length) return null
  const t = testimonials[idx % testimonials.length]
  return (
    <section className="py-14 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-8">Lo que dicen nuestros clientes</h2>
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <div className="flex justify-center gap-0.5 mb-3">
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-5 h-5 ${i < t.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />)}
          </div>
          <p className="text-lg text-slate-700 italic">“{t.text}”</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {t.avatarUrl && <img src={t.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />}
            <div className="text-left"><p className="font-semibold text-slate-900 text-sm">{t.author}</p>{t.role && <p className="text-xs text-slate-500">{t.role}</p>}</div>
          </div>
        </div>
        {testimonials.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {testimonials.map((_, i) => <button key={i} onClick={() => setIdx(i)} className={`w-2.5 h-2.5 rounded-full ${i === idx ? 'bg-slate-700' : 'bg-gray-300'}`} />)}
          </div>
        )}
      </div>
    </section>
  )
}

// ── CONTACTO ─────────────────────────────────────────────────────────────────
export function ContactSection({ config, accent }: { config: Theme4Config; accent: string }) {
  const wa = config.whatsapp ? `https://wa.me/${config.whatsapp.replace(/[^\d]/g, '')}` : null
  return (
    <section id="contacto" className="py-14 bg-white">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-slate-900">Contáctanos / Cotiza</h2>
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {config.phone && <a href={`tel:${config.phone}`} className="flex items-center gap-3 text-slate-700"><Phone className="w-5 h-5" style={{ color: accent }} /> {config.phone}</a>}
            {config.email && <a href={`mailto:${config.email}`} className="flex items-center gap-3 text-slate-700"><Mail className="w-5 h-5" style={{ color: accent }} /> {config.email}</a>}
            {config.address && <p className="flex items-center gap-3 text-slate-700"><MapPin className="w-5 h-5" style={{ color: accent }} /> {config.address}</p>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-medium w-fit" style={{ background: '#25D366' }}><MessageCircle className="w-4 h-4" /> WhatsApp</a>}
          </div>
          {config.mapUrl ? (
            <div className="rounded-xl overflow-hidden border h-56">
              <iframe src={config.mapUrl} className="w-full h-full" loading="lazy" />
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); if (wa) window.open(wa, '_blank') }} className="space-y-2">
              <input placeholder="Tu nombre" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Email o teléfono" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <textarea placeholder="¿Qué necesitas cotizar?" className="w-full border rounded-lg px-3 py-2 text-sm h-20" />
              <button className="px-5 py-2.5 rounded-lg text-white font-medium" style={{ background: accent }}>Enviar</button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

// ── COMMUNITY BAR ────────────────────────────────────────────────────────────
export function CommunityBar({ slug, accent, initial }: { slug: string; accent: string; initial: { likes: number; saves: number; liked: boolean; saved: boolean } }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [s, setS] = useState(initial)

  const react = async (type: 'like' | 'save') => {
    if (!isAuthenticated) { router.push(`/login?next=/t/${slug}`); return }
    try {
      const r = await theme4Api.react(slug, type)
      setS(prev => ({ ...prev, likes: r.likes, saves: r.saves, liked: type === 'like' ? r.active : prev.liked, saved: type === 'save' ? r.active : prev.saved }))
    } catch { /* */ }
  }
  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try { if (navigator.share) await navigator.share({ url }); else { await navigator.clipboard.writeText(url) } } catch { /* */ }
  }

  return (
    <section className="py-8 bg-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 flex items-center justify-center gap-6 flex-wrap">
        <button onClick={() => react('like')} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${s.liked ? 'bg-rose-600' : 'bg-white/10 hover:bg-white/20'}`}>
          <Heart className={`w-5 h-5 ${s.liked ? 'fill-white' : ''}`} /> {s.likes}
        </button>
        <button onClick={() => react('save')} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${s.saved ? 'bg-amber-500' : 'bg-white/10 hover:bg-white/20'}`}>
          <Bookmark className={`w-5 h-5 ${s.saved ? 'fill-white' : ''}`} /> {s.saves}
        </button>
        <a href="#contacto" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20"><MessageCircle className="w-5 h-5" /> Dejar reseña</a>
        <button onClick={share} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20"><Share2 className="w-5 h-5" /> Compartir</button>
        <a href="/comunidad" className="text-sm text-white/70 hover:text-white underline">Ver Comunidad Daimuz →</a>
      </div>
    </section>
  )
}

// ── TECH STACK (software) ────────────────────────────────────────────────────
export function TechStack({ groups, accent }: { groups: { label: string; items: string[] }[]; accent: string }) {
  const has = groups.some(g => g.items.length)
  if (!has) return null
  return (
    <section className="py-14 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-8">Stack tecnológico</h2>
        <div className="space-y-4">
          {groups.filter(g => g.items.length).map(g => (
            <div key={g.label} className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="w-28 font-semibold text-slate-700">{g.label}:</span>
              <div className="flex flex-wrap gap-2">
                {g.items.map(it => <span key={it} className="px-3 py-1 rounded-full text-sm font-medium text-white" style={{ background: accent }}>{it}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
