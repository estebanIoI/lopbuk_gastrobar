"use client"

/**
 * Cotizaciones (ferretería F2) — el cliente cotiza su proyecto y el vendedor lo
 * acompaña hasta la venta: borrador → enviada (WhatsApp) → aceptada (reserva
 * stock por sede) → facturada (venta real con 1 clic) | vencida/cancelada.
 * KPIs de conversión arriba: la métrica que pide el gerente.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { formatCOP } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  FileSpreadsheet, Plus, Search, Loader2, Send, Check, X, Trash2,
  ShoppingCart, MessageCircle, Printer, CalendarClock, Truck, TrendingUp, Package,
} from 'lucide-react'

interface QuoteItem { productId: string; productName: string; quantity: number; unitPrice: number; discount: number; subtotal: number }
interface Quote {
  id: string; quoteNumber: string; customerName?: string; customerPhone?: string
  sellerName?: string; sedeId?: string | null; sedeName?: string | null
  items: QuoteItem[]; subtotal: number; discount: number; total: number
  status: 'borrador' | 'enviada' | 'aceptada' | 'facturada' | 'vencida' | 'cancelada'
  validUntil?: string | null; deliveryPromise?: string | null; notes?: string | null
  saleId?: string | null; createdAt: string
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  borrador:  { label: 'Borrador',  cls: 'bg-zinc-500/15 text-zinc-500' },
  enviada:   { label: 'Enviada',   cls: 'bg-blue-500/15 text-blue-600' },
  aceptada:  { label: 'Aceptada',  cls: 'bg-amber-500/15 text-amber-600' },
  facturada: { label: 'Facturada', cls: 'bg-green-500/15 text-green-600' },
  vencida:   { label: 'Vencida',   cls: 'bg-orange-500/15 text-orange-500' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-500/15 text-red-500' },
}

export function QuotesPanel() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [stats, setStats] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Quote | 'new' | null>(null)
  const [converting, setConverting] = useState<Quote | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [qRes, sRes] = await Promise.all([
        api.getQuotes({ status: statusFilter === 'all' ? undefined : statusFilter, search: search || undefined }),
        api.getQuoteStats(),
      ])
      if (qRes.success && qRes.data) setQuotes(qRes.data as Quote[])
      if (sRes.success && sRes.data) setStats((sRes.data as any).month)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const act = async (q: Quote, fn: () => Promise<any>, okMsg: string) => {
    setActingId(q.id)
    try {
      const res = await fn()
      if (res.success) { toast.success(okMsg); await load() }
      else toast.error(res.error || res.message || 'No se pudo completar la acción')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo completar la acción')
    } finally {
      setActingId(null)
    }
  }

  const printQuote = (q: Quote) => {
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    const rows = q.items.map(i =>
      `<tr><td>${i.productName}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${formatCOP(i.unitPrice)}</td><td style="text-align:right">${formatCOP(i.subtotal)}</td></tr>`
    ).join('')
    w.document.write(`<!doctype html><html><head><title>${q.quoteNumber}</title><style>
      body{font-family:system-ui,sans-serif;padding:32px;color:#111}
      h1{font-size:20px;margin:0} .muted{color:#666;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
      th,td{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left}
      th{background:#f5f5f5;font-size:12px;text-transform:uppercase}
      .total{font-size:18px;font-weight:700;text-align:right;margin-top:12px}
    </style></head><body>
      <h1>Cotización ${q.quoteNumber}</h1>
      <p class="muted">${q.customerName ? `Cliente: ${q.customerName}` : ''}${q.customerPhone ? ` · ${q.customerPhone}` : ''}<br/>
      Fecha: ${new Date(q.createdAt).toLocaleDateString('es-CO')}${q.validUntil ? ` · Válida hasta: ${String(q.validUntil).slice(0, 10)}` : ''}${q.deliveryPromise ? ` · Entrega estimada: ${String(q.deliveryPromise).slice(0, 10)}` : ''}${q.sedeName ? ` · Sede: ${q.sedeName}` : ''}</p>
      <table><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${q.discount > 0 ? `<p style="text-align:right;margin:8px 0 0">Descuento: −${formatCOP(q.discount)}</p>` : ''}
      <p class="total">Total: ${formatCOP(q.total)}</p>
      ${q.notes ? `<p class="muted">${q.notes}</p>` : ''}
      <script>window.print()</script>
    </body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Cotizaciones
          </h2>
          <p className="text-sm text-muted-foreground">Del proyecto del cliente a la venta: cotiza, reserva y factura con 1 clic</p>
        </div>
        <Button onClick={() => setEditing('new')} className="gap-2 h-10">
          <Plus className="h-4 w-4" /> Nueva cotización
        </Button>
      </div>

      {/* KPIs del mes */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 lg:gap-3">
          <KpiCard icon={<FileSpreadsheet className="h-4 w-4" />} label="Cotizaciones del mes" value={String(stats.total)} sub={`${stats.open} abiertas · ${stats.expired} vencidas`} />
          <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Conversión a venta" value={`${stats.conversionRate}%`} sub={`${stats.converted} facturadas`} accent={stats.conversionRate >= 30 ? 'text-green-600' : 'text-amber-600'} />
          <KpiCard icon={<ShoppingCart className="h-4 w-4" />} label="Valor facturado" value={formatCOP(stats.convertedValue)} sub="desde cotizaciones" accent="text-green-600" />
          <KpiCard icon={<Package className="h-4 w-4" />} label="Pipeline abierto" value={formatCOP(stats.pipelineValue)} sub={`${stats.accepted} aceptadas (stock reservado)`} />
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, # o teléfono…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'borrador', 'enviada', 'aceptada', 'facturada', 'vencida'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/70'}`}
            >
              {s === 'all' ? 'Todas' : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : quotes.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm font-medium">Sin cotizaciones {statusFilter !== 'all' ? `en "${STATUS_META[statusFilter]?.label}"` : 'todavía'}</p>
            <p className="text-xs mt-1">Crea la primera con "Nueva cotización"</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {quotes.map(q => {
            const meta = STATUS_META[q.status]
            const busy = actingId === q.id
            return (
              <Card key={q.id} className="border-border">
                <CardContent className="p-3 lg:p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">{q.quoteNumber}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      {q.sedeName && <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">📍 {q.sedeName}</span>}
                    </div>
                    <span className="text-sm font-bold text-primary">{formatCOP(q.total)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
                    <span>
                      {q.customerName || 'Cliente sin nombre'}{q.customerPhone ? ` · ${q.customerPhone}` : ''} · {q.items.length} ítem{q.items.length !== 1 ? 's' : ''}
                      {q.sellerName ? ` · por ${q.sellerName}` : ''}
                    </span>
                    <span className="flex items-center gap-3">
                      {q.validUntil && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {String(q.validUntil).slice(0, 10)}</span>}
                      {q.deliveryPromise && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> {String(q.deliveryPromise).slice(0, 10)}</span>}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {q.items.slice(0, 4).map((i, idx) => (
                      <span key={idx} className="text-[11px] bg-secondary rounded-full px-2 py-0.5 text-muted-foreground">{i.productName} × {i.quantity}</span>
                    ))}
                    {q.items.length > 4 && <span className="text-[11px] text-muted-foreground">+{q.items.length - 4} más</span>}
                  </div>

                  {/* Acciones según estado */}
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {(q.status === 'borrador' || q.status === 'enviada') && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(q)}>Editar</Button>
                        {q.customerPhone && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-300" disabled={busy}
                            onClick={() => act(q, () => api.sendQuoteWhatsApp(q.id), 'Cotización enviada por WhatsApp')}>
                            <MessageCircle className="h-3 w-3" /> WhatsApp
                          </Button>
                        )}
                        {q.status === 'borrador' && !q.customerPhone && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy}
                            onClick={() => act(q, () => api.setQuoteStatus(q.id, 'enviada'), 'Marcada como enviada')}>
                            <Send className="h-3 w-3" /> Marcar enviada
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-amber-600 border-amber-300" disabled={busy}
                          onClick={() => act(q, () => api.setQuoteStatus(q.id, 'aceptada'), 'Aceptada — stock reservado')}>
                          <Check className="h-3 w-3" /> Aceptar (reserva stock)
                        </Button>
                      </>
                    )}
                    {(q.status === 'borrador' || q.status === 'enviada' || q.status === 'aceptada') && (
                      <>
                        <Button size="sm" className="h-7 text-xs gap-1" disabled={busy} onClick={() => setConverting(q)}>
                          <ShoppingCart className="h-3 w-3" /> Facturar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-500 border-red-300" disabled={busy}
                          onClick={() => act(q, () => api.setQuoteStatus(q.id, 'cancelada'), 'Cotización cancelada')}>
                          <X className="h-3 w-3" /> Cancelar
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => printQuote(q)}>
                      <Printer className="h-3 w-3" /> Imprimir
                    </Button>
                    {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <QuoteFormModal
          quote={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {converting && (
        <ConvertModal
          quote={converting}
          onClose={() => setConverting(null)}
          onDone={() => { setConverting(null); load() }}
        />
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon} {label}</p>
        <p className={`text-lg font-bold mt-0.5 ${accent || 'text-foreground'}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ── Form crear/editar ──────────────────────────────────────────────────────────

function QuoteFormModal({ quote, onClose, onSaved }: { quote: Quote | null; onClose: () => void; onSaved: () => void }) {
  const { products, fetchProducts, sedes, fetchSedes } = useStore()
  const [customerName, setCustomerName] = useState(quote?.customerName || '')
  const [customerPhone, setCustomerPhone] = useState(quote?.customerPhone || '')
  const [sedeId, setSedeId] = useState(quote?.sedeId || '')
  const [validUntil, setValidUntil] = useState(quote?.validUntil ? String(quote.validUntil).slice(0, 10) : defaultValidity())
  const [deliveryPromise, setDeliveryPromise] = useState(quote?.deliveryPromise ? String(quote.deliveryPromise).slice(0, 10) : '')
  const [notes, setNotes] = useState(quote?.notes || '')
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: number; unitPrice: number }[]>(
    quote?.items?.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })) || []
  )
  const [productSearch, setProductSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!products.length) fetchProducts(); if (!sedes.length) fetchSedes() }, [products.length, sedes.length, fetchProducts, fetchSedes])

  const matches = useMemo(() => {
    if (!productSearch.trim()) return []
    const term = productSearch.toLowerCase()
    return products
      .filter(p => !items.some(i => i.productId === p.id))
      .filter(p => p.name.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term))
      .slice(0, 6)
  }, [productSearch, products, items])

  const total = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)

  const save = async (status: 'borrador' | 'enviada') => {
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    setSaving(true)
    try {
      const payload = {
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        sedeId: sedeId || undefined,
        validUntil: validUntil || undefined,
        deliveryPromise: deliveryPromise || undefined,
        notes: notes || undefined,
        status,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
      }
      const res = quote ? await api.updateQuote(quote.id, payload) : await api.createQuote(payload)
      if (res.success) { toast.success(quote ? 'Cotización actualizada' : 'Cotización creada'); onSaved() }
      else toast.error((res as any).error || (res as any).message || 'No se pudo guardar')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{quote ? `Editar ${quote.quoteNumber}` : 'Nueva cotización'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Teléfono (para WhatsApp)</Label>
              <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="3001234567" className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {sedes.length >= 2 && (
              <div>
                <Label className="text-xs text-muted-foreground">Sede que despacha</Label>
                <Select value={sedeId || 'none'} onValueChange={v => setSedeId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin sede —</SelectItem>
                    {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Válida hasta</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Promesa de entrega</Label>
              <Input type="date" value={deliveryPromise} onChange={e => setDeliveryPromise(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Productos */}
          <div>
            <Label className="text-xs text-muted-foreground">Agregar productos</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Buscar por nombre o SKU…" className="pl-8 h-9 text-sm" />
            </div>
            {matches.length > 0 && (
              <div className="mt-1 border border-border rounded-md divide-y divide-border overflow-hidden">
                {matches.map(p => (
                  <button
                    key={p.id}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-secondary/60 text-left"
                    onClick={() => {
                      setItems(prev => [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPrice: p.salePrice }])
                      setProductSearch('')
                    }}
                  >
                    <span className="truncate text-foreground">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatCOP(p.salePrice)} · stock {p.stock}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div key={item.productId} className="flex items-center gap-2 bg-secondary/40 rounded-md px-2.5 py-1.5">
                  <span className="flex-1 text-sm text-foreground truncate">{item.productName}</span>
                  <Input
                    type="number" min={1} value={item.quantity}
                    onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, Number(e.target.value) || 1) } : it))}
                    className="h-7 w-16 text-right text-xs"
                  />
                  <Input
                    type="number" min={0} value={item.unitPrice}
                    onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: Math.max(0, Number(e.target.value) || 0) } : it))}
                    className="h-7 w-24 text-right text-xs"
                    title="Precio negociado"
                  />
                  <span className="text-xs font-medium text-foreground w-20 text-right">{formatCOP(item.unitPrice * item.quantity)}</span>
                  <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <p className="text-right text-sm font-bold text-primary pt-1">Total: {formatCOP(total)}</p>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Notas (obra, condiciones, forma de pago…)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => save('borrador')}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar borrador'}
            </Button>
            <Button size="sm" disabled={saving} onClick={() => save('enviada')} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Guardar y enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Facturar (convertir a venta) ───────────────────────────────────────────────

function ConvertModal({ quote, onClose, onDone }: { quote: Quote; onClose: () => void; onDone: () => void }) {
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [converting, setConverting] = useState(false)

  const convert = async () => {
    setConverting(true)
    try {
      const res = await api.convertQuote(quote.id, { paymentMethod, amountPaid: quote.total })
      if (res.success) {
        toast.success(`Facturada — venta ${(res.data as any)?.invoiceNumber || ''} creada`)
        onDone()
      } else {
        toast.error((res as any).error || (res as any).message || 'No se pudo facturar')
      }
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo facturar')
    } finally {
      setConverting(false)
    }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Facturar {quote.quoteNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <p className="text-sm text-muted-foreground">
            Se crea la venta real con los {quote.items.length} ítems por <span className="font-bold text-foreground">{formatCOP(quote.total)}</span>.
            {quote.status === 'aceptada' && ' La reserva de stock se libera y la venta descuenta el inventario.'}
          </p>
          <div>
            <Label className="text-xs text-muted-foreground">Método de pago</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="fiado">Fiado / Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={converting} onClick={convert} className="gap-1">
              {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />} Confirmar venta
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function defaultValidity(): string {
  const d = new Date()
  d.setDate(d.getDate() + 15)
  return d.toISOString().slice(0, 10)
}
