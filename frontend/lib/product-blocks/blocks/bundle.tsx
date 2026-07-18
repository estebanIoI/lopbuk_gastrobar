'use client'

/**
 * Bundle — "Llévalo junto / Compra este combo" en el PDP.
 *
 * Los bundles NO se guardan en la plantilla: el comerciante los crea en el
 * Bundle Builder y los asigna a productos. Este bloque solo decide DÓNDE y CÓMO
 * se muestran; los combos llegan por ctx.bundles (datos reales: precio, ahorro
 * y stock calculados en backend). Agregar al carrito va por ctx.onAddBundle.
 */

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { TextField, Hint, fmtDefault } from '../shared'
import { cldImg } from '@/utils/img'

export const BundleSchema = z.object({
  title: z.string().default('Llévalo en combo y ahorra'),
  maxBundles: z.coerce.number().catch(3).default(3),
}).passthrough().catch({ title: 'Llévalo en combo y ahorra', maxBundles: 3 })

type S = z.infer<typeof BundleSchema>

function Render({ settings, ctx, tv, tx, tmuted }: BlockRenderProps<S>) {
  const bundles = (ctx.bundles || []).slice(0, Number(settings.maxBundles) || 3)
  if (bundles.length === 0) return null
  const fmt = ctx.formatPrice || fmtDefault
  const border = ctx.isLightBg ? 'border-black/10' : 'border-white/10'

  return (
    <div>
      <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(String(settings.title || 'Llévalo en combo y ahorra'))}</h3>
      <div className="space-y-4">
        {bundles.map(b => (
          <div key={b.id} className={`rounded-2xl border ${border} p-4`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                {b.label && <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1" style={{ background: ctx.accentColor, color: '#fff' }}>{b.label}</span>}
                <p className={`font-semibold text-sm ${tx}`}>{b.name}</p>
              </div>
              {b.savings > 0 && (
                <span className="text-xs font-bold text-emerald-500 whitespace-nowrap">Ahorras {fmt(b.savings)}</span>
              )}
            </div>

            {/* Ítems del combo con el "+" entre ellos */}
            <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
              {b.items.map((it, i) => (
                <div key={it.productId + (it.variantId || '') + i} className="flex items-center gap-1 shrink-0">
                  <div className="w-16 text-center">
                    <div className={`aspect-square rounded-lg overflow-hidden border ${border} bg-black/5`}>
                      {it.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cldImg(it.imageUrl, 160)} alt={it.name} loading="lazy" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <p className={`text-[10px] mt-1 leading-tight line-clamp-2 ${tmuted}`}>
                      {it.quantity > 1 ? `${it.quantity}× ` : ''}{it.name}
                    </p>
                  </div>
                  {i < b.items.length - 1 && <span className={`text-lg font-light ${tmuted}`}>+</span>}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-dashed border-current/10">
              <div>
                <span className={`text-lg font-black ${tx}`}>{fmt(b.bundlePrice)}</span>
                {b.savings > 0 && <span className={`text-sm line-through ml-2 ${tmuted}`}>{fmt(b.regularTotal)}</span>}
              </div>
              <button
                onClick={() => ctx.onAddBundle?.(b.id)}
                disabled={!b.inStock}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100"
                style={{ background: ctx.accentColor }}
              >
                {b.inStock ? 'Agregar combo' : 'Agotado'}
              </button>
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
      <TextField label="Título de la sección" value={settings.title} onChange={v => set('title', v)} />
      <div>
        <label className="text-xs font-medium mb-1 block">Máximo de combos a mostrar</label>
        <input type="number" min={1} max={6} value={settings.maxBundles ?? 3}
          onChange={e => set('maxBundles', Number(e.target.value))}
          className="h-8 text-xs w-24 border rounded-md bg-background px-2" />
      </div>
      <Hint>
        Los combos se crean y asignan en el <b>Bundle Builder</b>. Aquí solo eliges dónde y cuántos
        aparecen. Precio, ahorro y disponibilidad se calculan solos desde los productos reales.
      </Hint>
    </div>
  )
}

export const bundleBlock: BlockDefinition<S> = {
  type: 'bundle',
  label: '🧺 Combos',
  desc: 'Ofrece bundles asignados a este producto (Bundle Builder)',
  category: 'conversion',
  schema: BundleSchema,
  Render,
  Editor,
}
