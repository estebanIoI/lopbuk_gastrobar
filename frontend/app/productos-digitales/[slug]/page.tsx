'use client'

// Producto digital ACTIVO. Si es de pago y no hay acceso, CartillaPage muestra el
// muro de pago (con compra como invitado); si es gratis o adquirido, monta la
// experiencia completa (módulos, actividades, comunidad, retos, descargables).
import { useParams } from 'next/navigation'
import CartillaPage from '@/cartilla-inga/CartillaPage'

export default function ProductoDigitalActivoPage() {
  const params = useParams()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug as string)
  if (!slug) return null
  return <CartillaPage slug={slug} />
}
