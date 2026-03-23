'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api as apiService } from '@/lib/api'
import { useStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Users, TrendingUp, ShoppingCart, DollarSign, ChevronRight, Printer,
  Calendar, Search, CreditCard, Banknote, Smartphone, FileWarning,
  Settings2, ClipboardList, History, Plus, Trash2, CheckCircle,
  Target, Award, AlertCircle, BarChart2, FileText, Umbrella, Loader2,
  ThumbsUp, ThumbsDown, Clock, X, Monitor, MonitorOff, UtensilsCrossed,
  RefreshCw, ChefHat,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)

function todayStr() { return new Date().toISOString().slice(0, 10) }

function firstOfMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function paymentIcon(method: string) {
  if (method === 'efectivo') return <Banknote className="h-3.5 w-3.5" />
  if (method === 'tarjeta') return <CreditCard className="h-3.5 w-3.5" />
  if (method === 'transferencia') return <Smartphone className="h-3.5 w-3.5" />
  return <FileWarning className="h-3.5 w-3.5" />
}

function paymentLabel(method: string) {
  return ({ efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transfer.', fiado: 'Fiado' } as any)[method] ?? method
}

function paymentColor(method: string) {
  return ({
    efectivo: 'bg-green-500/10 text-green-400 border-green-500/20',
    tarjeta: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    transferencia: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    fiado: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  } as any)[method] ?? 'bg-muted text-muted-foreground'
}

const commissionLabels: Record<string, string> = {
  sin_comision: 'Sin comisión',
  porcentaje: '% sobre ventas',
  fijo_por_venta: 'Fijo por venta',
  fijo_por_item: 'Fijo por ítem',
}

// ─── Shared print CSS (matches POS invoice format) ────────────────────────────

const PRINT_CSS = `
  body{font-family:Arial,sans-serif;padding:30px;max-width:800px;margin:0 auto;color:#333;font-size:14px}
  .header{text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px}
  .header h1{margin:0 0 5px 0;font-size:22px}
  .header p{margin:3px 0;color:#555;font-size:13px}
  .header .nit{font-weight:bold;font-size:14px;color:#333}
  .two-col{display:flex;justify-content:space-between;gap:20px;margin-bottom:20px}
  .two-col h3{margin:0 0 8px 0;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.05em}
  .two-col p{margin:3px 0;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:#f0f0f0;padding:10px 8px;text-align:left;border-bottom:2px solid #ccc;font-size:12px;text-transform:uppercase}
  td{padding:8px;border-bottom:1px solid #eee;font-size:13px}
  .num{text-align:right}
  .totals{width:320px;margin-left:auto}
  .totals td{padding:5px 8px}
  .totals .total-row td{font-size:16px;font-weight:bold;border-top:2px solid #333;padding-top:10px}
  .info-box{background:#f9f9f9;padding:15px;border-radius:5px;margin-bottom:20px}
  .info-box h3{margin:0 0 8px 0;font-size:13px;text-transform:uppercase;color:#666}
  .info-box p{margin:3px 0;font-size:13px}
  .sigs{display:flex;justify-content:space-around;margin:48px 0 20px}
  .sig{text-align:center;font-size:12px;color:#555}
  .sig-line{width:180px;border-top:1px solid #999;margin:0 auto 8px}
  .sig p{margin:2px 0}
  .footer{text-align:center;margin-top:20px;padding-top:15px;border-top:1px dashed #ccc;font-size:12px;color:#777}
  .footer p{margin:4px 0}
  .page-break{border:none;border-top:2px dashed #aaa;margin:30px 0;page-break-after:always}
  @media print{body{padding:15px}.page-break{page-break-after:always}}
`

function storeHeader(si: any) {
  return `<div class="header">
    ${si?.invoiceLogo ? `<img src="${si.invoiceLogo}" alt="Logo" style="max-height:70px;max-width:200px;object-fit:contain;margin-bottom:8px;" />` : ''}
    <h1>${si?.name ?? 'Empresa'}</h1>
    ${si?.taxId   ? `<p class="nit">NIT: ${si.taxId}</p>` : ''}
    ${si?.address ? `<p>${si.address}</p>` : ''}
    ${si?.phone   ? `<p>Tel: ${si.phone}${si?.email ? ` | ${si.email}` : ''}</p>` : ''}
  </div>`
}

function storeFooter(si: any, label = '¡Gracias por su trabajo!') {
  return `<div class="footer">
    <p><strong>${si?.invoiceGreeting || label}</strong></p>
    ${(si?.invoicePolicy || '').split('\n').filter(Boolean).map((l: string) => `<p>${l}</p>`).join('')}
    <p>${si?.name ?? ''}${si?.phone ? ` · ${si.phone}` : ''}</p>
  </div>`
}

function openPrint(title: string, bodyHtml: string, copies = 1) {
  const w = window.open('', '_blank', 'width=880,height=900')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
    <title>${title}</title><style>${PRINT_CSS}</style></head><body>
    ${bodyHtml}
    ${copies === 2 ? `<hr class="page-break" />${bodyHtml}` : ''}
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

// ─── Print helpers ────────────────────────────────────────────────────────────

function printNomina(records: any[], label: string, storeInfo?: any) {
  const grandTotal = records.reduce((a, r) => a + (r.totalPagar ?? r.total_pagar ?? r.estimated_total ?? 0), 0)
  const body = `
    ${storeHeader(storeInfo)}
    <div class="two-col">
      <div>
        <h3>Nómina de Empleados</h3>
        <p><strong>Período: ${label}</strong></p>
        <p>Generado: ${new Date().toLocaleString('es-CO')}</p>
      </div>
      <div>
        <h3>Resumen</h3>
        <p>${records.length} empleado(s)</p>
        <p><strong>Total a pagar: ${fmt(grandTotal)}</strong></p>
      </div>
    </div>
    <table><thead><tr>
      <th>Empleado</th><th class="num">Actividad</th><th class="num">Base período</th>
      <th class="num">Comisión</th><th class="num">Bonos</th>
      <th class="num">Descuentos</th><th class="num">TOTAL A PAGAR</th>
    </tr></thead><tbody>
    ${records.map(r => `<tr>
      <td>${r.sellerName ?? r.seller_name}</td>
      <td class="num">${r.totalVentas ?? r.total_ventas ?? 0}</td>
      <td class="num">${fmt(r.salaryBase ?? r.salary_base ?? 0)}</td>
      <td class="num">${fmt(r.commissionEarned ?? r.commission_earned ?? 0)}</td>
      <td class="num" style="color:#16a34a">${fmt(r.totalBonos ?? r.total_bonos ?? 0)}</td>
      <td class="num" style="color:#dc2626">${r.totalDescuentos ?? r.total_descuentos ?? 0 ? `-${fmt(r.totalDescuentos ?? r.total_descuentos ?? 0)}` : '—'}</td>
      <td class="num"><strong>${fmt(r.totalPagar ?? r.total_pagar ?? r.estimated_total ?? 0)}</strong></td>
    </tr>`).join('')}
    </tbody><tfoot><tr style="font-weight:bold;background:#f9f9f9">
      <td>TOTAL</td>
      <td class="num">${records.reduce((a, r) => a + (r.totalVentas ?? r.total_ventas ?? 0), 0)}</td>
      <td class="num">${fmt(records.reduce((a, r) => a + (r.salaryBase ?? r.salary_base ?? 0), 0))}</td>
      <td class="num">${fmt(records.reduce((a, r) => a + (r.commissionEarned ?? r.commission_earned ?? 0), 0))}</td>
      <td class="num" style="color:#16a34a">${fmt(records.reduce((a, r) => a + (r.totalBonos ?? r.total_bonos ?? 0), 0))}</td>
      <td class="num" style="color:#dc2626">-${fmt(records.reduce((a, r) => a + (r.totalDescuentos ?? r.total_descuentos ?? 0), 0))}</td>
      <td class="num"><strong>${fmt(grandTotal)}</strong></td>
    </tr></tfoot></table>
    ${storeFooter(storeInfo)}
  `
  openPrint(`Nómina – ${label}`, body, storeInfo?.invoiceCopies ?? 1)
}

// ─── Individual payslip (colilla) print ───────────────────────────────────────

const ROLE_DISPLAY_MAP: Record<string, string> = {
  mesero: 'Mesero', cajero: 'Cajero', cocinero: 'Cocinero', bartender: 'Bartender',
  administrador_rb: 'Admin RestBar', vendedor: 'Vendedor', comerciante: 'Comerciante',
}

function printColilla(r: any, periodLabel: string, factor: number, pDays: number, mDays: number, storeInfo?: any) {
  const sellerName  = r.sellerName  ?? r.seller_name  ?? ''
  const roleLabel   = ROLE_DISPLAY_MAP[r._role ?? r.role ?? ''] ?? (r._role ?? r.role ?? 'Empleado')
  const prorated    = r.proratedBase ?? Math.round((r.salaryBase ?? r.salary_base ?? 0) * factor)
  const monthlyBase = factor > 0 ? Math.round(prorated / factor) : (r.salaryBase ?? r.salary_base ?? 0)
  const factorPct   = Math.round(factor * 100)
  const commission  = r.commissionEarned ?? r.commission_earned ?? 0
  const bonos       = r.totalBonos    ?? r.total_bonos    ?? 0
  const descuentos  = r.totalDescuentos ?? r.total_descuentos ?? 0
  const totalPagar  = r.totalPagar    ?? r.total_pagar    ?? 0
  const periodFrom  = r.periodFrom    ?? r.period_from    ?? ''
  const periodTo    = r.periodTo      ?? r.period_to      ?? ''

  const body = `
    ${storeHeader(storeInfo)}
    <div class="two-col">
      <div>
        <h3>Comprobante de Pago</h3>
        <p><strong>Período: ${periodLabel}</strong></p>
        <p>Fechas: ${periodFrom} → ${periodTo}</p>
        <p>Generado: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div>
        <h3>Empleado</h3>
        <p><strong>${sellerName}</strong></p>
        <p>${roleLabel}</p>
        <p style="margin-top:6px;font-size:12px;color:#555;">${pDays} días de ${mDays} → ${factorPct}% del salario mensual</p>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>Concepto</th>
        <th class="num">Valor</th>
      </tr></thead>
      <tbody>
        <tr><td>Salario base mensual</td><td class="num">${fmt(monthlyBase)}</td></tr>
        <tr><td><strong>Salario período (${factorPct}% — ${pDays}/${mDays} días)</strong></td>
            <td class="num"><strong>${fmt(prorated)}</strong></td></tr>
        ${commission > 0 ? `<tr><td>Comisión</td><td class="num">${fmt(commission)}</td></tr>` : ''}
        ${bonos > 0 ? `<tr style="color:#16a34a"><td>+ Bonos adicionales</td><td class="num">+${fmt(bonos)}</td></tr>` : ''}
        ${descuentos > 0 ? `<tr style="color:#dc2626"><td>− Descuentos / Novedades</td><td class="num">-${fmt(descuentos)}</td></tr>` : ''}
      </tbody>
    </table>
    <table class="totals">
      <tr class="total-row">
        <td>TOTAL A PAGAR:</td>
        <td class="num">${fmt(totalPagar)}</td>
      </tr>
    </table>
    <div class="info-box">
      <h3>Acuse de recibo</h3>
      <p>El empleado declara haber recibido conforme el pago detallado en este comprobante.</p>
    </div>
    <div class="sigs">
      <div class="sig">
        <div class="sig-line"></div>
        <p><strong>Firma Empleado</strong></p>
        <p>${sellerName}</p>
      </div>
      <div class="sig">
        <div class="sig-line"></div>
        <p><strong>Firma Empleador</strong></p>
        <p>${storeInfo?.name ?? ''}</p>
      </div>
    </div>
    ${storeFooter(storeInfo, '¡Gracias por su trabajo!')}
  `
  openPrint(`Colilla – ${sellerName} – ${periodLabel}`, body, storeInfo?.invoiceCopies ?? 1)
}

// ─── Seller sales modal ───────────────────────────────────────────────────────

function SellerSalesModal({ seller, from, to, onClose }: {
  seller: any; from: string; to: string; onClose: () => void
}) {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    const res = await apiService.getVendedorSales(seller.seller_id ?? seller.id, { from, to, page: p, limit: 20 })
    if (res.success && res.data) {
      setSales(res.data.data ?? [])
      setTotalPages(res.data.pagination?.totalPages ?? 1)
    }
    setLoading(false)
  }, [seller, from, to])

  useEffect(() => { load(page) }, [load, page])

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-4 w-4 text-primary" />
            Ventas de {seller.seller_name ?? seller.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Ventas', value: seller.total_ventas },
            { label: 'Total', value: fmt(seller.total_monto) },
            { label: 'Comisión', value: fmt(seller.commission_earned ?? 0) },
            { label: 'A pagar est.', value: fmt(seller.estimated_total ?? 0) },
          ].map(c => (
            <div key={c.label} className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{c.label}</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{c.value}</p>
            </div>
          ))}
        </div>
        {loading ? <p className="text-center text-muted-foreground py-8 text-sm">Cargando…</p>
          : sales.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">Sin ventas en el período</p>
          : (
            <div className="space-y-1.5">
              {sales.map(s => (
                <div key={s.id} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground w-28 shrink-0">{s.invoiceNumber}</span>
                  <span className="flex-1 truncate text-foreground">{s.customerName ?? 'Cliente general'}</span>
                  <Badge variant="outline" className={`flex items-center gap-1 text-[10px] ${paymentColor(s.paymentMethod)}`}>
                    {paymentIcon(s.paymentMethod)} {paymentLabel(s.paymentMethod)}
                  </Badge>
                  <span className="font-semibold text-foreground shrink-0">{fmt(s.total)}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(s.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <span className="text-sm text-muted-foreground self-center">{page} / {totalPages}</span>
                  <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                </div>
              )}
            </div>
          )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function TabDashboard() {
  const storeInfo = useStore(s => s.storeInfo)
  const [from, setFrom] = useState(firstOfMonthStr())
  const [to, setTo] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiService.getVendedoresPerformance({ from, to })
    if (res.success && res.data) setStats(res.data)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const filtered = stats.filter(s => s.seller_name.toLowerCase().includes(search.toLowerCase()))
  const totalMonto  = filtered.reduce((a, s) => a + Number(s.total_monto), 0)
  const totalVentas = filtered.reduce((a, s) => a + Number(s.total_ventas), 0)
  const totalComision = filtered.reduce((a, s) => a + Number(s.commission_earned ?? 0), 0)
  const totalPagar = filtered.reduce((a, s) => a + Number(s.estimated_total ?? 0), 0)

  const quickRanges = [
    { label: 'Hoy', fn: () => { setFrom(todayStr()); setTo(todayStr()) } },
    { label: 'Este mes', fn: () => { setFrom(firstOfMonthStr()); setTo(todayStr()) } },
    {
      label: 'Mes anterior', fn: () => {
        const d = new Date(), y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()
        const m = d.getMonth() === 0 ? 12 : d.getMonth()
        const last = new Date(y, m, 0).getDate()
        setFrom(`${y}-${String(m).padStart(2, '0')}-01`)
        setTo(`${y}-${String(m).padStart(2, '0')}-${last}`)
      },
    },
  ]

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-border">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex gap-2 items-center">
                <div><p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Desde</p>
                  <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Hasta</p>
                  <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" /></div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {quickRanges.map(r => (
                <Button key={r.label} size="sm" variant="outline" className="h-8 text-xs" onClick={r.fn}>{r.label}</Button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar vendedor…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm w-44" />
            </div>
            <Button size="sm" variant="outline" className="flex items-center gap-2 h-8"
              onClick={() => printNomina(filtered, `${from} al ${to}`, storeInfo)} disabled={filtered.length === 0}>
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Empleados', value: filtered.length, icon: <Users className="h-5 w-5" />, color: 'text-blue-400' },
          { label: 'Total ventas', value: totalVentas, icon: <ShoppingCart className="h-5 w-5" />, color: 'text-green-400' },
          { label: 'Total comisiones', value: fmt(totalComision), icon: <Award className="h-5 w-5" />, color: 'text-purple-400' },
          { label: 'Total a pagar est.', value: fmt(totalPagar), icon: <DollarSign className="h-5 w-5" />, color: 'text-amber-400' },
        ].map(c => (
          <Card key={c.label} className="border-border">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className={`${c.color} opacity-80`}>{c.icon}</div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{c.label}</p>
                <p className="text-base font-bold text-foreground leading-tight">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Rendimiento por vendedor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center text-muted-foreground py-12 text-sm">Cargando…</p>
            : filtered.length === 0 ? <p className="text-center text-muted-foreground py-12 text-sm">Sin ventas en el período</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Vendedor', '# Ventas', 'Total vendido', 'Comisión', 'Meta', 'A pagar est.', ''].map(h => (
                        <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest ${h === '' || h === '# Ventas' ? '' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const goalPct = Number(s.goal_pct ?? 0)
                      return (
                        <tr key={s.seller_id ?? s.seller_name} className="border-b border-border/50 hover:bg-sidebar-accent/40 transition-colors cursor-pointer" onClick={() => setSelected(s)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">{i + 1}</div>
                              <div>
                                <p className="font-medium text-foreground">{s.seller_name}</p>
                                <p className="text-[10px] text-muted-foreground">{commissionLabels[s.commission_type] ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">{s.total_ventas}</td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(s.total_monto)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-purple-400">{fmt(s.commission_earned ?? 0)}</span>
                            {s.commission_type !== 'sin_comision' && (
                              <p className="text-[10px] text-muted-foreground">
                                {s.commission_type === 'porcentaje' ? `${s.commission_value}%` : fmt(s.commission_value)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {s.monthly_goal > 0 ? (
                              <div className="min-w-[100px]">
                                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                  <span>{Math.round(goalPct)}%</span>
                                  <span>{fmt(s.monthly_goal)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${goalPct >= 100 ? 'bg-green-500' : goalPct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(goalPct, 100)}%` }} />
                                </div>
                                {goalPct >= 100 && (
                                  <p className="text-[10px] text-green-400 mt-0.5">+{fmt(s.goal_bonus)} bono</p>
                                )}
                              </div>
                            ) : <span className="text-[10px] text-muted-foreground">Sin meta</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-amber-400">{fmt(s.estimated_total ?? 0)}</td>
                          <td className="px-3 py-3 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-sidebar-accent/30">
                      <td className="px-4 py-2.5 text-xs font-bold text-foreground uppercase">Total</td>
                      <td className="px-4 py-2.5 font-bold text-foreground">{totalVentas}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-foreground">{fmt(totalMonto)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-purple-400">{fmt(totalComision)}</td>
                      <td />
                      <td className="px-4 py-2.5 text-right font-bold text-amber-400">{fmt(totalPagar)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
        </CardContent>
      </Card>

      {selected && <SellerSalesModal seller={selected} from={from} to={to} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Tab: Configuración ───────────────────────────────────────────────────────

function TabConfig() {
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ commissionType: 'sin_comision', commissionValue: 0, salaryBase: 0, monthlyGoal: 0, goalBonus: 0 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await apiService.getVendedoresList()
    if (res.success && res.data) setSellers(res.data)
    setLoading(false)
  }

  const toggleLogin = async (s: any) => {
    setTogglingId(s.id)
    const newVal = !(s.canLogin !== false)
    await apiService.toggleEmployeeLogin(s.id, newVal)
    await load()
    setTogglingId(null)
  }

  useEffect(() => { load() }, [])

  const openEdit = (s: any) => {
    setEditing(s)
    setForm({
      commissionType: s.commissionType ?? 'sin_comision',
      commissionValue: s.commissionValue ?? 0,
      salaryBase: s.salaryBase ?? 0,
      monthlyGoal: s.monthlyGoal ?? 0,
      goalBonus: s.goalBonus ?? 0,
    })
    setMsg('')
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    const res = await apiService.updateSellerCommission(editing.id, form)
    if (res.success) {
      setMsg('Guardado exitosamente')
      await load()
      setTimeout(() => setEditing(null), 800)
    } else {
      setMsg(res.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  if (loading) return <p className="text-center text-muted-foreground py-12 text-sm">Cargando empleados…</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configura el salario base, tipo de comisión y meta mensual de cada vendedor.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sellers.map(s => (
          <Card key={s.id} className="border-border">
            <CardContent className="pt-4 pb-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{s.cargoName || s.role}</p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${s.canLogin !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.canLogin !== false ? <Monitor size={9} /> : <MonitorOff size={9} />}
                      {s.canLogin !== false ? 'Acceso activo' : 'Sin acceso al sistema'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(s)}>
                    <Settings2 className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className={`h-7 text-xs ${s.canLogin !== false ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                    onClick={() => toggleLogin(s)}
                    disabled={togglingId === s.id}
                  >
                    {togglingId === s.id ? <Loader2 size={10} className="animate-spin mr-1" /> : s.canLogin !== false ? <MonitorOff size={10} className="mr-1" /> : <Monitor size={10} className="mr-1" />}
                    {s.canLogin !== false ? 'Bloquear' : 'Dar acceso'}
                  </Button>
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground border-t border-border pt-2">
                <div className="flex justify-between"><span>Salario base</span><span className="text-foreground font-medium">{fmt(s.salaryBase ?? 0)}</span></div>
                <div className="flex justify-between"><span>Comisión</span><span className="text-foreground font-medium">{commissionLabels[s.commissionType ?? 'sin_comision']}</span></div>
                {s.commissionType !== 'sin_comision' && (
                  <div className="flex justify-between pl-2">
                    <span>Valor</span>
                    <span className="text-foreground font-medium">
                      {s.commissionType === 'porcentaje' ? `${s.commissionValue}%` : fmt(s.commissionValue ?? 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between"><span>Meta mensual</span><span className="text-foreground font-medium">{s.monthlyGoal ? fmt(s.monthlyGoal) : '—'}</span></div>
                {s.monthlyGoal > 0 && <div className="flex justify-between pl-2"><span>Bono por meta</span><span className="text-green-400 font-medium">{fmt(s.goalBonus ?? 0)}</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Configurar comisión – {editing.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">Salario base mensual</label>
                <Input type="number" min="0" value={form.salaryBase}
                  onChange={e => setForm(f => ({ ...f, salaryBase: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">Tipo de comisión</label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.commissionType} onChange={e => setForm(f => ({ ...f, commissionType: e.target.value }))}>
                  {Object.entries(commissionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {form.commissionType !== 'sin_comision' && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">
                    {form.commissionType === 'porcentaje' ? 'Porcentaje (%)' : 'Valor fijo (COP)'}
                  </label>
                  <Input type="number" min="0" value={form.commissionValue}
                    onChange={e => setForm(f => ({ ...f, commissionValue: parseFloat(e.target.value) || 0 }))} />
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">Meta de ventas mensual (0 = sin meta)</label>
                <Input type="number" min="0" value={form.monthlyGoal}
                  onChange={e => setForm(f => ({ ...f, monthlyGoal: parseFloat(e.target.value) || 0 }))} />
              </div>
              {form.monthlyGoal > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">Bono por cumplir meta</label>
                  <Input type="number" min="0" value={form.goalBonus}
                    onChange={e => setForm(f => ({ ...f, goalBonus: parseFloat(e.target.value) || 0 }))} />
                </div>
              )}
              {msg && <p className={`text-xs ${msg.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ─── Tab: Nómina ──────────────────────────────────────────────────────────────

function TabNomina() {
  const storeInfo = useStore(s => s.storeInfo)
  const [from, setFrom] = useState(() => {
    const d = new Date(), y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}-01`
  })
  const [to, setTo] = useState(() => {
    const d = new Date(), y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}-15`
  })
  const [label, setLabel] = useState(() => {
    const d = new Date()
    return `Quincena 1 ${d.toLocaleString('es-CO', { month: 'long' })} ${d.getFullYear()}`
  })
  const [preview, setPreview] = useState<any[]>([])
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [novedadesWarnings, setNovedadesWarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<any[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [genError, setGenError] = useState('')
  const [adjForm, setAdjForm] = useState({ sellerId: '', sellerName: '', type: 'bono', concept: '', amount: '' })
  const [sellers, setSellers] = useState<any[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Period proration factor ──────────────────────────────────────────────────
  // salary_base is always the MONTHLY salary; we prorate for sub-monthly periods
  const periodInfo = useMemo(() => {
    const pFrom    = new Date(from + 'T00:00:00')
    const pTo      = new Date(to   + 'T23:59:59')
    const pDays    = Math.round((pTo.getTime() - pFrom.getTime()) / 86400000) + 1
    const mDays    = new Date(pFrom.getFullYear(), pFrom.getMonth() + 1, 0).getDate()
    const factor   = Math.min(pDays / mDays, 1.0)
    const factorPct = Math.round(factor * 100)
    const isQuincena = pDays <= 16
    return { pDays, mDays, factor, factorPct, isQuincena }
  }, [from, to])

  const loadPreview = useCallback(async () => {
    setLoading(true)
    const DEDUCTING_TYPES = ['permiso_no_remunerado', 'suspension']
    const [perfRes, rbRes, sellersRes, adjRes, novRes] = await Promise.all([
      apiService.getVendedoresPerformance({ from, to }),
      apiService.getRestbarEmployeePerformance({ from, to }),
      apiService.getVendedoresList(),
      apiService.getPayrollAdjustments({ from, to }),
      apiService.getNovedades({ status: 'aprobado', from, to }),
    ])

    const salesPerf: any[]   = (perfRes.success    && perfRes.data)    ? perfRes.data    : []
    const rbPerf: any[]      = (rbRes.success      && rbRes.data)      ? rbRes.data      : []
    const allSellers: any[]  = (sellersRes.success && sellersRes.data) ? sellersRes.data : []
    const novAll: any[]      = (novRes.success     && novRes.data)     ? novRes.data     : []
    const novWarnings        = novAll.filter(n => DEDUCTING_TYPES.includes(n.type))

    const roleMap = new Map(allSellers.map((s: any) => [s.id, s.role ?? 'vendedor']))

    const seen = new Set<string>()
    const merged: any[] = []

    for (const p of salesPerf) {
      seen.add(p.seller_id)
      merged.push({ ...p, _source: 'ventas', _role: roleMap.get(p.seller_id) ?? 'vendedor' })
    }
    for (const rb of rbPerf) {
      if (!seen.has(rb.waiterId)) {
        seen.add(rb.waiterId)
        merged.push({
          seller_id: rb.waiterId, seller_name: rb.waiterName,
          total_ventas: rb.totalComandas, total_monto: rb.totalFacturado,
          salary_base: rb.salaryBase, commission_earned: 0,
          commission_type: 'sin_comision', goal_bonus_earned: 0,
          _source: 'restbar', _role: rb.role ?? 'mesero',
        })
      }
    }
    for (const s of allSellers) {
      if (!seen.has(s.id) && s.salaryBase > 0) {
        seen.add(s.id)
        merged.push({
          seller_id: s.id, seller_name: s.name,
          total_ventas: 0, total_monto: 0,
          salary_base: s.salaryBase, commission_earned: 0,
          commission_type: s.commissionType ?? 'sin_comision', goal_bonus_earned: 0,
          _source: 'sin_actividad', _role: s.role ?? 'vendedor',
        })
      }
    }

    if (adjRes.success    && adjRes.data)    setAdjustments(adjRes.data)
    if (sellersRes.success && sellersRes.data) setSellers(sellersRes.data)
    setNovedadesWarnings(novWarnings)
    setPreview(merged)
    setLoading(false)
  }, [from, to])

  useEffect(() => { loadPreview() }, [loadPreview])

  const getSellerAdjs = (id: string) => adjustments.filter(a => a.sellerId === id)
  const getSellerNov  = (id: string) => novedadesWarnings.filter(n => n.userId === id || n.user_id === id)

  const computeRow = useCallback((s: any) => {
    const { factor } = periodInfo
    const proratedBase   = Math.round((s.salary_base ?? 0) * factor)
    const adjs           = getSellerAdjs(s.seller_id)
    const bonos          = adjs.filter(a => a.type === 'bono').reduce((acc, a) => acc + Number(a.amount), 0)
    const manualDesc     = adjs.filter(a => a.type === 'descuento').reduce((acc, a) => acc + Number(a.amount), 0)
    const nov            = getSellerNov(s.seller_id)
    const novedadesDesc  = nov.reduce((acc, n) => acc + Number(n.deductAmount ?? n.deduct_amount ?? 0), 0)
    const totalDescuentos = manualDesc + novedadesDesc
    return {
      ...s, proratedBase, totalBonos: bonos,
      manualDescuentos: manualDesc, novedadesDescuentos: novedadesDesc,
      totalDescuentos, novedades: nov,
      totalPagar: proratedBase + (s.commission_earned ?? 0) + (s.goal_bonus_earned ?? 0) + bonos - totalDescuentos,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments, novedadesWarnings, periodInfo])

  const rows = preview.map(computeRow)
  const grandTotal = rows.reduce((a, r) => a + r.totalPagar, 0)

  const addAdj = async () => {
    if (!adjForm.sellerId || !adjForm.concept || !adjForm.amount) return
    const sel = sellers.find(s => s.id === adjForm.sellerId)
    await apiService.addPayrollAdjustment({
      sellerId: adjForm.sellerId,
      sellerName: sel?.name ?? adjForm.sellerId,
      periodFrom: from, periodTo: to,
      type: adjForm.type as 'bono' | 'descuento',
      concept: adjForm.concept,
      amount: parseFloat(adjForm.amount),
    })
    setAdjForm(f => ({ ...f, concept: '', amount: '' }))
    await loadPreview()
  }

  const delAdj = async (id: string) => {
    await apiService.deletePayrollAdjustment(id)
    await loadPreview()
  }

  const doGenerate = async () => {
    setShowConfirm(false)
    setGenerating(true)
    setGenError('')
    const res = await apiService.generatePayroll({ periodFrom: from, periodTo: to, periodLabel: label })
    if (res.success && res.data) {
      setGenerated(res.data as any[])
    } else {
      setGenError(res.error ?? res.message ?? 'Error al generar nómina')
    }
    setGenerating(false)
  }

  // ── Confirmation dialog ──────────────────────────────────────────────────────
  const totalNovDesc = novedadesWarnings.reduce((a, n) => a + Number(n.deductAmount ?? n.deduct_amount ?? 0), 0)

  if (showConfirm) {
    return (
      <div className="space-y-4">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400" /> Confirmar generación de nómina
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Período</span><strong>{label}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fechas</span><span>{from} → {to}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Días del período</span>
                <span>{periodInfo.pDays} días ({periodInfo.factorPct}% del salario mensual)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Empleados a pagar</span><strong>{rows.length}</strong></div>
              {totalNovDesc > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Descuentos por novedades</span><span>-{fmt(totalNovDesc)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-amber-400 font-bold">
                <span>TOTAL A PAGAR</span><span>{fmt(grandTotal)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta acción generará {rows.length} comprobante(s) en borrador. Puedes revisarlos y marcarlos como pagados en el Historial.
              Si ya existe una nómina para algún empleado en este período exacto, se omitirá automáticamente.
            </p>
            <div className="flex gap-2">
              <Button className="flex items-center gap-2" onClick={doGenerate} disabled={generating}>
                <ClipboardList className="h-3.5 w-3.5" /> Confirmar y generar
              </Button>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Success view ─────────────────────────────────────────────────────────────
  if (generated.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
          <p className="text-sm text-green-400 font-medium">
            Nómina generada — {generated.length} comprobante(s) en borrador para <strong>{label}</strong>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => printNomina(generated, label, storeInfo)} className="flex items-center gap-2">
            <Printer className="h-3.5 w-3.5" /> Imprimir resumen
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setGenerated([]); loadPreview() }}>Nueva nómina</Button>
        </div>
        <div className="space-y-2">
          {generated.map(r => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex-1">
                <p className="font-medium text-sm text-foreground">{r.sellerName ?? r.seller_name}</p>
                <p className="text-xs text-muted-foreground">{r.periodLabel ?? r.period_label}</p>
              </div>
              <span className="text-lg font-bold text-amber-400">{fmt(r.totalPagar ?? r.total_pagar ?? 0)}</span>
              <button
                onClick={() => printColilla(r, r.periodLabel ?? r.period_label ?? label, periodInfo.factor, periodInfo.pDays, periodInfo.mDays, storeInfo)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors">
                <FileText className="h-3 w-3" /> Colilla
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Config periodo */}
      <Card className="border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Período de pago</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-4">
          {/* Quick presets */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              {
                label: 'Quincena 1', fn: () => {
                  const d = new Date(), y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0')
                  setFrom(`${y}-${m}-01`); setTo(`${y}-${m}-15`)
                  setLabel(`Quincena 1 ${d.toLocaleString('es-CO', { month: 'long' })} ${y}`)
                }
              },
              {
                label: 'Quincena 2', fn: () => {
                  const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1
                  const last = new Date(y, m, 0).getDate()
                  setFrom(`${y}-${String(m).padStart(2, '0')}-16`); setTo(`${y}-${String(m).padStart(2, '0')}-${last}`)
                  setLabel(`Quincena 2 ${d.toLocaleString('es-CO', { month: 'long' })} ${y}`)
                }
              },
              {
                label: 'Mes completo', fn: () => {
                  const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1
                  const last = new Date(y, m, 0).getDate()
                  setFrom(`${y}-${String(m).padStart(2, '0')}-01`); setTo(`${y}-${String(m).padStart(2, '0')}-${last}`)
                  setLabel(`${d.toLocaleString('es-CO', { month: 'long' })} ${y}`)
                }
              },
            ].map(r => <Button key={r.label} size="sm" variant="outline" className="h-7 text-xs" onClick={r.fn}>{r.label}</Button>)}
          </div>
          <div className="flex flex-wrap gap-3">
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Desde</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Hasta</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" /></div>
            <div className="flex-1 min-w-[200px]"><label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Etiqueta</label>
              <Input value={label} onChange={e => setLabel(e.target.value)} className="h-8 text-sm" placeholder="Ej: Quincena 1 Marzo 2026" /></div>
          </div>
          {/* Period factor info */}
          <div className="flex items-center gap-2 rounded-md bg-primary/8 border border-primary/20 px-3 py-2 text-xs text-primary">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              Período de <strong>{periodInfo.pDays} días</strong> de {periodInfo.mDays} → se pagará el{' '}
              <strong>{periodInfo.factorPct}% del salario mensual</strong> de cada empleado
              {periodInfo.isQuincena && <span className="ml-1 opacity-70">(quincenal)</span>}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Novedades alert */}
      {novedadesWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-400">
              {novedadesWarnings.length} novedad(es) aprobada(s) en este período que generarán descuentos automáticos
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">
              {novedadesWarnings.map(n => `${n.userName ?? n.user_name}: ${NOVELTY_TYPE_LABELS[n.type] ?? n.type} (-${fmt(Number(n.deductAmount ?? n.deduct_amount ?? 0))})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Ajustes (bonos/descuentos) */}
      <Card className="border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Novedades manuales del período</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="w-40">
              <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Empleado</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={adjForm.sellerId}
                onChange={e => {
                  const sel = sellers.find(s => s.id === e.target.value)
                  setAdjForm(f => ({ ...f, sellerId: e.target.value, sellerName: sel?.name ?? '' }))
                }}>
                <option value="">Seleccionar…</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.role ? `(${ROLE_DISPLAY_MAP[s.role] ?? s.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Tipo</label>
              <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={adjForm.type} onChange={e => setAdjForm(f => ({ ...f, type: e.target.value }))}>
                <option value="bono">Bono / Extra</option>
                <option value="descuento">Descuento / Préstamo</option>
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Concepto</label>
              <Input value={adjForm.concept} onChange={e => setAdjForm(f => ({ ...f, concept: e.target.value }))} className="h-8 text-sm" placeholder="Ej: Bono domingos, Préstamo, etc." />
            </div>
            <div className="w-28">
              <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Valor $</label>
              <Input type="number" min="0" value={adjForm.amount} onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))} className="h-8 text-sm" />
            </div>
            <Button size="sm" className="flex items-center gap-1.5 h-8" onClick={addAdj}>
              <Plus className="h-3.5 w-3.5" /> Agregar
            </Button>
          </div>
          {adjustments.length > 0 && (
            <div className="space-y-1 mt-2">
              {adjustments.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
                  <Badge variant="outline" className={`text-[10px] ${a.type === 'bono' ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'}`}>
                    {a.type === 'bono' ? '+' : '−'} {a.type}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{a.sellerName}</span>
                  <span className="flex-1 text-foreground">{a.concept}</span>
                  <span className={`font-semibold ${a.type === 'bono' ? 'text-green-400' : 'text-red-400'}`}>{fmt(a.amount)}</span>
                  <button onClick={() => delAdj(a.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error banner */}
      {genError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {genError}
        </div>
      )}

      {/* Preview nómina */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Liquidación del período</CardTitle>
              {!loading && rows.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rows.length} empleado(s) · Total {fmt(grandTotal)}
                </p>
              )}
            </div>
            <Button
              size="sm" className="flex items-center gap-2"
              onClick={() => { setGenError(''); setShowConfirm(true) }}
              disabled={generating || rows.length === 0 || loading}>
              <ClipboardList className="h-3.5 w-3.5" />
              {generating ? 'Generando…' : 'Generar nómina'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center text-muted-foreground py-8 text-sm">Cargando…</p>
            : rows.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Sin empleados en el período</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Configura el salario base de tus empleados en la pestaña Empleados</p>
              </div>
            )
            : (
              <div className="space-y-0">
                {rows.map(r => {
                  const roleInfo = ROLE_LABELS[r._role] ?? { label: ROLE_DISPLAY_MAP[r._role] ?? r._role ?? 'Empleado', color: 'bg-zinc-500/15 text-zinc-400' }
                  const isExpanded = expandedId === r.seller_id
                  const activityLabel = (r._source === 'restbar') ? 'comandas' : 'ventas'
                  return (
                    <div key={r.seller_id} className="border-b border-border/50 last:border-0">
                      {/* Main row */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-sidebar-accent/20 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : r.seller_id)}>
                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-foreground truncate">{r.seller_name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
                            {r.novedades?.length > 0 && (
                              <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                                <AlertCircle className="h-3 w-3" /> {r.novedades.length} novedad
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {r.total_ventas ?? 0} {activityLabel} · Total generado {fmt(r.total_monto ?? 0)}
                          </p>
                        </div>
                        {/* Salary breakdown summary */}
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-muted-foreground">
                            Base {fmt(r.proratedBase)}
                            {r.totalBonos > 0 && <span className="text-green-400 ml-1">+{fmt(r.totalBonos)}</span>}
                            {r.totalDescuentos > 0 && <span className="text-red-400 ml-1">−{fmt(r.totalDescuentos)}</span>}
                          </p>
                          <p className="font-bold text-amber-400">{fmt(r.totalPagar)}</p>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>

                      {/* Expanded breakdown */}
                      {isExpanded && (
                        <div className="bg-sidebar-accent/10 border-t border-border/40 px-6 py-3 space-y-1.5 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Salario mensual base</span>
                            <span>{fmt(r.salary_base ?? 0)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Factor período ({periodInfo.pDays}/{periodInfo.mDays} días = {periodInfo.factorPct}%)</span>
                            <span className="text-foreground font-medium">{fmt(r.proratedBase)}</span>
                          </div>
                          {(r.commission_earned ?? 0) > 0 && (
                            <div className="flex justify-between text-purple-400">
                              <span>Comisión</span><span>{fmt(r.commission_earned)}</span>
                            </div>
                          )}
                          {(r.goal_bonus_earned ?? 0) > 0 && (
                            <div className="flex justify-between text-blue-400">
                              <span>Bono por meta</span><span>{fmt(r.goal_bonus_earned)}</span>
                            </div>
                          )}
                          {r.totalBonos > 0 && (
                            <div className="flex justify-between text-green-400">
                              <span>+ Bonos adicionales</span><span>{fmt(r.totalBonos)}</span>
                            </div>
                          )}
                          {r.novedades?.map((n: any, i: number) => (
                            <div key={i} className="flex justify-between text-red-400 text-xs">
                              <span>− {NOVELTY_TYPE_LABELS[n.type] ?? n.type} ({n.daysCount ?? n.days_count} días)</span>
                              <span>−{fmt(Number(n.deductAmount ?? n.deduct_amount ?? 0))}</span>
                            </div>
                          ))}
                          {r.manualDescuentos > 0 && (
                            <div className="flex justify-between text-red-400">
                              <span>− Descuentos manuales</span><span>−{fmt(r.manualDescuentos)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-border pt-2 font-bold text-amber-400">
                            <span>TOTAL A PAGAR</span><span>{fmt(r.totalPagar)}</span>
                          </div>
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => printColilla(r, label, periodInfo.factor, periodInfo.pDays, periodInfo.mDays, storeInfo)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors">
                              <FileText className="h-3 w-3" /> Ver colilla
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* Grand total */}
                <div className="flex items-center justify-between px-4 py-3 bg-sidebar-accent/30 border-t-2 border-border">
                  <span className="font-bold text-xs uppercase tracking-wider text-foreground">Gran total — {rows.length} empleados</span>
                  <span className="font-bold text-amber-400 text-lg">{fmt(grandTotal)}</span>
                </div>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Payroll table helper ──────────────────────────────────────────────────────

function PayrollTable({ records }: { records: any[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border">
          {['Empleado', 'Período', 'Actividad', 'Base período', 'Comisión', 'Bonos', 'Total pagar', 'Estado'].map(h => (
            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-widest">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id} className="border-b border-border/50">
              <td className="px-4 py-2.5 font-medium text-foreground">{r.sellerName ?? r.seller_name}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.periodLabel ?? r.period_label}</td>
              <td className="px-4 py-2.5 text-foreground">{r.totalVentas ?? r.total_ventas}</td>
              <td className="px-4 py-2.5 text-foreground">{fmt(r.salaryBase ?? r.salary_base ?? 0)}</td>
              <td className="px-4 py-2.5 text-purple-400">{fmt(r.commissionEarned ?? r.commission_earned ?? 0)}</td>
              <td className="px-4 py-2.5 text-green-400">{fmt(r.totalBonos ?? r.total_bonos ?? 0)}</td>
              <td className="px-4 py-2.5 font-bold text-amber-400">{fmt(r.totalPagar ?? r.total_pagar ?? 0)}</td>
              <td className="px-4 py-2.5">
                <Badge variant="outline" className={`text-[10px] ${(r.status === 'pagado') ? 'text-green-400 border-green-500/30' : 'text-amber-400 border-amber-500/30'}`}>
                  {r.status === 'pagado' ? 'Pagado' : 'Borrador'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab: Historial ───────────────────────────────────────────────────────────

function TabHistorial() {
  const storeInfo = useStore(s => s.storeInfo)
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<string[]>([])

  const load = useCallback(async (p: number) => {
    setLoading(true)
    const res = await apiService.getPayrollHistory({ page: p, limit: 20 })
    if (res.success && res.data) {
      setRecords(res.data.data ?? [])
      setTotalPages(res.data.pagination?.totalPages ?? 1)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(page) }, [load, page])

  const markPaid = async () => {
    await apiService.markPayrollPaid(selected)
    setSelected([])
    await load(page)
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este borrador?')) return
    await apiService.deletePayrollRecord(id)
    await load(page)
  }

  const toggleSelect = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const grouped = records.reduce((acc: Record<string, any[]>, r) => {
    const key = r.periodLabel ?? r.period_label ?? r.periodFrom ?? r.period_from
    ;(acc[key] ??= []).push(r)
    return acc
  }, {})

  if (loading) return <p className="text-center text-muted-foreground py-12 text-sm">Cargando historial…</p>
  if (records.length === 0) return (
    <div className="text-center py-16">
      <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-muted-foreground text-sm">Aún no se han generado nóminas</p>
      <p className="text-muted-foreground/60 text-xs mt-1">Ve a la pestaña Nómina para generar una</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {selected.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
          <span className="text-sm text-muted-foreground">{selected.length} seleccionado(s)</span>
          <Button size="sm" className="flex items-center gap-1.5 h-7" onClick={markPaid}>
            <CheckCircle className="h-3.5 w-3.5" /> Marcar como pagado
          </Button>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected([])}>Limpiar</button>
        </div>
      )}

      {Object.entries(grouped).map(([period, recs]) => (
        <div key={period}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> {period}
            </h3>
            <Button size="sm" variant="outline" className="flex items-center gap-1.5 h-7 text-xs"
              onClick={() => printNomina(recs, period, storeInfo)}>
              <Printer className="h-3 w-3" /> Imprimir
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-sidebar-accent/30">
                <th className="px-3 py-2 w-8" />
                {['Empleado', 'Actividad', 'Base período', 'Comisión', 'Bonos', 'Total pagar', 'Estado', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-widest">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(recs as any[]).map(r => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="px-3 py-2">
                      {r.status === 'borrador' && (
                        <input type="checkbox" className="rounded" checked={selected.includes(r.id)}
                          onChange={() => toggleSelect(r.id)} />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">{r.sellerName ?? r.seller_name}</td>
                    <td className="px-3 py-2 text-foreground">{r.totalVentas ?? r.total_ventas}</td>
                    <td className="px-3 py-2 text-foreground">{fmt(r.salaryBase ?? r.salary_base ?? 0)}</td>
                    <td className="px-3 py-2 text-purple-400">{fmt(r.commissionEarned ?? r.commission_earned ?? 0)}</td>
                    <td className="px-3 py-2 text-green-400">{fmt(r.totalBonos ?? r.total_bonos ?? 0)}</td>
                    <td className="px-3 py-2 font-bold text-amber-400">{fmt(r.totalPagar ?? r.total_pagar ?? 0)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[10px] ${r.status === 'pagado' ? 'text-green-400 border-green-500/30' : 'text-amber-400 border-amber-500/30'}`}>
                        {r.status === 'pagado' ? 'Pagado' : 'Borrador'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const notes = r.notes ? (() => { try { return JSON.parse(r.notes) } catch { return {} } })() : {}
                            printColilla(r, r.periodLabel ?? r.period_label ?? '', notes.salaryFactor ?? 1, notes.periodDays ?? 30, notes.daysInMonth ?? 30, storeInfo)
                          }}
                          title="Ver colilla"
                          className="text-muted-foreground hover:text-foreground transition-colors">
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        {r.status === 'borrador' && (
                          <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-border bg-sidebar-accent/20">
                <td colSpan={6} className="px-3 py-2 text-xs font-bold text-foreground uppercase">Total período</td>
                <td className="px-3 py-2 font-bold text-amber-400">
                  {fmt((recs as any[]).reduce((a, r) => a + Number(r.totalPagar ?? r.total_pagar ?? 0), 0))}
                </td>
                <td colSpan={2} />
              </tr></tfoot>
            </table>
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground self-center">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Novedades ───────────────────────────────────────────────────────────

const NOVELTY_TYPE_LABELS: Record<string, string> = {
  vacaciones:             'Vacaciones',
  permiso_remunerado:     'Permiso remunerado',
  permiso_no_remunerado:  'Permiso no remunerado',
  incapacidad:            'Incapacidad',
  calamidad:              'Calamidad',
  licencia_maternidad:    'Lic. Maternidad/Paternidad',
  suspension:             'Suspensión',
  otro:                   'Otro',
}

const NOVELTY_COLORS: Record<string, string> = {
  vacaciones:             'bg-blue-500/10 text-blue-400 border-blue-500/20',
  permiso_remunerado:     'bg-green-500/10 text-green-400 border-green-500/20',
  permiso_no_remunerado:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  incapacidad:            'bg-red-500/10 text-red-400 border-red-500/20',
  calamidad:              'bg-orange-500/10 text-orange-400 border-orange-500/20',
  licencia_maternidad:    'bg-pink-500/10 text-pink-400 border-pink-500/20',
  suspension:             'bg-destructive/10 text-destructive border-destructive/20',
  otro:                   'bg-muted text-muted-foreground border-border',
}

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  aprobado:  'bg-green-500/10 text-green-400 border-green-500/20',
  rechazado: 'bg-destructive/10 text-destructive border-destructive/20',
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado:  'Aprobado',
  rechazado: 'Rechazado',
}

function TabNovedades() {
  const [sellers, setSellers] = useState<any[]>([])
  const [novedades, setNovedades] = useState<any[]>([])
  const [balances, setBalances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'list' | 'vacaciones'>('list')
  const year = new Date().getFullYear()

  // Filters
  const [filterUser, setFilterUser] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    userId: '', type: 'permiso_remunerado', startDate: '', endDate: '', description: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params: any = {}
    if (filterUser)   params.userId = filterUser
    if (filterType)   params.type   = filterType
    if (filterStatus) params.status = filterStatus
    const [novRes, balRes, selRes] = await Promise.all([
      apiService.getNovedades(params),
      apiService.getVacationBalances(year),
      apiService.getVendedoresList(),
    ])
    if (novRes.success && novRes.data)  setNovedades(Array.isArray(novRes.data) ? novRes.data : [])
    if (balRes.success && balRes.data)  setBalances(Array.isArray(balRes.data) ? balRes.data : [])
    if (selRes.success && selRes.data)  setSellers(Array.isArray(selRes.data) ? selRes.data : [])
    setLoading(false)
  }, [filterUser, filterType, filterStatus, year])

  useEffect(() => { load() }, [load])

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0
    const s = new Date(start + 'T00:00:00'), e = new Date(end + 'T00:00:00')
    let count = 0
    const cur = new Date(s)
    while (cur <= e) { if (cur.getDay() !== 0) count++; cur.setDate(cur.getDate() + 1) }
    return Math.max(count, 1)
  }

  const handleCreate = async () => {
    setMsg('')
    if (!form.userId || !form.type || !form.startDate || !form.endDate) {
      setMsg('Todos los campos son obligatorios'); return
    }
    if (form.endDate < form.startDate) { setMsg('La fecha fin debe ser posterior al inicio'); return }
    setSaving(true)
    const res = await apiService.createNovedad(form)
    if (res.success) {
      setShowForm(false)
      setForm({ userId: '', type: 'permiso_remunerado', startDate: '', endDate: '', description: '' })
      load()
    } else {
      setMsg(res.error || 'Error al registrar novedad')
    }
    setSaving(false)
  }

  const handleStatus = async (id: string, status: 'aprobado' | 'rechazado') => {
    await apiService.updateNovedadStatus(id, status)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta novedad?')) return
    await apiService.deleteNovedad(id)
    load()
  }

  const handleUpdateBalance = async (userId: string, current: number) => {
    const input = prompt(`Días otorgados para ${year} (actual: ${current}):`, String(current))
    if (input === null) return
    const days = parseInt(input)
    if (isNaN(days) || days < 0) { alert('Valor inválido'); return }
    await apiService.updateVacationBalance({ userId, year, daysGranted: days })
    load()
  }

  const filteredNov = novedades.filter(n => {
    if (filterUser && n.userId !== filterUser) return false
    if (filterType && n.type !== filterType) return false
    if (filterStatus && n.status !== filterStatus) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {[
          { id: 'list', label: 'Novedades', icon: FileText },
          { id: 'vacaciones', label: 'Saldo Vacaciones', icon: Umbrella },
        ].map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'}`}>
              <Icon className="h-3.5 w-3.5" />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'list' && (
        <div className="space-y-4">
          {/* Filters + New */}
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="w-44">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Empleado</p>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                    <option value="">Todos</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>
                      {s.name}{s.role ? ` (${ROLE_DISPLAY_MAP[s.role] ?? s.role})` : ''}
                    </option>)}
                  </select>
                </div>
                <div className="w-44">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Tipo</p>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">Todos</option>
                    {Object.entries(NOVELTY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Estado</p>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </div>
                <Button size="sm" className="ml-auto flex items-center gap-1.5 h-8" onClick={() => { setShowForm(true); setMsg('') }}>
                  <Plus className="h-3.5 w-3.5" /> Nueva novedad
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Form */}
          {showForm && (
            <Card className="border-primary/40 bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Registrar Novedad</span>
                  <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Empleado *</label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}>
                      <option value="">Seleccionar empleado…</option>
                      {sellers.map(s => <option key={s.id} value={s.id}>
                        {s.name}{s.role ? ` — ${ROLE_DISPLAY_MAP[s.role] ?? s.role}` : ''}
                      </option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Tipo de novedad *</label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {Object.entries(NOVELTY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Días hábiles</label>
                    <div className="flex items-center h-9 rounded-md border border-input bg-secondary px-3 text-sm text-foreground font-semibold">
                      {calcDays(form.startDate, form.endDate) || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Fecha inicio *</label>
                    <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Fecha fin *</label>
                    <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Descripción / Motivo</label>
                    <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles opcionales" className="h-9 text-sm" />
                  </div>
                </div>
                {/* Info card by type */}
                {form.type && (
                  <div className={`rounded-lg border px-3 py-2 text-xs ${NOVELTY_COLORS[form.type]}`}>
                    {form.type === 'vacaciones' && '📅 Descuenta del saldo de vacaciones del empleado.'}
                    {form.type === 'permiso_remunerado' && '✅ Con sueldo completo. Descuenta días del saldo de vacaciones.'}
                    {form.type === 'permiso_no_remunerado' && '⚠️ Sin sueldo. Se calculará descuento proporcional en nómina.'}
                    {form.type === 'incapacidad' && '🏥 Incapacidad médica. Los primeros 2 días los paga el empleador; desde el día 3 la EPS cubre el 66.67%.'}
                    {form.type === 'calamidad' && '🏠 Calamidad doméstica. Máximo 5 días hábiles remunerados por ley.'}
                    {form.type === 'licencia_maternidad' && '👶 Licencia remunerada. Maternidad: 18 semanas. Paternidad: 2 semanas.'}
                    {form.type === 'suspension' && '🚫 Suspensión disciplinaria. Descuenta de nómina proporcionalmente.'}
                    {form.type === 'otro' && '📝 Novedad general. Sin impacto automático en nómina.'}
                  </div>
                )}
                {msg && <p className="text-xs text-destructive">{msg}</p>}
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={handleCreate} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    {saving ? 'Guardando…' : 'Registrar novedad'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* List */}
          <Card className="border-border">
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center text-muted-foreground py-12 text-sm">Cargando…</p>
              ) : filteredNov.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No hay novedades registradas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Empleado', 'Tipo', 'Período', 'Días', 'Impacto nómina', 'Estado', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNov.map(n => (
                        <tr key={n.id} className="border-b border-border/50 hover:bg-sidebar-accent/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{n.userName}</p>
                            {(() => {
                              const seller = sellers.find(s => s.id === n.userId)
                              const roleInfo = seller ? (ROLE_LABELS[seller.role] ?? null) : null
                              return roleInfo ? (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
                              ) : null
                            })()}
                            {n.description && <p className="text-[10px] text-muted-foreground truncate max-w-[150px] mt-0.5">{n.description}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[10px] ${NOVELTY_COLORS[n.type]}`}>
                              {NOVELTY_TYPE_LABELS[n.type] ?? n.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {n.startDate} {n.startDate !== n.endDate ? `→ ${n.endDate}` : ''}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground text-center">{n.daysCount}</td>
                          <td className="px-4 py-3">
                            {n.deductsSalary
                              ? <span className="text-xs text-red-400 font-medium">−${new Intl.NumberFormat('es-CO').format(n.deductAmount)}</span>
                              : n.deductsVacation
                              ? <span className="text-xs text-amber-400">−{n.daysCount} días vacac.</span>
                              : <span className="text-xs text-muted-foreground">Sin descuento</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[n.status]}`}>
                              {n.status === 'pendiente' && <Clock className="h-3 w-3 mr-1" />}
                              {n.status === 'aprobado'  && <CheckCircle className="h-3 w-3 mr-1" />}
                              {n.status === 'rechazado' && <X className="h-3 w-3 mr-1" />}
                              {STATUS_LABELS[n.status]}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              {n.status === 'pendiente' && (
                                <>
                                  <button title="Aprobar" onClick={() => handleStatus(n.id, 'aprobado')}
                                    className="p-1 rounded text-muted-foreground hover:text-green-400 transition-colors">
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button title="Rechazar" onClick={() => handleStatus(n.id, 'rechazado')}
                                    className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors">
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              <button title="Eliminar" onClick={() => handleDelete(n.id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'vacaciones' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Umbrella className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Saldo de vacaciones {year}</h3>
            <span className="text-xs text-muted-foreground ml-2">15 días hábiles por año (Ley colombiana)</span>
          </div>
          {loading ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Cargando…</p>
          ) : balances.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No hay empleados activos</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map(b => {
                const pct = Math.min((b.daysUsed / b.daysGranted) * 100, 100)
                const remaining = b.daysGranted - b.daysUsed
                const roleInfo = ROLE_LABELS[b.role] ?? null
                return (
                  <Card key={b.userId} className="border-border">
                    <CardContent className="pt-4 pb-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">
                            {b.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{b.userName}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {roleInfo && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
                              )}
                              {b.cargoName && <p className="text-[10px] text-muted-foreground">{b.cargoName}</p>}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => handleUpdateBalance(b.userId, b.daysGranted)}
                          className="text-[10px] text-primary hover:underline">Editar días</button>
                      </div>
                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Usados: <span className="text-foreground font-medium">{b.daysUsed}</span></span>
                          <span className="text-muted-foreground">Total: <span className="text-foreground font-medium">{b.daysGranted} días</span></span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Días disponibles</span>
                        <span className={`text-lg font-bold ${remaining <= 3 ? 'text-red-400' : remaining <= 7 ? 'text-amber-400' : 'text-green-400'}`}>
                          {remaining}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab RestBar ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  mesero:          { label: 'Mesero',        color: 'bg-green-500/15 text-green-400' },
  cajero:          { label: 'Cajero',        color: 'bg-blue-500/15 text-blue-400' },
  cocinero:        { label: 'Cocinero',      color: 'bg-orange-500/15 text-orange-400' },
  bartender:       { label: 'Bartender',     color: 'bg-purple-500/15 text-purple-400' },
  administrador_rb:{ label: 'Admin RestBar', color: 'bg-primary/15 text-primary' },
  vendedor:        { label: 'Vendedor',       color: 'bg-zinc-500/15 text-zinc-400' },
  comerciante:     { label: 'Comerciante',   color: 'bg-amber-500/15 text-amber-400' },
}

function TabRestBar() {
  const [from, setFrom] = useState(firstOfMonthStr())
  const [to, setTo]     = useState(todayStr())
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiService.getRestbarEmployeePerformance({ from, to })
    if (res.success && res.data) setData(res.data)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const quickRanges = [
    { label: 'Hoy',       fn: () => { setFrom(todayStr()); setTo(todayStr()) } },
    { label: 'Este mes',  fn: () => { setFrom(firstOfMonthStr()); setTo(todayStr()) } },
    { label: 'Mes anterior', fn: () => {
      const d = new Date(), y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()
      const m = d.getMonth() === 0 ? 12 : d.getMonth()
      const last = new Date(y, m, 0).getDate()
      setFrom(`${y}-${String(m).padStart(2, '0')}-01`)
      setTo(`${y}-${String(m).padStart(2, '0')}-${last}`)
    }},
  ]

  const totalComandas  = data.reduce((a, d) => a + d.totalComandas, 0)
  const totalFacturado = data.reduce((a, d) => a + d.totalFacturado, 0)
  const totalCerradas  = data.reduce((a, d) => a + d.comandasCerradas, 0)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border-border">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex gap-2 items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Desde</p>
                  <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Hasta</p>
                  <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {quickRanges.map(r => (
                <Button key={r.label} size="sm" variant="outline" className="h-8 text-xs" onClick={r.fn}>{r.label}</Button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-8 ml-auto" onClick={load}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Staff RestBar',     value: data.length,          icon: <ChefHat className="h-5 w-5" />,         color: 'text-primary' },
          { label: 'Comandas abiertas', value: totalComandas,        icon: <UtensilsCrossed className="h-5 w-5" />, color: 'text-amber-400' },
          { label: 'Comandas cerradas', value: totalCerradas,        icon: <CheckCircle className="h-5 w-5" />,     color: 'text-green-400' },
          { label: 'Total facturado',   value: fmt(totalFacturado),  icon: <DollarSign className="h-5 w-5" />,      color: 'text-blue-400' },
        ].map(c => (
          <Card key={c.label} className="border-border">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className={`${c.color} opacity-80`}>{c.icon}</div>
              <div>
                <p className="text-[11px] text-muted-foreground leading-none">{c.label}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Staff cards */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12 text-sm">Cargando rendimiento…</p>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <ChefHat className="h-10 w-10 opacity-30" />
          <p className="text-sm">Sin actividad en el período seleccionado</p>
          <p className="text-xs opacity-60">Crea usuarios mesero/cajero/cocinero desde el panel de comerciante</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map(emp => {
              const roleInfo = ROLE_LABELS[emp.role] ?? { label: emp.role, color: 'bg-zinc-500/15 text-zinc-400' }
              const pctCerradas = emp.totalComandas > 0 ? Math.round((emp.comandasCerradas / emp.totalComandas) * 100) : 0
              return (
                <Card key={emp.waiterId}
                  className={`border-border cursor-pointer transition-all hover:border-primary/40 ${selected?.waiterId === emp.waiterId ? 'border-primary/60 bg-primary/5' : ''}`}
                  onClick={() => setSelected(selected?.waiterId === emp.waiterId ? null : emp)}>
                  <CardContent className="pt-4 pb-3 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">
                          {(emp.waiterName ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{emp.waiterName}</p>
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${roleInfo.color}`}>
                            {roleInfo.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{fmt(emp.totalFacturado)}</p>
                        <p className="text-[10px] text-muted-foreground">facturado</p>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-2">
                      {[
                        { label: 'Comandas', value: emp.totalComandas },
                        { label: 'Cerradas', value: emp.comandasCerradas },
                        { label: 'Ítems', value: emp.totalItems },
                      ].map(m => (
                        <div key={m.label}>
                          <p className="text-base font-bold text-foreground">{m.value}</p>
                          <p className="text-[10px] text-muted-foreground">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Promedio + closure rate */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Promedio/comanda</span>
                        <span className="font-semibold text-foreground">{fmt(emp.promedioComanda)}</span>
                      </div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Tasa cierre</span>
                        <span className={`font-semibold ${pctCerradas >= 80 ? 'text-green-400' : pctCerradas >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {pctCerradas}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pctCerradas >= 80 ? 'bg-green-500' : pctCerradas >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${pctCerradas}%` }} />
                      </div>
                    </div>

                    {/* Salary base if set */}
                    {emp.salaryBase > 0 && (
                      <div className="flex justify-between text-xs border-t border-border pt-2">
                        <span className="text-muted-foreground">Salario base</span>
                        <span className="font-semibold text-foreground">{fmt(emp.salaryBase)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Detail panel for selected employee */}
          {selected && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2 pt-4 flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-primary" />
                  Detalle — {selected.waiterName}
                </CardTitle>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total comandas',   value: selected.totalComandas,              sub: 'todas las abiertas' },
                    { label: 'Comandas cerradas',value: selected.comandasCerradas,            sub: 'facturadas y cobradas' },
                    { label: 'Total ítems',      value: selected.totalItems,                  sub: 'productos despachados' },
                    { label: 'Promedio comanda', value: fmt(selected.promedioComanda),         sub: 'en comandas cerradas' },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg border border-border bg-card p-3 text-center">
                      <p className="text-xl font-bold text-foreground">{m.value}</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">{m.label}</p>
                      <p className="text-[10px] text-muted-foreground">{m.sub}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const tabs = [
  { id: 'dashboard', label: 'Dashboard',      icon: BarChart2 },
  { id: 'restbar',   label: 'RestBar',        icon: UtensilsCrossed },
  { id: 'config',    label: 'Configuración',  icon: Settings2 },
  { id: 'nomina',    label: 'Nómina',         icon: ClipboardList },
  { id: 'historial', label: 'Historial',      icon: History },
  { id: 'novedades', label: 'Novedades',      icon: FileText },
]

export function VendedoresPanel() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Empleados</h1>
        <p className="text-sm text-muted-foreground">Control de rendimiento, comisiones y nómina</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'dashboard'  && <TabDashboard />}
      {tab === 'restbar'    && <TabRestBar />}
      {tab === 'config'     && <TabConfig />}
      {tab === 'nomina'     && <TabNomina />}
      {tab === 'historial'  && <TabHistorial />}
      {tab === 'novedades'  && <TabNovedades />}
    </div>
  )
}
