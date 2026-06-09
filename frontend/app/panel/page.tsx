'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_SLUG } from '@/lib/panel-sections'

/** /panel sin sección -> redirige al panel por defecto. */
export default function PanelIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/panel/${DEFAULT_SLUG}`)
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
