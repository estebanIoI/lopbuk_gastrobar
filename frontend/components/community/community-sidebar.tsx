'use client'

import React, { useEffect, useState } from 'react'
import { Sparkles, Store, ShoppingBag, ArrowRight, TrendingUp, Tag } from 'lucide-react'
import { communityApi, formatCOP, type PublicProductLite } from './api'
import { LOGIN_PATH } from '@/lib/login-path'

/** Tarjeta "Sobre DAIMUZ" — se muestra también compacta en móvil. */
export function AboutCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
      <div className="flex items-center gap-2 font-extrabold">
        <Sparkles className="w-5 h-5" /> DAIMUZ <span className="font-medium opacity-90">Comunidad</span>
      </div>
      {!compact && (
        <p className="text-sm text-white/90 mt-2">
          Noticias, novedades y ofertas de los comercios locales. Descubre tiendas, productos y todo lo que pasa en DAIMUZ.
        </p>
      )}
      <a href="/" className="mt-3 inline-flex items-center gap-1.5 bg-white text-cyan-700 font-semibold text-sm px-3.5 py-2 rounded-full">
        <Store className="w-4 h-4" /> Explorar comercios
      </a>
    </div>
  )
}

/** Widget de productos públicos destacados (contenido real de los comercios). */
function FeaturedProducts() {
  const [items, setItems] = useState<PublicProductLite[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    communityApi.searchProducts('').then(p => { if (alive) setItems(p.slice(0, 5)) }).catch(() => {}).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  if (loading || items.length === 0) return null
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <h3 className="font-bold text-gray-900 flex items-center gap-1.5 text-sm mb-3"><TrendingUp className="w-4 h-4 text-cyan-600" /> Productos destacados</h3>
      <div className="space-y-2.5">
        {items.map(p => {
          const price = p.isOnOffer && p.offerPrice ? p.offerPrice : p.salePrice
          return (
            <a key={p.id} href={`/t/${p.storeSlug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group">
              <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ShoppingBag className="w-4 h-4" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-cyan-700">{p.name}</p>
                <p className="text-xs text-gray-400 truncate">{p.storeName} · <span className="font-semibold text-gray-600">{formatCOP(Number(price))}</span></p>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

/** CTA para comercios. */
function MerchantCTA() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5"><Tag className="w-4 h-4 text-emerald-600" /> ¿Tienes un comercio?</h3>
      <p className="text-xs text-gray-500 mt-1">Publica tus productos y aparece en la comunidad.</p>
      <a href={LOGIN_PATH} className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">Empezar <ArrowRight className="w-4 h-4" /></a>
    </div>
  )
}

/** Sidebar derecho (solo escritorio). */
export function CommunitySidebar() {
  return (
    <aside className="hidden lg:flex flex-col gap-4 w-72 xl:w-80 shrink-0 sticky top-24 self-start">
      <AboutCard />
      <FeaturedProducts />
      <MerchantCTA />
      <p className="text-[11px] text-gray-400 px-1">© {new Date().getFullYear()} DAIMUZ · Comunidad</p>
    </aside>
  )
}

export default CommunitySidebar
