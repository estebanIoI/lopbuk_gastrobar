'use client'

/**
 * CTA Builder — botón de acción configurable.
 *
 * En Fase 2 todas las acciones resuelven al CTA nativo del PDP (ctx.onCta) o a
 * WhatsApp (dato real de la tienda). El campo `action` queda modelado para que
 * checkout/reservar/evento/formulario se cableen sin tocar el schema ni el
 * registry cuando lleguen esos flujos.
 */

import { z } from 'zod'
import type { BlockDefinition, BlockRenderProps, BlockEditorProps } from '../types'
import { TextField, SelectField } from '../shared'

export const CTA_ACTIONS = ['default', 'checkout', 'whatsapp', 'reservar', 'evento', 'formulario', 'url'] as const

export const CtaSchema = z.object({
  text: z.string().default('Comprar ahora'),
  subtext: z.string().default(''),
  icon: z.string().default(''),
  action: z.enum(CTA_ACTIONS).catch('default').default('default'),
  /** solo se usa si action === 'url' */
  url: z.string().default(''),
  style: z.enum(['solid', 'outline']).catch('solid').default('solid'),
  size: z.enum(['sm', 'md', 'lg']).catch('lg').default('lg'),
  fullWidth: z.boolean().catch(true).default(true),
  sticky: z.boolean().catch(false).default(false),
}).passthrough().catch({
  text: 'Comprar ahora', subtext: '', icon: '', action: 'default', url: '',
  style: 'solid', size: 'lg', fullWidth: true, sticky: false,
})

type S = z.infer<typeof CtaSchema>

const SIZE: Record<string, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

function Render({ settings, ctx, tv, tmuted }: BlockRenderProps<S>) {
  const accent = ctx.accentColor || '#00833E'
  const solid = settings.style !== 'outline'
  const onClick = () => {
    if (settings.action === 'whatsapp') {
      const wa = ctx.store?.whatsapp
      if (wa) { window.open(`https://wa.me/${String(wa).replace(/\D/g, '')}`, '_blank'); return }
    }
    if (settings.action === 'url' && settings.url) { window.open(settings.url, '_blank'); return }
    // default / checkout / reservar / evento / formulario → CTA nativo del PDP
    ctx.onCta?.()
  }

  const btn = (
    <button onClick={onClick}
      className={`rounded-full font-bold transition-transform active:scale-95 ${SIZE[settings.size] || SIZE.lg} ${settings.fullWidth ? 'w-full' : ''}`}
      style={solid ? { background: accent, color: '#fff' } : { border: `2px solid ${accent}`, color: accent }}>
      {settings.icon && <span className="mr-1.5">{settings.icon}</span>}
      {tv(settings.text || 'Comprar ahora')}
    </button>
  )

  const body = (
    <div className={settings.fullWidth ? '' : 'flex flex-col items-center'}>
      {btn}
      {settings.subtext && <p className={`text-[11px] mt-1.5 text-center ${tmuted}`}>{tv(settings.subtext)}</p>}
    </div>
  )

  if (settings.sticky) {
    // Sticky dentro del contenedor del PDP (no fixed global): no invade otras vistas.
    return <div className="sticky bottom-3 z-20">{body}</div>
  }
  return body
}

function Editor({ settings, set }: BlockEditorProps) {
  return (
    <div className="space-y-3">
      <TextField label="Texto" value={settings.text} onChange={v => set('text', v)} />
      <TextField label="Subtexto (opcional)" value={settings.subtext} onChange={v => set('subtext', v)} />
      <TextField label="Emoji/icono (opcional)" value={settings.icon} onChange={v => set('icon', v)} />
      <SelectField label="Acción" value={settings.action || 'default'} onChange={v => set('action', v)}
        options={[
          { value: 'default', label: 'Comprar (CTA del producto)' },
          { value: 'checkout', label: 'Ir al checkout' },
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'reservar', label: 'Reservar' },
          { value: 'evento', label: 'Evento' },
          { value: 'formulario', label: 'Formulario' },
          { value: 'url', label: 'Enlace externo' },
        ]} />
      {settings.action === 'url' && (
        <TextField label="URL de destino" value={settings.url} onChange={v => set('url', v)} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <SelectField label="Estilo" value={settings.style || 'solid'} onChange={v => set('style', v)}
          options={[{ value: 'solid', label: 'Sólido' }, { value: 'outline', label: 'Contorno' }]} />
        <SelectField label="Tamaño" value={settings.size || 'lg'} onChange={v => set('size', v)}
          options={[{ value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={settings.fullWidth !== false} onChange={e => set('fullWidth', e.target.checked)} />
        Ancho completo
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={!!settings.sticky} onChange={e => set('sticky', e.target.checked)} />
        Fijo al hacer scroll (sticky)
      </label>
      <p className="text-[10px] text-muted-foreground">
        Por ahora las acciones checkout/reservar/evento/formulario abren el flujo de compra del
        producto; WhatsApp y enlace externo ya funcionan. Las demás se cablearán sin cambiar la
        plantilla.
      </p>
    </div>
  )
}

export const ctaBlock: BlockDefinition<S> = {
  type: 'cta',
  label: '🔘 Botón CTA',
  desc: 'Botón de acción configurable (texto, estilo, acción, sticky)',
  category: 'conversion',
  schema: CtaSchema,
  Render,
  Editor,
}
