'use client'

import { useEffect, useRef, useState } from 'react'
import { Lock, Unlock, TrendingDown, Sparkles, Trophy } from 'lucide-react'

export interface PriceTier {
  minQty: number
  price: number
  marginPct?: number
  /** Nombre visible del nivel. Si no viene del backend, se auto-genera. */
  tierName?: string
}

interface WholesalePriceBarProps {
  priceTiers: PriceTier[]
  /** Cantidad total del producto en el carrito (todas sus variantes) */
  cartQty: number
  /** Cantidad seleccionada actualmente en el modal (aún no en carrito) */
  selectionQty: number
  basePrice: number
  isLightBg?: boolean
  formatPrice: (v: number) => string
  /** Callback cuando cambia el precio resuelto por tiers */
  onResolvedPrice?: (price: number) => void
}

const TIER_LABELS: Record<number, { label: string; emoji: string; color: string }> = {
  0: { label: 'Detal',         emoji: '🛍️', color: 'text-white/60' },
  1: { label: 'Mayorista',     emoji: '🔥', color: 'text-orange-400' },
  2: { label: 'Distribuidor',  emoji: '🚀', color: 'text-blue-400' },
  3: { label: 'Socio Élite',   emoji: '👑', color: 'text-yellow-400' },
  4: { label: 'Premium',       emoji: '💎', color: 'text-purple-400' },
}

function getTierMeta(idx: number, minQty: number) {
  return TIER_LABELS[idx] ?? { label: `Nivel ${minQty}+`, emoji: '⭐', color: 'text-white/50' }
}

/** Resuelve el tier activo dado una cantidad total. */
export function resolveActiveTier(tiers: PriceTier[], totalQty: number): PriceTier | null {
  if (!tiers?.length) return null
  const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty)
  return sorted.find(t => totalQty >= t.minQty) ?? null
}

