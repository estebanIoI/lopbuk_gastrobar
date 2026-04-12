'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export default function CustomSectionPage() {
  const params = useParams()
  const storeSlug = params?.storeSlug as string
  const sectionSlug = params?.sectionSlug as string

  const [html, setHtml] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!storeSlug || !sectionSlug) return
    fetch(`${API_URL}/storefront/custom-sections/public/${storeSlug}/${sectionSlug}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setHtml(json.data.htmlContent || '')
          setName(json.data.name || '')
        } else {
          setError(json.error || 'Sección no encontrada')
        }
      })
      .catch(() => setError('Error al cargar la sección'))
      .finally(() => setLoading(false))
  }, [storeSlug, sectionSlug])

  // Adjust iframe height to fit content
  useEffect(() => {
    if (!iframeRef.current || html === null) return
    const iframe = iframeRef.current
    const onLoad = () => {
      try {
        const body = iframe.contentDocument?.body
        if (body) {
          iframe.style.height = body.scrollHeight + 'px'
        }
      } catch { /* cross-origin, ignore */ }
    }
    iframe.addEventListener('load', onLoad)
    return () => iframe.removeEventListener('load', onLoad)
  }, [html])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || html === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-400 text-sm">{error || 'Sección no encontrada'}</p>
      </div>
    )
  }

  return (
    <div style={{ margin: 0, padding: 0, minHeight: '100vh' }}>
      {name && (
        <title>{name}</title>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title={name}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        style={{
          width: '100%',
          minHeight: '100vh',
          border: 'none',
          display: 'block',
        }}
        onLoad={() => {
          try {
            const body = iframeRef.current?.contentDocument?.body
            if (body && iframeRef.current) {
              iframeRef.current.style.height = body.scrollHeight + 'px'
            }
          } catch { /* ignore */ }
        }}
      />
    </div>
  )
}
