'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api'
import { BRAND } from '@/lib/brand'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function setFavicon(url: string) {
  if (!url) return
  const link = (document.querySelector("link[rel~='icon']") as HTMLLinkElement) || document.createElement('link')
  link.rel = 'icon'
  link.href = url
  document.head.appendChild(link)

  const apple = (document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement) || document.createElement('link')
  apple.rel = 'apple-touch-icon'
  apple.href = url
  document.head.appendChild(apple)
}

export function DynamicFavicon() {
  useEffect(() => {
    // 1) Favicon de plataforma (configurable desde superadmin). Por defecto el icono DAIMUZ.
    fetch(`${API_URL}/storefront/platform-settings`)
      .then(r => r.json())
      .then(j => setFavicon((j?.data?.platform_logo as string) || BRAND.icon))
      .catch(() => setFavicon(BRAND.icon))

    // 2) Si hay comercio autenticado con logo propio, lo sobrescribe (su marca en la pestaña).
    if (!api.getToken()) return
    api.getStoreCustomization().then((res) => {
      const logoUrl = res?.data?.storeInfo?.logoUrl
      if (logoUrl) setFavicon(logoUrl)
    }).catch(() => {})
  }, [])

  return null
}
