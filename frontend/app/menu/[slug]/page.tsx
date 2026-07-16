'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Search, Clock, ChefHat, GlassWater, UtensilsCrossed, Flame, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const AREA_ICON: Record<string, any> = {
  cocina: ChefHat,
  bar:    GlassWater,
  ambos:  UtensilsCrossed,
}

// ── Device fingerprint ────────────────────────────────────────────────────────
function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('lopbuk_did')
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('lopbuk_did', id)
  }
  return id
}

function getLikedSet(): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try { return new Set(JSON.parse(localStorage.getItem('lopbuk_likes') || '[]')) }
  catch { return new Set() }
}

function saveLikedSet(s: Set<number>) {
  localStorage.setItem('lopbuk_likes', JSON.stringify([...s]))
}

// ── Heart SVG ─────────────────────────────────────────────────────────────────
function Heart({ filled, className = 'w-8 h-8' }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

// ── TikTok feed ───────────────────────────────────────────────────────────────
function TikTokFeed({
  items,
  initialIndex,
  slug,
  onClose,
  onLikeChange,
}: {
  items: MenuItem[]
  initialIndex: number
  slug: string
  onClose: () => void
  onLikeChange: (id: number, newCount: number, liked: boolean) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentIdx, setCurrentIdx] = useState(initialIndex)
  const [likedIds, setLikedIds] = useState<Set<number>>(() => getLikedSet())
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {}
    items.forEach(i => { m[i.id] = i.likes })
    return m
  })
  const [animId, setAnimId] = useState<number | null>(null)

  // Scroll to initial item without animation
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = initialIndex * window.innerHeight
  }, [initialIndex])

  // Track current item via scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const i = Math.round(el.scrollTop / window.innerHeight)
      setCurrentIdx(Math.max(0, Math.min(i, items.length - 1)))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [items.length])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleLike = useCallback(async (itemId: number) => {
    if (likedIds.has(itemId)) return
    const deviceId = getDeviceId()
    const newLiked = new Set(likedIds)
    newLiked.add(itemId)
    setLikedIds(newLiked)
    saveLikedSet(newLiked)
    const newCount = (likeCounts[itemId] ?? 0) + 1
    setLikeCounts(prev => ({ ...prev, [itemId]: newCount }))
    setAnimId(itemId)
    setTimeout(() => setAnimId(null), 700)
    onLikeChange(itemId, newCount, true)
    try {
      const r = await fetch(`${API_URL}/restbar/public-menu-like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: itemId, tenantSlug: slug, deviceId }),
      })
      const j = await r.json()
      if (j.success) {
        setLikeCounts(prev => ({ ...prev, [itemId]: j.data.likes }))
        onLikeChange(itemId, j.data.likes, true)
      }
    } catch {}
  }, [likedIds, likeCounts, slug, onLikeChange])

  return (
    <div className="fixed inset-0 z-50 bg-black">

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/90 hover:bg-black/70 transition-colors"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 right-4 z-30 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
        <span className="text-white/80 text-xs font-semibold tabular-nums">{currentIdx + 1} / {items.length}</span>
      </div>

      {/* Scrollable feed */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', scrollBehavior: 'auto' }}
      >
        {items.map((item, i) => {
          const AreaIcon = item.preparationArea ? AREA_ICON[item.preparationArea] : null
          const liked = likedIds.has(item.id)
          const count = likeCounts[item.id] ?? item.likes

          return (
            <div
              key={item.id}
              className="relative w-full flex-shrink-0"
              style={{ height: '100svh', scrollSnapAlign: 'start' }}
            >
              {/* Full-screen background image */}
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading={Math.abs(i - initialIndex) <= 2 ? 'eager' : 'lazy'}
                />
              ) : (
                <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                  <UtensilsCrossed className="h-20 w-20 text-white/10" />
                </div>
              )}

              {/* Gradient layers */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/40" />

              {/* Top badges */}
              <div className="absolute top-16 left-4 flex items-center gap-2" style={{ top: 'calc(max(1rem, env(safe-area-inset-top)) + 3rem)' }}>
                {item.prepTimeMinutes && (
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs text-white/90 font-semibold">{item.prepTimeMinutes} min</span>
                  </div>
                )}
                {AreaIcon && (
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <AreaIcon className="h-3.5 w-3.5 text-white/80" />
                  </div>
                )}
              </div>

              {/* Right side action column (TikTok style) */}
              <div className="absolute right-4 bottom-36 flex flex-col items-center gap-5 z-10">

                {/* Like button */}
                <button
                  type="button"
                  onClick={() => handleLike(item.id)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150',
                    liked
                      ? 'bg-rose-500/30 text-rose-400'
                      : 'bg-white/10 backdrop-blur-sm text-white/70 group-hover:bg-white/20',
                    animId === item.id && 'scale-125',
                  )}>
                    <Heart filled={liked} className="w-6 h-6" />
                  </div>
                  <span className={cn(
                    'text-xs font-bold tabular-nums',
                    liked ? 'text-rose-400' : 'text-white/80',
                  )}>
                    {count > 0 ? count : ''}
                  </span>
                </button>
              </div>

              {/* Bottom info */}
              <div
                className="absolute bottom-0 inset-x-0 px-5 pb-8 space-y-2"
                style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
              >
                {/* Category + most-liked badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  {item.category && (
                    <span className="text-[11px] px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/60 uppercase tracking-wide">
                      {item.category}
                    </span>
                  )}
                  {count >= 5 && (
                    <span className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-semibold backdrop-blur-sm">
                      <Flame className="w-3 h-3" />
                      Favorito
                    </span>
                  )}
                </div>

                {/* Name */}
                <h2 className="text-2xl font-black text-white leading-tight drop-shadow-lg">{item.name}</h2>

                {/* Price */}
                <p className="text-xl font-bold text-amber-400 tabular-nums">{formatCOP(item.price)}</p>

                {/* Description */}
                {item.description && (
                  <p className="text-sm text-white/60 leading-relaxed line-clamp-2">{item.description}</p>
                )}

                {/* Scroll hint on first item */}
                {i === initialIndex && items.length > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2 text-white/30">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 animate-bounce">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                    <span className="text-xs tracking-wide">Desliza para ver más</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MenuItem {
  id: number
  name: string
  category: string
  description: string | null
  price: number
  imageUrl: string | null
  preparationArea: string | null
  prepTimeMinutes: number | null
  likes: number
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PublicMenuPage() {
  const params = useParams()
  const slug   = params?.slug as string

  const [storeName, setStoreName]   = useState('')
  const [categories, setCategories] = useState<Record<string, MenuItem[]>>({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all')
  const [sortByLikes, setSortByLikes] = useState(false)
  const [storyIndex, setStoryIndex] = useState<number | null>(null)
  const [likedIds] = useState<Set<number>>(() => getLikedSet())
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

  // Update like count in grid when user likes from feed
  const handleLikeChange = useCallback((id: number, newCount: number, liked: boolean) => {
    if (liked) {
      const newLiked = new Set(getLikedSet())
      newLiked.add(id)
      saveLikedSet(newLiked)
    }
    setCategories(prev => {
      const next: Record<string, MenuItem[]> = {}
      for (const [cat, items] of Object.entries(prev)) {
        next[cat] = items.map(item => item.id === id ? { ...item, likes: newCount } : item)
      }
      return next
    })
  }, [])

  const catNames = Object.keys(categories)
  const allItems = Object.values(categories).flat()
  const searchLower = search.toLowerCase()

  const visibleItems = (() => {
    const base = activeCategory === 'all' ? allItems : (categories[activeCategory] ?? [])
    const filtered = !search.trim() ? base : base.filter(i =>
      i.name.toLowerCase().includes(searchLower) ||
      (i.description ?? '').toLowerCase().includes(searchLower)
    )
    if (sortByLikes) return [...filtered].sort((a, b) => b.likes - a.likes)
    return filtered
  })()

  const maxLikes = Math.max(...allItems.map(i => i.likes), 1)

  const scrollCatIntoView = (cat: string) => {
    setActiveCategory(cat)
    const bar = catBarRef.current
    if (!bar) return
    const btn = bar.querySelector(`[data-cat="${cat}"]`) as HTMLElement
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  const openFeed = (item: MenuItem) => {
    const idx = visibleItems.findIndex(i => i.id === item.id)
    if (idx >= 0) setStoryIndex(idx)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 text-white px-6">
      <UtensilsCrossed className="h-12 w-12 opacity-30" />
      <p className="text-center text-white/40">{error}</p>
    </div>
  )

  // Grouped by category for the "all" non-sorted view
  const groupedForDisplay: Array<{ cat: string; items: MenuItem[] }> = (() => {
    if (activeCategory !== 'all' || search.trim() || sortByLikes) return []
    return catNames.map(cat => ({ cat, items: categories[cat] }))
  })()

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Fixed header ── */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-white/8">

        {/* Store name */}
        <div className="px-4 pt-4 pb-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-amber-400 shrink-0" />
            <h1 className="text-base font-semibold tracking-wide text-white">{storeName}</h1>
          </div>
          <p className="text-[11px] text-white/40 mt-0.5 uppercase tracking-widest">Menú</p>
        </div>

        {/* Search + sort */}
        <div className="px-4 pb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="search"
              placeholder="Buscar platillo, bebida..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 bg-white/6 border border-white/10 rounded-xl pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortByLikes(v => !v)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-semibold transition-all',
              sortByLikes
                ? 'bg-amber-400/20 border-amber-400/50 text-amber-400'
                : 'bg-white/6 border-white/10 text-white/50 hover:text-white/70',
            )}
          >
            <Flame className="w-3.5 h-3.5" />
            Top
          </button>
        </div>

        {/* Category chips */}
        {catNames.length > 1 && (
          <div ref={catBarRef} className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3">
            <button
              data-cat="all"
              onClick={() => scrollCatIntoView('all')}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                activeCategory === 'all' ? 'bg-amber-400 text-zinc-900' : 'bg-white/8 text-white/60 hover:bg-white/15',
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
                  activeCategory === cat ? 'bg-amber-400 text-zinc-900' : 'bg-white/8 text-white/60 hover:bg-white/15',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div className="max-w-2xl mx-auto px-3 py-4 pb-24">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-white/30">
            <Search className="h-10 w-10" />
            <p className="text-sm">Sin resultados</p>
          </div>
        ) : groupedForDisplay.length > 0 ? (
          /* Grouped by category */
          <div className="space-y-8">
            {groupedForDisplay.map(({ cat, items }) => (
              <section key={cat}>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-amber-400/70 mb-3 px-1">{cat}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {items.map(item => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      liked={likedIds.has(item.id)}
                      maxLikes={maxLikes}
                      onClick={() => openFeed(item)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          /* Flat grid (search / category filter / sort by likes) */
          <>
            {sortByLikes && (
              <p className="text-[11px] text-amber-400/70 uppercase tracking-widest font-bold mb-3 px-1">
                🔥 Más gustados primero
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {visibleItems.map(item => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  liked={likedIds.has(item.id)}
                  maxLikes={maxLikes}
                  onClick={() => openFeed(item)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="fixed bottom-0 inset-x-0 bg-zinc-950/90 backdrop-blur border-t border-white/8 py-3 text-center">
        <p className="text-[11px] text-white/25 uppercase tracking-widest">Powered by Daimuz</p>
      </div>

      {/* ── TikTok feed ── */}
      {storyIndex !== null && visibleItems.length > 0 && (
        <TikTokFeed
          items={visibleItems}
          initialIndex={storyIndex}
          slug={slug}
          onClose={() => setStoryIndex(null)}
          onLikeChange={handleLikeChange}
        />
      )}
    </div>
  )
}

// ── Grid card ─────────────────────────────────────────────────────────────────
function MenuItemCard({
  item,
  liked,
  maxLikes,
  onClick,
}: {
  item: MenuItem
  liked: boolean
  maxLikes: number
  onClick: () => void
}) {
  const AreaIcon = item.preparationArea ? AREA_ICON[item.preparationArea] : null
  const isTop = item.likes > 0 && item.likes === maxLikes

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl bg-white/4 border border-white/8 active:scale-[0.97] transition-transform text-left w-full"
    >
      {/* Image area */}
      <div className="relative aspect-[3/4] w-full">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
            <UtensilsCrossed className="h-10 w-10 text-white/15" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {item.prepTimeMinutes && (
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
              <Clock className="h-2.5 w-2.5 text-amber-400" />
              <span className="text-[10px] text-white/90 font-medium">{item.prepTimeMinutes}m</span>
            </div>
          )}
        </div>
        {AreaIcon && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1.5">
            <AreaIcon className="h-3 w-3 text-white/80" />
          </div>
        )}

        {/* Most liked crown */}
        {isTop && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <span className="text-base">👑</span>
          </div>
        )}

        {/* Like count bubble */}
        {item.likes > 0 && (
          <div className={cn(
            'absolute bottom-9 right-2 flex items-center gap-1 rounded-full px-2 py-1 backdrop-blur-sm text-[11px] font-bold',
            liked ? 'bg-rose-500/30 text-rose-400' : 'bg-black/60 text-white/60',
          )}>
            <Heart filled={liked} className="w-3 h-3" />
            {item.likes}
          </div>
        )}

        {/* Name + price */}
        <div className="absolute bottom-0 inset-x-0 px-3 pb-3">
          <p className="font-bold text-sm leading-tight text-white line-clamp-2 drop-shadow">{item.name}</p>
          <p className="text-sm font-black text-amber-400 tabular-nums mt-0.5 drop-shadow">{formatCOP(item.price)}</p>
        </div>
      </div>

      {/* Description below image */}
      {item.description && (
        <p className="px-3 py-2 text-[11px] text-white/45 line-clamp-2 leading-snug">{item.description}</p>
      )}
    </button>
  )
}
