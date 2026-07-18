'use client'

/**
 * Hero — cabecera de conversión del PDP.
 *
 * REGLA DE ORO: no almacena NADA del producto. Título, precio, precio tachado,
 * descuento, stock, marca e imágenes se resuelven en runtime desde el producto
 * real (ctx.product) o vía variables {{product.*}}. Lo único que el comerciante
 * configura aquí es ESTRUCTURA: layout, qué badges/trust-badges mostrar, texto
 * y estilo del CTA, y textos de eyebrow/nota que NO son datos del producto.
 */

import { useState } from 'react'
import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { TextField, SelectField, ListEditor, Hint } from '../shared'
import { productImages, productDiscountPct } from '@/lib/template-vars'
import { cldImg } from '@/utils/img'

export const HeroSchema = z.object({
  layout: z.enum(['image_left', 'image_right', 'stacked']).catch('image_left').default('image_left'),
  media: z.enum(['slider', 'single']).catch('slider').default('slider'),
  // Textos de ESTRUCTURA (no son datos del producto): un eyebrow tipo "Nuevo
  // lanzamiento" y una nota bajo el precio tipo "Impuestos incluidos".
  eyebrow: z.string().default(''),
  priceNote: z.string().default(''),
  showPrice: z.boolean().catch(true).default(true),
  showComparePrice: z.boolean().catch(true).default(true),
  showDiscountBadge: z.boolean().catch(true).default(true),
  showStock: z.boolean().catch(true).default(true),
  showBrand: z.boolean().catch(true).default(true),
  // Badges de estructura (texto libre — NO precios ni títulos del producto)
  badges: z.array(z.object({ text: z.string().default('') }).passthrough()).catch([]).default([]),
  trustBadges: z.array(
    z.object({ icon: z.string().default(''), text: z.string().default('') }).passthrough()
  ).catch([]).default([]),
  ctaText: z.string().default('Comprar ahora'),
  ctaSubtext: z.string().default(''),
}).passthrough().catch({
  layout: 'image_left', media: 'slider', eyebrow: '', priceNote: '',
  showPrice: true, showComparePrice: true, showDiscountBadge: true, showStock: true, showBrand: true,
  badges: [], trustBadges: [], ctaText: 'Comprar ahora', ctaSubtext: '',
})

type S = z.infer<typeof HeroSchema>

