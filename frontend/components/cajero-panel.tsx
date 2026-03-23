'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Receipt, RefreshCcw, RefreshCw, Clock, LogOut,
  CheckCircle2, DollarSign, AlertCircle, X, ChevronRight,
  CreditCard, Banknote, Smartphone, ArrowLeftRight, Layers,
  Users, UtensilsCrossed, FileText, TrendingUp, History,
  ClipboardList, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const today = () => new Date().toISOString().split('T')[0]

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  abierta:   { label: 'Abierta',    cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  en_proceso: { label: 'En proceso', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  lista:     { label: 'Listo ✓',    cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  entregada: { label: 'Entregada',  cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  cerrada:   { label: 'Cerrada',    cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
}

const PAY_METHODS = [
  { id: 'efectivo',       label: 'Efectivo',      icon: Banknote },
  { id: 'tarjeta',        label: 'Tarjeta',       icon: CreditCard },
  { id: 'nequi',          label: 'Nequi',         icon: Smartphone },
  { id: 'bancolombia',    label: 'Bancolombia',   icon: ArrowLeftRight },
  { id: 'bbva',           label: 'BBVA',          icon: ArrowLeftRight },
  { id: 'transferencia',  label: 'Transferencia', icon: ArrowLeftRight },
  { id: 'mixto',          label: 'Mixto',         icon: Layers },
]

const GUEST_COLORS = [
  'border-violet-500/40 bg-violet-500/10 text-violet-400',
  'border-blue-500/40 bg-blue-500/10 text-blue-400',
  'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  'border-pink-500/40 bg-pink-500/10 text-pink-400',
  'border-amber-500/40 bg-amber-500/10 text-amber-400',
  'border-cyan-500/40 bg-cyan-500/10 text-cyan-400',
]
const guestColor = (n: number) => GUEST_COLORS[(n - 1) % GUEST_COLORS.length]

type PanelTab = 'activas' | 'facturas' | 'historial'

// ─── POS Receipt Printer ───────────────────────────────────────────────────────

function printReceipt({
  storeInfo,
  order,
  breakdown,
  payTarget,
  payMethod,
  amountPaid,
  targetAmount,
  changeAmount,
  invoiceNumber,
  cashierName,
}: {
  storeInfo: any
  order: any
  breakdown: any
  payTarget: null | 'general' | number
  payMethod: string
  amountPaid: number
  targetAmount: number
  changeAmount: number
  invoiceNumber: string
  cashierName: string
}) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Determine line items to print
  let lineItems: { qty: number; name: string; subtotal: number }[] = []
  let guestLabel = ''

  if (payTarget === null) {
    // Full table — use all non-cancelled items
    const activeItems = order.items?.filter((i: any) => i.status !== 'cancelado') ?? []
    lineItems = activeItems.map((i: any) => ({ qty: i.quantity, name: i.menuItemName ?? i.name, subtotal: i.subtotal ?? 0 }))
    guestLabel = 'Mesa completa'
  } else {
    // Specific guest
    const guest = breakdown?.guests?.find((g: any) =>
      payTarget === 'general' ? g.guestNumber == null : g.guestNumber === payTarget
    )
    if (guest) {
      guestLabel = guest.guestName
      lineItems = (guest.items ?? []).map((i: any) => ({ qty: i.quantity, name: i.menuItemName ?? i.name, subtotal: i.subtotal ?? 0 }))
    }
  }

  const methodLabel = PAY_METHODS.find(m => m.id === payMethod)?.label ?? payMethod

  const line = (char = '-', len = 32) => char.repeat(len)

  const rows = lineItems.map(i => {
    const priceStr = fmt(i.subtotal)
    const desc = `${i.qty}x ${i.name}`
    const spaces = Math.max(1, 32 - desc.length - priceStr.length)
    return `${desc}${' '.repeat(spaces)}${priceStr}`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Factura ${invoiceNumber}</title>
  <style>
    @page { margin: 4mm; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      width: 72mm;
      padding: 2mm;
    }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .large  { font-size: 14px; }
    .xlarge { font-size: 16px; }
    hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; }
    .row .price { white-space: nowrap; margin-left: 4px; }
    .total-box {
      border: 1px solid #000;
      padding: 4px 6px;
      margin: 4px 0;
    }
    @media print {
      body { width: 72mm; }
    }
  </style>
</head>
<body>
  <div class="center bold large">${storeInfo?.name ?? 'Establecimiento'}</div>
  ${storeInfo?.address ? `<div class="center">${storeInfo.address}</div>` : ''}
  ${storeInfo?.phone ? `<div class="center">Tel: ${storeInfo.phone}</div>` : ''}
  ${storeInfo?.taxId ? `<div class="center">NIT/CC: ${storeInfo.taxId}</div>` : ''}
  <hr/>
  <div class="center bold">FACTURA POS</div>
  <div class="center bold xlarge">${invoiceNumber}</div>
  <hr/>
  <div class="row"><span>Fecha:</span><span>${dateStr}</span></div>
  <div class="row"><span>Hora:</span><span>${timeStr}</span></div>
  <div class="row"><span>Mesa:</span><span>${order.tableNumber}</span></div>
  <div class="row"><span>Pedido:</span><span>${order.orderNumber}</span></div>
  <div class="row"><span>Mesero:</span><span>${order.waiterName ?? '—'}</span></div>
  <div class="row"><span>Cajero:</span><span>${cashierName}</span></div>
  ${guestLabel ? `<div class="row"><span>Cobrado a:</span><span class="bold">${guestLabel}</span></div>` : ''}
  <hr/>
  <div class="bold" style="margin-bottom:2px">DESCRIPCIÓN</div>
  ${lineItems.map(i => `
    <div class="row">
      <span>${i.qty}× ${i.name}</span>
      <span class="price">${fmt(i.subtotal)}</span>
    </div>
  `).join('')}
  <hr/>
  <div class="total-box">
    <div class="row bold large">
      <span>TOTAL</span>
      <span>${fmt(targetAmount)}</span>
    </div>
  </div>
  <div class="row"><span>Método de pago:</span><span class="bold">${methodLabel}</span></div>
  <div class="row"><span>Recibido:</span><span>${fmt(amountPaid)}</span></div>
  <div class="row bold"><span>Cambio:</span><span>${fmt(changeAmount)}</span></div>
  <hr/>
  ${storeInfo?.invoiceGreeting ? `<div class="center" style="margin-top:4px">${storeInfo.invoiceGreeting}</div>` : '<div class="center" style="margin-top:4px">¡Gracias por su visita!</div>'}
  ${storeInfo?.invoicePolicy ? `<div class="center" style="margin-top:2px;font-size:10px">${storeInfo.invoicePolicy}</div>` : ''}
  <div class="center" style="margin-top:6px;font-size:9px;opacity:0.5">Powered by Lopbuk</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=400,height=600,scrollbars=yes')
  if (!win) { toast.error('Activa los pop-ups para imprimir la factura'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function CajeroPanel() {
  const { user, logout } = useAuthStore()

  const [tab, setTab]               = useState<PanelTab>('activas')
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [closedOrders, setClosedOrders] = useState<any[]>([])
  const [summary, setSummary]       = useState<any>(null)
  const [storeInfo, setStoreInfo]   = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [currentTime, setCurrentTime] = useState(new Date())

  // Payment state
  const [payingOrder, setPayingOrder]   = useState<any>(null)
  const [breakdown, setBreakdown]       = useState<any>(null)
  const [loadingBreakdown, setLoadingBreakdown] = useState(false)
  const [payTarget, setPayTarget]       = useState<null | 'general' | number>(null)
  const [payMethod, setPayMethod]       = useState('efectivo')
  const [amountPaid, setAmountPaid]     = useState('')
  const [paying, setPaying]             = useState(false)

  const autoRef = useRef(autoRefresh)
  autoRef.current = autoRefresh

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Data load ─────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const [activeR, closedR, sumR] = await Promise.all([
      api.getRestbarOrders(),
      api.getRestbarOrders('cerrada'),
      api.getRestbarDailySummary(today()),
    ])
    if (activeR.success) {
      setActiveOrders(activeR.data ?? [])
    }
    if (closedR.success) {
      setClosedOrders(closedR.data ?? [])
    }
    if (sumR.success) setSummary(sumR.data)
    setLastUpdate(new Date())
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    load()
    api.getStoreInfo().then(r => { if (r.success) setStoreInfo(r.data) })
  }, [load])

  // Auto-refresh every 8 s
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(async () => {
        if (autoRef.current) await load(true)
        schedule()
      }, 8000)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [load])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const pendingCount = activeOrders.length
  const porcobrar    = activeOrders.reduce((a, o) => a + (o.total ?? 0), 0)
  const ventas       = summary?.revenue ?? 0
  const cerradas     = summary?.closedOrders ?? 0

  // ── Open payment modal ────────────────────────────────────────────────────
  const openPay = async (order: any) => {
    setPayingOrder(order)
    setPayTarget(null)
    setAmountPaid(String(order.total))
    setBreakdown(null)
    setLoadingBreakdown(true)
    const [orderR, bdR] = await Promise.all([
      api.getRestbarOrder(order.id),
      api.getRestbarGuestBreakdown(order.id),
    ])
    if (orderR.success) setPayingOrder(orderR.data)
    if (bdR.success)    setBreakdown(bdR.data)
    setLoadingBreakdown(false)
  }

  const closePay = () => {
    setPayingOrder(null); setBreakdown(null)
    setPayTarget(null); setAmountPaid(''); setPaying(false)
  }

  const targetAmount = (() => {
    if (payTarget === null) return payingOrder?.total ?? 0
    const g = breakdown?.guests?.find((g: any) =>
      payTarget === 'general' ? g.guestNumber == null : g.guestNumber === payTarget
    )
    return g?.subtotal ?? 0
  })()

  const change = Math.max(0, Number(amountPaid) - targetAmount)

  const processPayment = async () => {
    if (!payingOrder) return
    const paid = Number(amountPaid)
    if (paid < targetAmount) { toast.error('El monto es menor al total a cobrar'); return }
    setPaying(true)
    const guestNumber = payTarget === null ? undefined : payTarget === 'general' ? null : payTarget
    const r = await api.processRestbarPayment(payingOrder.id, {
      paymentMethod: payMethod as any,
      amountPaid: paid,
      guestNumber,
    })
    if (r.success) {
      const who = payTarget === null ? 'Mesa completa'
        : payTarget === 'general' ? 'Mesa general'
        : breakdown?.guests?.find((g: any) => g.guestNumber === payTarget)?.guestName ?? `Comensal ${payTarget}`
      toast.success(`✅ ${who} — Factura ${r.data.invoiceNumber} — Cambio: ${fmt(r.data.changeAmount)}`)

      // Print POS receipt
      printReceipt({
        storeInfo,
        order: payingOrder,
        breakdown,
        payTarget,
        payMethod,
        amountPaid: paid,
        targetAmount,
        changeAmount: r.data.changeAmount ?? change,
        invoiceNumber: r.data.invoiceNumber,
        cashierName: user?.name ?? 'Cajero',
      })

      if (r.data.closed) {
        closePay(); load()
      } else {
        // Partial: refresh breakdown only
        const [oR, bR] = await Promise.all([
          api.getRestbarOrder(payingOrder.id),
          api.getRestbarGuestBreakdown(payingOrder.id),
        ])
        if (oR.success) setPayingOrder(oR.data)
        if (bR.success) setBreakdown(bR.data)
        setPayTarget(null); setAmountPaid('')
        load(true)
      }
    } else toast.error(r.error ?? 'Error al procesar pago')
    setPaying(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col select-none">

      {/* ── Header ── */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground leading-none">Panel Cajero</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{user?.name ?? ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-2.5 py-1.5">
            <Clock className="h-3.5 w-3.5" />
            {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={logout}>
            <LogOut className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      {/* ── Controls ── */}
      <div className="border-b border-border bg-card/50 px-6 py-2.5 flex items-center gap-2 shrink-0">
        <button onClick={() => setAutoRefresh(v => !v)}
          className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            autoRefresh ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
          <RefreshCcw className="h-3.5 w-3.5" /> Auto-actualizar
        </button>
        <button onClick={() => load()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Última actualización: {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
          {autoRefresh && (
            <span className="flex items-center gap-1 text-primary">
              <RefreshCw className="h-3 w-3 animate-spin" /> Auto-actualizando cada 8s
            </span>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 shrink-0">
        {[
          {
            icon: <DollarSign className="h-5 w-5 text-green-400" />,
            label: 'Ventas del Día', value: fmt(ventas),
            cls: 'border-green-500/20',
          },
          {
            icon: <CheckCircle2 className="h-5 w-5 text-blue-400" />,
            label: 'Cuentas Cerradas', value: cerradas,
            cls: 'border-blue-500/20',
          },
          {
            icon: <AlertCircle className="h-5 w-5 text-amber-400" />,
            label: 'Pendientes', value: pendingCount,
            cls: pendingCount > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border',
          },
          {
            icon: <TrendingUp className="h-5 w-5 text-primary" />,
            label: 'Por Cobrar', value: fmt(porcobrar),
            cls: porcobrar > 0 ? 'border-primary/30 bg-primary/5' : 'border-border',
          },
        ].map(s => (
          <div key={s.label} className={cn('rounded-2xl border bg-card px-5 py-4 flex items-center gap-4', s.cls)}>
            <div className="shrink-0">{s.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground leading-tight mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 px-6 border-b border-border shrink-0">
        {([
          { id: 'activas',   label: 'Cuentas Activas',   icon: ClipboardList },
          { id: 'facturas',  label: 'Facturas del Día',  icon: FileText },
          { id: 'historial', label: 'Historial de Pagos', icon: History },
        ] as { id: PanelTab; label: string; icon: any }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.id === 'activas' && pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2 pb-2">
          <button onClick={() => load()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Actualizar
          </button>
          <span className="text-xs text-muted-foreground">Última: {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'activas' && (
          <ActiveOrdersTab
            orders={activeOrders}
            loading={loading}
            onPay={openPay}
          />
        )}
        {tab === 'facturas' && (
          <FacturasTab orders={closedOrders} loading={loading} />
        )}
        {tab === 'historial' && (
          <HistorialTab summary={summary} loading={loading} />
        )}
      </div>

      {/* ── Payment modal (slide-in from right) ── */}
      {payingOrder && (
        <PaymentModal
          order={payingOrder}
          breakdown={breakdown}
          loadingBreakdown={loadingBreakdown}
          payTarget={payTarget}
          setPayTarget={setPayTarget}
          payMethod={payMethod}
          setPayMethod={setPayMethod}
          amountPaid={amountPaid}
          setAmountPaid={setAmountPaid}
          targetAmount={targetAmount}
          change={change}
          paying={paying}
          onPay={processPayment}
          onClose={closePay}
        />
      )}
    </div>
  )
}

// ─── Active Orders Tab ────────────────────────────────────────────────────────

function ActiveOrdersTab({ orders, loading, onPay }: {
  orders: any[]; loading: boolean; onPay: (o: any) => void
}) {
  if (loading && orders.length === 0)
    return <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  if (orders.length === 0)
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 opacity-40" />
        </div>
        <p className="font-semibold">Sin comandas activas</p>
        <p className="text-sm">No hay pedidos pendientes de cobro en este momento.</p>
      </div>
    )

  return (
    <div className="space-y-3 max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
        {orders.length} comanda{orders.length !== 1 ? 's' : ''} activa{orders.length !== 1 ? 's' : ''}
      </p>

      {orders.map(o => {
        const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.abierta
        return (
          <button
            key={o.id}
            onClick={() => onPay(o)}
            className="w-full rounded-2xl border-2 border-border bg-card hover:border-primary/40 hover:shadow-[0_0_16px_rgba(99,102,241,0.08)] active:scale-[0.99] transition-all text-left group"
          >
            {/* Top row: mesa + total + status */}
            <div className="flex items-start justify-between px-5 pt-4 pb-3">
              <div>
                <p className="text-2xl font-black leading-none">Mesa {o.tableNumber}</p>
                <p className="text-xs text-muted-foreground mt-1">{o.orderNumber} · {o.waiterName}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-green-400 tabular-nums">{fmt(o.total ?? 0)}</p>
                <span className={cn('inline-block mt-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', st.cls)}>
                  {st.label}
                </span>
              </div>
            </div>

            {/* Bottom row: meta info + CTA */}
            <div className="flex items-center justify-between px-5 pb-4 border-t border-border/50 pt-3">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  {o.itemsCount ?? '?'} ítems
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {o.guestsCount ? `${o.guestsCount} persona${o.guestsCount !== 1 ? 's' : ''}` : 'Mesa general'}
                </span>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                Ver detalle y cobrar <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Facturas del Día ─────────────────────────────────────────────────────────

function FacturasTab({ orders, loading }: { orders: any[]; loading: boolean }) {
  const todayStr = today()
  // Filter to orders closed today
  const todayOrders = orders.filter(o => {
    if (!o.closedAt && !o.closed_at) return false
    const d = new Date(o.closedAt ?? o.closed_at)
    return d.toISOString().startsWith(todayStr)
  })

  if (loading && orders.length === 0)
    return <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  if (todayOrders.length === 0)
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center">
          <FileText className="h-8 w-8 opacity-40" />
        </div>
        <p className="font-semibold">Sin facturas hoy</p>
        <p className="text-sm">Las facturas generadas hoy aparecerán aquí.</p>
      </div>
    )

  const total = todayOrders.reduce((a, o) => a + (o.total ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{todayOrders.length} factura(s) generada(s) hoy</p>
        <p className="text-sm font-bold text-green-400">Total: {fmt(total)}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-accent/30">
              {['#', 'Mesa', 'Mesero', 'Hora', 'Total'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {todayOrders.map(o => (
              <tr key={o.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-foreground">{o.orderNumber}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">Mesa {o.tableNumber}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{o.waiterName}</td>
                <td className="px-5 py-3 text-xs text-muted-foreground">
                  {new Date(o.closedAt ?? o.closed_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-5 py-3 font-bold text-green-400">{fmt(o.total ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Historial de Pagos ───────────────────────────────────────────────────────

function HistorialTab({ summary }: { summary: any; loading: boolean }) {
  const [payments, setPayments] = useState<any[]>([])
  const [loadingPay, setLoadingPay] = useState(true)
  const [date, setDate] = useState(today())

  const load = useCallback(async () => {
    setLoadingPay(true)
    const r = await api.getRestbarPayments(date)
    if (r.success) setPayments(r.data ?? [])
    setLoadingPay(false)
  }, [date])

  useEffect(() => { load() }, [load])

  const totalCobrado = payments.reduce((a, p) => a + Number(p.amount), 0)

  const methodIcon: Record<string, any> = {
    efectivo: Banknote, tarjeta: CreditCard,
    nequi: Smartphone, bancolombia: ArrowLeftRight,
    bbva: ArrowLeftRight, transferencia: ArrowLeftRight, mixto: Layers,
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Filtro de fecha + resumen rápido */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <RefreshCw className={cn('h-3.5 w-3.5', loadingPay && 'animate-spin')} /> Actualizar
        </button>
        {payments.length > 0 && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{payments.length} transacción{payments.length !== 1 ? 'es' : ''}</span>
            <span className="font-black text-green-400">{fmt(totalCobrado)}</span>
          </div>
        )}
      </div>

      {/* Resumen por método */}
      {payments.length > 0 && (() => {
        const byMethod: Record<string, number> = {}
        payments.forEach(p => { byMethod[p.payment_method] = (byMethod[p.payment_method] ?? 0) + Number(p.amount) })
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(byMethod).map(([method, total]) => {
              const pm = PAY_METHODS.find(m => m.id === method)
              const Icon = pm ? methodIcon[method] : DollarSign
              return (
                <div key={method} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">{pm?.label ?? method}</p>
                    <p className="text-sm font-bold text-green-400 tabular-nums">{fmt(total)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Lista de pagos */}
      {loadingPay ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <History className="h-10 w-10 opacity-30" />
          <p className="font-semibold">Sin pagos registrados</p>
          <p className="text-sm">No hay transacciones para la fecha seleccionada.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/30">
                {['Hora', 'Mesa', 'Pedido', 'Cobrado a', 'Método', 'Total', 'Cambio', 'Cajero'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const Icon = methodIcon[p.payment_method] ?? DollarSign
                const guestLabel = p.guest_number == null ? 'Mesa completa' : `Comensal ${p.guest_number}`
                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(p.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-semibold">Mesa {p.table_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{guestLabel}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {PAY_METHODS.find(m => m.id === p.payment_method)?.label ?? p.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-green-400 tabular-nums">{fmt(Number(p.amount))}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{fmt(Number(p.change_amount))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.cashier_name}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Top items (de summary si existe) */}
      {summary?.topItems?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Top ítems vendidos hoy
          </h3>
          <div className="space-y-2">
            {summary.topItems.map((item: any, i: number) => {
              const pct = Math.round((item.qtySold / summary.topItems[0].qtySold) * 100)
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm truncate text-foreground">{item.name}</span>
                      <span className="text-sm font-semibold text-primary ml-2 shrink-0">{item.qtySold} und.</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-accent overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({
  order, breakdown, loadingBreakdown,
  payTarget, setPayTarget,
  payMethod, setPayMethod,
  amountPaid, setAmountPaid,
  targetAmount, change, paying,
  onPay, onClose,
}: {
  order: any; breakdown: any; loadingBreakdown: boolean
  payTarget: null | 'general' | number; setPayTarget: (v: null | 'general' | number) => void
  payMethod: string; setPayMethod: (v: string) => void
  amountPaid: string; setAmountPaid: (v: string) => void
  targetAmount: number; change: number; paying: boolean
  onPay: () => void; onClose: () => void
}) {
  const hasSplit = (breakdown?.guests?.length ?? 0) > 0
  const activeItems = order.items?.filter((i: any) => i.status !== 'cancelado' && i.status !== 'entregado') ?? []

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-background border-l border-border flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Mesa {order.tableNumber}
            </h2>
            <p className="text-xs text-muted-foreground">{order.orderNumber} · {order.waiterName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── DETALLE DE CONSUMO ──────────────────────────── */}
          {loadingBreakdown ? (
            <div className="flex justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : hasSplit ? (
            /* Per-guest breakdown */
            <div className="p-4 border-b border-border space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">Consumo por comensal</p>
              {breakdown.guests.map((g: any) => (
                <div key={g.guestNumber ?? 'general'}
                  className={cn('rounded-xl border overflow-hidden',
                    g.paid ? 'border-green-500/30 bg-green-500/5 opacity-70' : 'border-border bg-card')}>
                  {/* Guest header */}
                  <div className={cn('flex items-center justify-between px-4 py-2.5',
                    g.guestNumber != null ? guestColor(g.guestNumber) : 'bg-accent/40 text-foreground border-b border-border')}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{g.guestName}</span>
                      {g.paid && <span className="text-[10px] bg-green-500/30 text-green-300 rounded-full px-2 py-0.5">✓ Pagado</span>}
                    </div>
                    <span className={cn('font-black text-base tabular-nums', g.paid ? 'line-through opacity-50' : '')}>
                      {fmt(g.subtotal)}
                    </span>
                  </div>
                  {/* Items */}
                  {g.items?.length > 0 && (
                    <div className="divide-y divide-border/50">
                      {g.items.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2">
                          <span className="text-sm text-muted-foreground">
                            <span className="font-bold text-foreground">{item.quantity}×</span> {item.menuItemName}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">{fmt(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {/* Total bar */}
              <div className="flex items-center justify-between rounded-xl bg-green-950/40 border border-green-500/20 px-4 py-3">
                <span className="text-sm font-semibold text-green-400/70">Total mesa</span>
                <span className="text-xl font-black text-green-400 tabular-nums">{fmt(order.total)}</span>
              </div>
            </div>
          ) : (
            /* No split — flat items list */
            <div className="p-4 border-b border-border">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">Consumo</p>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="divide-y divide-border">
                  {activeItems.map((i: any) => (
                    <div key={i.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">
                        <span className="font-bold text-foreground">{i.quantity}×</span> {i.menuItemName}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{fmt(i.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-green-950/40 border-t border-green-500/20">
                  <span className="text-sm font-semibold text-green-400/70">Total</span>
                  <span className="text-xl font-black text-green-400 tabular-nums">{fmt(order.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── ¿A QUIÉN COBRAR? ──────────────────────────── */}
          <div className="p-4 border-b border-border space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">¿A quién cobrar?</p>

            {/* Whole table */}
            <button onClick={() => { setPayTarget(null); setAmountPaid(String(order.total)) }}
              className={cn('w-full rounded-xl border-2 p-3.5 text-left transition-all flex items-center justify-between',
                payTarget === null ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/30')}>
              <div>
                <p className="font-bold text-sm">Toda la mesa</p>
                <p className="text-xs text-muted-foreground">{activeItems.length} ítems · cobro único</p>
              </div>
              <p className="text-lg font-black text-primary tabular-nums">{fmt(order.total)}</p>
            </button>

            {/* Per guest */}
            {hasSplit && breakdown.guests.map((g: any) => (
              <button key={g.guestNumber ?? 'general'}
                onClick={() => { if (!g.paid) { setPayTarget(g.guestNumber ?? 'general'); setAmountPaid(String(g.subtotal)) } }}
                disabled={g.paid}
                className={cn('w-full rounded-xl border-2 p-3.5 text-left transition-all flex items-center justify-between',
                  g.paid ? 'opacity-50 cursor-not-allowed border-green-500/30 bg-green-500/5'
                    : payTarget === (g.guestNumber ?? 'general') ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent/30')}>
                <div>
                  <p className="font-bold text-sm flex items-center gap-2">
                    {g.guestName}
                    {g.paid && <span className="text-[10px] bg-green-500/20 text-green-400 rounded-full px-2 py-0.5">✓ Pagado</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{g.items?.length ?? 0} ítems</p>
                </div>
                <p className={cn('text-base font-black tabular-nums', g.paid ? 'line-through opacity-40' : '')}>
                  {fmt(g.subtotal)}
                </p>
              </button>
            ))}
          </div>

          {/* ── MÉTODO DE PAGO ────────────────────────────── */}
          <div className="px-4 py-4 border-b border-border space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Método de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {PAY_METHODS.map(m => (
                <button key={m.id} onClick={() => setPayMethod(m.id)}
                  className={cn('flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-semibold transition-all',
                    payMethod === m.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent')}>
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── MONTO ─────────────────────────────────────── */}
          <div className="px-4 py-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Monto recibido</p>

            {/* Total to charge */}
            <div className="rounded-2xl bg-gradient-to-b from-green-900/40 to-green-950/60 border border-green-500/30 p-4 text-center">
              <p className="text-[11px] text-green-500/60 uppercase tracking-widest">Total a cobrar</p>
              <p className="text-3xl font-black text-green-300 tabular-nums mt-1">{fmt(targetAmount)}</p>
            </div>

            <input
              type="number"
              inputMode="numeric"
              className="w-full h-16 rounded-xl border-2 border-border bg-background px-4 text-3xl font-black text-center focus:outline-none focus:border-primary tabular-nums transition-colors"
              placeholder="0"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
            />

            {/* Change / shortage */}
            {amountPaid && (
              <div className={cn('rounded-xl border-2 px-4 py-3 flex justify-between items-center',
                Number(amountPaid) >= targetAmount
                  ? 'border-green-500/40 bg-green-500/10'
                  : 'border-red-500/40 bg-red-500/10')}>
                <span className={cn('text-sm font-bold',
                  Number(amountPaid) >= targetAmount ? 'text-green-400' : 'text-red-400')}>
                  {Number(amountPaid) >= targetAmount ? 'Cambio' : 'Falta'}
                </span>
                <span className={cn('text-xl font-black tabular-nums',
                  Number(amountPaid) >= targetAmount ? 'text-green-400' : 'text-red-400')}>
                  {Number(amountPaid) >= targetAmount
                    ? fmt(change)
                    : fmt(targetAmount - Number(amountPaid))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Pay button */}
        <div className="border-t border-border p-4 shrink-0 space-y-2">
          <button
            onClick={onPay}
            disabled={paying || !amountPaid || Number(amountPaid) < targetAmount}
            className={cn(
              'w-full h-14 rounded-2xl font-black text-lg text-white transition-all',
              paying || !amountPaid || Number(amountPaid) < targetAmount
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500 active:scale-[0.98] shadow-lg shadow-green-900/40',
            )}>
            {paying ? 'Procesando...'
              : payTarget === null
              ? `Cobrar ${fmt(targetAmount)}`
              : `Cobrar ${fmt(targetAmount)} — Parcial`}
          </button>
          <button onClick={onClose} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            Cancelar
          </button>
        </div>
      </div>
    </>
  )
}
