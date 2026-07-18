'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { SelectField } from '../shared'

export const SpacerSchema = z.object({
  size: z.enum(['sm', 'md', 'lg', 'xl']).catch('md').default('md'),
  divider: z.boolean().catch(false).default(false),
}).passthrough().catch({ size: 'md', divider: false })

type S = z.infer<typeof SpacerSchema>

const H: Record<string, string> = { sm: 'h-4', md: 'h-8', lg: 'h-14', xl: 'h-24' }

function Render({ settings, ctx }: BlockRenderProps<S>) {
  return (
    <div className={`${H[settings.size] || H.md} flex items-center`}>
      {settings.divider && <div className={`w-full border-t ${ctx.isLightBg ? 'border-black/10' : 'border-white/10'}`} />}
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <SelectField label="Altura" value={settings.size || 'md'} onChange={v => set('size', v)}
        options={[
          { value: 'sm', label: 'Pequeña' },
          { value: 'md', label: 'Mediana' },
          { value: 'lg', label: 'Grande' },
          { value: 'xl', label: 'Extra grande' },
        ]} />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={!!settings.divider} onChange={e => set('divider', e.target.checked)} />
        Mostrar línea divisoria
      </label>
    </div>
  )
}

export const spacerBlock: BlockDefinition<S> = {
  type: 'spacer',
  label: '↕ Espaciador',
  desc: 'Espacio en blanco o línea divisoria',
  category: 'contenido',
  schema: SpacerSchema,
  Render,
  Editor,
}
