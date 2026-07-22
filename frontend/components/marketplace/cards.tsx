'use client'

import { MapPin, Flame } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { cldImg, cldSrcSet } from '@/utils/img'
import { GREEN, fmtCOP } from './theme'
import type { MarketStore, MarketProduct } from './types'

// ════════════════════════════════════════════════════════════════════════════
//  TARJETA DE COMERCIO (idéntica a la landing original)
// ════════════════════════════════════════════════════════════════════════════
export function StoreCard({
  store, onOpenStore, hasServices, ensureAbsoluteUrl,
}: {
  store: MarketStore
  onOpenStore: (s: MarketStore) => void
  hasServices: boolean
  ensureAbsoluteUrl: (u: string) => string
}) {
  const isExternal = !!store.externalUrl
  const isEmpty = !isExternal && store.productCount === 0
  return (
    <button
      onClick={() => { if (isExternal || !isEmpty) onOpenStore(store) }}
      className={`group relative bg-[#171717] rounded-2xl overflow-hidden text-left flex flex-col shadow-sm transition-all duration-300 border ${isEmpty ? 'cursor-default border-white/5 opacity-70' : 'hover:shadow-xl border-white/10 hover:border-white/25 cursor-pointer'}`}
    >
      {isEmpty && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] rounded-2xl">
          <span style={{ fontSize: '1.6rem', lineHeight: 1, marginBottom: '0.4rem' }}>🚧</span>
          <p style={{ color: '#d97706', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Próximamente</p>
        </div>
      )}
      {hasServices && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: 80, zIndex: 30, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 18, left: -22, width: 100, transform: 'rotate(-45deg)', background: 'linear-gradient(90deg,#7c3aed,#a855f7)', color: '#fff', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '3px 0', textAlign: 'center' }}>
            Servicios
          </div>
        </div>
      )}
      <div className="relative w-full bg-[#0e0e0e] overflow-hidden shrink-0" style={{ aspectRatio: '16/10' }}>
        {(store.coverUrl || store.logoUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldImg((store.coverUrl || store.logoUrl) as string, 500)} srcSet={cldSrcSet((store.coverUrl || store.logoUrl) as string, [300, 500, 800])} sizes="(max-width:640px) 100vw, 360px" loading="lazy" decoding="async" alt={store.name} className={`w-full h-full ${store.coverUrl ? 'object-cover' : 'object-contain p-4'} ${isEmpty ? '' : 'group-hover:scale-105'} transition-transform duration-500`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND.isotipo} alt={BRAND.name} className="w-16 h-16 object-contain opacity-30" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#171717] to-transparent pointer-events-none" />
        {isExternal ? (
          <span className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm bg-violet-500/20 text-violet-200 border border-violet-400/50">
            VISITAR ↗
          </span>
        ) : !isEmpty && (
          <span className={`absolute top-2.5 right-2.5 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm ${store.openState === 'closed' ? 'bg-red-500/20 text-red-300 border border-red-400/40' : 'bg-green-500/20 text-green-300 border border-green-400/50'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${store.openState === 'closed' ? 'bg-red-400' : 'bg-green-400'}`} />
            {store.openState === 'closed' ? 'CERRADO' : 'ABIERTO'}
          </span>
        )}
      </div>
      <div className="px-4 -mt-7 relative z-10 flex">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-[#1f1f1f] border-2 border-[#171717] shadow-lg flex items-center justify-center shrink-0">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cldImg(store.logoUrl, 160)} loading="lazy" decoding="async" alt={store.name} className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={BRAND.isotipo} alt={BRAND.name} className="w-full h-full object-contain p-1.5" />
          )}
        </div>
      </div>
      <div className="px-4 pt-2 pb-4 flex flex-col gap-1 mt-auto">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm sm:text-base font-bold text-white truncate">{store.name}</h3>
          {Boolean(store.isVerified) && (
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" role="img" aria-label="Verificado">
              <path fill="#3b82f6" d="M12 1l2.4 1.8 3 .2.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .2L12 23l-2.4-1.8-3-.2-.9-2.9L3.3 16l.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.2z"/>
              <path fill="#fff" d="M10.6 14.6l-2.2-2.2-1.1 1.1 3.3 3.3 6-6-1.1-1.1z"/>
            </svg>
          )}
        </div>
        {(store.cardDescription || store.businessType) && (
          <p className="text-[11px] sm:text-xs text-white/50 truncate">{store.cardDescription || store.businessType}</p>
        )}
        <div className="flex items-center gap-1 mt-1 text-[11px] text-white/40">
          <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
          <span className="truncate">
            {[
              // Solo mostramos "N Sedes" si hay 2 o más; con 0/1 mostramos solo la ubicación.
              (typeof store.sedeCount === 'number' && store.sedeCount >= 2) ? `${store.sedeCount} Sedes` : null,
              store.city || store.address || null,
            ].filter(Boolean).join(' · ')}
          </span>
        </div>
        {store.openState === 'closed' && store.nextOpenLabel && (
          <p className="text-[11px] text-gray-300 mt-0.5 truncate">🕒 {store.nextOpenLabel}</p>
        )}
      </div>
    </button>
  )
}

// ── Tarjeta de producto (estilo claro institucional) ──────────────────────────
export function ProductCard({ product, onOpen }: { product: MarketProduct; onOpen: (p: MarketProduct) => void }) {
  const isOffer = !!(product.isOnOffer && product.offerPrice)
  const discount = isOffer ? Math.round(((product.salePrice - (product.offerPrice as number)) / product.salePrice) * 100) : 0
  return (
    <button onClick={() => onOpen(product)} className="group text-left bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND.isotipo} alt={BRAND.name} className="w-12 h-12 object-contain opacity-40" />
          </div>
        )}
        {isOffer && (
          <span className="absolute top-2 left-2 flex items-center gap-1 text-white text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: '#dc2626' }}>
            <Flame className="w-2.5 h-2.5" />-{discount}%
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-0.5">
        <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">{product.name}</p>
        {product.storeName && <p className="text-[10px] uppercase tracking-wide text-gray-400 truncate">{product.storeName}</p>}
        <div className="flex items-center gap-2 mt-1">
          {isOffer ? (
            <>
              <span className="text-xs text-gray-400 line-through">{fmtCOP(product.salePrice)}</span>
              <span className="text-sm font-bold" style={{ color: GREEN }}>{fmtCOP(product.offerPrice as number)}</span>
            </>
          ) : (
            <span className="text-sm font-bold" style={{ color: GREEN }}>{fmtCOP(product.salePrice)}</span>
          )}
        </div>
      </div>
    </button>
  )
}
