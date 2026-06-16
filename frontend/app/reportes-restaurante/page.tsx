'use client'

// Reportes de restaurante (Fase 4): resumen de pagos, top de productos y
// rendimiento por mesero y por mesa en un rango de fechas. Exporta a PDF (imprimir).
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

const money = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO')
const METHOD: Record<string, string> = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', nequi: '📱 Nequi', transferencia: '🏦 Transferencia', mixto: '🔀 Mixto' }
const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function RestaurantReportsPage() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 86400000)))
  const [to, setTo] = useState(iso(new Date()))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.getRestbarReports(from, to)
    if (r.success) setData(r.data)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const k = data?.kpis || {}

  return (
    <div className="min-h-screen bg-background text-foreground p-5 max-w-4xl mx-auto print:p-0">
      <style>{`@media print { .no-print { display:none !important } body { background:#fff } }`}</style>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black">📊 Reportes del restaurante</h1>
          <p className="text-sm text-muted-foreground">Periodo {from} → {to}</p>
        </div>
        <div className="flex items-end gap-2 no-print">
          <div>
            <label className="block text-[11px] font-semibold mb-0.5">Desde</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-lg bg-background border border-border px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-0.5">Hasta</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-lg bg-background border border-border px-2 py-1.5 text-sm" />
          </div>
          <button onClick={load} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">Aplicar</button>
          <button onClick={() => window.print()} className="rounded-lg bg-foreground text-background px-3 py-1.5 text-sm font-semibold">🖨️ PDF</button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-16">Cargando…</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              ['Ventas (comandas)', money(k.sales || 0)],
              ['Comandas cerradas', String(k.orders || 0)],
              ['Ticket promedio', money(k.avgTicket || 0)],
              ['Total cobrado', money(k.paymentsTotal || 0)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-xl font-black mt-1">{val}</p>
              </div>
            ))}
          </div>

          <Section title="💳 Resumen de pagos por método">
            <Table head={['Método', 'Transacciones', 'Total']}
              rows={(data?.payments || []).map((p: any) => [METHOD[p.method] || p.method, p.count, money(p.total)])}
              empty="Sin pagos en el periodo" />
          </Section>

          <Section title="🍽️ Top de productos">
            <Table head={['#', 'Producto', 'Cantidad', 'Ingresos']}
              rows={(data?.topProducts || []).map((p: any, i: number) => [i + 1, p.name, p.qty, money(p.revenue)])}
              empty="Sin ventas en el periodo" />
          </Section>

          <Section title="🧑‍🍳 Rendimiento por mesero">
            <Table head={['Mesero', 'Comandas', 'Ventas']}
              rows={(data?.waiters || []).map((w: any) => [w.name, w.orders, money(w.sales)])}
              empty="Sin datos" />
          </Section>

          <Section title="🪑 Rendimiento por mesa">
            <Table head={['Mesa', 'Comandas', 'Ventas']}
              rows={(data?.tables || []).map((t: any) => [`Mesa ${t.tableNumber}`, t.orders, money(t.sales)])}
              empty="Sin datos" />
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">{title}</h2>
      {children}
    </div>
  )
}

function Table({ head, rows, empty }: { head: string[]; rows: any[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground py-3">{empty}</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-accent/40 text-left">
            {head.map((h, i) => <th key={i} className={`px-3 py-2 font-semibold ${i >= head.length - 1 ? 'text-right' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => <td key={j} className={`px-3 py-2 ${j >= r.length - 1 ? 'text-right font-semibold tabular-nums' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
