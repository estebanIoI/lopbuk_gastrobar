'use client'

/**
 * Link de campaña compartible: /l/<code>
 * Resuelve el link (share_links) y redirige según su tipo:
 *  - product    → /t/<slug>?product=<id>  (abre el modal del item)
 *  - store      → /t/<slug>               (tienda del comerciante)
 *  - collection → /?collection=<code>     (marketplace filtrado: solo esos comercios)
 * Pensado para pegar en una historia de IG/TikTok.
 */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BoxLoader } from '@/components/box-loader'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export default function ShareLinkPage() {
  const params = useParams()
  const router = useRouter()
  const code = Array.isArray(params?.code) ? params.code[0] : (params?.code as string)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!code) return
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/storefront/share/${code}`).then(r => r.json()).catch(() => null)
        if (!alive) return
        const data = res?.success ? res.data : null
        if (!data) { setNotFound(true); return }
        if (data.type === 'product' && data.config?.slug && data.config?.productId) {
          router.replace(`/t/${data.config.slug}?product=${encodeURIComponent(data.config.productId)}`)
        } else if (data.type === 'store' && data.config?.slug) {
          router.replace(`/t/${data.config.slug}`)
        } else if (data.type === 'collection') {
          router.replace(`/?collection=${encodeURIComponent(code)}`)
        } else {
          setNotFound(true)
        }
      } catch { if (alive) setNotFound(true) }
    })()
    return () => { alive = false }
  }, [code, router])

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
        <h1 className="text-lg font-bold text-gray-800">Enlace no disponible</h1>
        <p className="text-sm text-gray-500 mt-1">Este link expiró o no existe.</p>
      </div>
    )
  }
  return <BoxLoader />
}
