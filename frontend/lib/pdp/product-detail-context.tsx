'use client'
// ── ProductDetailContext · estado único del PDP ──────────────────────────────
// Fase 1 del Motor de PDP. Centraliza el estado derivado de compra para que cada
// componente visual (ProductHeader, ProductPricing, StickyBuyBar, PurchaseCard…)
// consuma UNA sola fuente de verdad y no se pasen props entre sí. El Principio 2
// ("nunca repetir información") se vuelve estructural: precio/cantidad se leen del
// contexto, no se recalculan por bloque.
//
// Alcance de esta fase: estado de solo-lectura derivado. Las acciones (setVariant,
// pickPromo, addToCart, buyNow) se añaden al contexto a medida que se extraen los
// componentes que las necesitan, para no crecer el contrato antes de tiempo.

import { createContext, useContext, type ReactNode } from 'react'

export type PurchaseState = 'configuring' | 'ready'

export interface PdpContextValue {
  productId: string
  productName: string
  // precio
  unitPrice: number
  basePrice: number
  onOffer: boolean
  discountPct: number
  // stock
  available: number
  lowStock: boolean
  // prueba social
  ratingAvg: number
  ratingCount: number
  soldText: string | null
  // selección
  hasVariants: boolean
  quantity: number
  /** configuring = falta elegir variante · ready = se puede comprar */
  purchaseState: PurchaseState
}

const PdpContext = createContext<PdpContextValue | null>(null)

export function ProductDetailProvider({
  value,
  children,
}: {
  value: PdpContextValue
  children: ReactNode
}) {
  return <PdpContext.Provider value={value}>{children}</PdpContext.Provider>
}

export function usePdp(): PdpContextValue {
  const ctx = useContext(PdpContext)
  if (!ctx) throw new Error('usePdp() debe usarse dentro de <ProductDetailProvider>')
  return ctx
}
