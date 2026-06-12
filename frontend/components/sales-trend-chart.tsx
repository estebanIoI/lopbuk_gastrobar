'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Calendar, Filter, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

/**
 * Gráfica de tendencia de ventas (estilo Shopify) — la misma del Dashboard (tema 1),
 * extraída para reutilizarla en el panel del comerciante (tema 2).
 * Autocontenida: maneja su propio rango, fetch y cálculo.
 */
export function SalesTrendChart() {
  const { navigateToInvoices } = useStore()
  const [trendRange, setTrendRange] = useState<number>(7)
  const [backendTrend, setBackendTrend] = useState<Array<{ date: string; total: number; count: number; fiadoTotal?: number; fiadoCount?: number }>>([])
  const chartScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    api.getSalesTrend(trendRange).then(r => {
      if (alive && r.success && Array.isArray(r.data)) setBackendTrend(r.data as any)
    }).catch(() => {})
    return () => { alive = false }
  }, [trendRange])

  const salesTrendData = useMemo(() => {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const today = new Date()

    const trendMap = new Map<string, { total: number; count: number; fiadoTotal: number; fiadoCount: number }>()
    for (const row of backendTrend) {
      const dateKey = typeof row.date === 'string' ? row.date.split('T')[0] : String(row.date)
      trendMap.set(dateKey, { total: row.total, count: row.count, fiadoTotal: row.fiadoTotal || 0, fiadoCount: row.fiadoCount || 0 })
    }

    let numDays: number
    if (trendRange === 0) {
      if (backendTrend.length === 0) {
        numDays = 30
      } else {
        const oldest = backendTrend[0].date
        const oldestDateStr = typeof oldest === 'string' ? oldest.split('T')[0] : String(oldest)
        const oldestDate = new Date(oldestDateStr + 'T00:00:00')
        numDays = Math.max(Math.ceil((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1, 1)
      }
    } else {
      numDays = trendRange
    }

    const result = []
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dayData = trendMap.get(dateStr)
      const label = numDays <= 14 ? dayNames[d.getDay()] : `${d.getDate()} ${monthNames[d.getMonth()]}`
      result.push({
        day: label,
        fecha: `${d.getDate()}/${d.getMonth() + 1}`,
        fullDate: dateStr,
        ventas: dayData?.total || 0,
        fiados: dayData?.fiadoTotal || 0,
        transacciones: (dayData?.count || 0) + (dayData?.fiadoCount || 0),
      })
    }
    return result
  }, [backendTrend, trendRange])

  const todaySales = (salesTrendData[salesTrendData.length - 1]?.ventas || 0) + (salesTrendData[salesTrendData.length - 1]?.fiados || 0)
  const yesterdaySales = (salesTrendData[salesTrendData.length - 2]?.ventas || 0) + (salesTrendData[salesTrendData.length - 2]?.fiados || 0)
  const salesChange = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100) : 0
  const rangeTotal = salesTrendData.reduce((sum, d) => sum + d.ventas + d.fiados, 0)
  const rangeFiados = salesTrendData.reduce((sum, d) => sum + d.fiados, 0)
  const rangeTransactions = salesTrendData.reduce((sum, d) => sum + d.transacciones, 0)
  const chartMinWidth = salesTrendData.length > 14 ? salesTrendData.length * 60 : undefined

  const scrollChart = (direction: 'left' | 'right') => {
    if (chartScrollRef.current) {
      const amount = 300
      chartScrollRef.current.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' })
    }
  }

  const rangeLabels: Record<number, string> = { 7: '7 días', 14: '14 días', 30: '30 días', 90: '90 días', 0: 'Todo' }

  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className="p-4 sm:p-6 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                Ventas — {trendRange === 0 ? 'Histórico completo' : `Últimos ${rangeLabels[trendRange]}`}
              </p>
            </div>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
              {formatCOP(rangeTotal)}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs sm:text-sm text-muted-foreground">
                {rangeTransactions} transacciones
              </span>
              {rangeFiados > 0 && (
                <span className="text-xs sm:text-sm text-amber-500">
                  Fiados: {formatCOP(rangeFiados)}
                </span>
              )}
              {salesChange !== 0 && (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  salesChange >= 0
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {salesChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {salesChange >= 0 ? '+' : ''}{salesChange.toFixed(1)}% vs ayer
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-4 sm:gap-6 sm:text-right">
            <div>
              <p className="text-xs text-muted-foreground">Hoy</p>
              <p className="text-base sm:text-lg font-bold text-foreground">{formatCOP(todaySales)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ayer</p>
              <p className="text-base sm:text-lg font-bold text-muted-foreground">{formatCOP(yesterdaySales)}</p>
            </div>
          </div>
        </div>
        {/* Filter buttons */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          {([7, 14, 30, 90, 0] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTrendRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                trendRange === range
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              }`}
            >
              {rangeLabels[range]}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable chart with navigation arrows */}
      <div className="relative mt-2">
        {chartMinWidth && (
          <>
            <button
              onClick={() => scrollChart('left')}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
            <button
              onClick={() => scrollChart('right')}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          </>
        )}
        <div
          ref={chartScrollRef}
          className="overflow-x-auto scrollbar-thin pb-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div style={{ minWidth: chartMinWidth ? `${chartMinWidth}px` : '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={salesTrendData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                style={{ cursor: 'pointer' }}
                onClick={(chartData: any) => {
                  const payload = chartData?.activePayload?.[0]?.payload
                  if (payload?.fullDate && payload?.transacciones > 0) {
                    navigateToInvoices(payload.fullDate)
                  }
                }}
              >
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fiadoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={({ x, y, payload }: { x: number; y: number; payload: { value: string; index: number } }) => (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={12} textAnchor="middle" fill="#9ca3af" fontSize={12}>
                        {payload.value}
                      </text>
                      <text x={0} y={0} dy={26} textAnchor="middle" fill="#6b7280" fontSize={10}>
                        {salesTrendData[payload.index]?.fecha}
                      </text>
                    </g>
                  )}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '12px 16px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', marginBottom: '4px' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'ventas') return [formatCOP(value), 'Ventas']
                    if (name === 'fiados') return [formatCOP(value), 'Fiados']
                    return [value, name]
                  }}
                  labelFormatter={(label, payload) => {
                    const item = (payload as any)?.[0]?.payload
                    return item ? `${label} ${item.fecha} — ${item.transacciones} venta(s)` : label
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                  dot={{ fill: '#22c55e', strokeWidth: 2, r: 4, stroke: '#fff' }}
                  activeDot={{ r: 7, fill: '#22c55e', stroke: '#fff', strokeWidth: 3, cursor: 'pointer' }}
                  name="ventas"
                />
                <Area
                  type="monotone"
                  dataKey="fiados"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  fill="url(#fiadoGradient)"
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 3 }}
                  name="fiados"
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={30}
                  formatter={(value) => {
                    const labels: Record<string, string> = { ventas: 'Ventas', fiados: 'Fiados' }
                    return <span style={{ fontSize: 12, color: '#9ca3af' }}>{labels[value] || value}</span>
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  )
}
