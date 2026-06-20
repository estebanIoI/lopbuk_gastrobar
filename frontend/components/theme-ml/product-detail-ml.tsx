'use client'

/**
 * ProductDetailML — vista de detalle de producto "cargada de info", estilo
 * Mercado Libre, como TEMA NUEVO seleccionable (no toca el detalle actual).
 *
 * Es autocontenido y desacoplado del storefront: recibe el producto + callbacks
 * (onAddToCart / onBuyNow / onClose) y datos opcionales del vendedor, opiniones,
 * preguntas y relacionados. Lo que aún no viene del backend (cuotas, reputación
 * del vendedor, opiniones de ejemplo) se muestra de forma visual con defaults
 * sensatos y props para sobre-escribir cuando se cableen datos reales.
 *
 * Tematizable vía `accentColor` (por defecto azul ML) — usa var(--ml-accent).
 */
import { useMemo, useState, useEffect, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import {
  Star, Heart, Truck, ShieldCheck, RotateCcw, BadgeCheck,
  Plus, Minus, X, ThumbsUp, MessageCircleQuestion,
} from 'lucide-react'
import { VariantSelector, type RawVariant, type SelectedVariant } from '@/components/variant-selector'
import { qtyPromoOptions, hasQtyPromo, type QtyPromo, type QtyPromoOption } from '@/lib/qty-promo'
import { StoreCardML } from '@/components/theme-ml/store-card-ml'

// ── Tipos públicos ────────────────────────────────────────────────────────────
export interface MLProduct {
  id: string
  name: string
  description?: string | null
  salePrice: number
  offerPrice?: number | null
  isOnOffer?: boolean | number
  imageUrl?: string | null
  images?: string[] | null
  variants?: RawVariant[]
  color?: string | null
  size?: string | null
  category?: string | null
  /** Unidades vendidas (para "+N vendidos"). */
  soldCount?: number
  /** Stock disponible sin variantes. */
  stock?: number
  /** Estado: "Nuevo" | "Usado"… */
  condition?: string
  /** Bullets de "Lo que tienes que saber". Si falta, se intentan extraer de la descripción. */
  features?: string[]
  /** Rating promedio (0-5) y nº de calificaciones, si el backend los provee. */
  rating?: number
  ratingCount?: number
}

export interface MLSeller {
  name: string
  logoUrl?: string | null
  isOfficial?: boolean
  /** Texto de ventas, ej. "+10 mil ventas". */
  salesText?: string
  followersText?: string
  productsText?: string
  /** Nivel de reputación, ej. "MercadoLíder Platinum". */
  level?: string
  /** Posición del termómetro 1-5 (5 = mejor). */
  reputation?: number
}

export interface MLReview {
  rating: number
  text: string
  author?: string
  location?: string
  date?: string
  photo?: string | null
  likes?: number
}

export interface MLQuestion {
  q: string
  a?: string
  date?: string
}

export interface MLInstallments {
  count: number
  monthly: number
  interestFree?: boolean
}

export interface ProductDetailMLProps {
  product: MLProduct
  seller?: MLSeller
  related?: MLProduct[]
  reviews?: MLReview[]
  questions?: MLQuestion[]
  installments?: MLInstallments
  /** Color de marca (CTA, links). Por defecto azul ML. */
  accentColor?: string
  formatPrice?: (n: number) => string
  onClose?: () => void
  onAddToCart?: (qty: number, variant: SelectedVariant | null) => void
  onBuyNow?: (qty: number, variant: SelectedVariant | null) => void
  onSelectRelated?: (p: MLProduct) => void
  /** Promo de cantidad (2da unidad con % / niveles por cantidad). */
  qtyPromo?: QtyPromo | null
  /** Reporta el precio unitario combinado de la promo elegida (null = sin promo). */
  onPromoSelect?: (unitPrice: number | null, qty: number) => void
  /** Modo controlado opcional: variante elegida (para una sola fuente de verdad con el storefront). */
  variant?: SelectedVariant | null
  onVariantChange?: Dispatch<SetStateAction<SelectedVariant | null>>
  /** Modo controlado opcional: cantidad. */
  qty?: number
  onQtyChange?: Dispatch<SetStateAction<number>>
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const defaultFmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

function deriveFeatures(p: MLProduct): string[] {
  if (p.features && p.features.length) return p.features
  if (!p.description) return []
  // Extrae líneas tipo bullet de la descripción.
  return p.description
    .split(/\r?\n/)
    .map(l => l.replace(/^[\s•\-*]+/, '').trim())
    .filter(l => l.length > 2 && l.length < 90)
    .slice(0, 6)
}

function galleryOf(p: MLProduct): string[] {
  const imgs = (p.images && p.images.length ? p.images : [p.imageUrl]).filter(Boolean) as string[]
  // Suma imágenes de variantes (sin duplicar).
  const fromVariants = (p.variants || []).flatMap(v => (Array.isArray(v.images) ? v.images : [])).filter(Boolean) as string[]
  return Array.from(new Set([...imgs, ...fromVariants]))
}

function Stars({ value, size = 14, color = '#3483fa' }: { value: number; size?: number; color?: string }) {
  return (
    <span className="inline-flex items-center" aria-label={`${value} de 5`}>
      {[0, 1, 2, 3, 4].map(i => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className="shrink-0"
          fill={i < Math.round(value) ? color : 'none'}
          color={color}
          strokeWidth={i < Math.round(value) ? 0 : 1.5}
        />
      ))}
    </span>
  )
}

// ── Componente ────────────────────────────────────────────────────────────────
export function ProductDetailML({
  product,
  seller,
  related = [],
  reviews = [],
  questions = [],
  installments,
  accentColor = '#3483fa',
  formatPrice,
  onClose,
  onAddToCart,
  onBuyNow,
  onSelectRelated,
  onPromoSelect,
  qtyPromo,
  variant: variantProp,
  onVariantChange,
  qty: qtyProp,
  onQtyChange,
}: ProductDetailMLProps) {
  const fmt = formatPrice ?? defaultFmt
  const gallery = useMemo(() => galleryOf(product), [product])
  const features = useMemo(() => deriveFeatures(product), [product])

  const [activeImg, setActiveImg] = useState(0)
  const [variantInner, setVariantInner] = useState<SelectedVariant | null>(null)
  const [qtyInner, setQtyInner] = useState(1)
  const [fav, setFav] = useState(false)

  // Controlado si el padre pasa estado (una sola fuente de verdad); si no, interno.
  const variant = variantProp !== undefined ? variantProp : variantInner
  const setVariant: Dispatch<SetStateAction<SelectedVariant | null>> = onVariantChange ?? setVariantInner
  const qty = qtyProp !== undefined ? qtyProp : qtyInner
  const setQty: Dispatch<SetStateAction<number>> = onQtyChange ?? setQtyInner
  const [showFullDesc, setShowFullDesc] = useState(false)

  const hasVariants = !!(product.variants && product.variants.length > 0)
  const basePrice = product.salePrice
  const onOffer = !!(product.isOnOffer && product.offerPrice)
  const listPrice = onOffer ? product.offerPrice! : basePrice
  const unitPrice = variant ? variant.price : listPrice
  const discountPct = onOffer ? Math.round(((basePrice - product.offerPrice!) / basePrice) * 100) : 0

  // ── Promo de cantidad (2da unidad % / niveles) ──
  const [promoQty, setPromoQty] = useState(1)
  const promoOpts = useMemo(() => qtyPromoOptions(unitPrice, qtyPromo), [unitPrice, qtyPromo])
  const showPromo = hasQtyPromo(qtyPromo) && promoOpts.length > 1
  const pickPromo = (o: QtyPromoOption) => {
    setPromoQty(o.qty)
    setQty(o.qty)
    onPromoSelect?.(o.qty === 1 ? null : o.unitPrice, o.qty)
  }
  const clearPromo = () => { setPromoQty(1); onPromoSelect?.(null, qty) }
  // Si cambia la variante (y con ella el precio base), re-aplica el combinado.
  useEffect(() => {
    if (promoQty > 1) {
      const o = promoOpts.find(x => x.qty === promoQty)
      if (o) onPromoSelect?.(o.unitPrice, o.qty)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitPrice])

  // Imagen activa: prioriza la de la variante elegida.
  const heroUrl = variant?.image || gallery[activeImg] || gallery[0] || ''

  // Cuotas (visual por defecto: 3 sin interés).
  const inst: MLInstallments = installments ?? {
    count: 3,
    monthly: Math.round(unitPrice / 3),
    interestFree: true,
  }

  const available = variant ? variant.available : (product.stock ?? 0)
  const lowStock = available > 0 && available <= 3
  const soldText = product.soldCount ? `+${product.soldCount} vendidos` : null

  const ratingAvg = product.rating ?? (reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 5)
  const ratingCount = product.ratingCount ?? reviews.length

  const accent = accentColor
  const styleVars = { ['--ml-accent' as string]: accent } as CSSProperties

  return (
    <div className="ml-detail bg-white text-[#333] min-h-full" style={styleVars}>
      {/* Barra superior */}
      <div className="mx-auto max-w-[1200px] px-4 pt-4 flex items-center justify-between text-xs text-[#3483fa]">
        {seller?.isOfficial ? (
          <span className="inline-flex items-center gap-1">
            Visita la Tienda oficial de {seller.name}
            <BadgeCheck className="w-3.5 h-3.5" style={{ color: accent }} fill={accent} stroke="#fff" />
          </span>
        ) : <span />}
        {onClose && (
          <button onClick={onClose} aria-label="Cerrar" className="text-[#999] hover:text-[#333]">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ════════ Bloque principal: 3 columnas ════════ */}
      <div className="mx-auto max-w-[1200px] px-4 py-4 grid grid-cols-1 lg:grid-cols-[64px_minmax(0,1fr)_320px] gap-x-5 gap-y-6">

        {/* ── Rail de miniaturas (desktop) ── */}
        <div className="hidden lg:flex flex-col gap-2">
          {gallery.map((url, i) => (
            <button
              key={i}
              onMouseEnter={() => setActiveImg(i)}
              onClick={() => setActiveImg(i)}
              className="w-16 h-16 rounded border bg-white overflow-hidden transition-all"
              style={{ borderColor: i === activeImg && !variant?.image ? accent : '#e6e6e6' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${product.name} ${i + 1}`} className="w-full h-full object-contain" />
            </button>
          ))}
        </div>

        {/* ── Imagen principal ── */}
        <div className="relative">
          <button
            onClick={() => setFav(f => !f)}
            aria-label="Favorito"
            className="absolute top-1 right-1 z-10 w-9 h-9 rounded-full bg-white/90 border border-[#e6e6e6] flex items-center justify-center hover:shadow"
          >
            <Heart className="w-5 h-5" style={{ color: fav ? '#f74b4b' : accent }} fill={fav ? '#f74b4b' : 'none'} />
          </button>
          {onOffer && (
            <div className="absolute top-2 left-2 z-10 bg-[#00a650] text-white text-[11px] font-semibold px-2 py-0.5 rounded">
              {discountPct}% OFF
            </div>
          )}
          <div className="aspect-square w-full bg-white flex items-center justify-center rounded">
            {heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={heroUrl} src={heroUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-[#ccc] text-sm">Sin imagen</div>
            )}
          </div>
          {/* Miniaturas mobile */}
          {gallery.length > 1 && (
            <div className="lg:hidden flex gap-2 mt-3 overflow-x-auto">
              {gallery.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className="shrink-0 w-14 h-14 rounded border bg-white overflow-hidden"
                  style={{ borderColor: i === activeImg ? accent : '#e6e6e6' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${product.name} ${i + 1}`} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Columna central: info ── */}
        <div className="lg:col-start-2 lg:row-start-2 lg:-mt-2 min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#999]">
            <span>{product.condition || 'Nuevo'}</span>
            {soldText && <><span>·</span><span>{soldText}</span></>}
          </div>

          <h1 className="mt-1 text-xl sm:text-2xl font-medium leading-snug text-[#333]">{product.name}</h1>

          {/* Rating */}
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            <span className="text-[#3483fa]" style={{ color: accent }}>{ratingAvg.toFixed(1)}</span>
            <Stars value={ratingAvg} color={accent} />
            {ratingCount > 0 && <span className="text-[#999] text-xs">({ratingCount})</span>}
          </div>

          {/* Precio */}
          <div className="mt-4">
            {onOffer && <div className="text-sm text-[#999] line-through">{fmt(basePrice)}</div>}
            <div className="flex items-end gap-2 flex-wrap">
              <span className="text-[34px] leading-none font-light text-[#333]">{fmt(unitPrice)}</span>
              {onOffer && <span className="text-[#00a650] text-base font-semibold pb-1">{discountPct}% OFF</span>}
            </div>
            <div className="mt-1 text-sm text-[#333]">
              {inst.count} cuotas de <span className="text-[#00a650]">{fmt(inst.monthly)}</span>
              {inst.interestFree && <span className="text-[#00a650]"> con 0% interés</span>}
            </div>
            <button className="mt-1 text-xs hover:underline" style={{ color: accent }}>Ver medios de pago y promociones</button>
          </div>

          {lowStock && (
            <div className="mt-3 inline-block bg-[#fff1cc] text-[#8a6d3b] text-xs font-semibold px-2 py-1 rounded">
              ¡ÚLTIMAS {available} UNIDADES!
            </div>
          )}

          {/* Promo de cantidad (2da unidad / niveles) */}
          {showPromo && (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-wide text-[#999] mb-2">Aprovecha y ahorra</p>
              <div className="space-y-2">
                {promoOpts.map(o => {
                  const active = promoQty === o.qty
                  return (
                    <button
                      key={o.qty}
                      onClick={() => pickPromo(o)}
                      className="w-full text-left rounded-lg border p-3 transition-all"
                      style={{ borderColor: active ? accent : '#e6e6e6', backgroundColor: active ? '#f0f6ff' : '#fff' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: active ? accent : '#ccc' }}>
                            {active && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#333]">{o.label}</p>
                            {o.sublabel && (
                              <span className="inline-block mt-0.5 text-[11px] font-semibold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: '#00a650' }}>{o.sublabel}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-[#333]">{fmt(o.total)}</div>
                          {o.savings > 0 && <div className="text-[11px] text-[#00a650]">Ahorra {fmt(o.savings)}</div>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Variantes / Color */}
          <div className="mt-5">
            {hasVariants ? (
              <VariantSelector
                variants={product.variants!}
                basePrice={basePrice}
                isLightBg
                formatPrice={fmt}
                onChange={setVariant}
              />
            ) : product.color ? (
              <div className="text-sm">
                <span className="text-[#666]">Color: </span>
                <span className="font-medium">{product.color}</span>
              </div>
            ) : null}
          </div>

          {/* Lo que tienes que saber */}
          {features.length > 0 && (
            <div className="mt-6">
              <h2 className="text-base font-medium text-[#333] mb-2">Lo que tienes que saber de este producto</h2>
              <ul className="space-y-1.5">
                {features.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#666]">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-[#999] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button className="mt-2 text-sm hover:underline" style={{ color: accent }}>Ver características</button>
            </div>
          )}
        </div>

        {/* ── Buy box (derecha) ── */}
        <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2">
          <div className="border border-[#e6e6e6] rounded-md p-4 sticky top-4">
            <div className="text-sm">
              <span className="text-[#00a650] font-medium">Llega gratis</span>
              <span className="text-[#666]"> a todo el país</span>
            </div>
            <button className="text-xs mt-0.5 hover:underline" style={{ color: accent }}>Más detalles y formas de entrega</button>

            <div className="mt-3 text-sm">
              <div className="font-medium text-[#333]">Stock disponible</div>
              {available > 0 ? (
                <div className="text-xs text-[#666] mt-0.5 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-[#00a650]" /> Enviado por <span className="font-semibold text-[#00a650]">FULL</span>
                </div>
              ) : (
                <div className="text-xs text-[#e74c3c] mt-0.5">Sin stock</div>
              )}
            </div>

            {/* Cantidad */}
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-[#666]">Cantidad:</span>
              <div className="inline-flex items-center border border-[#e6e6e6] rounded">
                <button onClick={() => { clearPromo(); setQty(q => Math.max(1, q - 1)) }} className="px-2 py-1 text-[#666] disabled:opacity-30" disabled={qty <= 1}><Minus className="w-3.5 h-3.5" /></button>
                <span className="px-3 min-w-[2ch] text-center">{qty}</span>
                <button onClick={() => { clearPromo(); setQty(q => (available ? Math.min(available, q + 1) : q + 1)) }} className="px-2 py-1 text-[#666]"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              {available > 0 && <span className="text-xs text-[#999]">({available} disponibles)</span>}
            </div>

            {/* CTAs */}
            <button
              onClick={() => onBuyNow?.(qty, variant)}
              disabled={hasVariants && !variant}
              className="mt-4 w-full rounded-md py-3 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              Comprar ahora
            </button>
            <button
              onClick={() => onAddToCart?.(qty, variant)}
              disabled={hasVariants && !variant}
              className="mt-2 w-full rounded-md py-3 text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#e3edfb', color: accent }}
            >
              Agregar al carrito
            </button>
            {hasVariants && !variant && (
              <p className="mt-2 text-[11px] text-[#e74c3c] text-center">Elige una variante para continuar</p>
            )}

            {/* Tarjeta de presentación del comercio (debajo de los botones) */}
            {seller && (
              <div className="mt-4">
                <StoreCardML
                  name={seller.name}
                  logoUrl={seller.logoUrl}
                  coverUrl={null}
                  isOfficial={seller.isOfficial}
                  followersText={seller.followersText}
                  productsText={seller.productsText}
                  level={seller.level}
                  reputation={seller.reputation}
                  salesText={seller.salesText}
                  accentColor={accent}
                  onGoToStore={onClose}
                />
              </div>
            )}

            {/* Garantías */}
            <ul className="mt-4 space-y-2.5 text-xs">
              <li className="flex gap-2"><RotateCcw className="w-4 h-4 shrink-0" style={{ color: accent }} /><span className="text-[#666]"><span style={{ color: accent }}>Devolución gratis.</span> Tienes 30 días desde que lo recibes.</span></li>
              <li className="flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0" style={{ color: accent }} /><span className="text-[#666]"><span style={{ color: accent }}>Compra Protegida.</span> Recibe el producto que esperabas o te devolvemos tu dinero.</span></li>
              <li className="flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0 text-[#999]" /><span className="text-[#666]">12 meses de garantía de fábrica.</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* ════════ Descripción ════════ */}
      {product.description && (
        <div className="mx-auto max-w-[1200px] px-4 py-6 border-t border-[#eee]">
          <h2 className="text-2xl font-light text-[#333] mb-4">Descripción</h2>
          <div className={`text-sm text-[#666] whitespace-pre-line leading-relaxed ${showFullDesc ? '' : 'max-h-48 overflow-hidden relative'}`}>
            {product.description}
            {!showFullDesc && <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />}
          </div>
          <button onClick={() => setShowFullDesc(s => !s)} className="mt-2 text-sm hover:underline" style={{ color: accent }}>
            {showFullDesc ? 'Ver menos' : 'Ver descripción completa'}
          </button>
        </div>
      )}

      {/* ════════ Preguntas ════════ */}
      <div className="mx-auto max-w-[1200px] px-4 py-6 border-t border-[#eee]">
        <h2 className="text-2xl font-light text-[#333] mb-4">Preguntas</h2>
        <div className="flex gap-2 max-w-2xl">
          <input placeholder="Escribe tu pregunta..." className="flex-1 border border-[#e6e6e6] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#3483fa]" />
          <button className="px-5 rounded text-sm font-medium text-white inline-flex items-center gap-1" style={{ backgroundColor: accent }}>
            <MessageCircleQuestion className="w-4 h-4" /> Preguntar
          </button>
        </div>
        {questions.length > 0 && (
          <ul className="mt-5 space-y-4 max-w-2xl">
            {questions.map((q, i) => (
              <li key={i} className="text-sm">
                <p className="text-[#333]">{q.q}</p>
                {q.a && <p className="mt-1 text-[#666] pl-4 border-l-2 border-[#eee]">{q.a}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ════════ Opiniones ════════ */}
      <div className="mx-auto max-w-[1200px] px-4 py-6 border-t border-[#eee]">
        <h2 className="text-2xl font-light text-[#333] mb-4">Opiniones del producto</h2>
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="shrink-0">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-light text-[#333]">{ratingAvg.toFixed(1)}</span>
            </div>
            <Stars value={ratingAvg} size={16} color={accent} />
            <div className="text-xs text-[#999] mt-1">{ratingCount} calificaciones</div>
            <div className="mt-3 space-y-1 w-44">
              {[5, 4, 3, 2, 1].map(n => {
                const c = reviews.filter(r => Math.round(r.rating) === n).length
                const pct = ratingCount ? (c / ratingCount) * 100 : (n === 5 ? 100 : 0)
                return (
                  <div key={n} className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[#eee] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#999' }} />
                    </div>
                    <span className="text-[10px] text-[#999] w-3 text-right">{n}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex-1 space-y-5">
            {reviews.length > 0 ? reviews.map((r, i) => (
              <div key={i} className="text-sm">
                <Stars value={r.rating} color={accent} />
                {r.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo} alt="opinión" className="mt-2 w-20 h-20 rounded object-cover border border-[#eee]" />
                )}
                <p className="mt-1.5 text-[#666]">{r.text}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-[#999]">
                  {r.location && <span>{r.location}</span>}
                  {r.date && <span>{r.date}</span>}
                  <button className="inline-flex items-center gap-1 hover:text-[#666]"><ThumbsUp className="w-3 h-3" /> {r.likes ?? 0}</button>
                </div>
              </div>
            )) : (
              <p className="text-sm text-[#999]">Aún no hay opiniones. ¡Sé el primero en opinar!</p>
            )}
          </div>
        </div>
      </div>

      {/* ════════ Productos relacionados ════════ */}
      {related.length > 0 && (
        <div className="mx-auto max-w-[1200px] px-4 py-6 border-t border-[#eee]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium text-[#333]">Productos relacionados</h2>
            <span className="text-[10px] text-[#ccc]">Ad</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {related.map(rp => {
              const rOffer = !!(rp.isOnOffer && rp.offerPrice)
              const rPrice = rOffer ? rp.offerPrice! : rp.salePrice
              const rPct = rOffer ? Math.round(((rp.salePrice - rp.offerPrice!) / rp.salePrice) * 100) : 0
              const rImg = (rp.images && rp.images[0]) || rp.imageUrl || ''
              return (
                <button
                  key={rp.id}
                  onClick={() => onSelectRelated?.(rp)}
                  className="shrink-0 w-44 text-left border border-transparent hover:border-[#e6e6e6] hover:shadow-md rounded-md p-3 transition-all bg-white"
                >
                  <div className="aspect-square bg-white flex items-center justify-center mb-2">
                    {rImg && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={rImg} alt={rp.name} className="max-w-full max-h-full object-contain" />
                    )}
                  </div>
                  {rOffer && <div className="text-xs text-[#999] line-through">{fmt(rp.salePrice)}</div>}
                  <div className="flex items-center gap-1.5">
                    <span className="text-base text-[#333]">{fmt(rPrice)}</span>
                    {rOffer && <span className="text-[#00a650] text-xs font-semibold">{rPct}% OFF</span>}
                  </div>
                  <div className="text-xs text-[#00a650] mt-0.5">Envío gratis</div>
                  <p className="mt-1 text-xs text-[#666] line-clamp-2">{rp.name}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductDetailML
