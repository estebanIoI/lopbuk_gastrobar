'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { ListEditor } from '../shared'

export const GuaranteesSchema = z.object({
  items: z.array(
    z.object({
      icon: z.string().default(''),
      title: z.string().default(''),
      text: z.string().default(''),
    }).passthrough()
  ).catch([]).default([]),
}).passthrough().catch({ items: [] })

type S = z.infer<typeof GuaranteesSchema>

function Render({ settings, ctx, tv, tx, tmuted }: BlockRenderProps<S>) {
  const items: Array<{ icon?: string; title: string; text?: string }> =
    Array.isArray(settings.items) ? settings.items : []
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

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <ListEditor items={settings.items || []} onChange={v => set('items', v)} addLabel="Agregar garantía"
      fields={[{ key: 'icon', label: 'Emoji' }, { key: 'title', label: 'Título' }, { key: 'text', label: 'Descripción' }]} />
  )
}

export const guaranteesBlock: BlockDefinition<S> = {
  type: 'guarantees',
  label: '🛡️ Garantías',
  desc: 'Trust badges de confianza',
  category: 'confianza',
  schema: GuaranteesSchema,
  Render,
  Editor,
}
