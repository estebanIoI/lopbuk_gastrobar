'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { TextField, NumberField, Hint } from '../shared'
import { cldImg } from '@/utils/img'

export const TestimonialsSchema = z.object({
  title: z.string().default('Opiniones'),
  maxItems: z.coerce.number().catch(6).default(6),
}).passthrough().catch({ title: 'Opiniones', maxItems: 6 })

type S = z.infer<typeof TestimonialsSchema>

interface Item {
  rating: number | null
  text: string
  author?: string
  date?: string
  photo?: string | null
  verified: boolean
}

/** Estrellas solo cuando hay calificación real. Sin rating → sin estrellas. */
function Stars({ rating }: { rating: number }) {
  const n = Math.max(1, Math.min(5, rating))
  return (
    <div className="text-amber-400 text-sm mb-1.5">
      {'★'.repeat(n)}<span className="opacity-25">{'★'.repeat(5 - n)}</span>
    </div>
  )
}

function Render({ settings, ctx, tv, tx, tmuted }: BlockRenderProps<S>) {
  const max = Number(settings.maxItems) || 6

  // Reseñas REALES del producto (orden verificada). Solo estas pueden marcarse.
  const real: Item[] = (ctx.reviews || []).map(r => ({
    rating: typeof r.rating === 'number' ? r.rating : null,
    text: r.text,
    author: r.author,
    date: r.date,
    photo: r.photo ?? null,
    verified: r.verified !== false,
  }))

  // Testimonios MANUALES del comerciante: nunca verificados, y sin estrellas
  // inventadas — si no puso calificación, no se muestra ninguna.
  const manual: Item[] = (ctx.pageContent?.testimonials || []).map(t => ({
    rating: typeof t.rating === 'number' ? t.rating : null,
    text: t.text,
    author: t.name,
    date: undefined,
    photo: t.imageUrl || null,
    verified: false,
  }))

  const items = [...real, ...manual].slice(0, max) // verificadas primero
  if (items.length === 0) return null

  return (
    <div>
      <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(String(settings.title || 'Opiniones'))}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((r, i) => (
          <div key={i} className={`p-4 rounded-xl border ${ctx.isLightBg ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
            {r.rating != null && <Stars rating={r.rating} />}
            <p className={`text-sm leading-relaxed ${tmuted}`}>{r.text}</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {r.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cldImg(r.photo, 100)} alt="" loading="lazy" className="w-7 h-7 rounded-full object-cover" />
              )}
              <span className={`text-xs font-medium ${tx}`}>{r.author || 'Cliente'}</span>
              {r.verified ? (
                <span className="text-[10px] font-medium text-emerald-500 inline-flex items-center gap-0.5">
                  ✓ Compra verificada
                </span>
              ) : (
                <span className={`text-[10px] ${tmuted}`}>· Testimonio</span>
              )}
              {r.date && <span className={`text-[10px] ${tmuted}`}>· {r.date}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Título" value={settings.title} onChange={v => set('title', v)} />
      <NumberField label="Máximo a mostrar" value={settings.maxItems} onChange={v => set('maxItems', v)}
        min={1} max={12} fallback={6} />
      <Hint>
        Muestra primero las reseñas APROBADAS del producto, marcadas como “Compra verificada”.
        Los testimonios manuales del contenido de página se muestran después, etiquetados como
        “Testimonio”: solo las reseñas de compras reales pueden aparecer como verificadas.
      </Hint>
    </div>
  )
}

export const testimonialsBlock: BlockDefinition<S> = {
  type: 'testimonials',
  label: '⭐ Testimonios',
  desc: 'Reseñas verificadas del producto + testimonios manuales',
  category: 'confianza',
  schema: TestimonialsSchema,
  Render,
  Editor,
}
