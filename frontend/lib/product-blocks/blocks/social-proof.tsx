'use client'

/**
 * Social Proof — SOLO datos reales.
 *
 * Muestra señales derivadas de datos verdaderos (ctx.socialProof): espectadores
 * en vivo, vendidos recientes, última compra, stock bajo y valoración verificada.
 * Cada línea aparece únicamente si tiene respaldo real; si no hay ninguna, el
 * bloque no se renderiza. El comerciante elige QUÉ señales mostrar, nunca sus
 * valores — no existe forma de inventar un número.
 */

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps, SocialProofData } from '../types'
import { Hint } from '../shared'

export const SocialProofSchema = z.object({
  showViewers: z.boolean().catch(true).default(true),
  showSold: z.boolean().catch(true).default(true),
  showLastPurchase: z.boolean().catch(true).default(true),
  showLowStock: z.boolean().catch(true).default(true),
  showRating: z.boolean().catch(true).default(true),
  layout: z.enum(['bar', 'stack']).catch('bar').default('bar'),
}).passthrough().catch({
  showViewers: true, showSold: true, showLastPurchase: true, showLowStock: true, showRating: true, layout: 'bar',
})

type S = z.infer<typeof SocialProofSchema>

/** "hace 8 minutos" a partir de un ISO real; null si es muy viejo (>30 días). */
export function timeAgo(iso: string | null): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  const s = Math.floor((Date.now() - then) / 1000)
  if (s < 0) return null
  if (s < 60) return 'hace instantes'
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24); if (d <= 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  return null // demasiado viejo para usarse como prueba social
}

/**
 * Construye las señales visibles desde datos REALES. Función pura (testeable sin
 * DOM): una señal solo entra si el comerciante la activó Y el dato existe.
 */
export function buildSocialProofSignals(
  settings: { showViewers?: boolean; showSold?: boolean; showLastPurchase?: boolean; showLowStock?: boolean; showRating?: boolean },
  sp: SocialProofData | null | undefined,
): Array<{ icon: string; text: string }> {
  const items: Array<{ icon: string; text: string }> = []
  if (!sp) return items
  if (settings.showViewers !== false && sp.viewers > 1) {
    items.push({ icon: '👀', text: `${sp.viewers} personas viendo ahora` })
  }
  if (settings.showSold !== false && sp.soldRecent > 0) {
    items.push({ icon: '🛍️', text: `${sp.soldRecent} vendidos en los últimos ${sp.recentDays} días` })
  }
  if (settings.showLastPurchase !== false) {
    const ago = timeAgo(sp.lastPurchaseAt)
    if (ago) items.push({ icon: '✅', text: `Última compra ${ago}` })
  }
  if (settings.showLowStock !== false && sp.lowStock && sp.stock != null) {
    items.push({ icon: '🔥', text: `Solo quedan ${sp.stock} unidades` })
  }
  if (settings.showRating !== false && sp.avgRating != null && sp.reviewCount > 0) {
    items.push({ icon: '⭐', text: `${sp.avgRating} de 5 · ${sp.reviewCount} reseñas verificadas` })
  }
  return items
}

function Render({ settings, ctx, tx, tmuted }: BlockRenderProps<S>) {
  const sp = ctx.socialProof
  if (!sp) return null
  const items = buildSocialProofSignals(settings, sp)
  if (items.length === 0) return null

  if (settings.layout === 'stack') {
    return (
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${ctx.isLightBg ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
            <span className="text-base leading-none">{it.icon}</span>
            <span className={`text-sm ${tx}`}>{it.text}</span>
          </div>
        ))}
      </div>
    )
  }

  // bar: fila compacta con separadores
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 py-3 rounded-xl border text-center ${ctx.isLightBg ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
      {items.map((it, i) => (
        <span key={i} className={`text-xs font-medium inline-flex items-center gap-1.5 ${tmuted}`}>
          <span className="text-sm">{it.icon}</span>{it.text}
        </span>
      ))}
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  const toggle = (key: string, label: string) => (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={settings[key] !== false} onChange={e => set(key, e.target.checked)} />{label}
    </label>
  )
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {toggle('showViewers', 'Personas viendo')}
        {toggle('showSold', 'Vendidos recientes')}
        {toggle('showLastPurchase', 'Última compra')}
        {toggle('showLowStock', 'Stock bajo')}
        {toggle('showRating', 'Valoración')}
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block">Disposición</label>
        <select value={settings.layout || 'bar'} onChange={e => set('layout', e.target.value)}
          className="w-full h-8 text-xs border rounded-md bg-background px-2">
          <option value="bar">Barra compacta</option>
          <option value="stack">Lista apilada</option>
        </select>
      </div>
      <Hint>
        Todas las señales salen de datos reales: ventas, stock, reseñas aprobadas y espectadores en
        vivo. Si una no tiene datos, no se muestra. No hay contadores simulados.
      </Hint>
    </div>
  )
}

export const socialProofBlock: BlockDefinition<S> = {
  type: 'social_proof',
  label: '📊 Prueba social',
  desc: 'Señales reales: viendo ahora, vendidos, última compra, reseñas',
  category: 'confianza',
  schema: SocialProofSchema,
  Render,
  Editor,
}
