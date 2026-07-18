'use client'

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { TextField } from '../shared'
import { cldImg } from '@/utils/img'

export const ImageBannerSchema = z.object({
  imageUrl: z.string().default(''),
  title: z.string().default(''),
  subtitle: z.string().default(''),
  ctaText: z.string().default(''),
}).passthrough().catch({ imageUrl: '', title: '', subtitle: '', ctaText: '' })

type S = z.infer<typeof ImageBannerSchema>

function Render({ settings, ctx, tv }: BlockRenderProps<S>) {
  const img = String(settings.imageUrl || '')
  if (!img && !settings.title) return null
  return (
    <div className="relative rounded-2xl overflow-hidden min-h-[180px] flex items-center justify-center bg-black/40">
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cldImg(img, 1200)} alt={tv(String(settings.title || ''))} loading="lazy" decoding="async"
          className="absolute inset-0 w-full h-full object-cover" />
      )}
      {(settings.title || settings.subtitle || settings.ctaText) && (
        <div className="relative z-10 text-center px-6 py-10 bg-black/40 w-full">
          {settings.title && <h3 className="text-xl sm:text-2xl font-bold text-white">{tv(settings.title)}</h3>}
          {settings.subtitle && <p className="text-sm text-white/80 mt-1.5">{tv(settings.subtitle)}</p>}
          {settings.ctaText && (
            <button onClick={ctx.onCta} className="mt-4 px-6 py-2.5 rounded-full text-sm font-semibold text-black bg-white hover:bg-white/90 transition-colors">
              {tv(settings.ctaText)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="URL de imagen de fondo" value={settings.imageUrl} onChange={v => set('imageUrl', v)} />
      <TextField label="Título" value={settings.title} onChange={v => set('title', v)} />
      <TextField label="Subtítulo" value={settings.subtitle} onChange={v => set('subtitle', v)} />
      <TextField label="Texto del botón (vacío = sin botón)" value={settings.ctaText} onChange={v => set('ctaText', v)} />
    </div>
  )
}

export const imageBannerBlock: BlockDefinition<S> = {
  type: 'image_banner',
  label: '🖼️ Banner',
  desc: 'Imagen full-width con texto y botón',
  category: 'medios',
  schema: ImageBannerSchema,
  Render,
  Editor,
}
