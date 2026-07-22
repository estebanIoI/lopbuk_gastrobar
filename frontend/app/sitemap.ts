import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://daimuz.alexsters.works'

// Sitemap base con las rutas públicas estables. Las tiendas por slug (/t/[slug])
// pueden añadirse dinámicamente consultando el backend cuando se quiera indexarlas.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/portfolio`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]
  return routes
}
