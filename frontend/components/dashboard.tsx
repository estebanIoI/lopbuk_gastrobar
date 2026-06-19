'use client'

import React, { useEffect, useState, useRef, useMemo } from "react"

import { useStore, getStockStatus } from '@/lib/store'
import { api } from '@/lib/api'
import { type Sale, type Product } from '@/lib/types'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Package,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  CreditCard,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

function AssistantConnectedBanner() {
  const [on, setOn] = useState(false)
  useEffect(() => { api.getPlatformAssistant().then(r => { if (r.success && r.data?.enabled) setOn(true) }) }, [])
  if (!on) return null
  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-xl">✨</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <p className="font-semibold text-sm">Asistente conectado a tu negocio</p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          El asistente de la plataforma recomienda tus productos a los usuarios según sus objetivos y situación. Mantén tu catálogo publicado y con stock para aparecer.
        </p>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { products, sales, fetchProducts, fetchSales, categories, fetchCategories, navigateToInvoices } = useStore()
  const [accountsReceivable, setAccountsReceivable] = useState(0)
  const [trendRange, setTrendRange] = useState<number>(7)
  const [backendTrend, setBackendTrend] = useState<Array<{ date: string; total: number; count: number; fiadoTotal?: number; fiadoCount?: number }>>([])
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null)
  const chartScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProducts()
    fetchSales()
    fetchCategories()
    fetchAccountsReceivable()
    fetchDashboardMetrics()
  }, [fetchProducts, fetchSales, fetchCategories])

  // Fetch trend data from backend whenever range changes
  useEffect(() => {
    fetchSalesTrend(trendRange)
  }, [trendRange])

  const fetchSalesTrend = async (days: number) => {
    const result = await api.getSalesTrend(days)
    if (result.success && result.data) {
      setBackendTrend(Array.isArray(result.data) ? result.data : [])
    }
  }

  const fetchDashboardMetrics = async () => {
    const result = await api.getDashboardMetrics()
    if (result.success && result.data) {
      setDashboardMetrics(result.data)
    }
  }

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    return cat ? cat.name : categoryId
  }

  const fetchAccountsReceivable = async () => {
    const result = await api.getCreditsSummary()
    if (result.success && result.data) {
      setAccountsReceivable(result.data.totalPending || 0)
    }
  }

  // Calculate metrics - prefer backend data (computed from ALL sales) over client-side (limited to 100)
  const totalProducts = dashboardMetrics?.totalProducts ?? products.length
  const totalInventoryValue = dashboardMetrics?.totalInventoryValue ?? products.reduce((sum, p) => sum + (p.salePrice * p.stock), 0)
  const lowStockProducts = dashboardMetrics?.lowStockProducts ?? products.filter(p => getStockStatus(p) === 'bajo').length
  const outOfStockProducts = dashboardMetrics?.outOfStockProducts ?? products.filter(p => getStockStatus(p) === 'agotado').length

  const completedSales = sales.filter(s => s.status === 'completada')
  const totalSales = dashboardMetrics?.monthlySales ?? completedSales.reduce((sum, s) => sum + s.total, 0)

  // Sales by category - prefer backend data
  const categoryChartData = dashboardMetrics?.salesByCategory
    ? dashboardMetrics.salesByCategory
        .filter((c: any) => c.totalRevenue > 0)
        .map((c: any) => ({ name: getCategoryName(c.category), value: c.totalRevenue }))
    : (() => {
        const salesByCategory = products.reduce((acc, product) => {
          const productSales = completedSales.flatMap(s => s.items)
            .filter(item => item.productId === product.id)
            .reduce((sum, item) => sum + (item.subtotal || item.total || 0), 0)
          const category = getCategoryName(product.category)
          acc[category] = (acc[category] || 0) + productSales
          return acc
        }, {} as Record<string, number>)
        return Object.entries(salesByCategory)
          .filter(([_, value]) => value > 0)
          .map(([name, value]) => ({ name, value }))
      })()

  // Top selling products - prefer backend data
  const topProducts = dashboardMetrics?.topSellingProducts
    ? dashboardMetrics.topSellingProducts
        .filter((p: any) => p.totalSold > 0)
        .map((p: any) => ({ name: p.name.substring(0, 15) + (p.name.length > 15 ? '...' : ''), cantidad: p.totalSold }))
    : (() => {
        const productSalesMap = completedSales.flatMap(s => s.items).reduce((acc, item) => {
          acc[item.productName] = (acc[item.productName] || 0) + item.quantity
          return acc
        }, {} as Record<string, number>)
        return Object.entries(productSalesMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, quantity]) => ({ name: name.substring(0, 15) + '...', cantidad: quantity }))
      })()
  
  // Profit margin per product - cross-references backend revenue data with product cost
  const profitMarginData = useMemo(() => {
    if (dashboardMetrics?.topSellingProducts && products.length > 0) {
      return dashboardMetrics.topSellingProducts
        .filter((tp: any) => tp.totalSold > 0)
        .map((tp: any) => {
          const product = products.find(p => p.id === tp.id)
          const totalCost = product ? tp.totalSold * product.purchasePrice : 0
          const margin = tp.totalRevenue - totalCost
          return {
            name: tp.name.length > 12 ? tp.name.substring(0, 12) + '...' : tp.name,
            fullName: tp.name,
            ingresos: tp.totalRevenue,
            costo: totalCost,
            ganancia: margin,
            margen: tp.totalRevenue > 0 ? Math.round((margin / tp.totalRevenue) * 100) : 0,
          }
        })
    }
    // Fallback: compute from local data
    return products
      .map(product => {
        const soldItems = completedSales.flatMap(s => s.items).filter(item => item.productId === product.id)
        const totalQuantity = soldItems.reduce((sum, item) => sum + item.quantity, 0)
        const totalRevenue = soldItems.reduce((sum, item) => sum + (item.subtotal || 0), 0)
        const totalCost = totalQuantity * product.purchasePrice
        const margin = totalRevenue - totalCost
        return {
          name: product.name.length > 12 ? product.name.substring(0, 12) + '...' : product.name,
          fullName: product.name,
          ingresos: totalRevenue,
          costo: totalCost,
          ganancia: margin,
          margen: totalRevenue > 0 ? Math.round((margin / totalRevenue) * 100) : 0,
        }
      })
      .filter(p => p.ingresos > 0)
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 5)
  }, [dashboardMetrics, products, completedSales])

  // Payment method distribution
  const paymentMethodData = useMemo(() => {
    const methodLabels: Record<string, string> = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
      fiado: 'Fiado',
    }
    const methodMap = sales.reduce((acc, s) => {
      const label = methodLabels[s.paymentMethod] || s.paymentMethod
      if (!acc[label]) acc[label] = { total: 0, count: 0 }
      acc[label].total += s.total
      acc[label].count += 1
      return acc
    }, {} as Record<string, { total: number; count: number }>)
    return Object.entries(methodMap)
      .map(([name, { total, count }]) => ({ name, value: total, count }))
      .sort((a, b) => b.value - a.value)
  }, [sales])

  // Sales trend - uses backend data with all days filled in (including zero-sale days)
  const salesTrendData = useMemo(() => {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const today = new Date()

    const localTrend = () => {
      const map = new Map<string, { total: number; count: number; fiadoTotal: number; fiadoCount: number }>()
      for (const sale of completedSales) {
        const dateKey = sale.createdAt?.split('T')[0]
        if (!dateKey) continue
        const bucket = map.get(dateKey) || { total: 0, count: 0, fiadoTotal: 0, fiadoCount: 0 }
        if (sale.paymentMethod === 'fiado') {
          bucket.fiadoTotal += sale.total
          bucket.fiadoCount += 1
        } else {
          bucket.total += sale.total
          bucket.count += 1
        }
        map.set(dateKey, bucket)
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({ date, ...data }))
    }

    // Fall back to local sales when the backend trend is empty.
    const trendRows = backendTrend.length > 0 ? backendTrend : localTrend()

    // Build a lookup map from backend trend data
    const trendMap = new Map<string, { total: number; count: number; fiadoTotal: number; fiadoCount: number }>()
    for (const row of trendRows) {
      const dateKey = typeof row.date === 'string' ? row.date.split('T')[0] : String(row.date)
      trendMap.set(dateKey, { total: row.total, count: row.count, fiadoTotal: row.fiadoTotal || 0, fiadoCount: row.fiadoCount || 0 })
    }

    // Determine number of days to show
    let numDays: number
    if (trendRange === 0) {
      if (trendRows.length === 0) {
        numDays = 30
      } else {
        const oldest = trendRows[0].date
        const oldestDateStr = typeof oldest === 'string' ? oldest.split('T')[0] : String(oldest)
        const oldestDate = new Date(oldestDateStr + 'T00:00:00')
        numDays = Math.max(Math.ceil((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1, 1)
      }
    } else {
      numDays = trendRange
    }

    // Generate all days in range, filling in zeros for missing days
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
  }, [backendTrend, completedSales, trendRange])

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
  
  // Chart colors
  const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899']
  
  // Low stock items
  const lowStockItems = products
    .filter(p => getStockStatus(p) !== 'suficiente')
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5)
  
  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <AssistantConnectedBanner />
      {/* ========== HERO: Sales Trend Line (Shopify-style) ========== */}
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
                onClick={(chartData) => {
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
                  const item = payload?.[0]?.payload
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

      {/* ========== METRICS CARDS (Indices) ========== */}
      <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-8">
        <MetricCard
          title="Total Productos"
          value={totalProducts.toString()}
          description="En inventario"
          icon={Package}
          trend={null}
        />
        <MetricCard
          title="Valor Inventario"
          value={formatCOP(totalInventoryValue)}
          description="Precio de venta"
          icon={DollarSign}
          trend={null}
        />
        <MetricCard
          title="Ventas del Mes"
          value={formatCOP(totalSales)}
          description={dashboardMetrics ? `Día: ${formatCOP(dashboardMetrics.dailySales)} | Sem: ${formatCOP(dashboardMetrics.weeklySales)}` : `${completedSales.length} transacciones`}
          icon={ShoppingBag}
          trend={null}
        />
        <MetricCard
          title="Por Cobrar (Fiados)"
          value={formatCOP(accountsReceivable)}
          description="Créditos pendientes"
          icon={CreditCard}
          trend={null}
          variant={accountsReceivable > 0 ? "warning" : undefined}
        />
        <MetricCard
          title="Alertas Stock"
          value={(lowStockProducts + outOfStockProducts).toString()}
          description={`${outOfStockProducts} agotados, ${lowStockProducts} bajos`}
          icon={AlertTriangle}
          trend={null}
          variant="warning"
        />
      </div>

      {/* ========== CHARTS ROW: Top Products + Profit Margin ========== */}
      <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-2">
        {/* Top Products Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base lg:text-lg font-medium">Productos Más Vendidos</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Top 5 por cantidad vendida</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-[200px] sm:h-[280px] lg:h-[320px] xl:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="cantidad" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Profit Margin Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base lg:text-lg font-medium">Margen de Ganancia</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Ingresos vs Costo — Top 5 productos</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-[200px] sm:h-[280px] lg:h-[320px] xl:h-[360px]">
              {profitMarginData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">No hay datos de ventas aún</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitMarginData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      type="number"
                      stroke="#9ca3af"
                      fontSize={11}
                      tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                    />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={90} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        padding: '12px 16px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', marginBottom: '4px' }}
                      labelFormatter={(_, payload) => {
                        const item = payload?.[0]?.payload
                        return item ? `${item.fullName} — Margen: ${item.margen}%` : ''
                      }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = { ingresos: 'Ingresos', costo: 'Costo' }
                        return [formatCOP(value), labels[name] || name]
                      }}
                    />
                    <Legend
                      formatter={(value) => {
                        const labels: Record<string, string> = { ingresos: 'Ingresos', costo: 'Costo' }
                        return <span className="text-xs text-muted-foreground">{labels[value] || value}</span>
                      }}
                    />
                    <Bar dataKey="ingresos" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="costo" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== ROW: Category + Payment Method + Low Stock ========== */}
      <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-2 xl:grid-cols-4">
        {/* Sales by Category */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base lg:text-lg font-medium">Ventas por Categoría</CardTitle>
            <CardDescription>Distribución de ingresos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] lg:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryChartData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCOP(value), '']}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Distribution */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base lg:text-lg font-medium">Métodos de Pago</CardTitle>
            <CardDescription>Distribución por forma de pago</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] lg:h-[280px]">
              {paymentMethodData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">No hay datos de ventas aún</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {paymentMethodData.map((_: any, index: number) => (
                        <Cell key={`pm-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, _: string, props: any) => {
                        return [formatCOP(value), `${props.payload.count} venta(s)`]
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className="border-border bg-card xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base lg:text-lg font-medium">Alertas de Reabastecimiento</CardTitle>
            <CardDescription>Productos que necesitan atención</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No hay productos con stock bajo
                </p>
              ) : (
                lowStockItems.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3 lg:p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        product.stock === 0 ? 'bg-destructive' : 'bg-warning'
                      }`} />
                      <div>
                        <p className="text-sm lg:text-base font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {product.sku} | {getCategoryName(product.category)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm lg:text-base font-semibold ${
                        product.stock === 0 ? 'text-destructive' : 'text-warning'
                      }`}>
                        {product.stock} unidades
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mínimo: {product.reorderPoint}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base lg:text-lg font-medium">Ventas Recientes</CardTitle>
          <CardDescription>Últimas transacciones realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {completedSales.slice(0, 5).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 lg:p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-lg bg-primary/10">
                    <ShoppingBag className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm lg:text-base font-medium text-foreground">{sale.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.items.length} producto(s) | {sale.paymentMethod}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm lg:text-base font-semibold text-primary">
                    {formatCOP(sale.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sale.createdAt).toLocaleDateString('es-CO')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string
  description: string
  icon: React.ElementType
  trend: { value: number; positive: boolean } | null
  variant?: 'default' | 'warning'
}

function MetricCard({ title, value, description, icon: _icon, trend, variant = 'default' }: MetricCardProps) {
  const Icon = _icon as React.ComponentType<{ className?: string }>
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
            <p className={`text-base sm:text-lg lg:text-xl font-bold break-all leading-tight ${
              variant === 'warning' ? 'text-warning' : 'text-foreground'
            }`}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          </div>
          <div className={`rounded-lg p-2 flex-shrink-0 ${
            variant === 'warning' ? 'bg-warning/10' : 'bg-primary/10'
          }`}>
            <Icon className={`h-5 w-5 lg:h-6 lg:w-6 ${
              variant === 'warning' ? 'text-warning' : 'text-primary'
            }`} />
          </div>
        </div>
        {trend && (
          <div className={`mt-2 flex items-center gap-1 text-xs ${
            trend.positive ? 'text-primary' : 'text-destructive'
          }`}>
            {trend.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trend.value}% vs mes anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
