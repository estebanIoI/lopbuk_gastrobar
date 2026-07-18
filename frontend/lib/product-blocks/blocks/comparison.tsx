'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { ListEditor, TextField } from '../shared'

export const ComparisonSchema = z.object({
  title: z.string().default(''),
  ourLabel: z.string().default('Nosotros'),
  theirLabel: z.string().default('Otros'),
  rows: z.array(
    z.object({
      feature: z.string().default(''),
      ours: z.string().default(''),
      theirs: z.string().default(''),
    }).passthrough()
  ).catch([]).default([]),
}).passthrough().catch({ title: '', ourLabel: 'Nosotros', theirLabel: 'Otros', rows: [] })

type S = z.infer<typeof ComparisonSchema>

function Render({ settings, ctx, tv, tx, tmuted }: BlockRenderProps<S>) {
  const rows: Array<{ feature: string; ours: string; theirs: string }> = [
    ...(Array.isArray(settings.rows) ? settings.rows : []),
    ...((ctx.pageContent?.comparisonRows) || []),
  ]
  if (rows.length === 0) return null
  const border = ctx.isLightBg ? 'border-black/10' : 'border-white/10'
  return (
    <div>
      {settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(settings.title)}</h3>}
      <div className={`overflow-x-auto rounded-xl border ${border}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${border}`}>
              <th className={`text-left px-4 py-2.5 font-medium ${tmuted}`}></th>
              <th className={`text-left px-4 py-2.5 font-semibold ${tx}`} style={{ color: ctx.accentColor }}>{tv(String(settings.ourLabel || 'Nosotros'))}</th>
              <th className={`text-left px-4 py-2.5 font-medium ${tmuted}`}>{tv(String(settings.theirLabel || 'Otros'))}</th>
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

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Título" value={settings.title} onChange={v => set('title', v)} />
      <TextField label="Etiqueta de tu producto" value={settings.ourLabel} onChange={v => set('ourLabel', v)} />
      <TextField label="Etiqueta de la competencia" value={settings.theirLabel} onChange={v => set('theirLabel', v)} />
      <ListEditor items={settings.rows || []} onChange={v => set('rows', v)} addLabel="Agregar fila"
        fields={[
          { key: 'feature', label: 'Característica' },
          { key: 'ours', label: 'Tu producto (ej: ✓ Incluida)' },
          { key: 'theirs', label: 'Otros (ej: ✗)' },
        ]} />
    </div>
  )
}

export const comparisonBlock: BlockDefinition<S> = {
  type: 'comparison',
  label: '⚖️ Comparación',
  desc: 'Tu producto vs la competencia',
  category: 'confianza',
  schema: ComparisonSchema,
  Render,
  Editor,
}
