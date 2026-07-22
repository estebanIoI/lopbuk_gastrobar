'use client'

import { useEffect, useState, useCallback, useRef, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { formatCOP } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ── Device fingerprint (persisted in localStorage) ───────────────────────────
function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('lopbuk_did')
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('lopbuk_did', id)
  }
  return id
}

function getLikedSet(): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try { return new Set(JSON.parse(localStorage.getItem('lopbuk_likes') || '[]')) }
  catch { return new Set() }
}

function saveLikedSet(s: Set<number>) {
  localStorage.setItem('lopbuk_likes', JSON.stringify([...s]))
}

// ── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(targetDate: string | null | undefined) {
  const calc = useCallback(() => {
    if (!targetDate) return null
    const diff = new Date(targetDate).getTime() - Date.now()
    if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return { expired: false, days, hours, minutes, seconds }
  }, [targetDate])

  const [time, setTime] = useState(calc)
  useEffect(() => {
    if (!targetDate) return
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  }, [targetDate, calc])
  return time
}

function formatShipRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) return null
  const fmt = (d: string) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  return fmt((start || end)!)
}

// ── Types ────────────────────────────────────────────────────────────────────
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
  productType?: string | null
  weight?: number | null
  hardwareWeightUnit?: string | null
  isPreorder?: number | boolean | null
  preorderWindowEnd?: string | null
  preorderShipStart?: string | null
  preorderShipEnd?: string | null
  preorderBadgeText?: string | null
  preorderPolicyText?: string | null
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
  contactPageSocialImages: string | null
  contactPageSettings: string | null
  socialX: string | null
  socialSnapchat: string | null
  reservationsEnabled?: boolean
  shopProducts: ShopProduct[]
}

// ── Social icons ─────────────────────────────────────────────────────────────
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
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function SnapchatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.304 4.972-.01.179-.02.353-.026.521.263.15.698.226 1.08.226.378 0 .744-.079.993-.226.018-.011.032-.017.058-.017.076 0 .157.055.193.131.048.1.066.238-.073.42-.218.294-.62.613-1.394.8-.18.046-.365.09-.558.13.127.284.299.616.501.89.388.536.827.876 1.42.876.093 0 .188-.012.286-.036.293-.074.62-.121.966-.121.423 0 .833.086 1.189.253.55.254.888.657.888 1.09 0 .516-.471.969-1.289 1.127-.253.049-.527.091-.822.134-.62.09-1.324.187-1.848.465-.332.177-.575.487-.575.811 0 .174.059.342.178.499.336.45.802.975.946 1.581.076.32.048.628-.082.878-.218.424-.676.64-1.386.64-.416 0-.882-.09-1.406-.27-.575-.199-1.164-.297-1.752-.297-.604 0-1.216.1-1.817.3-.513.175-.968.263-1.376.263-.756 0-1.224-.226-1.424-.691-.147-.338-.157-.73-.026-1.106.147-.402.454-.74.848-1.102.11-.1.211-.197.302-.291.371-.384.567-.78.567-1.146 0-.494-.354-.966-.881-1.191-.457-.195-.943-.3-1.442-.312-.499-.011-.959.072-1.33.249-.19.088-.372.162-.545.218-.299.096-.58.143-.855.143-.454 0-.831-.132-1.124-.393-.262-.234-.413-.553-.413-.881 0-.399.217-.783.611-1.085.431-.33.921-.515 1.415-.624.298-.065.583-.115.848-.162.533-.097.986-.195 1.36-.368.52-.242.778-.63.778-1.144 0-.263-.082-.524-.242-.768-.382-.584-.527-1.29-.4-1.958.204-1.076.927-1.988 1.935-2.453C11.007.913 11.594.793 12.206.793z" />
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

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

