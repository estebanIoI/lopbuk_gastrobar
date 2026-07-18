'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { videoEmbed, TextField, Hint } from '../shared'

export const VideoSchema = z.object({
  title: z.string().default(''),
  url: z.string().default(''),
}).passthrough().catch({ title: '', url: '' })

type S = z.infer<typeof VideoSchema>

function Render({ settings, ctx, tv, tx }: BlockRenderProps<S>) {
  const url = String(settings.url || ctx.pageContent?.videoUrl || '')
  const { kind, src, vertical } = videoEmbed(url)
  if (kind === 'none') return null
  return (
    <div>
      {settings.title && <h3 className={`text-lg font-semibold mb-4 ${tx}`}>{tv(settings.title)}</h3>}
      {kind === 'mp4' ? (
        <video src={src} controls playsInline preload="metadata" className="w-full rounded-xl max-h-[480px] bg-black" />
      ) : kind === 'gif' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={tv(String(settings.title || ''))} loading="lazy" className="w-full rounded-xl max-h-[480px] object-contain bg-black" />
      ) : (
        <div className={`relative w-full overflow-hidden rounded-xl ${vertical ? 'max-w-[340px] mx-auto aspect-[9/16]' : 'aspect-video'}`}>
          <iframe src={src} loading="lazy" allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="absolute inset-0 w-full h-full border-0" />
        </div>
      )}
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Título" value={settings.title} onChange={v => set('title', v)} />
      <TextField label="URL (YouTube, TikTok o .mp4)" value={settings.url} onChange={v => set('url', v)} />
      <Hint>Si se deja vacío, usa el video propio del producto (contenido de página).</Hint>
    </div>
  )
}

export const videoBlock: BlockDefinition<S> = {
  type: 'video',
  label: '🎬 Video',
  desc: 'YouTube, TikTok, Instagram, Shorts, GIF o MP4',
  category: 'medios',
  schema: VideoSchema,
  Render,
  Editor,
}
