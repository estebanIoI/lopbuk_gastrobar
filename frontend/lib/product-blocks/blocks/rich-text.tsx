'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { MdLite, TextField, SelectField } from '../shared'
import { Textarea } from '@/components/ui/textarea'
import { cldImg } from '@/utils/img'

export const RichTextSchema = z.object({
  title: z.string().default(''),
  body: z.string().default(''),
  imageUrl: z.string().default(''),
  imagePosition: z.enum(['left', 'right']).catch('right').default('right'),
}).passthrough().catch({ title: '', body: '', imageUrl: '', imagePosition: 'right' as const })

type S = z.infer<typeof RichTextSchema>

function Render({ settings, tv, tx, tmuted }: BlockRenderProps<S>) {
  const img = settings.imageUrl ? String(settings.imageUrl) : ''
  const pos = settings.imagePosition || 'right'
  const body = <MdLite text={tv(String(settings.body || ''))} className={`text-sm leading-relaxed space-y-1 ${tmuted}`} />
  return (
    <div>
      {settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(settings.title)}</h3>}
      {img ? (
        <div className={`flex flex-col gap-5 ${pos === 'left' ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}>
          <div className="flex-1 min-w-0">{body}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cldImg(img, 600)} alt={tv(String(settings.title || ''))} loading="lazy" decoding="async"
            className="sm:w-2/5 w-full rounded-xl object-cover" />
        </div>
      ) : body}
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Título" value={settings.title} onChange={v => set('title', v)} />
      <div>
        <label className="text-xs font-medium mb-1 block">
          Texto (usa **negrita**, &quot;- &quot; para listas y {'{{product.description}}'})
        </label>
        <Textarea rows={6} value={settings.body || ''} onChange={e => set('body', e.target.value)} className="text-xs" />
      </div>
      <TextField label="URL de imagen (opcional)" value={settings.imageUrl} onChange={v => set('imageUrl', v)} />
      <SelectField label="Posición de la imagen" value={settings.imagePosition || 'right'} onChange={v => set('imagePosition', v)}
        options={[{ value: 'right', label: 'Derecha' }, { value: 'left', label: 'Izquierda' }]} />
    </div>
  )
}

export const richTextBlock: BlockDefinition<S> = {
  type: 'rich_text',
  label: '📝 Texto enriquecido',
  desc: 'Título + texto con negritas y listas + imagen',
  category: 'contenido',
  schema: RichTextSchema,
  Render,
  Editor,
}
