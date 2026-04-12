'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export default function CustomSectionPage() {
  const params = useParams()
  const storeSlug = params?.storeSlug as string
  const sectionSlug = params?.sectionSlug as string

  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const blobRef = useRef<string | null>(null)

  useEffect(() => {
    if (!storeSlug || !sectionSlug) return

    fetch(`${API_URL}/storefront/custom-sections/public/${storeSlug}/${sectionSlug}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          const html: string = json.data.htmlContent || ''
          const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
          const url = URL.createObjectURL(blob)
          blobRef.current = url
          setBlobUrl(url)
          setName(json.data.name || '')
        } else {
          setError(json.error || 'Sección no encontrada')
        }
      })
      .catch(() => setError('Error al cargar la sección'))
      .finally(() => setLoading(false))

    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    }
  }, [storeSlug, sectionSlug])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error || !blobUrl) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#999' }}>
        <p>{error || 'Sección no encontrada'}</p>
      </div>
    )
  }

  return (
    <>
      {name && <title>{name}</title>}
      <iframe
        src={blobUrl}
        title={name}
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none' }}
        allow="fullscreen"
      />
    </>
  )
}
