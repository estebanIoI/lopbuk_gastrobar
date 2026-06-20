'use client'

/**
 * FloatingMarketplaceSticker — sticker flotante inteligente que usa el LOGO del
 * comercio activo como elemento visual. Contraído = cápsula con el logo (sin texto).
 * Al interactuar (hover en desktop / tap en móvil) se expande y revela el CTA
 * "Ver todas las tiendas". En móvil usa flujo de dos toques (expandir → navegar).
 *
 * Colores dinámicos: fondo = primaryColor, borde = secondaryColor, texto = contraste.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Store } from 'lucide-react'

export interface MarketplaceStickerProps {
  storeName: string
  logo?: string | null
  primaryColor?: string
  secondaryColor?: string
  marketplaceUrl?: string
  onNavigate?: () => void
  /** ms para auto-contraer tras un tap en móvil (default 3000). */
  autoExpandDelay?: number
  position?: 'left' | 'right'
  loading?: boolean
}

/** Texto legible (oscuro/claro) según la luminancia del fondo. */
function readableText(bg: string): string {
  let c = (bg || '').replace('#', '')
  if (c.length === 3) c = c.split('').map(x => x + x).join('')
  const r = parseInt(c.slice(0, 2), 16) || 0
  const g = parseInt(c.slice(2, 4), 16) || 0
  const b = parseInt(c.slice(4, 6), 16) || 0
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#0f172a' : '#ffffff'
}

export function FloatingMarketplaceSticker({
  storeName,
  logo,
  primaryColor = '#3483fa',
  secondaryColor = '#ffffff',
  marketplaceUrl,
  onNavigate,
  autoExpandDelay = 3000,
  position = 'left',
  loading = false,
}: MarketplaceStickerProps) {
  const [expanded, setExpanded] = useState(false)
  const [pulse, setPulse] = useState(false)
  const touchedRef = useRef(false)
  const interactedRef = useRef(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const text = readableText(primaryColor)

  // Animación de atención si el usuario lleva >12s sin interactuar (una sola vez).
  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      if (!interactedRef.current) { setPulse(true); setTimeout(() => setPulse(false), 1200) }
    }, 12000)
  }, [])

  useEffect(() => {
    armIdle()
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
    }
  }, [armIdle])

  const markInteracted = () => {
    interactedRef.current = true
    if (idleTimer.current) clearTimeout(idleTimer.current)
  }

  const navigate = () => {
    if (onNavigate) onNavigate()
    else if (marketplaceUrl) window.location.href = marketplaceUrl
  }

  const scheduleCollapse = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current)
    collapseTimer.current = setTimeout(() => setExpanded(false), autoExpandDelay)
  }

  // Click/tap: si está contraído → expande (en móvil, primer toque); si está
  // expandido → navega (segundo toque). En desktop el hover ya expandió.
  const handleClick = () => {
    markInteracted()
    if (!expanded) {
      setExpanded(true)
      if (touchedRef.current) scheduleCollapse()
    } else {
      navigate()
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      markInteracted()
      if (!expanded) setExpanded(true)
      else navigate()
    }
  }

  // ── Loading / esqueleto ──
  if (loading || !storeName) {
    return (
      <div
        className={`fixed z-[55] left-4 md:left-5 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] md:bottom-auto md:top-1/2 md:-translate-y-1/2 ${position === 'right' ? 'left-auto right-4 md:right-5 md:left-auto' : ''}`}
        aria-hidden
      >
        <div className="h-16 w-16 md:h-[72px] md:w-[72px] rounded-full bg-black/10 animate-pulse" />
      </div>
    )
  }

  const sideClasses =
    position === 'right'
      ? 'right-4 md:right-5 md:left-auto'
      : 'left-4 md:left-5'

  return (
    <button
      type="button"
      aria-label="Ver todas las tiendas"
      onMouseEnter={() => { if (!touchedRef.current) { markInteracted(); setExpanded(true) } }}
      onMouseLeave={() => { if (!touchedRef.current) setExpanded(false) }}
      onFocus={() => { markInteracted(); setExpanded(true) }}
      onBlur={() => { if (!touchedRef.current) setExpanded(false) }}
      onTouchStart={() => { touchedRef.current = true }}
      onClick={handleClick}
      onKeyDown={handleKey}
      className={`fixed z-[55] bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] md:bottom-auto md:top-1/2 md:-translate-y-1/2 ${sideClasses} outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
      style={{ ['--mkt-ring' as string]: secondaryColor } as React.CSSProperties}
    >
      <span
        className={[
          'group flex items-center overflow-hidden rounded-full cursor-pointer',
          'h-16 md:h-[72px]',
          expanded ? 'w-[228px] md:w-[252px]' : 'w-16 md:w-[72px]',
          'transition-[width,transform,box-shadow] duration-[250ms] ease-out',
          pulse ? 'mkt-attn' : '',
        ].join(' ')}
        style={{
          backgroundColor: primaryColor,
          color: text,
          border: `1.5px solid ${secondaryColor}`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transform: expanded ? 'scale(1.03)' : 'scale(1)',
          boxShadow: expanded
            ? '0 14px 34px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.10) inset'
            : '0 8px 22px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.08) inset',
        }}
      >
        {/* Logo (cuadrado, contain, nunca se deforma) */}
        <span className="shrink-0 h-16 w-16 md:h-[72px] md:w-[72px] flex items-center justify-center p-2.5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={storeName}
              loading="lazy"
              className="max-h-full max-w-full object-contain rounded-full"
              style={{ objectFit: 'contain' }}
            />
          ) : (
            <Store className="w-7 h-7" style={{ color: text }} />
          )}
        </span>

        {/* Texto + flecha (aparecen al expandir) */}
        <span
          className={`flex-1 flex items-center justify-between gap-2 pr-3 whitespace-nowrap transition-all duration-300 ease-out ${expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}
        >
          <span className="text-sm font-semibold">Ver todas las tiendas</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </span>
      </span>

      {/* Keyframe de atención (una sola pasada) */}
      <style>{`
        @keyframes mkt-attn-kf {
          0%,100% { transform: scale(1); }
          30% { transform: scale(1.08); }
          60% { transform: scale(0.98); }
        }
        .mkt-attn { animation: mkt-attn-kf 1.1s ease-in-out 1; }
      `}</style>
    </button>
  )
}

export default FloatingMarketplaceSticker
