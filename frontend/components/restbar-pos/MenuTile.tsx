'use client'

import type { MenuItem } from './PosShell'
import { Clock, Star, Leaf, Flame } from 'lucide-react'

interface MenuTileProps {
  item: MenuItem
  onClick: () => void
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

export function MenuTile({ item, onClick }: MenuTileProps) {
  const gradient = CATEGORY_COLORS[item.category] || 'from-zinc-700 to-zinc-900 border-zinc-600/40'

  return (
    <button
      onClick={onClick}
      className={`flex flex-col justify-between p-2 rounded-xl border bg-gradient-to-br ${gradient}
        text-left min-h-[100px] active:scale-[0.97] transition-transform cursor-pointer hover:brightness-110
        select-none relative overflow-hidden`}
    >
      {/* Image */}
      {item.imageUrl ? (
        <div className="absolute inset-0 opacity-15">
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : null}

      {/* Badges row */}
      <div className="flex gap-1 mb-1 relative z-10">
        {item.prepTimeMinutes && (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-black/40 rounded px-1 py-0.5 text-zinc-300">
            <Clock className="h-3 w-3" /> {item.prepTimeMinutes}m
          </span>
        )}
        {(item as any).isNewLaunch && (
          <span className="text-[10px] bg-emerald-500/40 rounded px-1 py-0.5 text-emerald-300 font-bold">NUEVO</span>
        )}
        {(item as any).stock <= 5 && (item as any).stock > 0 && (
          <span className="text-[10px] bg-amber-500/40 rounded px-1 py-0.5 text-amber-300">Quedan {item.stock}</span>
        )}
        {(item as any).stock === 0 && (
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
