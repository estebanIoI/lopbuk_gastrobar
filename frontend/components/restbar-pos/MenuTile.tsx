'use client'

import { useRef, useCallback, useState } from 'react'
import type { MenuItem } from './PosShell'
import { Clock, Star, Flame } from 'lucide-react'

interface MenuTileProps {
  item: MenuItem
  onClick: () => void
  onDoubleClick?: () => void
  onLongPress?: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
  popularity?: number
}

const CATEGORY_COLORS: Record<string, string> = {
  Bebidas: 'from-blue-700 to-blue-900 border-blue-600/40',
  Entradas: 'from-emerald-700 to-emerald-900 border-emerald-600/40',
  Platos: 'from-amber-700 to-amber-900 border-amber-600/40',
  Hamburguesas: 'from-red-700 to-red-900 border-red-600/40',
  Pizzas: 'from-orange-700 to-orange-900 border-orange-600/40',
  Sushi: 'from-pink-700 to-pink-900 border-pink-600/40',
  Carnes: 'from-rose-700 to-rose-900 border-rose-600/40',
  Postres: 'from-purple-700 to-purple-900 border-purple-600/40',
  Ensaladas: 'from-green-700 to-green-900 border-green-600/40',
  Sopas: 'from-yellow-700 to-yellow-900 border-yellow-600/40',
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const DOUBLE_TAP_MS = 350
const LONG_PRESS_MS = 600

export function MenuTile({ item, onClick, onDoubleClick, onLongPress, isFavorite, onToggleFavorite, popularity }: MenuTileProps) {
  const gradient = CATEGORY_COLORS[item.category] || 'from-zinc-700 to-zinc-900 border-zinc-600/40'
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTap = useRef(0)
  const isPressing = useRef(false)
  const [feedback, setFeedback] = useState(false)

  const handleTouchStart = useCallback(() => {
    isPressing.current = true
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if (isPressing.current) {
          onLongPress()
          isPressing.current = false
        }
      }, LONG_PRESS_MS)
    }
  }, [onLongPress])

  const handleTouchEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    isPressing.current = false
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!isPressing.current && longPressTimer.current === null) {
      // Long press already fired — skip click
      if (!isPressing.current && !longPressTimer.current) return
    }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS && onDoubleClick) {
      // Double tap detected
      lastTap.current = 0
      onDoubleClick()
      return
    }
    lastTap.current = now

    // Single tap — delayed to allow double-tap detection
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => {
      if (lastTap.current !== 0) {
        onClick()
        setFeedback(true)
        setTimeout(() => setFeedback(false), 300)
      }
    }, DOUBLE_TAP_MS)
  }, [onClick, onDoubleClick])

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={() => { isPressing.current = false; if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
      className={`flex flex-col justify-between p-2 rounded-xl border bg-gradient-to-br ${gradient}
        text-left min-h-[100px] active:scale-[0.97] transition-transform cursor-pointer hover:brightness-110
        select-none relative overflow-hidden group/tile
        ${feedback ? 'ring-2 ring-white/30 scale-[0.97]' : ''}`}
    >
      {/* Image */}
      {item.imageUrl ? (
        <div className="absolute inset-0 opacity-15">
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : null}

      {/* Favorite star (top-right) */}
      {onToggleFavorite && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onToggleFavorite() } }}
          className={`absolute top-1.5 right-1.5 z-20 p-0.5 rounded-full transition-all cursor-pointer
            ${isFavorite ? 'text-amber-400 opacity-100' : 'text-white/20 opacity-0 group-hover/tile:opacity-100 hover:!text-amber-400'}`}
        >
          <Star className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
        </span>
      )}

      {/* Badges row */}
      <div className="flex gap-1 mb-1 relative z-10 pr-5">
        {popularity && popularity >= 3 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-500/40 rounded px-1 py-0.5 text-amber-300 font-bold">
            <Flame className="h-3 w-3" /> Popular
          </span>
        )}
        {item.prepTimeMinutes && (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-black/40 rounded px-1 py-0.5 text-zinc-300">
            <Clock className="h-3 w-3" /> {item.prepTimeMinutes}m
          </span>
        )}
        {(item as any).isNewLaunch && (
          <span className="text-[10px] bg-emerald-500/40 rounded px-1 py-0.5 text-emerald-300 font-bold">NUEVO</span>
        )}
        {item.stock <= 5 && item.stock > 0 && (
          <span className="text-[10px] bg-amber-500/40 rounded px-1 py-0.5 text-amber-300">Quedan {item.stock}</span>
        )}
        {item.stock === 0 && (
          <span className="text-[10px] bg-red-500/40 rounded px-1 py-0.5 text-red-300">Agotado</span>
        )}
      </div>

      {/* Name */}
      <div className="text-sm font-bold leading-tight text-white relative z-10 line-clamp-2">
        {item.name}
      </div>

      {/* Price */}
      <div className="text-base font-extrabold text-white/90 relative z-10 mt-1">
        {formatCOP(item.price)}
      </div>
    </button>
  )
}
