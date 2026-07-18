'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { ListEditor, TextField, Hint } from '../shared'

export const FaqSchema = z.object({
  title: z.string().default('Preguntas frecuentes'),
  items: z.array(
    z.object({ q: z.string().default(''), a: z.string().default('') }).passthrough()
  ).catch([]).default([]),
}).passthrough().catch({ title: 'Preguntas frecuentes', items: [] })

type S = z.infer<typeof FaqSchema>

function Render({ settings, ctx, tv, tx, tmuted }: BlockRenderProps<S>) {
  const items: Array<{ q: string; a: string }> = [
    ...(Array.isArray(settings.items) ? settings.items : []),
    ...((ctx.pageContent?.faqs) || []),
  ]
  if (items.length === 0) return null
  return (
    <div>
      <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(String(settings.title || 'Preguntas frecuentes'))}</h3>
      <div className="space-y-2">
        {items.map((f, i) => (
          <details key={i} className={`group rounded-xl border ${ctx.isLightBg ? 'border-black/10' : 'border-white/10'}`}>
            <summary className={`cursor-pointer list-none px-4 py-3 text-sm font-medium flex items-center justify-between gap-2 ${tx}`}>
              {tv(f.q)}
              <span className="transition-transform group-open:rotate-45 text-lg leading-none shrink-0">+</span>
            </summary>
            <div className={`px-4 pb-4 text-sm leading-relaxed ${tmuted}`}>{tv(f.a)}</div>
          </details>
        ))}
      </div>
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Título" value={settings.title} onChange={v => set('title', v)} />
      <ListEditor items={settings.items || []} onChange={v => set('items', v)} addLabel="Agregar pregunta"
        fields={[{ key: 'q', label: 'Pregunta' }, { key: 'a', label: 'Respuesta', long: true }]} />
      <Hint>Las FAQs propias de cada producto se suman automáticamente.</Hint>
    </div>
  )
}

export const faqBlock: BlockDefinition<S> = {
  type: 'faq',
  label: '❓ FAQ',
  desc: 'Preguntas frecuentes en acordeón',
  category: 'contenido',
  schema: FaqSchema,
  Render,
  Editor,
}
