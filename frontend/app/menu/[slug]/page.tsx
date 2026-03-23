'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Search, Clock, ChefHat, GlassWater, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const AREA_ICON: Record<string, any> = {
  cocina: ChefHat,
  bar:    GlassWater,
  ambos:  UtensilsCrossed,
}

export default function PublicMenuPage() {
  const params = useParams()
  const slug   = params?.slug as string

  const [storeName, setStoreName]   = useState('')
  const [categories, setCategories] = useState<Record<string, any[]>>({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const catBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`${API_URL}/restbar/public-menu/${slug}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setStoreName(json.data.storeName)
          setCategories(json.data.categories)
        } else {
          setError(json.error || 'Menú no disponible')
        }
      })
      .catch(() => setError('Error al cargar el menú'))
      .finally(() => setLoading(false))
  }, [slug])

  const catNames    = Object.keys(categories)
  const allItems    = Object.values(categories).flat()
  const searchLower = search.toLowerCase()

  const visibleItems = (() => {
    const base = activeCategory === 'all' ? allItems : (categories[activeCategory] ?? [])
    if (!search.trim()) return base
    return base.filter(i =>
      i.name.toLowerCase().includes(searchLower) ||
      (i.description ?? '').toLowerCase().includes(searchLower)
    )
  })()

  // Scroll category chip into view
  const scrollCatIntoView = (cat: string) => {
    setActiveCategory(cat)
    const bar = catBarRef.current
    if (!bar) return
    const btn = bar.querySelector(`[data-cat="${cat}"]`) as HTMLElement
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 text-white px-6">
      <UtensilsCrossed className="h-12 w-12 opacity-30" />
      <p className="text-center text-muted-foreground">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Fixed header ── */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-white/8">
        {/* Store name bar */}
        <div className="px-4 pt-4 pb-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-amber-400 shrink-0" />
            <h1 className="text-base font-semibold tracking-wide text-white">{storeName}</h1>
          </div>
          <p className="text-[11px] text-white/40 mt-0.5 uppercase tracking-widest">Menú</p>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="search"
              placeholder="Buscar platillo, bebida..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 bg-white/6 border border-white/10 rounded-xl pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:bg-white/8 transition-colors"
            />
          </div>
        </div>

        {/* Category chips */}
        {catNames.length > 1 && (
          <div
            ref={catBarRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3"
          >
            <button
              data-cat="all"
              onClick={() => scrollCatIntoView('all')}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                activeCategory === 'all'
                  ? 'bg-amber-400 text-zinc-900'
                  : 'bg-white/8 text-white/60 hover:bg-white/15',
              )}
            >
              Todo
            </button>
            {catNames.map(cat => (
              <button
                key={cat}
                data-cat={cat}
                onClick={() => scrollCatIntoView(cat)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap',
                  activeCategory === cat
                    ? 'bg-amber-400 text-zinc-900'
                    : 'bg-white/8 text-white/60 hover:bg-white/15',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Items ── */}
      <div className="max-w-2xl mx-auto px-3 py-4 pb-20">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-white/30">
            <Search className="h-10 w-10" />
            <p className="text-sm">Sin resultados</p>
          </div>
        ) : (
          /* Group by category when "all" selected */
          activeCategory === 'all' && !search.trim() ? (
            <div className="space-y-8">
              {catNames.map(cat => (
                <section key={cat}>
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-amber-400/70 mb-3 px-1">
                    {cat}
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {categories[cat].map(item => (
                      <MenuItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visibleItems.map(item => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Footer ── */}
      <div className="fixed bottom-0 inset-x-0 bg-zinc-950/90 backdrop-blur border-t border-white/8 py-3 text-center">
        <p className="text-[11px] text-white/25 uppercase tracking-widest">Powered by Lopbuk</p>
      </div>
    </div>
  )
}

function MenuItemCard({ item }: { item: any }) {
  const AreaIcon = AREA_ICON[item.preparationArea]

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/4 border border-white/8 active:scale-[0.98] transition-transform">
      {/* Image */}
      <div className="relative aspect-[3/4] w-full">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
            <UtensilsCrossed className="h-10 w-10 text-white/15" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        {/* Badge área preparación */}
        {AreaIcon && (
          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-1.5">
            <AreaIcon className="h-3.5 w-3.5 text-white/80" />
          </div>
        )}

        {/* Tiempo */}
        {item.prepTimeMinutes && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
            <Clock className="h-3 w-3 text-amber-400" />
            <span className="text-[11px] text-white/90 font-medium">{item.prepTimeMinutes}m</span>
          </div>
        )}

        {/* Name + price overlaid at bottom */}
        <div className="absolute bottom-0 inset-x-0 px-3 pb-3 pt-6">
          <p className="font-bold text-sm leading-tight text-white line-clamp-2 drop-shadow">
            {item.name}
          </p>
          <p className="text-base font-black text-amber-400 tabular-nums mt-1 drop-shadow">
            {formatCOP(item.price)}
          </p>
        </div>
      </div>

      {/* Description (below image, only if exists) */}
      {item.description && (
        <p className="px-3 py-2 text-[11px] text-white/45 line-clamp-2 leading-snug">
          {item.description}
        </p>
      )}
    </div>
  )
}
