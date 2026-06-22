'use client'

/**
 * consumer-cart-store — Carrito COMPARTIDO del Consumer OS (C4b).
 * Separado del carrito POS (`useStore`) y del carrito interno de LandingPage.
 * Persiste en localStorage para sobrevivir cambios de tab/navegación dentro del OS.
 * Soporta multi-tienda (cada ítem lleva su tenantId/storeSlug) → el checkout agrupa
 * por comercio y crea un pedido por tienda (reusa /orders/public, ya endurecido).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ConsumerCartItem {
  productId: string
  name: string
  unitPrice: number
  image?: string | null
  storeSlug?: string | null
  storeName?: string | null
  tenantId?: string | null
  qty: number
}

interface ConsumerCartState {
  items: ConsumerCartItem[]
  add: (p: any, qty?: number) => void
  remove: (productId: string) => void
  setQty: (productId: string, qty: number) => void
  clear: () => void
}

export const useConsumerCart = create<ConsumerCartState>()(
  persist(
    (set) => ({
      items: [],
      add: (p, qty = 1) => set((s) => {
        const id = String(p.id)
        const price = p.isOnOffer && p.offerPrice ? Number(p.offerPrice) : Number(p.salePrice)
        const idx = s.items.findIndex(x => x.productId === id)
        if (idx >= 0) {
          const next = [...s.items]
          next[idx] = { ...next[idx], qty: next[idx].qty + qty }
          return { items: next }
        }
        return {
          items: [...s.items, {
            productId: id, name: p.name, unitPrice: price,
            image: p.imageUrl ?? null, storeSlug: p.storeSlug ?? null,
            storeName: p.storeName ?? null, tenantId: p.tenantId ?? null, qty,
          }],
        }
      }),
      remove: (id) => set((s) => ({ items: s.items.filter(x => x.productId !== id) })),
      setQty: (id, qty) => set((s) => ({
        items: qty <= 0 ? s.items.filter(x => x.productId !== id) : s.items.map(x => x.productId === id ? { ...x, qty } : x),
      })),
      clear: () => set({ items: [] }),
    }),
    { name: 'dz_consumer_cart' },
  ),
)

export const cartCount = (items: ConsumerCartItem[]) => items.reduce((a, x) => a + x.qty, 0)
export const cartSubtotal = (items: ConsumerCartItem[]) => items.reduce((a, x) => a + x.unitPrice * x.qty, 0)
