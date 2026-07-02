'use client'

// Pantalla de éxito de compra como INVITADO. Recupera el estado por token (?c=)
// y muestra las descargas al confirmarse el pago en Wompi.
import { Suspense } from 'react'
import CompraExito from '@/cartilla-inga/CompraExito'

export default function ProductoDigitalExitoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F5F5]" />}>
      <CompraExito />
    </Suspense>
  )
}
