'use client'

/**
 * Urgencia — SOLO datos reales.
 *
 * Este bloque no expone ningún setting que permita inventar prueba social
 * ("N personas viendo", "N vendidos hoy"). Muestra stock real del producto y/o
 * una cuenta regresiva real fijada por el comerciante, y si no hay nada real
 * que mostrar, no se renderiza. Fase 5 (Social Proof Engine) lo alimentará
 * desde pedidos/órdenes/Socket.io — datos reales o nada.
 */

import { useState, useEffect } from 'react'
import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { TextField } from '../shared'
import { Input } from '@/components/ui/input'

export const UrgencySchema = z.object({
  message: z.string().default(''),
  // z.coerce.boolean() NO: Boolean('false') === true. Estricto + catch.
  showStock: z.boolean().catch(true).default(true),
  deadline: z.string().default(''),
}).passthrough().catch({ message: '', showStock: true, deadline: '' })

type S = z.infer<typeof UrgencySchema>

function Render({ settings, ctx, tv }: BlockRenderProps<S>) {
  const [now, setNow] = useState(() => Date.now())
  const deadline = settings.deadline ? new Date(String(settings.deadline)).getTime() : null
  useEffect(() => {
    if (!deadline || deadline < Date.now()) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadline])

  const showStock = settings.showStock !== false
  const stock = ctx.product?.stock
  const stockOk = showStock && stock != null && stock > 0
  let countdown = ''
  if (deadline && deadline > now) {
    const secs = Math.floor((deadline - now) / 1000)
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60), sg = secs % 60
    countdown = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sg}s`
  }
  // Sin stock real y sin countdown real → no se muestra nada.
  if (!stockOk && !countdown && !settings.message) return null
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
      <span className="text-sm font-semibold text-amber-500">
        {tv(String(settings.message || (stockOk ? `🔥 Quedan {{product.stock}} unidades` : 'Oferta por tiempo limitado')))}
      </span>
      {countdown && <span className="text-sm font-bold tabular-nums text-amber-500">⏰ {countdown}</span>}
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Mensaje (usa {{product.stock}})" value={settings.message} onChange={v => set('message', v)} />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={settings.showStock !== false} onChange={e => set('showStock', e.target.checked)} />
        Mostrar solo si hay stock real
      </label>
      <div>
        <label className="text-xs font-medium mb-1 block">Fecha límite (cuenta regresiva, opcional)</label>
        <Input type="datetime-local" value={settings.deadline || ''} onChange={e => set('deadline', e.target.value)} className="h-8 text-xs" />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Solo datos reales: stock del inventario y fecha límite que tú defines. No existen contadores simulados.
      </p>
    </div>
  )
}

export const urgencyBlock: BlockDefinition<S> = {
  type: 'urgency',
  label: '🔥 Urgencia',
  desc: 'Stock real y/o cuenta regresiva',
  category: 'conversion',
  schema: UrgencySchema,
  Render,
  Editor,
}
