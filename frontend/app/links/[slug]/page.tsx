'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatCOP } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface LinkItem { label: string; url: string; color?: string; image?: string }

interface ShopProduct {
  id: number
  name: string
  category?: string | null
  brand?: string | null
  description?: string | null
  salePrice: number
  imageUrl?: string | null
  images?: string[]
  stock?: number | null
  color?: string | null
  size?: string | null
  isOnOffer?: number | boolean | null
  offerPrice?: number | null
  offerLabel?: string | null
}

interface StoreData {
  slug: string
  name: string
  logoUrl: string | null
  email: string | null
  phone: string | null
  socialInstagram: string | null
  socialFacebook: string | null
  socialTiktok: string | null
  socialWhatsapp: string | null
  contactPageTitle: string | null
  contactPageDescription: string | null
  contactPageImage: string | null
  contactPageLinks: string | null
  contactPageLinkTheme: string | null
  shopProducts: ShopProduct[]
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.79 1.53V6.77a4.85 4.85 0 0 1-1.02-.08z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  )
}

export default function LinksPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [data, setData] = useState<StoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'links' | 'shop'>('links')
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null)

  useEffect(() => {
    if (!selectedProduct) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedProduct(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedProduct])

  useEffect(() => {
    if (!slug) return
    fetch(`${API_URL}/storefront/links/${slug}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data)
        else setError(json.error || 'Página no encontrada')
      })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-gray-400 text-sm">{error || 'Página no encontrada'}</p>
    </div>
  )

  let links: LinkItem[] = []
  try { links = data.contactPageLinks ? JSON.parse(data.contactPageLinks) : [] } catch { links = [] }

  const products = data.shopProducts || []
  const linkTheme = data.contactPageLinkTheme || 'theme1'
  const isTheme2 = linkTheme === 'theme2'

  const hasSocials = data.socialInstagram || data.socialFacebook || data.socialTiktok || data.socialWhatsapp
  const catalogUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?store=${slug}`

  return (
    <div className={`min-h-screen flex flex-col items-center pb-16 ${isTheme2 ? 'bg-black' : 'bg-gray-50'}`}>
      <div className="w-full max-w-sm mx-auto px-4 pt-10 flex flex-col items-center">

        {/* Avatar / Logo */}
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 shadow-md mb-4 bg-gray-200">
          {data.logoUrl || data.contactPageImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.contactPageImage || data.logoUrl!}
              alt={data.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <span className="text-3xl font-bold text-gray-400">{data.name.charAt(0)}</span>
            </div>
          )}
        </div>

        {/* Name */}
        <h1 className={`text-lg font-bold tracking-wide uppercase text-center ${isTheme2 ? 'text-white' : 'text-gray-900'}`}>
          {data.contactPageTitle || data.name}
        </h1>

        {/* Description */}
        {data.contactPageDescription && (
          <p className={`text-sm text-center mt-1 leading-snug ${isTheme2 ? 'text-gray-400' : 'text-gray-500'}`}>
            {data.contactPageDescription}
          </p>
        )}

        {/* Social icons */}
        {hasSocials && (
          <div className="flex items-center gap-4 mt-4">
            {data.socialTiktok && (
              <a href={data.socialTiktok} target="_blank" rel="noopener noreferrer"
                className={`transition-colors ${isTheme2 ? 'text-gray-400 hover:text-white' : 'text-gray-700 hover:text-black'}`}>
                <TikTokIcon />
              </a>
            )}
            {data.socialInstagram && (
              <a href={data.socialInstagram} target="_blank" rel="noopener noreferrer"
                className={`transition-colors ${isTheme2 ? 'text-gray-400 hover:text-pink-400' : 'text-gray-700 hover:text-pink-600'}`}>
                <InstagramIcon />
              </a>
            )}
            {data.socialFacebook && (
              <a href={data.socialFacebook} target="_blank" rel="noopener noreferrer"
                className={`transition-colors ${isTheme2 ? 'text-gray-400 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'}`}>
                <FacebookIcon />
              </a>
            )}
            {data.socialWhatsapp && (
              <a href={data.socialWhatsapp} target="_blank" rel="noopener noreferrer"
                className={`transition-colors ${isTheme2 ? 'text-gray-400 hover:text-green-400' : 'text-gray-700 hover:text-green-500'}`}>
                <WhatsAppIcon />
              </a>
            )}
          </div>
        )}

        {/* Tab selector */}
        <div className={`flex w-full mt-6 rounded-full p-1 gap-1 ${isTheme2 ? 'bg-white/10' : 'bg-gray-100'}`}>
          <button
            onClick={() => setActiveTab('links')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'links'
                ? isTheme2 ? 'bg-white text-black shadow-sm' : 'bg-gray-900 text-white shadow-sm'
                : isTheme2 ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Links
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'shop'
                ? isTheme2 ? 'bg-white text-black shadow-sm' : 'bg-gray-900 text-white shadow-sm'
                : isTheme2 ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Shop
          </button>
        </div>

        {/* Links tab */}
        {activeTab === 'links' && (
          <div className="w-full mt-4 space-y-3">
            {links.length === 0 ? (
              <p className={`text-center text-sm py-8 ${isTheme2 ? 'text-gray-500' : 'text-gray-400'}`}>Sin links configurados</p>
            ) : isTheme2 ? (
              /* ── Theme 2: image cards ── */
              links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block w-full rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
                  style={{ height: '140px' }}
                >
                  {/* Background image or fallback gradient */}
                  {link.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={link.image}
                      alt={link.label}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
                  )}
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-black/40" />
                  {/* Link icon top-left */}
                  <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-white">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  {/* Label bottom */}
                  <div className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-8 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-sm font-bold tracking-wide uppercase">{link.label || link.url}</p>
                  </div>
                </a>
              ))
            ) : (
              /* ── Theme 1: simple buttons ── */
              links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-4 px-6 rounded-2xl border border-gray-200 bg-white text-gray-900 text-sm font-semibold tracking-wide uppercase shadow-sm hover:shadow-md hover:border-gray-300 active:scale-[0.98] transition-all"
                  style={link.color ? { borderColor: link.color, color: link.color } : {}}
                >
                  {link.label || link.url}
                </a>
              ))
            )}
          </div>
        )}

        {/* Shop tab */}
        {activeTab === 'shop' && (
          <div className="w-full mt-4 space-y-4">
            {products.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Sin productos configurados</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.map(product => {
                  const mainImage = (product.images && product.images[0]) || product.imageUrl || ''
                  const isOffer = Boolean(product.isOnOffer && product.offerPrice)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="text-left rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                      <div className="relative w-full h-28 bg-gray-100">
                        {mainImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                            Sin imagen
                          </div>
                        )}
                        {isOffer && (
                          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black text-white uppercase tracking-wide">
                            {product.offerLabel || 'Oferta'}
                          </span>
                        )}
                      </div>
                      <div className="p-3 space-y-1">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                          {product.name}
                        </p>
                        <div className="text-xs text-gray-500">
                          {isOffer ? (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 font-semibold">{formatCOP(product.offerPrice || 0)}</span>
                              <span className="line-through">{formatCOP(product.salePrice)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-900 font-semibold">{formatCOP(product.salePrice)}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <a
              href={catalogUrl}
              className="block w-full text-center py-4 px-6 rounded-2xl bg-gray-900 text-white text-sm font-semibold tracking-wide uppercase shadow-sm hover:bg-gray-800 active:scale-[0.98] transition-all"
            >
              Ver catálogo completo
            </a>
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
            onClick={() => setSelectedProduct(null)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden">
            <div className="relative h-56 bg-gray-100">
              {((selectedProduct.images && selectedProduct.images[0]) || selectedProduct.imageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(selectedProduct.images && selectedProduct.images[0]) || selectedProduct.imageUrl || ''}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                  Sin imagen
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-gray-700 shadow flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-gray-900">{selectedProduct.name}</h2>
                {(selectedProduct.brand || selectedProduct.category) && (
                  <p className="text-xs text-gray-500">
                    {[selectedProduct.brand, selectedProduct.category].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>

              <div>
                {Boolean(selectedProduct.isOnOffer && selectedProduct.offerPrice) ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900">{formatCOP(selectedProduct.offerPrice || 0)}</span>
                    <span className="text-sm text-gray-400 line-through">{formatCOP(selectedProduct.salePrice)}</span>
                    {selectedProduct.offerLabel && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-black text-white uppercase tracking-wide">
                        {selectedProduct.offerLabel}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-lg font-semibold text-gray-900">{formatCOP(selectedProduct.salePrice)}</span>
                )}
              </div>

              {selectedProduct.description && (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {selectedProduct.description}
                </p>
              )}

              {(selectedProduct.color || selectedProduct.size) && (
                <div className="text-xs text-gray-500">
                  {selectedProduct.color && <span>Color: {selectedProduct.color}</span>}
                  {selectedProduct.color && selectedProduct.size && <span className="mx-2">|</span>}
                  {selectedProduct.size && <span>Talla: {selectedProduct.size}</span>}
                </div>
              )}

              <a
                href={catalogUrl}
                className="block w-full text-center py-3 px-4 rounded-2xl bg-gray-900 text-white text-sm font-semibold tracking-wide uppercase shadow-sm hover:bg-gray-800 active:scale-[0.98] transition-all"
              >
                Ir al catálogo
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`fixed bottom-0 inset-x-0 py-3 text-center backdrop-blur ${isTheme2 ? 'bg-black/80' : 'bg-gray-50/80'}`}>
        <p className={`text-[11px] uppercase tracking-widest ${isTheme2 ? 'text-gray-600' : 'text-gray-300'}`}>Powered by Lopbuk</p>
      </div>
    </div>
  )
}
