'use client'

/**
 * ProductInfoTabs — Motor de PDP · #5
 * Tabs en lenguaje de comprador (Información · Guía de tallas · Materiales · Envíos).
 *
 * Principio: una pestaña solo existe si TIENE contenido real. Nada de tabs vacías
 * ni de rellenar con prosa: si el producto no tiene horma, no hay guía de tallas.
 */
import { useState, type ReactNode } from 'react'
import { HormaSizeGuide } from '@/components/horma-size-guide'
import { emitPdpEvent } from '@/lib/pdp/pdp-analytics'

interface TabDef { key: string; label: string; content: ReactNode }

/** Descripción con viñetas (mismo formato que usaba el bloque original). */
function DescriptionBody({ text, isLightBg }: { text: string; isLightBg: boolean }) {
  return (
    <div className="space-y-2">
      {text.split(/\n+/).map(l => l.trim()).filter(Boolean).map((line, i) => {
        const isBullet = /^[-•*►▸→✓✔·]\s/.test(line)
        const clean = isBullet ? line.replace(/^[-•*►▸→✓✔·]\s*/, '') : line
        return isBullet ? (
          <div key={i} className="flex items-start gap-2">
            <span className={`mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full ${isLightBg ? 'bg-black/50' : 'bg-white/70'}`} />
            <p className={`text-sm font-light leading-relaxed ${isLightBg ? 'text-black/70' : 'text-white/60'}`}>{clean}</p>
          </div>
        ) : (
          <p key={i} className={`text-sm font-light leading-relaxed ${isLightBg ? 'text-black/70' : 'text-white/60'}`}>{line}</p>
        )
      })}
    </div>
  )
}

export function ProductInfoTabs({
  isLightBg,
  productId,
  description,
  hormaId,
  materials,
  shipping,
}: {
  isLightBg: boolean
  productId?: string | number
  description?: string | null
  hormaId?: string | null
  materials?: ReactNode
  shipping?: ReactNode
}) {
  const tabs: TabDef[] = []
  if (description && description.trim()) {
    tabs.push({ key: 'info', label: 'Información', content: <DescriptionBody text={description} isLightBg={isLightBg} /> })
  }
  if (hormaId) {
    tabs.push({ key: 'tallas', label: 'Guía de tallas', content: <HormaSizeGuide hormaId={hormaId} /> })
  }
  if (materials) tabs.push({ key: 'materiales', label: 'Materiales', content: materials })
  if (shipping) tabs.push({ key: 'envios', label: 'Envíos', content: shipping })

  const [active, setActive] = useState(0)
  if (tabs.length === 0) return null

  const idx = Math.min(active, tabs.length - 1)
  const current = tabs[idx]

  const onPick = (i: number) => {
    setActive(i)
    const t = tabs[i]
    if (t.key === 'tallas') emitPdpEvent('VIEW_SIZE_GUIDE', { productId })
  }

  return (
    <div className={`py-4 border-t ${isLightBg ? 'border-black/10' : 'border-white/8'}`}>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 mb-4">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            onClick={() => onPick(i)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-widest border transition-colors ${
              i === idx
                ? (isLightBg ? 'bg-black text-white border-black' : 'bg-white text-black border-white')
                : (isLightBg ? 'text-black/50 border-black/15 hover:border-black/30' : 'text-white/50 border-white/15 hover:border-white/30')
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{current.content}</div>
    </div>
  )
}
