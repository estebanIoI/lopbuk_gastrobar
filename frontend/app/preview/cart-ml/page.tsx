'use client'

/**
 * Preview de las piezas ML del carrito y checkout:
 *  - StoreCardML (tarjeta del comercio dentro del carrito)
 *  - OrderCompletedML (pantalla "Pedido Completado")
 * Ruta: /preview/cart-ml — datos mock, no toca el storefront real.
 */
import { useState } from 'react'
import { StoreCardML } from '@/components/theme-ml/store-card-ml'
import { OrderCompletedML } from '@/components/theme-ml/order-completed-ml'
import type { PedidoConfirmado } from '@/types'

const img = (seed: string) => `https://picsum.photos/seed/${seed}/200/200`

const pedido: PedidoConfirmado = {
  numeroPedido: 'LB-2026-0418',
  email: 'cliente@correo.com',
  total: 287800,
  fecha: new Date().toLocaleString('es-CO'),
  productos: [
    { id: 1, nombre: 'Extractor De Jugos Mertec MT-041S Gris', precio: 143900, cantidad: 1, imagen: img('p1') },
    { id: 2, nombre: 'Set de Vasos de Vidrio x6', precio: 71950, cantidad: 2, imagen: img('p2') },
  ],
}

export default function PreviewCartMLPage() {
  const [showDone, setShowDone] = useState(false)
  return (
    <div className="min-h-screen bg-[#ededed] py-8 px-4">
      <div className="mx-auto max-w-md space-y-4">
        <h2 className="text-sm font-semibold text-[#333]">Tarjeta del comercio (dentro del carrito)</h2>
        <StoreCardML
          name="Mertec"
          isOfficial
          logoUrl={img('logo')}
          followersText="+10 Seguidores"
          productsText="+500 Productos"
          level="MercadoLíder Platinum"
          levelTagline="¡Uno de los mejores del sitio!"
          reputation={5}
          salesText="+10 mil"
          onFollow={() => alert('Seguir')}
          onGoToStore={() => alert('Ir a la tienda')}
        />

        <button
          onClick={() => setShowDone(true)}
          className="w-full rounded-md py-3 text-sm font-medium text-white"
          style={{ backgroundColor: '#3483fa' }}
        >
          Ver pantalla "Pedido Completado"
        </button>
      </div>

      {showDone && (
        <OrderCompletedML pedido={pedido} storeName="Mertec" onCerrar={() => setShowDone(false)} />
      )}
    </div>
  )
}