// ── Capturador de email (contacto) ──────────────────────────────────────────────
// Campo de email + botón "Connect". Al enviar: guarda el correo (módulo Newsletter),
// muestra "¡Listo!" y desaparece. Recuerda por visitante (localStorage) para no reaparecer.
function EmailCaptureBox({ slug, isTheme2, title, buttonText, logoUrl }: {
  slug: string; isTheme2: boolean; title?: string; buttonText?: string; logoUrl?: string | null
}) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'hidden'>('idle')
  useEffect(() => {
    try { if (localStorage.getItem(`emailcap_${slug}`)) setState('hidden') } catch { /* ignore */ }
  }, [slug])
  if (state === 'hidden') return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return
    setState('loading')
    try {
      await fetch(`${API_URL}/newsletter/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), acceptedTerms: true, store: slug }),
      })
    } catch { /* red — igual mostramos éxito para no frustrar al cliente */ }
    try { localStorage.setItem(`emailcap_${slug}`, '1') } catch { /* ignore */ }
    setState('success')
    setTimeout(() => setState('hidden'), 2600)
  }

  const surface = isTheme2 ? 'bg-white/10 border-white/15' : 'bg-white border-gray-200'
  const textMuted = isTheme2 ? 'text-white/70' : 'text-gray-500'
  const textStrong = isTheme2 ? 'text-white' : 'text-gray-900'

  if (state === 'success') {
    return (
      <div className={`w-full rounded-2xl border ${surface} p-4 flex items-center gap-3 transition-all`}>
        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-5 h-5"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <div>
          <p className={`text-sm font-bold ${textStrong}`}>¡Listo! Gracias por conectar</p>
          <p className={`text-xs ${textMuted}`}>Te escribiremos pronto.</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="w-full">
      {title && <p className={`text-sm font-semibold mb-2 text-center ${textStrong}`}>{title}</p>}
      <div className={`flex items-center gap-1 w-full rounded-full border ${surface} p-1`}>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className={`flex-1 min-w-0 bg-transparent px-4 py-2.5 text-sm outline-none ${textStrong} ${isTheme2 ? 'placeholder:text-white/50' : 'placeholder:text-gray-400'}`}
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className={`shrink-0 flex items-center gap-2 pl-4 pr-1.5 py-1.5 rounded-full font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 ${isTheme2 ? 'bg-white text-black' : 'bg-gray-900 text-white'}`}
        >
          {state === 'loading' ? 'Enviando…' : (buttonText || 'Connect')}
          {logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
            : <span className={`w-7 h-7 rounded-full flex items-center justify-center ${isTheme2 ? 'bg-black/10' : 'bg-white/20'}`}>→</span>}
        </button>
      </div>
    </form>
  )
}

// ── Heart icon ────────────────────────────────────────────────────────────────
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-7 h-7">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

// ── Full-screen story viewer ───────────────────────────────────────────────────
function MenuStoryViewer({
  products,
  initialIndex,
  slug,
  catalogUrl,
  onClose,
}: {
  products: ShopProduct[]
  initialIndex: number
  slug: string
  catalogUrl: string
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIndex)
  const [likedIds, setLikedIds] = useState<Set<number>>(() => getLikedSet())
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({})
  const [heartAnim, setHeartAnim] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const product = products[idx]
  const isPreorder = Boolean(product?.isPreorder)
  const countdown = useCountdown(isPreorder ? product?.preorderWindowEnd : null)
  const preorderExpired = countdown?.expired ?? (
    product?.preorderWindowEnd ? new Date(product.preorderWindowEnd).getTime() < Date.now() : false
  )
  const shipRange = formatShipRange(product?.preorderShipStart, product?.preorderShipEnd)

  const liked = likedIds.has(product?.id)
  const likeCount = likeCounts[product?.id] ?? 0

  // Fetch initial like counts for all products
  useEffect(() => {
    products.forEach(p => {
      fetch(`${API_URL}/restbar/public-menu-likes/${p.id}`)
        .then(r => r.json())
        .then(j => { if (j.success) setLikeCounts(prev => ({ ...prev, [p.id]: j.data.likes })) })
        .catch(() => {})
    })
  }, [products])

  const goNext = useCallback(() => {
    setIdx(i => Math.min(i + 1, products.length - 1))
    setShowPolicy(false)
  }, [products.length])

  const goPrev = useCallback(() => {
    setIdx(i => Math.max(i - 1, 0))
    setShowPolicy(false)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goNext, goPrev])

  // Swipe handling
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) goNext()
      else goPrev()
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  const handleLike = async () => {
    if (liked) return
    const deviceId = getDeviceId()
    const newLiked = new Set(likedIds)
    newLiked.add(product.id)
    setLikedIds(newLiked)
    saveLikedSet(newLiked)
    setLikeCounts(prev => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + 1 }))
    setHeartAnim(true)
    setTimeout(() => setHeartAnim(false), 600)
    try {
      const r = await fetch(`${API_URL}/restbar/public-menu-like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, tenantSlug: slug, deviceId }),
      })
      const j = await r.json()
      if (j.success) setLikeCounts(prev => ({ ...prev, [product.id]: j.data.likes }))
    } catch {}
  }

  const mainImage = (product?.images && product.images[0]) || product?.imageUrl || ''
  const isOffer = Boolean(product?.isOnOffer && product?.offerPrice)

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Background blurred image */}
      {mainImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mainImage}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-110"
        />
      )}

      {/* Progress dots */}
      <div className="absolute top-4 inset-x-0 flex justify-center gap-1.5 px-4 z-10">
        {products.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { setIdx(i); setShowPolicy(false) }}
            className={`h-1 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-3 bg-white/30'}`}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-10 right-4 z-10 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Main image */}
      <div className="absolute inset-0 flex items-center justify-center">
        {mainImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mainImage}
            alt={product?.name}
            className="max-h-[65vh] max-w-full object-contain"
            style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))' }}
          />
        ) : (
          <div className="w-64 h-64 flex items-center justify-center text-white/30">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-20 h-20 opacity-40">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Left / Right tap zones */}
      <button
        type="button"
        onClick={goPrev}
        disabled={idx === 0}
        className="absolute left-0 top-0 bottom-0 w-1/4 z-10 flex items-center justify-start pl-3 opacity-0 hover:opacity-100 transition-opacity disabled:pointer-events-none"
        aria-label="Anterior"
      >
        <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
      </button>
      <button
        type="button"
        onClick={goNext}
        disabled={idx === products.length - 1}
        className="absolute right-0 top-0 bottom-0 w-1/4 z-10 flex items-center justify-end pr-3 opacity-0 hover:opacity-100 transition-opacity disabled:pointer-events-none"
        aria-label="Siguiente"
      >
        <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </button>

      {/* Bottom info panel */}
      <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent pt-20 pb-8 px-5 space-y-3">

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {isPreorder && (
            <span className={`text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-wide ${preorderExpired ? 'bg-gray-600 text-white' : 'bg-amber-500 text-white'}`}>
              {preorderExpired ? 'Pre-orden cerrada' : (product?.preorderBadgeText || 'Pre-orden')}
            </span>
          )}
          {isOffer && (
            <span className="text-[11px] px-3 py-1 rounded-full bg-rose-500 text-white font-bold uppercase tracking-wide">
              {product?.offerLabel || 'Oferta'}
            </span>
          )}
          {product?.category && (
            <span className="text-[11px] px-3 py-1 rounded-full bg-white/10 text-white/70 uppercase tracking-wide">
              {product.category}
            </span>
          )}
        </div>

        {/* Name + brand */}
        <div>
          <h2 className="text-2xl font-bold text-white leading-tight">{product?.name}</h2>
          {product?.brand && <p className="text-sm text-white/60 mt-0.5">{product.brand}</p>}
        </div>

        {/* Price */}
        <div className="flex items-center gap-3">
          {isOffer ? (
            <>
              <span className="text-2xl font-bold text-rose-400">{formatCOP(product?.offerPrice || 0)}</span>
              <span className="text-base text-white/40 line-through">{formatCOP(product?.salePrice || 0)}</span>
            </>
          ) : (
            <span className="text-2xl font-bold text-white">{formatCOP(product?.salePrice || 0)}</span>
          )}
        </div>

        {/* Description */}
        {product?.description && (
          <p className="text-sm text-white/70 leading-relaxed line-clamp-2">{product.description}</p>
        )}

        {/* Pre-order countdown */}
        {isPreorder && !preorderExpired && countdown && !countdown.expired && product?.preorderWindowEnd && (
          <div>
            <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wide mb-1.5">Cierra en</p>
            <div className="flex gap-2">
              {[
                { v: countdown.days, l: 'días' },
                { v: countdown.hours, l: 'hrs' },
                { v: countdown.minutes, l: 'min' },
                { v: countdown.seconds, l: 'seg' },
              ].map(({ v, l }) => (
                <div key={l} className="flex-1 bg-white/10 backdrop-blur rounded-xl text-center py-2 border border-white/10">
                  <p className="text-lg font-bold text-amber-300 leading-none">{String(v).padStart(2, '0')}</p>
                  <p className="text-[10px] text-amber-500 uppercase">{l}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ship range */}
        {shipRange && (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>📦</span>
            <span>Envío: {shipRange}</span>
          </div>
        )}

        {/* Policy toggle */}
        {product?.preorderPolicyText && (
          <div>
            <button type="button" onClick={() => setShowPolicy(v => !v)} className="text-xs text-amber-400 underline underline-offset-2">
              {showPolicy ? 'Ocultar política' : '¿Qué es una pre-orden?'}
            </button>
            {showPolicy && <p className="mt-1.5 text-xs text-white/60 leading-relaxed">{product.preorderPolicyText}</p>}
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-3 pt-1">
          {/* Like button */}
          <button
            type="button"
            onClick={handleLike}
            className={`flex items-center gap-1.5 transition-all ${liked ? 'text-rose-400' : 'text-white/60 hover:text-white'}`}
          >
            <span className={`transition-transform ${heartAnim ? 'scale-150' : 'scale-100'}`}>
              <HeartIcon filled={liked} />
            </span>
            {likeCount > 0 && <span className="text-sm font-semibold">{likeCount}</span>}
          </button>

          {/* CTA button */}
          <a
            href={catalogUrl}
            className={`flex-1 block text-center py-3 px-4 rounded-2xl text-sm font-semibold tracking-wide uppercase transition-all active:scale-[0.98] ${
              preorderExpired && isPreorder
                ? 'bg-white/20 text-white/40 pointer-events-none'
                : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            {isPreorder && !preorderExpired ? 'Reservar ahora' : isPreorder && preorderExpired ? 'Pre-orden cerrada' : 'Ver catálogo'}
          </a>
        </div>

        {/* Swipe hint (only on first item, first render) */}
        {idx === 0 && products.length > 1 && (
          <p className="text-center text-[11px] text-white/30 tracking-wide">Desliza para ver más platillos →</p>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LinksPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [data, setData] = useState<StoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'links' | 'shop'>('links')
  const [storyIndex, setStoryIndex] = useState<number | null>(null)

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
  const hasSocials = data.socialInstagram || data.socialFacebook || data.socialTiktok || data.socialWhatsapp || data.socialX || data.socialSnapchat

  // Imágenes de fondo por red (grid estilo "MY SOCIALS"). Cada red con imagen se
  // muestra como tarjeta; sin imagen, sigue como icono en la cabecera.
  let socialImages: Record<string, string> = {}
  try {
    const raw = data.contactPageSocialImages
    socialImages = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
  } catch { socialImages = {} }
  const socialCards = [
    { key: 'instagram', url: data.socialInstagram, label: 'Instagram', icon: <InstagramIcon /> },
    { key: 'snapchat', url: data.socialSnapchat, label: 'Snapchat', icon: <SnapchatIcon /> },
    { key: 'tiktok', url: data.socialTiktok, label: 'TikTok', icon: <TikTokIcon /> },
    { key: 'facebook', url: data.socialFacebook, label: 'Facebook', icon: <FacebookIcon /> },
    { key: 'x', url: data.socialX, label: 'X', icon: <XIcon /> },
    { key: 'whatsapp', url: data.socialWhatsapp, label: 'WhatsApp', icon: <WhatsAppIcon /> },
  ].filter(s => s.url && socialImages[s.key])
  const hasSocialGrid = isTheme2 && socialCards.length > 0

  // Ajustes de la página: ocultar selector de pestañas + capturador de email.
  let contactSettings: { hideTabs?: boolean; emailCapture?: boolean; emailCaptureTitle?: string; emailCaptureButton?: string } = {}
  try {
    const raw = data.contactPageSettings
    contactSettings = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
  } catch { contactSettings = {} }
  const hideTabs = !!contactSettings.hideTabs

  // Detecta la red de un link personalizado (por nombre o URL) para mostrar su icono de marca.
  const brandIconFor = (text: string) => {
    const t = (text || '').toLowerCase()
    if (t.includes('instagram')) return <InstagramIcon />
    if (t.includes('tiktok')) return <TikTokIcon />
    if (t.includes('youtube') || t.includes('youtu.be')) return <YouTubeIcon />
    if (t.includes('facebook') || t.includes('fb.com')) return <FacebookIcon />
    if (t.includes('whatsapp') || t.includes('wa.me')) return <WhatsAppIcon />
    if (t.includes('snapchat')) return <SnapchatIcon />
    if (t.includes('twitter') || t.includes('x.com')) return <XIcon />
    return null
  }
  const catalogUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?store=${slug}`

  const socialLinks = (
    <>
      {data.socialTiktok && (
        <a href={data.socialTiktok} target="_blank" rel="noopener noreferrer"
          className={`transition-colors ${isTheme2 ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-black'}`}>
          <TikTokIcon />
        </a>
      )}
      {data.socialSnapchat && (
        <a href={data.socialSnapchat} target="_blank" rel="noopener noreferrer"
          className={`transition-colors ${isTheme2 ? 'text-white/80 hover:text-yellow-400' : 'text-gray-700 hover:text-yellow-400'}`}>
          <SnapchatIcon />
        </a>
      )}
      {data.socialInstagram && (
        <a href={data.socialInstagram} target="_blank" rel="noopener noreferrer"
          className={`transition-colors ${isTheme2 ? 'text-white/80 hover:text-pink-400' : 'text-gray-700 hover:text-pink-600'}`}>
          <InstagramIcon />
        </a>
      )}
      {data.socialX && (
        <a href={data.socialX} target="_blank" rel="noopener noreferrer"
          className={`transition-colors ${isTheme2 ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-black'}`}>
          <XIcon />
        </a>
      )}
      {data.socialFacebook && (
        <a href={data.socialFacebook} target="_blank" rel="noopener noreferrer"
          className={`transition-colors ${isTheme2 ? 'text-white/80 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'}`}>
          <FacebookIcon />
        </a>
      )}
      {data.socialWhatsapp && (
        <a href={data.socialWhatsapp} target="_blank" rel="noopener noreferrer"
          className={`transition-colors ${isTheme2 ? 'text-white/80 hover:text-green-400' : 'text-gray-700 hover:text-green-500'}`}>
          <WhatsAppIcon />
        </a>
      )}
    </>
  )

  return (
    <div className={`min-h-screen flex flex-col items-center pb-16 ${isTheme2 ? 'bg-black' : 'bg-gray-50'}`}>

      {/* Theme 2: full-width cover image header */}
      {isTheme2 ? (
        <div className="w-full max-w-sm mx-auto">
          <div className="relative w-full" style={{ height: '420px' }}>
            {(data.contactPageImage || data.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.contactPageImage || data.logoUrl!} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 px-4 pb-4 flex flex-col items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-wide text-center">{data.contactPageTitle || data.name}</h1>
              {data.contactPageDescription && <p className="text-sm text-white/70 text-center leading-snug">{data.contactPageDescription}</p>}
              {hasSocials && <div className="flex items-center gap-3 mt-1">{socialLinks}</div>}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`w-full max-w-sm mx-auto px-4 flex flex-col items-center ${isTheme2 ? 'pt-0' : 'pt-10'}`}>

        {/* Theme 1: circle avatar header */}
        {!isTheme2 && (
          <>
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 shadow-md mb-4 bg-gray-200">
              {data.logoUrl || data.contactPageImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.contactPageImage || data.logoUrl!} alt={data.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-3xl font-bold text-gray-400">{data.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <h1 className="text-lg font-bold tracking-wide uppercase text-center text-gray-900">{data.contactPageTitle || data.name}</h1>
            {data.contactPageDescription && <p className="text-sm text-center mt-1 leading-snug text-gray-500">{data.contactPageDescription}</p>}
            {hasSocials && <div className="flex items-center gap-4 mt-4">{socialLinks}</div>}
          </>
        )}

        {/* Capturador de email (contacto) — si el comercio lo activó */}
        {contactSettings.emailCapture && (
          <div className={isTheme2 ? 'w-full mt-4' : 'w-full mt-6'}>
            <EmailCaptureBox
              slug={slug}
              isTheme2={isTheme2}
              title={contactSettings.emailCaptureTitle}
              buttonText={contactSettings.emailCaptureButton}
              logoUrl={data.logoUrl}
            />
          </div>
        )}

        {/* Tab selector — se puede ocultar desde el editor (hideTabs) */}
        {!hideTabs && (
        <div className={`flex w-full rounded-full p-1 gap-1 ${isTheme2 ? 'bg-white/10 mt-4' : 'bg-gray-100 mt-6'}`}>
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
            Menú
          </button>
        </div>
        )}

        {/* Links tab — cuando el selector está oculto, se muestra siempre este contenido */}
        {(hideTabs || activeTab === 'links') && (
          <div className="w-full mt-4 space-y-3">
            {data.reservationsEnabled && (
              <a
                href={`/reservar/${slug}`}
                className={`flex items-center justify-center gap-2 w-full py-4 px-6 rounded-2xl text-sm font-semibold tracking-wide uppercase transition-all active:scale-[0.98] ${
                  isTheme2 ? 'bg-black text-white hover:bg-zinc-900' : 'bg-gray-900 text-white border border-gray-800 hover:bg-gray-800'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Reservar mesa
              </a>
            )}

            {/* ── Grid "MY SOCIALS": redes con imagen de fondo (tema 2) ── */}
            {hasSocialGrid && (
              <div className="pt-1">
                <h2 className="text-center text-white text-lg font-extrabold tracking-widest uppercase mb-3">Mis redes</h2>
                <div className="grid grid-cols-2 gap-3">
                  {socialCards.map(s => (
                    <a key={s.key} href={s.url!} target="_blank" rel="noopener noreferrer"
                      className="relative block rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
                      style={{ height: '150px' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={socialImages[s.key]} alt={s.label} className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                      <div className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-black">
                        {s.icon}
                      </div>
                      <div className="absolute bottom-0 inset-x-0 px-3 pb-3 pt-8">
                        <p className="text-white text-sm font-bold tracking-wide text-center">{s.label}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {links.length === 0 && !data.reservationsEnabled && !hasSocialGrid ? (
              <p className={`text-center text-sm py-8 ${isTheme2 ? 'text-gray-500' : 'text-gray-400'}`}>Sin links configurados</p>
            ) : links.length === 0 ? null : isTheme2 ? (
              links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="relative block w-full rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
                  style={{ height: '140px' }}>
                  {link.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={link.image} alt={link.label} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
                  )}
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-black">
                    {brandIconFor(`${link.label || ''} ${link.url || ''}`) || (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-black">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    )}
                  </div>
                  <div className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-8 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-sm font-bold tracking-wide uppercase text-center">{link.label || link.url}</p>
                  </div>
                </a>
              ))
            ) : (
              links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="block w-full text-center py-4 px-6 rounded-2xl border border-gray-200 bg-white text-gray-900 text-sm font-semibold tracking-wide uppercase shadow-sm hover:shadow-md hover:border-gray-300 active:scale-[0.98] transition-all"
                  style={link.color ? { borderColor: link.color, color: link.color } : {}}>
                  {link.label || link.url}
                </a>
              ))
            )}
          </div>
        )}

        {/* Shop / Menú tab */}
        {activeTab === 'shop' && (
          <div className="w-full mt-4 space-y-4">
            {products.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Sin productos configurados</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.map((product, i) => {
                  const mainImage = (product.images && product.images[0]) || product.imageUrl || ''
                  const isOffer = Boolean(product.isOnOffer && product.offerPrice)
                  const isPreorder = Boolean(product.isPreorder)
                  const preorderExpired = product.preorderWindowEnd
                    ? new Date(product.preorderWindowEnd).getTime() < Date.now()
                    : false
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setStoryIndex(i)}
                      className="text-left rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                      <div className="relative w-full h-28 bg-gray-100">
                        {mainImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Sin imagen</div>
                        )}
                        {/* Heart indicator */}
                        <div className="absolute bottom-1.5 right-2 text-rose-400 opacity-70">
                          <HeartIcon filled={false} />
                        </div>
                        {isPreorder && !isOffer && (
                          <span className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-bold ${preorderExpired ? 'bg-gray-400 text-white' : 'bg-amber-500 text-white'}`}>
                            {preorderExpired ? 'Cerrado' : (product.preorderBadgeText || 'Pre-orden')}
                          </span>
                        )}
                        {isOffer && (
                          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white uppercase tracking-wide font-bold">
                            {product.offerLabel || 'Oferta'}
                          </span>
                        )}
                      </div>
                      <div className="p-3 space-y-1">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                        <div className="text-xs text-gray-500">
                          {isOffer ? (
                            <div className="flex items-center gap-2">
                              <span className="text-rose-600 font-semibold">{formatCOP(product.offerPrice || 0)}</span>
                              <span className="line-through">{formatCOP(product.salePrice)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-900 font-semibold">{formatCOP(product.salePrice)}</span>
                          )}
                        </div>
                        {isPreorder && product.preorderShipStart && (
                          <p className="text-[10px] text-amber-600 font-medium truncate">
                            Envío: {formatShipRange(product.preorderShipStart, product.preorderShipEnd)}
                          </p>
                        )}
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

      {/* Full-screen story viewer */}
      {storyIndex !== null && products.length > 0 && (
        <MenuStoryViewer
          products={products}
          initialIndex={storyIndex}
          slug={slug}
          catalogUrl={catalogUrl}
          onClose={() => setStoryIndex(null)}
        />
      )}

      {/* Footer */}
      <div className={`fixed bottom-0 inset-x-0 py-3 text-center backdrop-blur ${isTheme2 ? 'bg-black/80' : 'bg-gray-50/80'}`}>
        <p className={`text-[11px] uppercase tracking-widest ${isTheme2 ? 'text-gray-600' : 'text-gray-300'}`}>Powered by Daimuz</p>
      </div>
    </div>
  )
}