function Slider({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0)
  if (images.length === 0) {
    return <div className="aspect-square w-full rounded-2xl bg-black/10" />
  }
  const idx = Math.min(i, images.length - 1)
  return (
    <div className="space-y-2">
      <div className="aspect-square w-full rounded-2xl overflow-hidden bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cldImg(images[idx], 900)} alt={alt} loading="eager" decoding="async" className="w-full h-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {images.map((img, k) => (
            <button key={k} onClick={() => setI(k)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${k === idx ? 'border-current' : 'border-transparent opacity-60'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cldImg(img, 120)} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Render({ settings, ctx, tv, tx, tmuted }: BlockRenderProps<S>) {
  const p = ctx.product
  const imgs = productImages(p)
  const images = settings.media === 'single' ? imgs.slice(0, 1) : imgs
  const discount = productDiscountPct(p)
  const onOffer = !!(p && p.isOnOffer && p.offerPrice)
  const fmt = ctx.formatPrice || ((v: number) => String(v))
  const effective = p ? (onOffer ? Number(p.offerPrice) : Number(p.salePrice || 0)) : 0

  const media = <Slider images={images} alt={p?.name || ''} />

  const info = (
    <div className="flex flex-col justify-center gap-3">
      {settings.eyebrow && <p className="text-xs font-semibold uppercase tracking-widest opacity-70">{tv(settings.eyebrow)}</p>}
      {settings.showBrand && p?.brand && <p className={`text-sm ${tmuted}`}>{p.brand}</p>}
      <h1 className={`text-2xl sm:text-3xl font-black leading-tight ${tx}`}>{p?.name || ''}</h1>

      {/* Badges de estructura (texto libre del comerciante) */}
      {(settings.badges?.length > 0 || (settings.showDiscountBadge && discount > 0)) && (
        <div className="flex flex-wrap gap-1.5">
          {settings.showDiscountBadge && discount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500 text-white">-{discount}%</span>
          )}
          {(settings.badges || []).filter(b => b.text).map((b, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-current opacity-80">{tv(b.text)}</span>
          ))}
        </div>
      )}

      {/* Precio: SIEMPRE del producto real */}
      {settings.showPrice && p && (
        <div className="flex items-end gap-2 flex-wrap">
          <span className={`text-3xl font-black ${tx}`}>{fmt(effective)}</span>
          {settings.showComparePrice && onOffer && (
            <span className={`text-lg line-through ${tmuted}`}>{fmt(Number(p.salePrice))}</span>
          )}
        </div>
      )}
      {settings.priceNote && <p className={`text-xs ${tmuted}`}>{tv(settings.priceNote)}</p>}

      {settings.showStock && p?.stock != null && p.stock > 0 && (
        <p className="text-xs font-medium text-emerald-600">✓ {p.stock} disponibles</p>
      )}

      {/* CTA — en Fase 2 dispara el CTA nativo del PDP (onCta). Las acciones
          checkout/WhatsApp/reserva llegan con el CTA Builder. */}
      <div className="mt-1">
        <button onClick={ctx.onCta}
          className="w-full sm:w-auto px-8 py-3 rounded-full text-sm font-bold text-white transition-transform active:scale-95"
          style={{ background: ctx.accentColor }}>
          {tv(settings.ctaText || 'Comprar ahora')}
        </button>
        {settings.ctaSubtext && <p className={`text-[11px] mt-1.5 ${tmuted}`}>{tv(settings.ctaSubtext)}</p>}
      </div>

      {/* Trust badges */}
      {settings.trustBadges?.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
          {settings.trustBadges.filter(t => t.text).map((t, i) => (
            <span key={i} className={`text-[11px] flex items-center gap-1 ${tmuted}`}>
              <span>{t.icon || '✓'}</span>{tv(t.text)}
            </span>
          ))}
        </div>
      )}
    </div>
  )

  if (settings.layout === 'stacked') {
    return <div className="space-y-5">{media}{info}</div>
  }
  const reverse = settings.layout === 'image_right'
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 ${reverse ? 'sm:[direction:rtl]' : ''}`}>
      <div className="[direction:ltr]">{media}</div>
      <div className="[direction:ltr]">{info}</div>
    </div>
  )
}

function Editor({ settings, set }: BlockEditorProps) {
  const toggle = (key: string, label: string) => (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={settings[key] !== false} onChange={e => set(key, e.target.checked)} />
      {label}
    </label>
  )
  return (
    <div className="space-y-3">
      <SelectField label="Disposición" value={settings.layout || 'image_left'} onChange={v => set('layout', v)}
        options={[
          { value: 'image_left', label: 'Imagen izquierda' },
          { value: 'image_right', label: 'Imagen derecha' },
          { value: 'stacked', label: 'Apilado (imagen arriba)' },
        ]} />
      <SelectField label="Medios" value={settings.media || 'slider'} onChange={v => set('media', v)}
        options={[{ value: 'slider', label: 'Slider (galería)' }, { value: 'single', label: 'Imagen única' }]} />
      <TextField label="Eyebrow (texto sobre el título, opcional)" value={settings.eyebrow} onChange={v => set('eyebrow', v)} />
      <div className="grid grid-cols-2 gap-1.5 py-1">
        {toggle('showBrand', 'Marca')}
        {toggle('showPrice', 'Precio')}
        {toggle('showComparePrice', 'Precio tachado')}
        {toggle('showDiscountBadge', 'Badge de descuento')}
        {toggle('showStock', 'Stock')}
      </div>
      <TextField label="Nota bajo el precio (opcional)" value={settings.priceNote} onChange={v => set('priceNote', v)} />
      <div>
        <label className="text-xs font-medium mb-1 block">Badges (etiquetas de estructura)</label>
        <ListEditor items={settings.badges || []} onChange={v => set('badges', v)} addLabel="Agregar badge"
          fields={[{ key: 'text', label: 'Texto (ej: Más vendido)' }]} />
      </div>
      <TextField label="Texto del botón" value={settings.ctaText} onChange={v => set('ctaText', v)} />
      <TextField label="Subtexto del botón (opcional)" value={settings.ctaSubtext} onChange={v => set('ctaSubtext', v)} />
      <div>
        <label className="text-xs font-medium mb-1 block">Trust badges (bajo el CTA)</label>
        <ListEditor items={settings.trustBadges || []} onChange={v => set('trustBadges', v)} addLabel="Agregar trust badge"
          fields={[{ key: 'icon', label: 'Emoji' }, { key: 'text', label: 'Texto (ej: Pago seguro)' }]} />
      </div>
      <Hint>
        El precio, el descuento, el stock, la marca y las imágenes salen del producto real. Aquí
        solo defines qué mostrar y cómo, nunca valores fijos. Usa {'{{product.title}}'} en textos si
        lo necesitas.
      </Hint>
    </div>
  )
}

export const heroBlock: BlockDefinition<S> = {
  type: 'hero',
  label: '⭐ Hero',
  desc: 'Cabecera de conversión: imagen/slider, precio, badges y CTA',
  category: 'conversion',
  schema: HeroSchema,
  Render,
  Editor,
}
