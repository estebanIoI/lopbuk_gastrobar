'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { ListEditor, TextField, SelectField } from '../shared'

export const FeatureGridSchema = z.object({
  title: z.string().default(''),
  columns: z.coerce.number().catch(3).default(3),
  items: z.array(
    z.object({
      icon: z.string().default(''),
      title: z.string().default(''),
      description: z.string().default(''),
    }).passthrough()
  ).catch([]).default([]),
}).passthrough().catch({ title: '', columns: 3, items: [] })

type S = z.infer<typeof FeatureGridSchema>

function Render({ settings, ctx, tv, tx, tmuted }: BlockRenderProps<S>) {
  const items = Array.isArray(settings.items) ? settings.items.filter(i => i.title || i.description || i.icon) : []
  if (items.length === 0) return null
  const n = Number(settings.columns)
  const cols = n === 2 ? 'sm:grid-cols-2' : n === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'
  return (
    <div>
      {settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(settings.title)}</h3>}
      <div className={`grid grid-cols-1 ${cols} gap-4`}>
        {items.map((f, i) => (
          <div key={i} className={`text-center p-4 rounded-xl border ${ctx.isLightBg ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]'}`}>
            <div className="text-3xl mb-2">{f.icon || '✓'}</div>
            {f.title && <p className={`text-sm font-semibold ${tx}`}>{tv(f.title)}</p>}
            {f.description && <p className={`text-xs mt-1 leading-relaxed ${tmuted}`}>{tv(f.description)}</p>}
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
      <SelectField label="Columnas" value={settings.columns ?? 3} onChange={v => set('columns', Number(v))}
        options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
      <ListEditor items={settings.items || []} onChange={v => set('items', v)} addLabel="Agregar característica"
        fields={[
          { key: 'icon', label: 'Emoji' },
          { key: 'title', label: 'Título' },
          { key: 'description', label: 'Descripción', long: true },
        ]} />
    </div>
  )
}

export const featureGridBlock: BlockDefinition<S> = {
  type: 'feature_grid',
  label: '▦ Características',
  desc: 'Grid de icono + título + descripción',
  category: 'contenido',
  schema: FeatureGridSchema,
  Render,
  Editor,
}