export function WholesalePriceBar({
  priceTiers,
  cartQty,
  selectionQty,
  basePrice,
  isLightBg = false,
  formatPrice,
  onResolvedPrice,
}: WholesalePriceBarProps) {
  const totalQty = cartQty + selectionQty
  const [unlockAnim, setUnlockAnim] = useState(false)
  const prevTierRef = useRef<PriceTier | null>(null)

  // Ordena tiers ascendente por min_qty
  const sorted = [...priceTiers].sort((a, b) => a.minQty - b.minQty)

  // Tier "base" (min_qty = 0 o 1 implícito con precio base)
  const allTiers: PriceTier[] = [
    { minQty: 1, price: basePrice, tierName: 'Detal' },
    ...sorted.filter(t => t.minQty > 1),
  ]

  const activeTier = resolveActiveTier(allTiers, totalQty)
  const resolvedPrice = activeTier?.price ?? basePrice

  // Notificar precio resuelto al padre
  useEffect(() => {
    onResolvedPrice?.(resolvedPrice)
  }, [resolvedPrice, onResolvedPrice])

  // Detectar cambio de tier y disparar animación
  useEffect(() => {
    const prev = prevTierRef.current
    if (prev && activeTier && prev.minQty !== activeTier.minQty && activeTier.minQty > 1) {
      setUnlockAnim(true)
      const t = setTimeout(() => setUnlockAnim(false), 2000)
      return () => clearTimeout(t)
    }
    prevTierRef.current = activeTier
  }, [activeTier])

  // No mostrar si no hay tiers reales (solo detal)
  if (allTiers.length <= 1) return null

  // Tier actual e índice
  const activeTierIdx = activeTier ? allTiers.indexOf(activeTier) : 0
  const nextTier = allTiers[activeTierIdx + 1] ?? null

  // Progreso hasta el siguiente tier
  const prevQty = activeTier?.minQty ?? 1
  const nextQty = nextTier?.minQty ?? null
  const pctToNext = nextQty
    ? Math.min(100, Math.round(((totalQty - prevQty) / (nextQty - prevQty)) * 100))
    : 100

  const savings = basePrice - resolvedPrice
  const savingsPct = basePrice > 0 ? Math.round((savings / basePrice) * 100) : 0
  const totalSavings = savings * totalQty

  const bg = isLightBg
    ? 'bg-black/[0.04] border-black/10'
    : 'bg-white/[0.04] border-white/10'

  const textMuted = isLightBg ? 'text-black/40' : 'text-white/40'
  const textSub   = isLightBg ? 'text-black/60' : 'text-white/60'

  return (
    <div className={`rounded-xl border overflow-hidden ${bg} text-sm`}>
      {/* Header: tier actual + savings */}
      <div className={`px-3 py-2.5 flex items-center justify-between gap-2 ${isLightBg ? 'bg-black/[0.03]' : 'bg-white/[0.03]'}`}>
        <div className="flex items-center gap-2">
          {activeTierIdx > 0 ? (
            <div className={`flex items-center gap-1.5 ${unlockAnim ? 'animate-pulse' : ''}`}>
              <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="font-semibold text-orange-400 text-xs">
                Precio {getTierMeta(activeTierIdx, activeTier!.minQty).label} desbloqueado
              </span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 ${textMuted}`}>
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs">Agrega más para desbloquear descuento</span>
            </div>
          )}
        </div>
        {savings > 0 && totalQty > 0 && (
          <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold shrink-0">
            <span>Ahorras {formatPrice(totalSavings)}</span>
            <span className="opacity-60">({savingsPct}%)</span>
          </div>
        )}
      </div>

      {/* Animación de desbloqueo */}
      {unlockAnim && (
        <div className="px-3 py-2 bg-orange-500/10 flex items-center gap-2 border-t border-orange-500/20 animate-in fade-in slide-in-from-top-1 duration-300">
          <Trophy className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="text-orange-300 text-xs font-medium">
            🎉 ¡Precio {getTierMeta(activeTierIdx, activeTier!.minQty).label} desbloqueado!
          </span>
        </div>
      )}

      {/* Barra de progreso al siguiente tier */}
      {nextTier && (
        <div className="px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={`text-xs ${textMuted}`}>
              {nextQty! - totalQty > 0
                ? <>Te faltan <strong className={textSub}>{nextQty! - totalQty} {nextQty! - totalQty === 1 ? 'prenda' : 'prendas'}</strong> para {getTierMeta(activeTierIdx + 1, nextTier.minQty).emoji} <strong className={textSub}>{getTierMeta(activeTierIdx + 1, nextTier.minQty).label}</strong></>
                : <>Ya casi desbloqueas {getTierMeta(activeTierIdx + 1, nextTier.minQty).emoji} <strong className={textSub}>{getTierMeta(activeTierIdx + 1, nextTier.minQty).label}</strong></>
              }
            </span>
            <span className={`text-xs font-medium ${textSub}`}>{formatPrice(nextTier.price)} c/u</span>
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden ${isLightBg ? 'bg-black/10' : 'bg-white/10'}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
              style={{ width: `${pctToNext}%` }}
            />
          </div>
          <div className={`flex justify-between text-[10px] ${textMuted}`}>
            <span>{totalQty} prendas</span>
            <span>{nextQty} prendas</span>
          </div>
        </div>
      )}

      {/* Tabla de tiers */}
      <div className={`divide-y ${isLightBg ? 'divide-black/5' : 'divide-white/5'}`}>
        {allTiers.map((tier, idx) => {
          const isActive = activeTierIdx === idx
          const isUnlocked = totalQty >= tier.minQty
          const meta = getTierMeta(idx, tier.minQty)
          const tierSavings = basePrice > 0 && tier.price < basePrice
            ? Math.round(((basePrice - tier.price) / basePrice) * 100)
            : 0

          return (
            <div
              key={tier.minQty}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                isActive
                  ? isLightBg
                    ? 'bg-orange-50'
                    : 'bg-orange-500/10'
                  : ''
              }`}
            >
              {/* Icono lock/unlock */}
              <div className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full ${
                isUnlocked
                  ? 'bg-orange-500/20 text-orange-400'
                  : isLightBg
                    ? 'bg-black/10 text-black/30'
                    : 'bg-white/10 text-white/30'
              }`}>
                {isUnlocked
                  ? (isActive ? <Unlock className="w-3 h-3" /> : <Unlock className="w-3 h-3 opacity-60" />)
                  : <Lock className="w-3 h-3" />
                }
              </div>

              {/* Nombre del tier */}
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium flex items-center gap-1.5 ${
                  isUnlocked
                    ? isLightBg ? 'text-black/80' : 'text-white/80'
                    : textMuted
                }`}>
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                  {isActive && (
                    <span className="text-[9px] font-bold bg-orange-500/20 text-orange-400 rounded-full px-1.5 py-0.5 leading-none">ACTIVO</span>
                  )}
                </div>
                <div className={`text-[10px] mt-0.5 ${textMuted}`}>
                  {idx === 0 ? '1-' + (allTiers[1]?.minQty ? (allTiers[1].minQty - 1) : '∞') : `${tier.minQty}+`} {idx === 0 ? 'unidades' : 'unidades'}
                </div>
              </div>

              {/* Precio + ahorro */}
              <div className="text-right shrink-0">
                <div className={`text-sm font-semibold ${
                  isUnlocked
                    ? idx > 0 ? 'text-orange-400' : isLightBg ? 'text-black/80' : 'text-white/80'
                    : textMuted
                }`}>
                  {formatPrice(tier.price)}
                </div>
                {tierSavings > 0 && (
                  <div className={`text-[10px] ${isUnlocked ? 'text-emerald-400' : textMuted}`}>
                    {isUnlocked ? `Ahorras ${tierSavings}%` : `${tierSavings}% dto`}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer: mix & match hint */}
      <div className={`px-3 py-2 border-t ${isLightBg ? 'border-black/5 bg-black/[0.02]' : 'border-white/5 bg-white/[0.02]'}`}>
        <p className={`text-[10px] text-center ${textMuted}`}>
          Combina tallas y colores libremente — el total cuenta para el precio
        </p>
      </div>
    </div>
  )
}
