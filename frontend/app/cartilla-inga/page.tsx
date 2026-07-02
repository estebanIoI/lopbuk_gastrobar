'use client'

// Ruta legada: /cartilla-inga → /productos-digitales (canónica). Redirección
// permanente en cliente para no romper enlaces viejos ni redirects de Wompi.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CartillaIngaLegacyRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/productos-digitales') }, [router])
  return <div className="min-h-screen bg-[#F5F5F5]" />
}
