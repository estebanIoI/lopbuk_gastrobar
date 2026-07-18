'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { ListEditor, TextField, SelectField } from '../shared'

export const BenefitsSchema = z.object({
  title: z.string().default(''),
  columns: z.coerce.number().catch(2).default(2),
  items: z.array(
    z.object({ icon: z.string().default(''), text: z.string().default('') }).passthrough()
  ).catch([]).default([]),
}).passthrough().catch({ title: '', columns: 2, items: [] })

type S = z.infer<typeof BenefitsSchema>

function Render({ settings, ctx, tv, tx, tmuted }: BlockRenderProps<S>) {
  const items: Array<{ icon?: string; text: string }> = [
    ...(Array.isArray(settings.items) ? settings.items : []),
    ...((ctx.pageContent?.benefits) || []),
  ]
  if (items.length === 0) return null
  const cols = Number(settings.columns) === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <div>
      {settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(settings.title)}</h3>}
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

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Título" value={settings.title} onChange={v => set('title', v)} />
      <SelectField label="Columnas" value={settings.columns ?? 2} onChange={v => set('columns', Number(v))}
        options={[{ value: '2', label: '2 columnas' }, { value: '3', label: '3 columnas' }]} />
      <ListEditor items={settings.items || []} onChange={v => set('items', v)} addLabel="Agregar beneficio"
        fields={[{ key: 'icon', label: 'Emoji' }, { key: 'text', label: 'Texto del beneficio' }]} />
    </div>
  )
}

export const benefitsBlock: BlockDefinition<S> = {
  type: 'benefits',
  label: '✓ Beneficios',
  desc: 'Bloques de valor (envío, garantía, calidad)',
  category: 'contenido',
  schema: BenefitsSchema,
  Render,
  Editor,
}
