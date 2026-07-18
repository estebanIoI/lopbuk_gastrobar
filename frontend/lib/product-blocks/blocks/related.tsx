'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { TextField, NumberField, Hint, fmtDefault } from '../shared'
import { cldImg } from '@/utils/img'

export const RelatedSchema = z.object({
  title: z.string().default('También te puede gustar'),
  maxItems: z.coerce.number().catch(4).default(4),
}).passthrough().catch({ title: 'También te puede gustar', maxItems: 4 })

type S = z.infer<typeof RelatedSchema>

function Render({ settings, ctx, tv, tx, tmuted }: BlockRenderProps<S>) {
  const items = (ctx.relatedProducts || []).slice(0, Number(settings.maxItems) || 4)
  if (items.length === 0) return null
  const fmt = ctx.formatPrice || fmtDefault
  return (
    <div>
      <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(String(settings.title || 'También te puede gustar'))}</h3>
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

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Título" value={settings.title} onChange={v => set('title', v)} />
      <NumberField label="Máximo a mostrar" value={settings.maxItems} onChange={v => set('maxItems', v)}
        min={2} max={8} fallback={4} />
      <Hint>Reemplaza la sección nativa de relacionados (misma categoría/marca).</Hint>
    </div>
  )
}

export const relatedBlock: BlockDefinition<S> = {
  type: 'related',
  label: '🛍️ Relacionados',
  desc: 'Productos de la misma categoría/marca',
  category: 'contenido',
  schema: RelatedSchema,
  Render,
  Editor,
}
