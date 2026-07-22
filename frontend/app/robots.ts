import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://daimuz.alexsters.works'

// robots.txt generado por Next (App Router). Permite el sitio público y bloquea
// las áreas privadas/operativas que no deben indexarse.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/panel/',
          '/login',
          '/acceso/',
          '/hidden/',
          '/api/',
          '/wallet/',
          '/delivery-os/',
          '/modo-chat/',
          '/respaldos/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
