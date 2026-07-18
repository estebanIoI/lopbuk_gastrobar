'use client'

import { useState, useRef } from 'react'
import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { TextField } from '../shared'
import { cldImg } from '@/utils/img'

export const BeforeAfterSchema = z.object({
  title: z.string().default(''),
  beforeUrl: z.string().default(''),
  afterUrl: z.string().default(''),
  beforeLabel: z.string().default('Antes'),
  afterLabel: z.string().default('Después'),
  caption: z.string().default(''),
}).passthrough().catch({ title: '', beforeUrl: '', afterUrl: '', beforeLabel: 'Antes', afterLabel: 'Después', caption: '' })

type S = z.infer<typeof BeforeAfterSchema>

function Render({ settings, tv, tx, tmuted }: BlockRenderProps<S>) {
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  if (!settings.beforeUrl || !settings.afterUrl) return null

  const onMove = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }

  return (
    <div>
      {settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(settings.title)}</h3>}
      <div
        ref={ref}
        className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden select-none touch-none cursor-ew-resize"
        onMouseMove={e => e.buttons === 1 && onMove(e.clientX)}
        onTouchMove={e => onMove(e.touches[0].clientX)}
        onClick={e => onMove(e.clientX)}
      >
        {/* Después (fondo) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cldImg(settings.afterUrl, 900)} alt={settings.afterLabel} draggable={false} className="absolute inset-0 w-full h-full object-cover" />
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white">{tv(settings.afterLabel)}</span>
        {/* Antes (recortado) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cldImg(settings.beforeUrl, 900)} alt={settings.beforeLabel} draggable={false}
            className="absolute inset-0 h-full max-w-none object-cover" style={{ width: ref.current?.clientWidth || '100%' }} />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white">{tv(settings.beforeLabel)}</span>
        </div>
        {/* Manija */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-black text-xs">⇔</div>
        </div>
      </div>
      {settings.caption && <p className={`text-xs mt-2 text-center ${tmuted}`}>{tv(settings.caption)}</p>}
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Título (opcional)" value={settings.title} onChange={v => set('title', v)} />
      <TextField label="URL imagen ANTES" value={settings.beforeUrl} onChange={v => set('beforeUrl', v)} />
      <TextField label="URL imagen DESPUÉS" value={settings.afterUrl} onChange={v => set('afterUrl', v)} />
      <div className="grid grid-cols-2 gap-2">
        <TextField label="Etiqueta antes" value={settings.beforeLabel} onChange={v => set('beforeLabel', v)} />
        <TextField label="Etiqueta después" value={settings.afterLabel} onChange={v => set('afterLabel', v)} />
      </div>
      <TextField label="Pie de foto (opcional)" value={settings.caption} onChange={v => set('caption', v)} />
    </div>
  )
}

export const beforeAfterBlock: BlockDefinition<S> = {
  type: 'before_after',
  label: '↔️ Antes / Después',
  desc: 'Comparador de imágenes con slider',
  category: 'medios',
  schema: BeforeAfterSchema,
  Render,
  Editor,
}
