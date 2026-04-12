'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export default function CustomSectionPage() {
  const params = useParams()
  const storeSlug = params?.storeSlug as string
  const sectionSlug = params?.sectionSlug as string
  const [error, setError] = useState('')

  useEffect(() => {
    if (!storeSlug || !sectionSlug) return

    fetch(`${API_URL}/storefront/custom-sections/public/${storeSlug}/${sectionSlug}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.htmlContent) {
          // Replace the entire document with the HTML template
          document.open('text/html')
          document.write(json.data.htmlContent)
          document.close()
        } else {
          setError(json.error || 'Sección no encontrada')
        }
      })
      .catch(() => setError('Error al cargar la sección'))
  }, [storeSlug, sectionSlug])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#999' }}>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
