'use client'

/**
 * CartDrawer — carrito + checkout INLINE del Consumer OS (C4b).
 * Agrupa por comercio (multi-tienda) y crea un pedido por tienda con /orders/public
 * (endpoint endurecido). Pago: efectivo (registra y confirma) o Wompi (1 tienda,
 * redirige al checkout público que ya construimos). No saca al usuario del OS.
 */
import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Minus, Trash2, Loader2, Check, ShoppingBag, Store, Navigation, MapPin, Crown } from 'lucide-react'
import { api } from '@/lib/api'
import { useConsumerCart, cartSubtotal, type ConsumerCartItem } from '@/lib/consumer-cart-store'
import { hapticSuccess } from '@/lib/haptics'

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const ASSET_BASE = API_URL.replace(/\/api$/, '')
const abs = (u?: string | null) => (!u ? '' : u.startsWith('http') ? u : `${ASSET_BASE}${u}`)

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, setQty, remove, clear } = useConsumerCart()
  const [step, setStep] = useState<'cart' | 'form' | 'done'>('cart')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [payment, setPayment] = useState<'efectivo' | 'wompi'>('efectivo')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Ubicación GPS (mini-mapa, sin mostrar coordenadas)
  const [coLat, setCoLat] = useState<number | null>(null)
  const [coLng, setCoLng] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)
  // Descuento LEGEND (C7.5)
  const [discountPct, setDiscountPct] = useState(0)

  useEffect(() => {
    if (!open) return
    api.getConsumerDiscounts().then(r => { if (r.success && r.data?.hasDiscounts) setDiscountPct(Number(r.data.percentOff) || 0) }).catch(() => {})
  }, [open])

  const captureLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setCoLat(pos.coords.latitude); setCoLng(pos.coords.longitude); setLocating(false) },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // Agrupa por comercio (multi-tienda → un pedido por tienda)
  const groups = useMemo(() => {
    const m = new Map<string, { tenantId: string | null; storeName: string; items: ConsumerCartItem[] }>()
    for (const it of items) {
      const key = it.tenantId || '__default__'
      if (!m.has(key)) m.set(key, { tenantId: it.tenantId ?? null, storeName: it.storeName || 'Tienda', items: [] })
      m.get(key)!.items.push(it)
    }
    return [...m.values()]
  }, [items])

  const subtotal = cartSubtotal(items)
  const savings = Math.round(subtotal * discountPct / 100)
  const finalTotal = Math.max(0, subtotal - savings)
  const missing = !name.trim() || phone.replace(/\D/g, '').length < 10
  const wompiMultiBlock = payment === 'wompi' && groups.length > 1

  const submit = async () => {
    if (missing || submitting) return
    if (wompiMultiBlock) { setError('Wompi permite pagar una tienda a la vez. Usa efectivo o deja productos de una sola tienda.'); return }
    setSubmitting(true); setError('')
    try {
      const orderNumbers: string[] = []
      for (const g of groups) {
        const gSubtotal = g.items.reduce((s, it) => s + it.unitPrice * it.qty, 0)
        const gDiscount = Math.round(gSubtotal * discountPct / 100)
        const baseNote = (coLat != null && coLng != null) ? `Pedido desde Explore (Consumer OS) · Ubicación: https://maps.google.com/?q=${coLat},${coLng}` : 'Pedido desde Explore (Consumer OS)'
        const r = await fetch(`${API_URL}/orders/public`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: name.trim(),
            customerPhone: phone.trim(),
            address: address.trim() || undefined,
            notes: gDiscount > 0 ? `${baseNote} · Descuento LEGEND ${discountPct}%` : baseNote,
            discount: gDiscount || undefined,
            deliveryLatitude: coLat ?? undefined,
            deliveryLongitude: coLng ?? undefined,
            tenantId: g.tenantId || undefined,
            paymentMethod: payment === 'wompi' ? 'wompi' : 'efectivo',
            items: g.items.map(it => ({
              productId: it.productId, productName: it.name, quantity: it.qty, unitPrice: it.unitPrice,
              productImage: it.image || undefined,
            })),
          }),
        })
        const j = await r.json().catch(() => null)
        if (!r.ok || !j?.success) { setError(j?.error || 'No se pudo crear el pedido.'); setSubmitting(false); return }
        if (j.data?.orderNumber) orderNumbers.push(j.data.orderNumber)
      }
      // Wompi (1 tienda) → checkout público y redirección
      if (payment === 'wompi' && orderNumbers[0]) {
        const res = await api.createPublicOrderCheckout({
          contextId: orderNumbers[0],
          redirectUrl: `${window.location.origin}/pago/resultado`,
        })
        if (res?.success && res.data?.checkoutUrl) { window.location.href = res.data.checkoutUrl; return }
        setError(res?.error || 'No se pudo iniciar el pago.'); setSubmitting(false); return
      }
      // Efectivo → confirmado
      if (savings > 0) api.trackConsumerEvent('discount_used', { amount: savings, pct: discountPct }).catch(() => {})
      hapticSuccess()
      clear(); setStep('done')
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.')
    } finally { setSubmitting(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[160] bg-black/50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-black/10 shrink-0">
          <h3 className="font-bold flex items-center gap-2"><ShoppingBag className="w-5 h-5" /> Tu carrito</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="w-5 h-5" /></button>
        </div>

        {step === 'done' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3"><Check className="w-8 h-8" /></div>
            <p className="font-bold text-lg">¡Pedido confirmado!</p>
            <p className="text-sm text-neutral-500 mt-1">El comercio se pondrá en contacto contigo.</p>
            <button onClick={() => { setStep('cart'); onClose() }} className="mt-6 rounded-xl bg-neutral-900 text-white text-sm font-semibold px-5 py-2.5">Seguir explorando</button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-300">
            <ShoppingBag className="w-10 h-10 mb-2" /><p className="text-sm">Tu carrito está vacío.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {groups.map((g, gi) => (
                <div key={gi}>
                  <p className="text-[11px] font-semibold text-neutral-400 uppercase mb-2 flex items-center gap-1"><Store className="w-3 h-3" />{g.storeName}</p>
                  <div className="space-y-3">
                    {g.items.map(it => (
                      <div key={it.productId} className="flex gap-3">
                        {abs(it.image) ? <img src={abs(it.image)} alt={it.name} className="w-14 h-14 rounded-lg object-cover bg-neutral-100 shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-neutral-100 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between gap-2">
                            <p className="text-sm font-semibold line-clamp-2">{it.name}</p>
                            <button onClick={() => remove(it.productId)} className="text-neutral-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <div className="inline-flex items-center rounded-full border border-black/10">
                              <button onClick={() => setQty(it.productId, it.qty - 1)} className="w-7 h-7 flex items-center justify-center text-neutral-500"><Minus className="w-3.5 h-3.5" /></button>
                              <span className="w-6 text-center text-sm font-bold">{it.qty}</span>
                              <button onClick={() => setQty(it.productId, it.qty + 1)} className="w-7 h-7 flex items-center justify-center text-neutral-500"><Plus className="w-3.5 h-3.5" /></button>
                            </div>
                            <span className="text-sm font-bold">{COP(it.unitPrice * it.qty)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {step === 'form' && (
                <div className="space-y-3 pt-2 border-t border-black/10">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre *" className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                  <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="WhatsApp (10 dígitos) *" className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección de entrega (opcional)" className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                  {/* Ubicación GPS exacta (mini-mapa, sin coordenadas) */}
                  {coLat == null || coLng == null ? (
                    <button onClick={captureLocation} disabled={locating} className="w-full rounded-lg border border-neutral-200 py-2.5 text-sm text-neutral-600 hover:border-emerald-400 flex items-center justify-center gap-2 disabled:opacity-60">
                      {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                      {locating ? 'Obteniendo ubicación…' : 'Agregar ubicación exacta (opcional)'}
                    </button>
                  ) : (
                    <div className="rounded-lg overflow-hidden border border-emerald-300">
                      <iframe title="Ubicación" className="w-full h-32 block" loading="lazy"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${coLng - 0.0035}%2C${coLat - 0.002}%2C${coLng + 0.0035}%2C${coLat + 0.002}&layer=mapnik&marker=${coLat}%2C${coLng}`} />
                      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50">
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Ubicación lista</span>
                        <button onClick={() => { setCoLat(null); setCoLng(null) }} className="text-[11px] text-neutral-500 hover:text-red-500">Quitar</button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {(['efectivo', 'wompi'] as const).map(pm => (
                      <button key={pm} onClick={() => { setPayment(pm); setError('') }} className={`rounded-lg border p-2.5 text-sm font-medium ${payment === pm ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-neutral-200 text-neutral-600'}`}>
                        {pm === 'efectivo' ? 'Contra entrega' : 'Pagar con Wompi'}
                      </button>
                    ))}
                  </div>
                  {wompiMultiBlock && <p className="text-[11px] text-amber-600">Wompi: una tienda a la vez. Tienes productos de {groups.length} tiendas.</p>}
                  {error && <p className="text-xs text-red-500">{error}</p>}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-black/10 shrink-0 space-y-2">
              <div className="flex justify-between text-sm text-neutral-500"><span>Subtotal</span><span>{COP(subtotal)}</span></div>
              {savings > 0 && (
                <div className="flex justify-between text-sm font-semibold" style={{ color: '#D4AF37' }}>
                  <span className="flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> Precio LEGEND (−{discountPct}%)</span>
                  <span>−{COP(savings)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{COP(finalTotal)}</span></div>
              {savings > 0 && <p className="text-[11px] text-emerald-600 text-right -mt-1">Ahorraste {COP(savings)} 🎉</p>}
              {step === 'cart' ? (
                <button onClick={() => setStep('form')} className="w-full rounded-xl bg-neutral-900 text-white font-bold py-3">Continuar</button>
              ) : (
                <button onClick={submit} disabled={missing || submitting} className="w-full rounded-xl bg-emerald-500 text-white font-bold py-3 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (payment === 'wompi' ? 'Pagar con Wompi' : 'Confirmar pedido')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
