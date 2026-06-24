'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  X, ChevronRight, ChevronLeft, Search, MapPin, Clock, Plus, Minus,
  ShoppingBag, Store, Trash2, Navigation, Loader2, Check,
} from 'lucide-react'
import { Theme2OrderSuccess, type OrderSuccessData } from '@/components/theme2/theme2-order-success'
import { VariantSelector, type RawVariant, type SelectedVariant } from '@/components/variant-selector'
import { parseQtyPromo, qtyPromoUnit, type QtyPromo } from '@/lib/qty-promo'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const ASSET_BASE = API_URL.replace(/\/api$/, '')
const abs = (u?: string | null) => (!u ? '' : u.startsWith('http') ? u : `${ASSET_BASE}${u}`)
const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

export interface T2Product {
  id: string
  name: string
  description?: string | null
  salePrice: number
  imageUrl?: string | null
  category?: string | null
  isOnOffer?: boolean | number
  offerPrice?: number | null
  tenantId?: string | null
  variants?: RawVariant[]
  hasVariants?: boolean
  isPreorder?: boolean | number
  preorderShipStart?: string | null
  preorderShipEnd?: string | null
  qtyPromo?: QtyPromo | string | null
}
export interface T2Sede { id: string; name: string; address?: string | null }
interface T2Option { id: string; name: string; imageUrl?: string | null; priceDelta: number }
interface T2Group {
  id: string; name: string
  selectionType: 'single' | 'multiple'
  isRequired: boolean; minSelect: number; maxSelect: number | null
  options: T2Option[]
}
interface SelMod { groupName: string; optionName: string; priceDelta: number }
export interface T2Info {
  name?: string
  logoUrl?: string | null
  socialWhatsapp?: string | null
  locationMapUrl?: string | null
  address?: string | null
}
interface CartItem { key: string; product: T2Product; qty: number; notes: string; mods: SelMod[]; unit: number; variantId?: string; variantLabel?: string; variantImage?: string | null }

const priceOf = (p: T2Product) => (p.isOnOffer && p.offerPrice ? p.offerPrice : p.salePrice)

const INP = 'w-full rounded-xl bg-[#161616] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-400/50 focus:outline-none'

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/70 mb-1">
        {label}{required && <span className="text-red-400"> *</span>}
      </label>
      {children}
    </div>
  )
}

function PhoneInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 rounded-xl bg-[#1b1b1b] border border-white/[0.08] px-3 py-2.5 text-sm text-white/60">+57</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={placeholder}
        inputMode="numeric"
        className={INP}
      />
    </div>
  )
}

