'use client'

/**
 * ExploreSection — marketplace MODULAR dentro del Consumer OS (C4a/C4b).
 * NO embebe LandingPage: compone módulos reutilizables (search + categorías +
 * grid de ProductCard) sobre los feeds del storefront. Contextual al objetivo del
 * usuario. La compra se delega al storefront del comercio (cart-safe); el carrito
 * inline compartido es el siguiente incremento (C4b-cart).
 */
import { useEffect, useMemo, useState } from 'react'
import { Search, Compass, Loader2, ExternalLink, Sparkles, Boxes, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import ProductCard from './ProductCard'
import { rankByGoal, topRecommended } from '@/lib/explore-recommend'
import LegendGate from '@/components/consumer/widgets/LegendGate'
import { useConsumerCart } from '@/lib/consumer-cart-store'

const COPx = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const priceOfP = (p: any) => (p.isOnOffer && p.offerPrice ? Number(p.offerPrice) : Number(p.salePrice))

const GOAL_LABEL: Record<string, string> = {
  bajar_peso: 'bajar de peso', subir_masa: 'subir masa', mantener: 'mantener tu forma', salud_general: 'salud general',
}

export default function ExploreSection({ goal, onFullStore, onGoPlanes }: { goal?: string; onFullStore?: () => void; onGoPlanes?: () => void }) {
  const addToCart = useConsumerCart(s => s.add)
  const [products, setProducts] = useState<any[]>([])
  const [serverRecs, setServerRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [legendPct, setLegendPct] = useState(0)

  useEffect(() => {
    api.getConsumerDiscounts().then(r => { if (r.success && r.data?.hasDiscounts) setLegendPct(Number(r.data.percentOff) || 0) }).catch(() => {})
    api.trackConsumerEvent('explore_opened').catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.allSettled([api.getPlatformFeatured(), api.getPublicNewLaunches()]).then(([f, n]) => {
      if (!alive) return
      const a = f.status === 'fulfilled' && (f.value as any)?.success ? ((f.value as any).data || []) : []
      const b = n.status === 'fulfilled' && (n.value as any)?.success ? ((n.value as any).data || []) : []
      const map = new Map<string, any>()
      ;[...a, ...b].forEach((p: any) => { if (p?.id != null) map.set(String(p.id), p) })
      setProducts([...map.values()])
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  // Recos contextuales desde el backend (con fallback al heurístico de front).
  useEffect(() => {
    if (!goal) { setServerRecs([]); return }
    let alive = true
    api.getRecommended(goal, 8).then(r => { if (alive && (r as any)?.success) setServerRecs((r as any).data || []) }).catch(() => {})
    return () => { alive = false }
  }, [goal])

  const cats = useMemo(
    () => Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[],
    [products],
  )
  const filtered = useMemo(() => {
    const base = products.filter(p =>
      (cat === 'all' || p.category === cat) &&
      (!q.trim() || String(p.name || '').toLowerCase().includes(q.trim().toLowerCase())),
    )
    return rankByGoal(base, goal)   // recomendación contextual: más relevantes primero
  }, [products, cat, q, goal])

  // "Recomendado para ti": backend si respondió, si no el heurístico de front.
  // Solo cuando no hay búsqueda/categoría activa.
  const recommended = useMemo(
    () => (q.trim() || cat !== 'all') ? [] : (serverRecs.length ? serverRecs : topRecommended(products, goal, 8)),
    [serverRecs, products, goal, q, cat],
  )

  // Smart combo: arma un combo con los top recomendados para el objetivo.
  const combo = recommended.slice(0, 3)
  const comboTotal = combo.reduce((s, p) => s + priceOfP(p), 0)
  const addCombo = () => { combo.forEach(p => addToCart(p, 1)); api.trackConsumerEvent('smart_combo_clicked', { count: combo.length }).catch(() => {}) }

  const openStore = (slug?: string) => { if (slug) window.location.assign(`/?store=${encodeURIComponent(slug)}`) }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header contextual */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2"><Compass className="w-5 h-5 text-emerald-500" /> Explore</h2>
          <p className="text-sm text-neutral-500">
            {goal ? `Recomendado para tu objetivo: ${GOAL_LABEL[goal] || goal}.` : 'Productos de comercios DAIMUZ para tu estilo de vida.'}
          </p>
        </div>
        {onFullStore && (
          <button onClick={onFullStore} className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
            Ver tienda completa <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar productos…"
          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:border-emerald-400"
        />
      </div>

      {/* Recomendado para tu objetivo (contextual) */}
      {!loading && recommended.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-bold text-neutral-800 mb-2 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-500" /> Recomendado para ti</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {recommended.map(p => (
              <div key={`rec-${p.id}`} className="w-40 shrink-0">
                <ProductCard p={p} onOpen={openStore} legendPct={legendPct} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Combos (LEGEND) — soft paywall para Free */}
      {!loading && combo.length >= 2 && (
        <div className="mb-5">
          <LegendGate
            entitlement="smart_combos"
            onUpgrade={onGoPlanes}
            title="Combos inteligentes"
            perks={['Combos armados para tu objetivo', 'Agrega todo en un toque', 'Solo para miembros LEGEND']}
            teaser={
              <div className="rounded-2xl bg-white border border-black/[0.07] p-4">
                <p className="text-sm font-bold mb-2">Combo para tu objetivo</p>
                <div className="flex gap-2">{combo.map(p => <div key={p.id} className="w-16 h-16 rounded-lg bg-neutral-100" />)}</div>
              </div>
            }
          >
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-200 p-4">
              <p className="text-sm font-bold text-neutral-800 mb-1 flex items-center gap-1.5"><Boxes className="w-4 h-4 text-amber-500" /> Combo para tu objetivo</p>
              <p className="text-[11px] text-neutral-500 mb-3">Armado con tus productos más afines.</p>
              <div className="flex items-center gap-2 mb-3 overflow-x-auto">
                {combo.map(p => (
                  <div key={p.id} className="w-20 shrink-0 text-center">
                    <div className="w-20 h-20 rounded-lg bg-neutral-100 overflow-hidden">{p.imageUrl && <img src={String(p.imageUrl).startsWith('http') ? p.imageUrl : (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api$/, '') + p.imageUrl} alt={p.name} className="w-full h-full object-cover" />}</div>
                    <p className="text-[10px] text-neutral-600 mt-1 line-clamp-2 leading-tight">{p.name}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-neutral-900">{COPx(comboTotal)}</span>
                <button onClick={addCombo} className="rounded-lg bg-amber-500 text-white text-sm font-semibold px-3 py-2 inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Agregar combo</button>
              </div>
            </div>
          </LegendGate>
        </div>
      )}

      {/* Categorías */}
      {cats.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 -mx-1 px-1">
          {['all', ...cats].map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${cat === c ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              {c === 'all' ? 'Todos' : c}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16 text-neutral-300"><Loader2 className="w-7 h-7 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-neutral-400 py-16 text-sm">No encontramos productos.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(p => <ProductCard key={p.id} p={p} onOpen={openStore} legendPct={legendPct} />)}
        </div>
      )}
    </div>
  )
}
