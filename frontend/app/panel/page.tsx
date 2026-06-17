'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_SLUG } from '@/lib/panel-sections'
import { FullPageLoader } from '@/components/box-loader'

/** /panel sin sección -> redirige al panel por defecto. */
export default function PanelIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/panel/${DEFAULT_SLUG}`)
  }, [router])
  return <FullPageLoader />
}
