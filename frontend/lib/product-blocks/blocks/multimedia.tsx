'use client'

/**
 * Multimedia — carrusel de piezas mixtas: YouTube, TikTok, Instagram, Shorts,
 * GIF, MP4 e imágenes. Cada item es una URL; el tipo se detecta con videoEmbed.
 */

import { useState } from 'react'
import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { ListEditor, TextField, videoEmbed } from '../shared'
import { cldImg } from '@/utils/img'

export const MultimediaSchema = z.object({
  title: z.string().default(''),
  items: z.array(
    z.object({ url: z.string().default('') }).passthrough()
  ).catch([]).default([]),
}).passthrough().catch({ title: '', items: [] })

type S = z.infer<typeof MultimediaSchema>

function Piece({ url, alt }: { url: string; alt: string }) {
  const { kind, src, vertical } = videoEmbed(url)
  if (kind === 'mp4') return <video src={src} controls playsInline preload="metadata" className="w-full h-full object-contain bg-black" />
  if (kind === 'gif') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
  }
  if (kind === 'none') {
    // URL de imagen directa (jpg/png/webp/cloudinary)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cldImg(url, 900)} alt={alt} loading="lazy" className="w-full h-full object-cover" />
  }
  return (
    <div className={`relative w-full ${vertical ? 'aspect-[9/16] max-w-[340px] mx-auto' : 'aspect-video'}`}>
      <iframe src={src} loading="lazy" allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        className="absolute inset-0 w-full h-full border-0" />
    </div>
  )
}

function Render({ settings, tv, tx }: BlockRenderProps<S>) {
  const items = (Array.isArray(settings.items) ? settings.items : []).filter(i => i.url)
  const [i, setI] = useState(0)
  if (items.length === 0) return null
  const idx = Math.min(i, items.length - 1)
  return (
    <div>
      {settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(settings.title)}</h3>}
      <div className="rounded-xl overflow-hidden bg-black/5">
        <Piece url={items[idx].url} alt={tv(String(settings.title || ''))} />
      </div>
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {items.map((_, k) => (
            <button key={k} onClick={() => setI(k)}
              className={`h-2 rounded-full transition-all ${k === idx ? 'w-5 bg-current' : 'w-2 bg-current/30'}`}
              aria-label={`Ir a ${k + 1}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Título (opcional)" value={settings.title} onChange={v => set('title', v)} />
      <ListEditor items={settings.items || []} onChange={v => set('items', v)} addLabel="Agregar pieza"
        fields={[{ key: 'url', label: 'URL (YouTube, TikTok, Instagram, GIF, MP4, imagen)' }]} />
      <p className="text-[10px] text-muted-foreground">
        Cada URL se detecta sola: YouTube/Shorts, TikTok, Instagram (reel/post), GIF, MP4 o imagen.
      </p>
    </div>
  )
}

export const multimediaBlock: BlockDefinition<S> = {
  type: 'multimedia',
  label: '🎠 Multimedia',
  desc: 'Carrusel de videos, reels, GIFs e imágenes',
  category: 'medios',
  schema: MultimediaSchema,
  Render,
  Editor,
}
