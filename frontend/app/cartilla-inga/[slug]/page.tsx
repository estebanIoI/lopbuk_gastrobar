'use client'

// Ruta legada: /cartilla-inga/[slug] → /productos-digitales/[slug] (canónica).
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function CartillaIngaActivaLegacyRedirect() {
  const router = useRouter()
  const params = useParams()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug as string)
  useEffect(() => {
    router.replace(slug ? `/productos-digitales/${slug}` : '/productos-digitales')
  }, [router, slug])
  return <div className="min-h-screen bg-[#F5F5F5]" />
}
