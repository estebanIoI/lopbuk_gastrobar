'use client'

import React, { useEffect, useState } from "react"
import { useStore, getStockStatus } from '@/lib/store'
import { type Product } from '@/lib/types'
import { formatCOP } from '@/lib/utils'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccountingReport } from '@/components/accounting-report'
import {
  Percent,
  TrendingUp,
  RotateCcw,
  CreditCard,
  PackageX,
  BarChart3,
  PiggyBank,
  Target,
  FileSpreadsheet
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts'

export function Analytics() {
  const { products, sales, fetchProducts, fetchSales, categories, fetchCategories } = useStore()
  const [monthlySalesData, setMonthlySalesData] = useState<Array<{ mes: string; ventas: number; gastos: number }>>([])

  useEffect(() => {
    fetchProducts()
    fetchSales()
    fetchCategories()
    // Fetch real monthly revenue vs costs data
    api.getMonthlyRevenueCosts(6).then(res => {
      if (res.success && res.data) {
        setMonthlySalesData(res.data.map(d => ({
          mes: d.month,
          ventas: d.revenue,
          gastos: d.costs,
        })))
      }
    }).catch(() => {})
  }, [fetchProducts, fetchSales, fetchCategories])

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    return cat ? cat.name : categoryId
  }

  const completedSales = sales.filter(s => s.status === 'completada')

  // Cálculos de Rentabilidad
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0)
  const totalCost = completedSales.flatMap(s => s.items).reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId)
    return sum + (product ? product.purchasePrice * item.quantity : 0)
  }, 0)
  const grossProfit = totalRevenue - totalCost
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  // Valor del inventario (costo vs venta)
  const inventoryCost = products.reduce((sum, p) => sum + (p.purchasePrice * p.stock), 0)
  const inventoryValue = products.reduce((sum, p) => sum + (p.salePrice * p.stock), 0)
  const potentialProfit = inventoryValue - inventoryCost

  // ROI del inventario
  const roi = inventoryCost > 0 ? ((potentialProfit / inventoryCost) * 100) : 0

  // Ticket promedio
  const avgTicket = completedSales.length > 0 ? totalRevenue / completedSales.length : 0

  // Análisis por método de pago
  const paymentMethodData = completedSales.reduce((acc, sale) => {
    const method = sale.paymentMethod === 'efectivo' ? 'Efectivo' :
                   sale.paymentMethod === 'tarjeta' ? 'Tarjeta' : 'Transferencia'
    acc[method] = (acc[method] || 0) + sale.total
    return acc
  }, {} as Record<string, number>)

  const paymentChartData = Object.entries(paymentMethodData).map(([name, value]) => ({ name, value }))

  // Margen por categoría
  const marginByCategory = products.reduce((acc, product) => {
    const category = getCategoryName(product.category)
    const margin = ((product.salePrice - product.purchasePrice) / product.salePrice) * 100

    if (!acc[category]) {
      acc[category] = { totalMargin: 0, count: 0 }
    }
    acc[category].totalMargin += margin
    acc[category].count += 1
    return acc
  }, {} as Record<string, { totalMargin: number, count: number }>)

  const categoryMarginData = Object.entries(marginByCategory)
    .map(([name, data]) => ({
      name: name.length > 12 ? name.substring(0, 12) + '...' : name,
      margen: Math.round(data.totalMargin / data.count)
    }))
    .sort((a, b) => b.margen - a.margen)

  // monthlySalesData se obtiene del backend (ver useEffect)

  // Productos sin movimiento (stock > 0 pero sin ventas)
  const productSalesCount = completedSales.flatMap(s => s.items).reduce((acc, item) => {
    acc[item.productId] = (acc[item.productId] || 0) + item.quantity
    return acc
  }, {} as Record<string, number>)

  const slowMovingProducts = products
    .filter(p => p.stock > 0 && !productSalesCount[p.id])
    .slice(0, 5)

  // Rotación de inventario por categoría
  const rotationByCategory = categories.map((cat) => {
    const categoryProducts = products.filter(p => p.category === cat.id)
    const totalStock = categoryProducts.reduce((sum, p) => sum + p.stock, 0)
    const totalSold = completedSales.flatMap(s => s.items)
      .filter(item => categoryProducts.some(p => p.id === item.productId))
      .reduce((sum, item) => sum + item.quantity, 0)

    const rotation = totalStock > 0 ? (totalSold / totalStock) * 100 : 0
    return { name: cat.name.length > 10 ? cat.name.substring(0, 10) + '...' : cat.name, rotacion: Math.round(rotation) }
  }).filter(item => item.rotacion > 0).sort((a, b) => b.rotacion - a.rotacion)

  const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899']

  return (
    <Tabs defaultValue="charts" className="space-y-4">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="charts" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Gráficos
        </TabsTrigger>
        <TabsTrigger value="reports" className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Reportes DIAN
        </TabsTrigger>
      </TabsList>

      <TabsContent value="charts">
    <div className="space-y-6">
      {/* Métricas de Rentabilidad */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnalyticsCard
          title="Margen Bruto"
          value={`${profitMargin.toFixed(1)}%`}
          description={`Ganancia: ${formatCOP(grossProfit)}`}
          icon={Percent}
          color="green"
        />
        <AnalyticsCard
          title="ROI Inventario"
          value={`${roi.toFixed(1)}%`}
          description={`Ganancia potencial: ${formatCOP(potentialProfit)}`}
          icon={TrendingUp}
          color="blue"
        />
        <AnalyticsCard
          title="Ticket Promedio"
          value={formatCOP(avgTicket)}
          description={`${completedSales.length} transacciones`}
          icon={Target}
          color="purple"
        />
        <AnalyticsCard
          title="Costo Inventario"
          value={formatCOP(inventoryCost)}
          description={`Valor venta: ${formatCOP(inventoryValue)}`}
          icon={PiggyBank}
          color="amber"
        />
      </div>

      {/* Gráficos principales */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tendencia de Ingresos vs Gastos */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Ingresos vs Costos</CardTitle>
            <CardDescription>Comparativa mensual (últimos 6 meses)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="mes" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value: number, name: string) => [formatCOP(value), name === 'ventas' ? 'Ingresos' : 'Costos']}
                  />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="gastos"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-muted-foreground">{value === 'ventas' ? 'Ingresos' : 'Costos'}</span>}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Margen por Categoría */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Margen por Categoría</CardTitle>
            <CardDescription>Porcentaje de ganancia promedio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryMarginData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={90} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value: number) => [`${value}%`, 'Margen']}
                  />
                  <Bar dataKey="margen" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fila inferior */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Métodos de Pago */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Métodos de Pago</CardTitle>
            <CardDescription>Distribución de ventas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {paymentChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
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

        {/* Rotación de Inventario */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Rotación de Inventario
            </CardTitle>
            <CardDescription>Por categoría (% vendido vs stock)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rotationByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Sin datos de rotación
                </p>
              ) : (
                rotationByCategory.slice(0, 5).map((item, index) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{item.name}</span>
                      <span className="text-muted-foreground">{item.rotacion}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(item.rotacion, 100)}%`,
                          backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Productos Estancados */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <PackageX className="h-4 w-4" />
              Productos Sin Movimiento
            </CardTitle>
            <CardDescription>En stock pero sin ventas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {slowMovingProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Todos los productos tienen movimiento
                </p>
              ) : (
                slowMovingProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getCategoryName(product.category)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-500">
                        {product.stock} uds
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCOP(product.salePrice * product.stock)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
      </TabsContent>

      <TabsContent value="reports">
        <AccountingReport />
      </TabsContent>
    </Tabs>
  )
}

interface AnalyticsCardProps {
  title: string
  value: string
  description: string
  icon: React.ElementType
  color: 'green' | 'blue' | 'purple' | 'amber'
}

function AnalyticsCard({ title, value, description, icon: _icon, color }: AnalyticsCardProps) {
  const Icon = _icon as React.ComponentType<{ className?: string }>
  const colorClasses = {
    green: { bg: 'bg-green-500/10', text: 'text-green-500' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' }
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${colorClasses[color].text}`}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={`rounded-lg p-2 ${colorClasses[color].bg}`}>
            <Icon className={`h-5 w-5 ${colorClasses[color].text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
