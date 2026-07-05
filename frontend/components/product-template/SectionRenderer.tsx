'use client'

/**
 * Renderer JSON-driven de las plantillas de producto (tipo Shopify).
 * Recibe el array de secciones { id, type, settings, order, visible } y las
 * renderiza con datos dinámicos del producto ({{product.*}}) + page_content.
 * Un solo código de render: la tienda pública Y la vista previa del editor
 * usan este mismo componente.
 */

import { useState, useEffect } from 'react'
import { resolveTemplateVars, type TemplateVarsContext } from '@/lib/template-vars'
import { cldImg } from '@/utils/img'

// ── Tipos (espejo del contrato backend section-types.ts) ───────────────────────

export type SectionType =
  | 'benefits' | 'rich_text' | 'video' | 'faq' | 'testimonials'
  | 'comparison' | 'urgency' | 'guarantees' | 'image_banner' | 'related'

export interface TemplateSection {
  id: string
  type: SectionType
  settings: Record<string, any>
  order: number
  visible: boolean
}

export interface ProductPageContent {
  videoUrl?: string
  benefits?: Array<{ icon?: string; text: string }>
  faqs?: Array<{ q: string; a: string }>
  testimonials?: Array<{ name?: string; text: string; rating?: number; imageUrl?: string }>
  comparisonRows?: Array<{ feature: string; ours: string; theirs: string }>
}

export interface TemplateReview {
  rating: number
  text: string
  author?: string
  date?: string
  photo?: string | null
}

export interface TemplateRelatedProduct {
  id: string | number
  name: string
  price: number
  imageUrl?: string | null
}

export interface SectionRendererCtx extends TemplateVarsContext {
  pageContent?: ProductPageContent | null
  reviews?: TemplateReview[]
  relatedProducts?: TemplateRelatedProduct[]
  onRelatedClick?: (id: string) => void
  onCta?: () => void
  formatPrice?: (v: number) => string
  /** true = fondo claro (tema de la tienda) */
  isLightBg?: boolean
  accentColor?: string
}

const fmtDefault = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Markdown-lite: **negrita**, saltos de línea y viñetas "- " */
function MdLite({ text, className }: { text: string; className?: string }) {
  const lines = String(text || '').split('\n')
  return (
    <div className={className}>
      {lines.map((line, li) => {
        const isBullet = /^\s*[-•]\s+/.test(line)
        const content = isBullet ? line.replace(/^\s*[-•]\s+/, '') : line
        const parts = content.split(/(\*\*[^*]+\*\*)/g).map((chunk, ci) =>
          chunk.startsWith('**') && chunk.endsWith('**')
            ? <strong key={ci}>{chunk.slice(2, -2)}</strong>
            : chunk
        )
        return isBullet
          ? <div key={li} className="flex gap-2 items-start"><span className="mt-0.5">•</span><span>{parts}</span></div>
          : <p key={li} className={line.trim() === '' ? 'h-2' : ''}>{parts}</p>
      })}
    </div>
  )
}

/** Convierte URL de YouTube/TikTok/MP4 al embed correcto */
function videoEmbed(url: string): { kind: 'youtube' | 'tiktok' | 'mp4' | 'none'; src: string } {
  const u = String(url || '').trim()
  if (!u) return { kind: 'none', src: '' }
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/)
  if (yt) return { kind: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}` }
  const tk = u.match(/tiktok\.com\/.*\/video\/(\d+)/)
  if (tk) return { kind: 'tiktok', src: `https://www.tiktok.com/embed/v2/${tk[1]}` }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { kind: 'mp4', src: u }
  return { kind: 'none', src: '' }
}

// ── Secciones ───────────────────────────────────────────────────────────────────

function BenefitsSection({ s, ctx, tv, tx, tmuted }: SectionProps) {
  const items: Array<{ icon?: string; text: string }> = [
    ...(Array.isArray(s.settings.items) ? s.settings.items : []),
    ...((ctx.pageContent?.benefits) || []),
  ]
  if (items.length === 0) return null
  const cols = Number(s.settings.columns) === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <div>
      {s.settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(s.settings.title)}</h3>}
      <div className={`grid grid-cols-1 ${cols} gap-3`}>
        {items.map((b, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${ctx.isLightBg ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
            <span className="text-xl leading-none shrink-0">{b.icon || '✓'}</span>
            <span className={`text-sm ${tmuted}`}>{tv(b.text)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RichTextSection({ s, ctx, tv, tx, tmuted }: SectionProps) {
  const img = s.settings.imageUrl ? String(s.settings.imageUrl) : ''
  const pos = s.settings.imagePosition || 'right'
  const body = <MdLite text={tv(String(s.settings.body || ''))} className={`text-sm leading-relaxed space-y-1 ${tmuted}`} />
  return (
    <div>
      {s.settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(s.settings.title)}</h3>}
      {img ? (
        <div className={`flex flex-col gap-5 ${pos === 'left' ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}>
          <div className="flex-1 min-w-0">{body}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cldImg(img, 600)} alt={tv(String(s.settings.title || ''))} loading="lazy" decoding="async"
            className="sm:w-2/5 w-full rounded-xl object-cover" />
        </div>
      ) : body}
    </div>
  )
}

function VideoSection({ s, tv, tx, ctx }: SectionProps) {
  const url = String(s.settings.url || ctx.pageContent?.videoUrl || '')
  const { kind, src } = videoEmbed(url)
  if (kind === 'none') return null
  return (
    <div>
      {s.settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(s.settings.title)}</h3>}
      {kind === 'mp4' ? (
        <video src={src} controls playsInline preload="metadata" className="w-full rounded-xl max-h-[480px] bg-black" />
      ) : (
        <div className={`relative w-full overflow-hidden rounded-xl ${kind === 'tiktok' ? 'max-w-[340px] mx-auto aspect-[9/16]' : 'aspect-video'}`}>
          <iframe src={src} loading="lazy" allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="absolute inset-0 w-full h-full border-0" />
        </div>
      )}
    </div>
  )
}

function FaqSection({ s, ctx, tv, tx, tmuted }: SectionProps) {
  const items: Array<{ q: string; a: string }> = [
    ...(Array.isArray(s.settings.items) ? s.settings.items : []),
    ...((ctx.pageContent?.faqs) || []),
  ]
  if (items.length === 0) return null
  return (
    <div>
      <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(String(s.settings.title || 'Preguntas frecuentes'))}</h3>
      <div className="space-y-2">
        {items.map((f, i) => (
          <details key={i} className={`group rounded-xl border ${ctx.isLightBg ? 'border-black/10' : 'border-white/10'}`}>
            <summary className={`cursor-pointer list-none px-4 py-3 text-sm font-medium flex items-center justify-between gap-2 ${tx}`}>
              {tv(f.q)}
              <span className="transition-transform group-open:rotate-45 text-lg leading-none shrink-0">+</span>
            </summary>
            <div className={`px-4 pb-4 text-sm leading-relaxed ${tmuted}`}>{tv(f.a)}</div>
          </details>
        ))}
      </div>
    </div>
  )
}

function TestimonialsSection({ s, ctx, tv, tx, tmuted }: SectionProps) {
  const max = Number(s.settings.maxItems) || 6
  const manual = (ctx.pageContent?.testimonials || []).map(t => ({
    rating: t.rating || 5, text: t.text, author: t.name, photo: t.imageUrl || null, date: undefined as string | undefined,
  }))
  const items = [...manual, ...(ctx.reviews || [])].slice(0, max)
  if (items.length === 0) return null
  return (
    <div>
      <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(String(s.settings.title || 'Opiniones'))}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((r, i) => (
          <div key={i} className={`p-4 rounded-xl border ${ctx.isLightBg ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
            <div className="text-amber-400 text-sm mb-1.5">{'★'.repeat(Math.max(1, Math.min(5, r.rating)))}<span className="opacity-25">{'★'.repeat(5 - Math.max(1, Math.min(5, r.rating)))}</span></div>
            <p className={`text-sm leading-relaxed ${tmuted}`}>{r.text}</p>
            <div className="flex items-center gap-2 mt-3">
              {r.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cldImg(r.photo, 100)} alt="" loading="lazy" className="w-7 h-7 rounded-full object-cover" />
              )}
              <span className={`text-xs font-medium ${tx}`}>{r.author || 'Cliente verificado'}</span>
              {r.date && <span className={`text-[10px] ${tmuted}`}>· {r.date}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ComparisonSection({ s, ctx, tv, tx, tmuted }: SectionProps) {
  const rows: Array<{ feature: string; ours: string; theirs: string }> = [
    ...(Array.isArray(s.settings.rows) ? s.settings.rows : []),
    ...((ctx.pageContent?.comparisonRows) || []),
  ]
  if (rows.length === 0) return null
  const border = ctx.isLightBg ? 'border-black/10' : 'border-white/10'
  return (
    <div>
      {s.settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(s.settings.title)}</h3>}
      <div className={`overflow-x-auto rounded-xl border ${border}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${border}`}>
              <th className={`text-left px-4 py-2.5 font-medium ${tmuted}`}></th>
              <th className={`text-left px-4 py-2.5 font-semibold ${tx}`} style={{ color: ctx.accentColor }}>{tv(String(s.settings.ourLabel || 'Nosotros'))}</th>
              <th className={`text-left px-4 py-2.5 font-medium ${tmuted}`}>{tv(String(s.settings.theirLabel || 'Otros'))}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i < rows.length - 1 ? `border-b ${border}` : ''}>
                <td className={`px-4 py-2.5 ${tmuted}`}>{tv(r.feature)}</td>
                <td className={`px-4 py-2.5 font-medium ${tx}`}>{tv(r.ours)}</td>
                <td className={`px-4 py-2.5 ${tmuted}`}>{tv(r.theirs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UrgencySection({ s, ctx, tv }: SectionProps) {
  const [now, setNow] = useState(() => Date.now())
  const deadline = s.settings.deadline ? new Date(String(s.settings.deadline)).getTime() : null
  useEffect(() => {
    if (!deadline || deadline < Date.now()) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadline])

  const showStock = s.settings.showStock !== false
  const stock = ctx.product?.stock
  const stockOk = showStock && stock != null && stock > 0
  let countdown = ''
  if (deadline && deadline > now) {
    const secs = Math.floor((deadline - now) / 1000)
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60), sg = secs % 60
    countdown = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sg}s`
  }
  if (!stockOk && !countdown && !s.settings.message) return null
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
      <span className="text-sm font-semibold text-amber-500">
        {tv(String(s.settings.message || (stockOk ? `🔥 Quedan {{product.stock}} unidades` : 'Oferta por tiempo limitado')))}
      </span>
      {countdown && <span className="text-sm font-bold tabular-nums text-amber-500">⏰ {countdown}</span>}
    </div>
  )
}

function GuaranteesSection({ s, ctx, tv, tx, tmuted }: SectionProps) {
  const items: Array<{ icon?: string; title: string; text?: string }> =
    Array.isArray(s.settings.items) ? s.settings.items : []
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((g, i) => (
        <div key={i} className={`p-4 rounded-xl border text-center ${ctx.isLightBg ? 'border-black/10' : 'border-white/10'}`}>
          <div className="text-2xl mb-1.5">{g.icon || '🛡️'}</div>
          <p className={`text-sm font-semibold ${tx}`}>{tv(g.title)}</p>
          {g.text && <p className={`text-xs mt-1 ${tmuted}`}>{tv(g.text)}</p>}
        </div>
      ))}
    </div>
  )
}

function ImageBannerSection({ s, ctx, tv }: SectionProps) {
  const img = String(s.settings.imageUrl || '')
  if (!img && !s.settings.title) return null
  return (
    <div className="relative rounded-2xl overflow-hidden min-h-[180px] flex items-center justify-center bg-black/40">
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cldImg(img, 1200)} alt={tv(String(s.settings.title || ''))} loading="lazy" decoding="async"
          className="absolute inset-0 w-full h-full object-cover" />
      )}
      {(s.settings.title || s.settings.subtitle || s.settings.ctaText) && (
        <div className="relative z-10 text-center px-6 py-10 bg-black/40 w-full">
          {s.settings.title && <h3 className="text-xl sm:text-2xl font-bold text-white">{tv(s.settings.title)}</h3>}
          {s.settings.subtitle && <p className="text-sm text-white/80 mt-1.5">{tv(s.settings.subtitle)}</p>}
          {s.settings.ctaText && (
            <button onClick={ctx.onCta} className="mt-4 px-6 py-2.5 rounded-full text-sm font-semibold text-black bg-white hover:bg-white/90 transition-colors">
              {tv(s.settings.ctaText)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function RelatedSection({ s, ctx, tv, tx, tmuted }: SectionProps) {
  const items = (ctx.relatedProducts || []).slice(0, Number(s.settings.maxItems) || 4)
  if (items.length === 0) return null
  const fmt = ctx.formatPrice || fmtDefault
  return (
    <div>
      <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(String(s.settings.title || 'También te puede gustar'))}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map(rp => (
          <button key={String(rp.id)} onClick={() => ctx.onRelatedClick?.(String(rp.id))}
            className={`group text-left rounded-xl overflow-hidden border transition-colors ${ctx.isLightBg ? 'border-black/10 hover:border-black/25' : 'border-white/10 hover:border-white/25'}`}>
            <div className="aspect-square bg-black/20 overflow-hidden">
              {rp.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cldImg(rp.imageUrl, 400)} alt={rp.name} loading="lazy" decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              )}
            </div>
            <div className="p-2.5">
              <p className={`text-xs font-medium truncate ${tx}`}>{rp.name}</p>
              <p className={`text-sm font-semibold mt-0.5 ${tmuted}`}>{fmt(rp.price)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Renderer principal ─────────────────────────────────────────────────────────

interface SectionProps {
  s: TemplateSection
  ctx: SectionRendererCtx
  tv: (t: string) => string
  tx: string
  tmuted: string
}

function renderSection(props: SectionProps) {
  switch (props.s.type) {
    case 'benefits':     return <BenefitsSection {...props} />
    case 'rich_text':    return <RichTextSection {...props} />
    case 'video':        return <VideoSection {...props} />
    case 'faq':          return <FaqSection {...props} />
    case 'testimonials': return <TestimonialsSection {...props} />
    case 'comparison':   return <ComparisonSection {...props} />
    case 'urgency':      return <UrgencySection {...props} />
    case 'guarantees':   return <GuaranteesSection {...props} />
    case 'image_banner': return <ImageBannerSection {...props} />
    case 'related':      return <RelatedSection {...props} />
    default:             return null // tipo futuro desconocido: se ignora con gracia
  }
}

export function SectionRenderer({ sections, ctx }: { sections: TemplateSection[]; ctx: SectionRendererCtx }) {
  if (!sections || sections.length === 0) return null
  // Colorimetría: acento de marca con fallback (regla brain/colorimetria)
  const accent = ctx.accentColor || 'var(--brand-green, #00833E)'
  const tx = ctx.isLightBg ? 'text-black' : 'text-white'
  const tmuted = ctx.isLightBg ? 'text-black/60' : 'text-white/60'
  const tv = (t: string) => resolveTemplateVars(t, ctx)

  return (
    <div className="space-y-10">
      {sections
        .filter(s => s.visible !== false)
        .sort((a, b) => a.order - b.order)
        .map(s => (
          <section key={s.id} data-template-section={s.type}>
            {renderSection({ s, ctx: { ...ctx, accentColor: accent }, tv, tx, tmuted })}
          </section>
        ))}
    </div>
  )
}
