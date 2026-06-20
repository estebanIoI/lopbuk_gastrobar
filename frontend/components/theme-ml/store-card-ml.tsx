'use client'

/**
 * StoreCardML — tarjeta de presentación del comercio estilo "Tienda oficial"
 * de Mercado Libre, para mostrar dentro del carrito (tema ML).
 *
 * Visual por defecto: las métricas (seguidores, productos, ventas, reputación)
 * son props con valores de ejemplo hasta que se cableen datos reales del backend.
 * Tematizable vía `accentColor`.
 */
import { BadgeCheck, MessageSquare, Timer, Store } from 'lucide-react'

export interface StoreCardMLProps {
  name: string
  logoUrl?: string | null
  coverUrl?: string | null
  isOfficial?: boolean
  followersText?: string
  productsText?: string
  level?: string
  levelTagline?: string
  /** Termómetro de reputación 1-5 (5 = mejor). */
  reputation?: number
  salesText?: string
  goodAttention?: boolean
  onTimeDelivery?: boolean
  accentColor?: string
  onFollow?: () => void
  onGoToStore?: () => void
}

const THERMO = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#22c55e']

export function StoreCardML({
  name,
  logoUrl,
  coverUrl,
  isOfficial = true,
  followersText = '+10 Seguidores',
  productsText = '+500 Productos',
  level = 'MercadoLíder Platinum',
  levelTagline = '¡Uno de los mejores del sitio!',
  reputation = 5,
  salesText = '+10 mil',
  goodAttention = true,
  onTimeDelivery = true,
  accentColor = '#3483fa',
  onFollow,
  onGoToStore,
}: StoreCardMLProps) {
  const accent = accentColor
  return (
    <div className="rounded-xl border border-[#e6e6e6] bg-white overflow-hidden">
      {/* Portada */}
      <div className="h-20 bg-gradient-to-r from-[#2d3277] to-[#3483fa] relative" style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <div className="absolute -bottom-6 left-4 w-14 h-14 rounded-full bg-white border border-[#e6e6e6] shadow flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={name} className="w-full h-full object-contain" />
          ) : (
            <Store className="w-6 h-6 text-[#999]" />
          )}
        </div>
      </div>

      <div className="pt-8 px-4 pb-4">
        {/* Nombre + seguir */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-semibold text-[#333] truncate">
              {name}
              {isOfficial && <BadgeCheck className="w-4 h-4 shrink-0" style={{ color: accent }} fill={accent} stroke="#fff" />}
            </div>
            {isOfficial && <p className="text-xs text-[#999]">Tienda oficial</p>}
          </div>
          <button
            onClick={onFollow}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded"
            style={{ backgroundColor: '#e3edfb', color: accent }}
          >
            Seguir
          </button>
        </div>

        {/* Seguidores / productos */}
        <div className="mt-2 flex items-center gap-4 text-xs text-[#666]">
          <span><strong className="text-[#333]">{followersText.split(' ')[0]}</strong> {followersText.split(' ').slice(1).join(' ') || 'Seguidores'}</span>
          <span><strong className="text-[#333]">{productsText.split(' ')[0]}</strong> {productsText.split(' ').slice(1).join(' ') || 'Productos'}</span>
        </div>

        {/* MercadoLíder */}
        {level && (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#00a650' }}>
              <Timer className="w-4 h-4" />
              {level}
            </div>
            {levelTagline && <p className="text-xs text-[#999] ml-5">{levelTagline}</p>}
            <div className="mt-1.5 flex gap-1">
              {THERMO.map((c, i) => (
                <span key={i} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i < reputation ? c : '#eee' }} />
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-sm font-bold text-[#333]">{salesText}</div>
            <div className="text-[10px] text-[#999]">Ventas</div>
          </div>
          <div className="border-x border-[#eee]">
            <MessageSquare className="w-4 h-4 mx-auto" style={{ color: goodAttention ? '#00a650' : '#ccc' }} />
            <div className="text-[10px] text-[#999] mt-0.5">Buena atención</div>
          </div>
          <div>
            <Timer className="w-4 h-4 mx-auto" style={{ color: onTimeDelivery ? '#00a650' : '#ccc' }} />
            <div className="text-[10px] text-[#999] mt-0.5">Entrega a tiempo</div>
          </div>
        </div>

        <button
          onClick={onGoToStore}
          className="mt-3 w-full text-sm font-medium py-2 rounded"
          style={{ backgroundColor: '#e3edfb', color: accent }}
        >
          Ir a la tienda oficial
        </button>
      </div>
    </div>
  )
}

export default StoreCardML
