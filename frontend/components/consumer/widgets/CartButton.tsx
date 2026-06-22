'use client'

/**
 * CartButton — botón de carrito global del Consumer OS (C4b). Muestra el contador
 * y abre el CartDrawer. Reutilizable en ambos shells (sidebar desktop + header móvil).
 */
import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import CartDrawer from '@/components/consumer/sections/explore/CartDrawer'
import { useConsumerCart, cartCount } from '@/lib/consumer-cart-store'

export default function CartButton({ className = '', label }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const items = useConsumerCart(s => s.items)
  const count = cartCount(items)
  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        <span className="relative inline-flex">
          <ShoppingBag className="w-5 h-5" />
          {count > 0 && (
            <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{count}</span>
          )}
        </span>
        {label && <span>{label}</span>}
      </button>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