export function Theme2OrderFlow({
  slug, info, sedes, openState, nextOpenLabel,
  categories, newIds, featuredIds, trendingIds, initialProductId, onClose,
}: {
  slug: string
  info: T2Info
  sedes: T2Sede[]
  openState: 'open' | 'closed'
  nextOpenLabel: string | null
  categories: { name: string; displayName?: string }[]
  newIds: Set<string>
  featuredIds: Set<string>
  trendingIds: Set<string>
  initialProductId?: string | null
  onClose: () => void
}) {
  // Si solo hay una sede (o ninguna), saltamos el selector
  const [step, setStep] = useState<'sede' | 'menu'>(sedes.length > 1 ? 'sede' : 'menu')
  const [sede, setSede] = useState<T2Sede | null>(sedes.length === 1 ? sedes[0] : null)

  const [products, setProducts] = useState<T2Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<'todos' | 'nuevo' | 'destacado' | 'populares' | 'descuento'>('todos')

  const [detail, setDetail] = useState<T2Product | null>(null)
  const [detailQty, setDetailQty] = useState(1)
  const [detailNotes, setDetailNotes] = useState('')
  const [keepAdding, setKeepAdding] = useState(false)
  const [detailGroups, setDetailGroups] = useState<T2Group[]>([])
  const [loadingMods, setLoadingMods] = useState(false)
  // Variante elegida en el detalle (color/talla/material) — null hasta que el cliente elige
  const [selVariant, setSelVariant] = useState<SelectedVariant | null>(null)
  // selección: groupId -> set de optionId
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})

  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)

  // ── Checkout ──
  const [coWhats, setCoWhats] = useState('')
  const [coWhatsConfirm, setCoWhatsConfirm] = useState('')
  const [coName, setCoName] = useState('')
  const [forOther, setForOther] = useState(false)
  const [otherName, setOtherName] = useState('')
  const [otherPhone, setOtherPhone] = useState('')
  const [mode, setMode] = useState<'domicilio' | 'recoger'>('domicilio')
  const [address, setAddress] = useState('')
  // Ubicación GPS exacta (mini-mapa, sin mostrar coordenadas)
  const [coLat, setCoLat] = useState<number | null>(null)
  const [coLng, setCoLng] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)
  const [locErr, setLocErr] = useState('')
  // Autocompletado de cliente recurrente por teléfono
  const [foundMsg, setFoundMsg] = useState('')
  const lookedUpRef = useRef('')
  const [payment, setPayment] = useState<'efectivo' | 'transferencia' | 'tarjeta' | ''>('')

  // Carga de productos al entrar al menú o cambiar de sede
  useEffect(() => {
    if (step !== 'menu') return
    let alive = true
    setLoadingProducts(true)
    const sedeParam = sede?.id ? `&sede=${sede.id}` : ''
    fetch(`${API_URL}/storefront/products?store=${slug}&limit=200${sedeParam}`)
      .then(r => r.json()).catch(() => null)
      .then(res => {
        // El backend devuelve { data: { products: [...], pagination } };
        // soportamos también { data: [...] } por compatibilidad.
        const list = Array.isArray(res?.data)
          ? res.data
          : (Array.isArray(res?.data?.products) ? res.data.products : [])
        if (alive) setProducts(list)
      })
      .finally(() => { if (alive) setLoadingProducts(false) })
    return () => { alive = false }
  }, [step, sede, slug])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(p => {
      if (activeCat !== 'all' && p.category !== activeCat) return false
      if (q && !(`${p.name} ${p.description ?? ''}`.toLowerCase().includes(q))) return false
      if (activeFilter === 'descuento' && !p.isOnOffer) return false
      if (activeFilter === 'nuevo' && !newIds.has(String(p.id))) return false
      if (activeFilter === 'destacado' && !featuredIds.has(String(p.id))) return false
      if (activeFilter === 'populares' && !trendingIds.has(String(p.id))) return false
      return true
    })
  }, [products, search, activeCat, activeFilter, newIds, featuredIds, trendingIds])

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  // Precio unitario efectivo de la línea: aplica la promo de cantidad ("lleva 2, −X%")
  // del producto según la cantidad de esa línea. Si no hay promo, devuelve i.unit.
  const lineUnit = (i: CartItem) => qtyPromoUnit(i.unit, i.qty, parseQtyPromo(i.product.qtyPromo))
  const cartTotal = cart.reduce((s, i) => s + lineUnit(i) * i.qty, 0)
  const cartFull = cart.reduce((s, i) => s + i.unit * i.qty, 0)
  const cartSavings = cartFull - cartTotal

  const openDetail = (p: T2Product) => {
    setDetail(p); setDetailQty(1); setDetailNotes(''); setKeepAdding(false)
    setDetailGroups([]); setSelected({}); setSelVariant(null); setLoadingMods(true)
    fetch(`${API_URL}/modifiers/public/${p.id}`).then(r => r.json()).catch(() => null)
      .then(res => setDetailGroups(Array.isArray(res?.data) ? res.data : []))
      .finally(() => setLoadingMods(false))
  }
  // Si el producto tiene variantes, el "+" abre el detalle (hay que elegir color/talla);
  // si no, agrega directo.
  const quickAdd = (p: T2Product) => {
    if (p.variants && p.variants.length > 0) { openDetail(p); return }
    addToCart(p, 1, '', [], priceOf(p))
  }

  const toggleOption = (g: T2Group, optId: string) => {
    setSelected(prev => {
      const cur = new Set(prev[g.id] ?? [])
      if (g.selectionType === 'single') {
        cur.clear(); cur.add(optId)
      } else {
        if (cur.has(optId)) cur.delete(optId)
        else {
          if (g.maxSelect && cur.size >= g.maxSelect) return prev // tope alcanzado
          cur.add(optId)
        }
      }
      return { ...prev, [g.id]: cur }
    })
  }

  // Modificadores elegidos + precio extra + validación de requeridos
  const selMods: SelMod[] = useMemo(() => {
    const out: SelMod[] = []
    for (const g of detailGroups) {
      const ids = selected[g.id]
      if (!ids) continue
      for (const o of g.options) if (ids.has(o.id)) out.push({ groupName: g.name, optionName: o.name, priceDelta: o.priceDelta })
    }
    return out
  }, [detailGroups, selected])
  const detailExtra = selMods.reduce((s, m) => s + m.priceDelta, 0)
  // El precio base lo manda la variante elegida (incluye su tier base / override); si no hay, el del producto
  const detailBase = selVariant ? selVariant.price : (detail ? priceOf(detail) : 0)
  const detailUnit = detailBase + detailExtra
  // Promo de cantidad ("lleva 2, −X%") del producto en detalle
  const detailPromo = useMemo(() => parseQtyPromo(detail?.qtyPromo), [detail])
  const detailEffUnit = qtyPromoUnit(detailUnit, detailQty, detailPromo)
  const detailMissing = useMemo(() =>
    detailGroups.filter(g => g.isRequired && (selected[g.id]?.size ?? 0) < Math.max(1, g.minSelect)),
    [detailGroups, selected])
  // Preventa: backorder, permite pedir variantes agotadas
  const detailIsPreorder = !!(detail?.isPreorder)
  // ¿El producto tiene variantes pero el cliente aún no elige una (o la elegida está agotada y NO es preventa)?
  const variantPending = !!(detail?.variants && detail.variants.length > 0)
    && (!selVariant || (selVariant.available <= 0 && !detailIsPreorder))
  // Imagen del detalle: la de la variante elegida tiene prioridad
  const detailImg = selVariant?.image ? abs(selVariant.image) : abs(detail?.imageUrl)

  const addToCart = (
    p: T2Product, qty: number, notes: string, mods: SelMod[], unit: number,
    variant?: { id: string; label: string; image: string | null },
  ) => {
    setCart(prev => {
      const sig = mods.map(m => m.optionName).sort().join('|')
      // Distingue líneas por producto + variante + notas + combinación de modificadores
      const idx = prev.findIndex(i =>
        i.product.id === p.id &&
        (i.variantId || '') === (variant?.id || '') &&
        i.notes === notes &&
        i.mods.map(m => m.optionName).sort().join('|') === sig)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + qty }
        return next
      }
      return [...prev, {
        key: `${p.id}-${variant?.id ?? ''}-${Date.now()}`,
        product: p, qty, notes, mods, unit,
        variantId: variant?.id, variantLabel: variant?.label, variantImage: variant?.image,
      }]
    })
  }
  // Favoritos → "Ordenar Ahora": agrega el producto inicial al carrito una sola vez,
  // en cuanto los productos cargan (ya estamos en la sección de menú).
  const addedInitialRef = useRef(false)
  useEffect(() => {
    if (!initialProductId || addedInitialRef.current || products.length === 0) return
    const p = products.find(x => String(x.id) === String(initialProductId))
    if (!p) return
    if (p.variants && p.variants.length > 0) { openDetail(p); addedInitialRef.current = true; return }
    addToCart(p, 1, '', [], priceOf(p))
    addedInitialRef.current = true
  }, [initialProductId, products])

  const confirmDetail = () => {
    if (!detail || detailMissing.length > 0 || variantPending) return
    const variant = selVariant ? { id: selVariant.id, label: selVariant.label, image: selVariant.image } : undefined
    addToCart(detail, detailQty, detailNotes.trim(), selMods, detailUnit, variant)
    if (keepAdding) { setDetailQty(1); setDetailNotes(''); setSelected({}); setSelVariant(null) }
    else setDetail(null)
  }
  const changeCartQty = (key: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.key === key ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0))
  }

  // Tenant del pedido (para búsquedas públicas) — del carrito o de los productos.
  const orderTenantId = useMemo(
    () => cart.map(i => i.product.tenantId).find(Boolean) || products.map(p => p.tenantId).find(Boolean) || '',
    [cart, products],
  )

  // ── Captura de ubicación del dispositivo (GPS) → mini-mapa, sin mostrar coordenadas ──
  const captureLocation = () => {
    if (!navigator.geolocation) { setLocErr('Tu navegador no soporta ubicación'); return }
    setLocating(true); setLocErr('')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoLat(pos.coords.latitude); setCoLng(pos.coords.longitude); setLocating(false) },
      (err) => { setLocating(false); setLocErr(err.code === 1 ? 'Permiso denegado. Activa la ubicación.' : 'No se pudo obtener tu ubicación.') },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  const clearLocation = () => { setCoLat(null); setCoLng(null); setLocErr('') }

  // ── "Te encontré": autocompleta domicilio con el último pedido de ese teléfono ──
  // PRIVACIDAD: el nombre es la llave de verificación. El backend solo revela el
  // domicilio si el nombre escrito coincide con el del pedido anterior de ese número.
  useEffect(() => {
    const phone = coWhats.replace(/\D/g, '')
    const name = coName.trim()
    if (phone.length < 10 || name.length < 2 || !orderTenantId) { setFoundMsg(''); return }
    const key = `${phone}|${name.toLowerCase()}`
    if (lookedUpRef.current === key) return
    lookedUpRef.current = key
    let alive = true
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_URL}/orders/public/lookup?phone=${encodeURIComponent(phone)}&tenantId=${encodeURIComponent(orderTenantId)}&name=${encodeURIComponent(name)}`)
        const j = await r.json().catch(() => null)
        if (!alive || !j?.data?.found) { setFoundMsg(''); return }
        const c = j.data.customer
        // Solo autocompleta lo que esté vacío (no pisa lo que el cliente ya escribió).
        setAddress(prev => prev || c.address || c.neighborhood || '')
        if (c.latitude != null && c.longitude != null) { setCoLat(prev => prev ?? c.latitude); setCoLng(prev => prev ?? c.longitude) }
        setFoundMsg('¡Te encontré! Autocompletamos tu domicilio.')
      } catch { /* noop */ }
    }, 500)
    return () => { alive = false; clearTimeout(t) }
  }, [coWhats, coName, orderTenantId])

  // Campos faltantes para habilitar el envío
  const missing = useMemo(() => {
    const m: string[] = []
    if (!coWhats.trim()) m.push('WhatsApp')
    if (!coWhatsConfirm.trim() || coWhatsConfirm.trim() !== coWhats.trim()) m.push('Confirmar WhatsApp')
    if (!coName.trim()) m.push('Nombre')
    if (forOther && (!otherName.trim() || !otherPhone.trim())) m.push('Datos de quien recibe')
    if (mode === 'domicilio' && !address.trim()) m.push('Dirección')
    if (!payment) m.push('Método de pago')
    return m
  }, [coWhats, coWhatsConfirm, coName, forOther, otherName, otherPhone, mode, address, payment])

  const paymentLabel: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' }
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [success, setSuccess] = useState<OrderSuccessData | null>(null)

  // Registra el pedido en la base de datos del comercio (además del WhatsApp).
  // Devuelve { ok, orderNumber, total } — ok=false setea orderError.
  // Link de Google Maps a partir del GPS capturado (para que el comercio lo abra).
  const mapsLink = (coLat != null && coLng != null) ? `https://maps.google.com/?q=${coLat},${coLng}` : ''

  const registerOrder = async (): Promise<{ ok: boolean; orderNumber?: string; total?: number }> => {
    const tenantId = cart.map(i => i.product.tenantId).find(Boolean) || undefined
    const notesParts = [
      `Entrega: ${mode === 'domicilio' ? 'Domicilio' : 'Recoger en sede'}`,
      sede ? `Sede: ${sede.name}` : '',
      `Pago: ${paymentLabel[payment] || ''}`,
      forOther ? `Recibe: ${otherName.trim()} (+57 ${otherPhone.trim()})` : '',
      mode === 'domicilio' && mapsLink ? `Ubicación: ${mapsLink}` : '',
    ].filter(Boolean)
    const items = cart.map(i => ({
      productId: i.product.id,
      productName:
        `${i.product.name}${i.variantLabel ? ` — ${i.variantLabel}` : ''}`
        + (i.mods.length ? ` (${i.mods.map(m => m.optionName).join(', ')})` : ''),
      quantity: i.qty,
      unitPrice: lineUnit(i),
      productImage: i.variantImage || i.product.imageUrl || undefined,
      variantId: i.variantId,
      isPreorder: i.product.isPreorder ? 1 : 0,
      preorderShipStart: i.product.preorderShipStart || null,
      preorderShipEnd: i.product.preorderShipEnd || null,
    }))
    // Atribución de afiliado por enlace (?ref= guardado en localStorage).
    let refToken: string | undefined
    try {
      const raw = localStorage.getItem('dz_ref')
      if (raw) { const r = JSON.parse(raw); if (r?.token && (!r.exp || r.exp > Date.now())) refToken = r.token }
    } catch { /* noop */ }
    try {
      const r = await fetch(`${API_URL}/orders/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: coName.trim(),
          customerPhone: coWhats.trim(),
          address: mode === 'domicilio' ? address.trim() : undefined,
          notes: notesParts.join(' · '),
          items,
          tenantId,
          paymentMethod: payment || 'efectivo',
          deliveryLatitude: mode === 'domicilio' ? coLat ?? undefined : undefined,
          deliveryLongitude: mode === 'domicilio' ? coLng ?? undefined : undefined,
          refToken,
        }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.success) {
        setOrderError(j?.error || 'No se pudo registrar el pedido. Intenta de nuevo.')
        return { ok: false }
      }
      return { ok: true, orderNumber: j.data?.orderNumber, total: Number(j.data?.total) || cartTotal }
    } catch {
      setOrderError('No se pudo conectar. Revisa tu internet e intenta de nuevo.')
      return { ok: false }
    }
  }

  // Construye la URL de WhatsApp con el resumen del pedido (NO abre nada).
  // Se calcula ANTES de vaciar el carrito y se ofrece como botón opcional en el éxito.
  const buildWhatsAppUrl = (): string => {
    const phone = String(info.socialWhatsapp || '').replace(/\D/g, '')
    const lines = [
      `*Pedido — ${info.name || ''}*`,
      sede ? `Sede: ${sede.name}` : '',
      '',
      '*Productos:*',
      ...cart.map(i => {
        const variant = i.variantLabel ? ` · ${i.variantLabel}` : ''
        const mods = i.mods.length ? `\n   ${i.mods.map(m => m.optionName).join(', ')}` : ''
        const note = i.notes ? `\n   _${i.notes}_` : ''
        return `• ${i.qty}x ${i.product.name}${variant} — ${COP(lineUnit(i) * i.qty)}${mods}${note}`
      }),
      '',
      `*Total a pagar: ${COP(cartTotal)}*`,
      '',
      `Cliente: ${coName.trim()}`,
      `WhatsApp: +57 ${coWhats.trim()}`,
      forOther ? `Recibe: ${otherName.trim()} (+57 ${otherPhone.trim()})` : '',
      `Entrega: ${mode === 'domicilio' ? 'Domicilio' : 'Recoger en sede'}`,
      mode === 'domicilio' ? `Dirección: ${address.trim()}` : '',
      mode === 'domicilio' && mapsLink ? `Ubicación: ${mapsLink}` : '',
      `Pago: ${paymentLabel[payment] || ''}`,
    ].filter(Boolean)
    const msg = encodeURIComponent(lines.join('\n'))
    return phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`
  }

  // Resetea el checkout tras un pedido exitoso (evita reenvíos / duplicados).
  const resetCheckout = () => {
    setCart([]); setShowCart(false)
    setCoWhats(''); setCoWhatsConfirm(''); setCoName('')
    setForOther(false); setOtherName(''); setOtherPhone('')
    setAddress(''); setPayment('')
    setCoLat(null); setCoLng(null); setLocErr(''); setFoundMsg(''); lookedUpRef.current = ''
    setOrderError('')
  }

  // Envía: registra el pedido en BD → muestra el éxito (holo + ticket) → abre WhatsApp.
  const submitOrder = async () => {
    if (missing.length > 0 || cart.length === 0 || submitting) return
    setSubmitting(true)
    setOrderError('')
    // Snapshot ANTES de vaciar el carrito (para el ticket).
    const snapshotItems = cart.map(i => ({ name: `${i.product.name}${i.variantLabel ? ` — ${i.variantLabel}` : ''}`, qty: i.qty, lineTotal: lineUnit(i) * i.qty }))
    const snapshotMode = mode
    const snapshotName = coName.trim()
    const snapshotSede = sede?.name ?? null
    const res = await registerOrder()
    if (res.ok) {
      // NO redirige a WhatsApp: muestra el contenedor de éxito y deja seguir comprando.
      // El WhatsApp queda como botón opcional ("¿Olvidaste algo?") dentro del éxito.
      const whatsappUrl = buildWhatsAppUrl()
      setSuccess({
        orderNumber: res.orderNumber,
        total: res.total ?? cartTotal,
        items: snapshotItems,
        mode: snapshotMode,
        customerName: snapshotName,
        sedeName: snapshotSede,
        whatsappUrl,
      })
      resetCheckout()
    }
    setSubmitting(false)
  }

  // ════════ SELECTOR DE SEDE ════════
  if (step === 'sede') {
    return (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-[#141414] border border-cyan-400/40 overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
            <div>
              <h3 className="text-lg font-bold text-white">Selecciona una Sede</h3>
              <p className="text-xs text-white/40">Elige dónde quieres ordenar</p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
            {sedes.map(s => (
              <button
                key={s.id}
                onClick={() => { setSede(s); setStep('menu') }}
                className="w-full text-left flex items-center gap-3 rounded-xl bg-[#1b1b1b] border border-white/[0.06] hover:border-cyan-400/40 p-3 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-white/40" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{s.name}</p>
                  {s.address && <p className="text-xs text-white/40 truncate flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{s.address}</p>}
                  <p className={`text-xs mt-1 ${openState === 'closed' ? 'text-red-400' : 'text-green-400'}`}>
                    {openState === 'closed' ? `Cerrado${nextOpenLabel ? ` · ${nextOpenLabel}` : ''}` : 'Abierto'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ════════ MENÚ ════════
  return (
    <div className="fixed inset-0 z-[60] bg-[#0a0a0a] text-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => sedes.length > 1 ? setStep('sede') : onClose()}
            className="text-white/60 hover:text-white"
          ><ChevronLeft className="w-5 h-5" /></button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-bold truncate">{sede?.name || info.name}</p>
            <p className={`text-[11px] ${openState === 'closed' ? 'text-red-400' : 'text-green-400'}`}>
              {openState === 'closed' ? `Cerrado${nextOpenLabel ? ` · ${nextOpenLabel}` : ''}` : 'Abierto'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {/* Buscador */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full rounded-xl bg-[#161616] border border-white/[0.08] pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
          {/* Categorías */}
          <div className="flex gap-2 overflow-x-auto pb-1 mt-3 -mx-1 px-1">
            {[{ name: 'all', displayName: 'Todos' }, ...categories].map(c => (
              <button
                key={c.name}
                onClick={() => setActiveCat(c.name)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeCat === c.name ? 'bg-cyan-500 text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}
              >{c.displayName || c.name}</button>
            ))}
          </div>
          {/* Filtros */}
          <div className="flex gap-2 overflow-x-auto pb-1 mt-2 -mx-1 px-1">
            {([
              ['todos', 'Todos'], ['nuevo', '🆕 Nuevo'], ['destacado', '⭐ Destacado'],
              ['populares', '🔥 Populares'], ['descuento', '🏷️ Descuento'],
            ] as const).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium border transition-colors ${activeFilter === f ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300' : 'border-white/[0.08] text-white/50 hover:text-white'}`}
              >{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de productos */}
      <div className="px-4 py-4 pb-28 max-w-3xl mx-auto space-y-3">
        {loadingProducts ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500/30 border-t-cyan-400" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-white/40 py-16 text-sm">No hay productos para mostrar.</p>
        ) : (
          filtered.map(p => (
            <div key={p.id} className="flex gap-3 rounded-2xl bg-[#141414] border border-white/[0.06] p-3">
              <button onClick={() => openDetail(p)} className="w-20 h-20 rounded-xl overflow-hidden bg-[#0e0e0e] shrink-0">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={abs(p.imageUrl)} alt={p.name} className="w-full h-full object-cover" />
                ) : <div className="w-full h-full flex items-center justify-center"><Store className="w-6 h-6 text-white/10" /></div>}
              </button>
              <div className="min-w-0 flex-1 flex flex-col">
                <button onClick={() => openDetail(p)} className="text-left">
                  <h3 className="font-bold text-sm">{p.name}</h3>
                  {p.description && <p className="text-xs text-white/40 line-clamp-2 mt-0.5">{p.description}</p>}
                </button>
                {(() => { const pr = parseQtyPromo(p.qtyPromo); return pr ? (
                  <span className="mt-1 inline-flex w-fit items-center rounded-full bg-green-500/15 text-green-400 text-[10px] font-bold px-2 py-0.5">
                    {pr.secondUnitPct ? `2da −${pr.secondUnitPct}%` : 'Promo x cantidad'}
                  </span>
                ) : null })()}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-400">{COP(priceOf(p))}</span>
                    {!!(p.isOnOffer && p.offerPrice) && <span className="text-[11px] text-white/30 line-through">{COP(p.salePrice)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openDetail(p)} className="text-[11px] text-white/40 hover:text-white">Ver detalles</button>
                    <button onClick={() => quickAdd(p)} className="w-8 h-8 rounded-full bg-cyan-500 text-black flex items-center justify-center hover:opacity-90"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Botón flotante de carrito */}
      {cartCount > 0 && !detail && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-black font-bold px-6 py-3.5 shadow-2xl"
        >
          <ShoppingBag className="w-5 h-5" />
          Ver pedido ({cartCount})
          <span>{COP(cartTotal)}</span>
        </button>
      )}

      {/* ════ DETALLE DE PRODUCTO ════ */}
      {detail && (
        <div className="fixed inset-0 z-40 bg-[#0a0a0a] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/[0.06]">
            <button onClick={() => setDetail(null)} className="text-white/60 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
            <p className="text-sm font-bold truncate">{detail.name}</p>
          </div>
          <div className="pb-28">
            <div className="aspect-square max-h-[42vh] w-full bg-[#0e0e0e] overflow-hidden flex items-center justify-center">
              {detailImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detailImg} alt={detail.name} className="w-full h-full object-cover transition-all" />
              ) : <Store className="w-12 h-12 text-white/10" />}
            </div>
            <div className="px-5 py-5 max-w-2xl mx-auto space-y-5">
              <div>
                <h2 className="text-xl font-extrabold">{detail.name}</h2>
                {detail.description && <p className="text-sm text-white/45 mt-1 leading-relaxed">{detail.description}</p>}
                <p className="text-2xl font-extrabold text-cyan-400 mt-3">
                  {selVariant ? COP(selVariant.price) : COP(priceOf(detail))}
                </p>
                {detail.category && <span className="inline-block mt-2 text-[10px] uppercase tracking-wider text-white/40 border border-white/15 rounded-full px-2.5 py-0.5">{detail.category}</span>}
              </div>

              {/* Selector de variantes (color / talla / material) — dinámico */}
              {detail.variants && detail.variants.length > 0 && (
                <VariantSelector
                  variants={detail.variants}
                  basePrice={priceOf(detail)}
                  isLightBg={false}
                  allowOutOfStock={detailIsPreorder}
                  formatPrice={COP}
                  onChange={setSelVariant}
                />
              )}

              {/* Grupos de modificadores */}
              {loadingMods ? (
                <div className="flex justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" /></div>
              ) : detailGroups.map(g => {
                const count = selected[g.id]?.size ?? 0
                const incomplete = g.isRequired && count < Math.max(1, g.minSelect)
                return (
                  <div key={g.id} className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <div className="flex items-center justify-between bg-[#161616] px-3 py-2.5">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide">{g.name}</p>
                        {(g.maxSelect || g.minSelect > 0) && (
                          <p className="text-[10px] text-white/35">
                            {g.selectionType === 'single' ? 'Elige 1' : `Elige${g.minSelect ? ` mín ${g.minSelect}` : ''}${g.maxSelect ? ` máx ${g.maxSelect}` : ''}`}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.isRequired ? (incomplete ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400') : 'bg-white/10 text-white/40'}`}>
                        {g.isRequired ? (incomplete ? 'OBLIGATORIO' : 'LISTO') : 'OPCIONAL'}
                      </span>
                    </div>
                    <div className="divide-y divide-white/[0.05]">
                      {g.options.map(o => {
                        const on = selected[g.id]?.has(o.id) ?? false
                        return (
                          <button key={o.id} type="button" onClick={() => toggleOption(g, o.id)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] text-left">
                            {o.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={abs(o.imageUrl)} alt={o.name} className="w-9 h-9 rounded-md object-cover shrink-0" />
                            ) : <div className="w-9 h-9 rounded-md bg-white/5 shrink-0" />}
                            <span className="flex-1 text-sm">{o.name}</span>
                            {o.priceDelta > 0 && <span className="text-xs text-white/50 shrink-0">+{COP(o.priceDelta)}</span>}
                            {o.priceDelta === 0 && <span className="text-[11px] text-white/30 shrink-0">Sin costo</span>}
                            <span className={`shrink-0 flex items-center justify-center w-5 h-5 ${g.selectionType === 'single' ? 'rounded-full' : 'rounded-md'} border-2 ${on ? 'border-cyan-400 bg-cyan-400' : 'border-white/25'}`}>
                              {on && <span className={`bg-black ${g.selectionType === 'single' ? 'w-2 h-2 rounded-full' : 'w-2.5 h-2.5 rounded-[2px]'}`} />}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <div>
                <p className="text-sm font-semibold mb-2">Cantidad</p>
                <div className="flex items-center gap-4 rounded-xl bg-[#161616] border border-white/[0.08] p-2 w-fit">
                  <button onClick={() => setDetailQty(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"><Minus className="w-4 h-4" /></button>
                  <span className="w-8 text-center font-bold">{detailQty}</span>
                  <button onClick={() => setDetailQty(q => q + 1)} className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"><Plus className="w-4 h-4" /></button>
                </div>
                {detailPromo && (
                  <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/[0.07] px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-green-400">
                      {detailPromo.secondUnitPct ? `🔥 Lleva 2 y la 2da con ${detailPromo.secondUnitPct}% menos` : '🔥 Promo por cantidad'}
                    </p>
                    {!!(detailPromo.tiers && detailPromo.tiers.length) && (
                      <p className="text-[11px] text-green-300/80 mt-0.5">
                        {detailPromo.tiers.map(t => `${t.minQty}+ → ${t.discountPct}% menos`).join(' · ')}
                      </p>
                    )}
                    {detailEffUnit < detailUnit && (
                      <p className="text-[11px] text-white/60 mt-1">Con {detailQty} unidades pagas {COP(detailEffUnit)} c/u · ahorras {COP((detailUnit - detailEffUnit) * detailQty)}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Notas adicionales</p>
                <textarea
                  value={detailNotes} onChange={e => setDetailNotes(e.target.value)}
                  placeholder="Ej: Extra picante, punto medio..."
                  rows={2}
                  className="w-full rounded-xl bg-[#161616] border border-white/[0.08] p-3 text-sm placeholder-white/30 focus:border-cyan-400/50 focus:outline-none resize-none"
                />
                <p className="text-[11px] text-white/30 mt-1.5">Tip: para varias unidades con notas distintas, agrégalas al carrito por separado.</p>
              </div>

              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="checkbox" checked={keepAdding} onChange={e => setKeepAdding(e.target.checked)} className="accent-cyan-500" />
                Seguir agregando este producto
              </label>
            </div>
          </div>
          {/* Botón fijo Agregar */}
          <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
            <button
              onClick={confirmDetail}
              disabled={detailMissing.length > 0 || variantPending}
              className="w-full max-w-2xl mx-auto block rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-black font-bold py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {variantPending
                ? (selVariant && selVariant.available <= 0 ? 'Variante agotada' : 'Elige una opción')
                : detailMissing.length > 0
                  ? `Elige: ${detailMissing.map(g => g.name).join(', ')}`
                  : `Agregar ${COP(detailEffUnit * detailQty)}`}
            </button>
          </div>
        </div>
      )}

      {/* ════ CARRITO (Fase 2: resumen + WhatsApp; checkout completo en Fase 3) ════ */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end" onClick={() => setShowCart(false)}>
          <div className="w-full max-w-md h-[100dvh] max-h-[100dvh] bg-[#0e0e0e] border-l border-white/[0.06] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06] shrink-0">
              <h3 className="font-bold">Tu pedido ({cartCount})</h3>
              <div className="flex items-center gap-3">
                <button onClick={() => setCart([])} className="text-white/40 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                <button onClick={() => setShowCart(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Items */}
              {cart.length === 0 ? (
                <p className="text-center text-white/40 py-16 text-sm">Tu carrito está vacío.</p>
              ) : cart.map(i => {
                const eff = lineUnit(i)
                const discounted = eff < i.unit
                return (
                <div key={i.key} className="py-3 border-b border-white/[0.05] flex gap-3">
                  {(() => { const src = abs(i.variantImage || i.product.imageUrl); return src ? (
                    <img src={src} alt={i.product.name} className="w-16 h-16 rounded-lg object-cover shrink-0 bg-white/[0.04]" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg shrink-0 bg-white/[0.04]" />
                  ) })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-semibold text-white/90 leading-snug">{i.product.name}</p>
                      <span className="text-sm font-bold text-white shrink-0 text-right">
                        {discounted && <span className="block text-[11px] font-normal text-white/30 line-through">{COP(i.unit * i.qty)}</span>}
                        {COP(eff * i.qty)}
                      </span>
                    </div>
                    {i.variantLabel && <p className="text-[11px] text-cyan-300/90 mt-1 font-medium">{i.variantLabel}</p>}
                    {i.mods.length > 0 && <p className="text-[11px] text-cyan-300/70 mt-1">{i.mods.map(m => m.optionName).join(', ')}</p>}
                    {i.notes && <p className="text-[11px] text-white/35 mt-0.5 italic">{i.notes}</p>}
                    {discounted && <p className="text-[11px] text-green-400 mt-1 font-semibold">Promo aplicada · ahorras {COP((i.unit - eff) * i.qty)}</p>}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="inline-flex items-center rounded-full border border-white/10">
                        <button onClick={() => changeCartQty(i.key, -1)} aria-label="Quitar uno" className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-6 text-center text-sm font-bold">{i.qty}</span>
                        <button onClick={() => changeCartQty(i.key, 1)} aria-label="Agregar uno" className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                      <span className="text-[11px] text-white/30">{COP(eff)} c/u</span>
                    </div>
                  </div>
                </div>
              )})}

              {cart.length > 0 && (
                <div className="space-y-4 pt-2">
                  {/* WhatsApp */}
                  <Field label="WhatsApp" required>
                    <PhoneInput value={coWhats} onChange={setCoWhats} placeholder="3001234567" />
                  </Field>
                  {foundMsg && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/[0.08] px-3 py-2.5 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                      <p className="text-[13px] font-semibold text-green-400">{foundMsg}</p>
                    </div>
                  )}
                  <Field label="Confirmar WhatsApp" required>
                    <PhoneInput value={coWhatsConfirm} onChange={setCoWhatsConfirm} placeholder="Repite tu número" />
                  </Field>
                  <Field label="Tu nombre" required>
                    <input value={coName} onChange={e => setCoName(e.target.value)} placeholder="Ej: Juan Pérez" className={INP} />
                  </Field>

                  {/* Para otra persona */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${forOther ? 'bg-cyan-500' : 'bg-white/15'}`}>
                      <input type="checkbox" checked={forOther} onChange={e => setForOther(e.target.checked)} className="sr-only" />
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${forOther ? 'translate-x-6' : 'translate-x-1'}`} />
                    </span>
                    <span className="text-sm">
                      <span className="font-semibold text-orange-400">🎁 Este pedido es para otra persona</span>
                      <span className="block text-[11px] text-white/40">Ingresa los datos de quien recibirá el pedido</span>
                    </span>
                  </label>
                  {forOther && (
                    <div className="rounded-xl bg-[#161616] border border-white/[0.06] p-3 space-y-3">
                      <p className="text-xs font-semibold text-cyan-400">Datos de quien recibe</p>
                      <Field label="Nombre completo" required>
                        <input value={otherName} onChange={e => setOtherName(e.target.value)} placeholder="Nombre de quien recibe" className={INP} />
                      </Field>
                      <Field label="Teléfono/WhatsApp" required>
                        <PhoneInput value={otherPhone} onChange={setOtherPhone} placeholder="Teléfono de quien recibe" />
                      </Field>
                    </div>
                  )}

                  {/* Domicilio / Recoger */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#161616] border border-white/[0.06] p-1">
                    {(['domicilio', 'recoger'] as const).map(m => (
                      <button key={m} onClick={() => setMode(m)} className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === m ? 'bg-cyan-500 text-black' : 'text-white/60 hover:text-white'}`}>
                        {m === 'domicilio' ? '🛵 Domicilio' : '🏪 Recoger'}
                      </button>
                    ))}
                  </div>

                  {mode === 'domicilio' && (
                    <>
                      <Field label="Barrio o Dirección" required>
                        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Barrio Centro, Calle 123 #45-67" className={INP} />
                      </Field>
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3 flex items-start gap-2">
                        <span>🛵</span>
                        <div>
                          <p className="text-xs font-semibold text-amber-400">Domicilio no incluido</p>
                          <p className="text-[11px] text-white/50">El costo del envío se coordina directamente con el restaurante.</p>
                        </div>
                      </div>
                      {coLat == null || coLng == null ? (
                        <>
                          <button onClick={captureLocation} disabled={locating} className="w-full rounded-xl border border-white/[0.08] bg-[#161616] py-3 text-sm text-white/70 hover:text-white flex items-center justify-center gap-2 disabled:opacity-60">
                            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                            {locating ? 'Obteniendo tu ubicación…' : 'Agregar ubicación exacta (opcional)'}
                          </button>
                          {locErr && <p className="text-[11px] text-red-400 mt-1">{locErr}</p>}
                        </>
                      ) : (
                        <div className="rounded-xl overflow-hidden border border-green-500/30 bg-[#161616]">
                          <iframe
                            title="Ubicación de entrega"
                            className="w-full h-40 block"
                            loading="lazy"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${coLng - 0.0035}%2C${coLat - 0.002}%2C${coLng + 0.0035}%2C${coLat + 0.002}&layer=mapnik&marker=${coLat}%2C${coLng}`}
                          />
                          <div className="flex items-center justify-between px-3 py-2.5">
                            <span className="text-[13px] font-semibold text-green-400 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Ubicación capturada</span>
                            <div className="flex items-center gap-3">
                              <button onClick={captureLocation} className="text-[11px] text-white/50 hover:text-white">Actualizar</button>
                              <button onClick={clearLocation} className="text-[11px] text-white/50 hover:text-red-400">Quitar</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Método de pago */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Método de Pago <span className="text-red-400">*</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['efectivo', 'transferencia', 'tarjeta'] as const).map(pm => (
                        <button key={pm} onClick={() => setPayment(pm)} className={`flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${payment === pm ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300' : 'border-white/[0.08] text-white/70 hover:bg-white/[0.04]'}`}>
                          <span className={`w-3.5 h-3.5 rounded-full border-2 ${payment === pm ? 'border-cyan-400 bg-cyan-400' : 'border-white/30'}`} />
                          {paymentLabel[pm]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer fijo: totales + envío */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-white/[0.06] space-y-3 shrink-0">
                <div className="flex justify-between text-sm text-white/50">
                  <span>Subtotal</span><span>{COP(cartTotal)}</span>
                </div>
                {cartSavings > 0 && (
                  <div className="flex justify-between text-sm text-green-400 font-semibold">
                    <span>Ahorro por promos</span><span>−{COP(cartSavings)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total a pagar</span>
                  <span className="font-extrabold text-cyan-400">{COP(cartTotal)}</span>
                </div>
                {orderError && (
                  <p className="text-[13px] text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-3">{orderError}</p>
                )}
                <button
                  onClick={submitOrder}
                  disabled={missing.length > 0 || submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 text-black font-bold py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? <span className="text-[12px] font-semibold">Confirmando...</span>
                    : missing.length > 0
                      ? <span className="text-[12px] font-semibold">Falta: {missing.join(', ')}</span>
                      : <><Check className="w-5 h-5" /> Confirmar pedido</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ ÉXITO: holo "en camino" + ticket ════ */}
      {success && (
        <Theme2OrderSuccess
          data={success}
          brand={info.name}
          onClose={() => { setSuccess(null); onClose() }}
          onNewOrder={() => setSuccess(null)}
        />
      )}
    </div>
  )
}
