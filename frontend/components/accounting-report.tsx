'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { formatCOP, formatNumber } from '@/lib/utils'
import type { Sale, Product, CustomerFull, CashSession, CreditDetail } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Building2,
  Receipt,
  BookOpen,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Scale,
  Landmark,
  ClipboardList,
  Calculator,
  Shield,
  Vault,
  ArrowUpCircle,
  ArrowDownCircle,
  Banknote,
  MinusCircle,
  PlusCircle,
} from 'lucide-react'

// ====================================
// CONSTANTES TRIBUTARIAS COLOMBIA
// ====================================
const IVA_GENERAL = 0.19 // 19% Tarifa general
const RETEFUENTE_COMPRAS = 0.025 // 2.5% Retención en la fuente compras
const RETEIVA_RATE = 0.15 // 15% del IVA
const UVT_2026 = 49799 // Valor UVT estimado 2026 (actualizar según DIAN)

// Helpers
function getMonthName(month: number): string {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return months[month] || ''
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ====================================
// COMPONENTE PRINCIPAL
// ====================================
export function AccountingReport() {
  const { products, sales, fetchProducts, fetchSales, storeInfo, categories, fetchCategories } = useStore()
  const { user } = useAuthStore()

  // Periodo de reporte
  const now = new Date()
  const [reportMonth, setReportMonth] = useState(now.getMonth())
  const [reportYear, setReportYear] = useState(now.getFullYear())
  const [activeReport, setActiveReport] = useState<string>('libro-ventas')
  const [customers, setCustomers] = useState<CustomerFull[]>([])
  const [credits, setCredits] = useState<CreditDetail[]>([])
  const [cashSessions, setCashSessions] = useState<CashSession[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProducts()
    fetchSales()
    fetchCategories()
    loadCustomers()
    loadCredits()
    loadCashSessions()
  }, [fetchProducts, fetchSales, fetchCategories])

  const loadCustomers = async () => {
    const res = await api.getCustomers({ limit: 1000 })
    if (res.success && res.data) {
      setCustomers((res.data as any).customers || [])
    }
  }

  const loadCredits = async () => {
    const res = await api.getPendingCredits({ limit: 1000 })
    if (res.success && res.data) {
      setCredits((res.data as any).credits || (res.data as any) || [])
    }
  }

  const loadCashSessions = async () => {
    const res = await api.getCashSessions({ limit: 100 })
    if (res.success && res.data) {
      setCashSessions(res.data || [])
    }
  }

  // ====================================
  // FILTRADO POR PERIODO
  // ====================================
  const periodSales = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.createdAt)
      return d.getMonth() === reportMonth && d.getFullYear() === reportYear
    })
  }, [sales, reportMonth, reportYear])

  const completedSales = useMemo(() =>
    periodSales.filter(s => s.status === 'completada'), [periodSales])

  const cancelledSales = useMemo(() =>
    periodSales.filter(s => s.status === 'anulada'), [periodSales])

  // ====================================
  // CÁLCULOS CONTABLES
  // ====================================

  // Totales de ventas del periodo
  const totalSubtotal = completedSales.reduce((sum, s) => sum + s.subtotal, 0)
  const totalIVA = completedSales.reduce((sum, s) => sum + s.tax, 0)
  const totalDescuentos = completedSales.reduce((sum, s) => sum + s.discount, 0)
  const totalVentas = completedSales.reduce((sum, s) => sum + s.total, 0)

  // Costo de mercancía vendida (CMV) / COGS
  const costoMercancia = useMemo(() => {
    return completedSales.flatMap(s => s.items).reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId)
      return sum + (product ? product.purchasePrice * item.quantity : item.unitPrice * item.quantity * 0.6)
    }, 0)
  }, [completedSales, products])

  // Utilidad bruta
  const utilidadBruta = totalSubtotal - costoMercancia

  // Margen bruto
  const margenBruto = totalSubtotal > 0 ? (utilidadBruta / totalSubtotal) * 100 : 0

  // Unidades vendidas
  const totalUnidadesVendidas = completedSales.flatMap(s => s.items).reduce((sum, item) => sum + item.quantity, 0)

  // Ventas por método de pago
  const ventasPorMetodo = useMemo(() => {
    const acc: Record<string, { count: number; total: number }> = {}
    completedSales.forEach(s => {
      const method = s.paymentMethod
      if (!acc[method]) acc[method] = { count: 0, total: 0 }
      acc[method].count++
      acc[method].total += s.total
    })
    return acc
  }, [completedSales])

  // Valor inventario
  const inventarioCosto = products.reduce((sum, p) => sum + (p.purchasePrice * p.stock), 0)
  const inventarioVenta = products.reduce((sum, p) => sum + (p.salePrice * p.stock), 0)
  const totalUnidadesInventario = products.reduce((sum, p) => sum + p.stock, 0)

  // Retención en la fuente estimada (ventas > 27 UVT)
  const umbralRetefuente = 27 * UVT_2026
  const ventasConRetencion = completedSales.filter(s => s.total >= umbralRetefuente)
  const retefuenteEstimada = ventasConRetencion.reduce((sum, s) => sum + (s.subtotal * RETEFUENTE_COMPRAS), 0)

  // ReteIVA estimado
  const reteIVAEstimado = ventasConRetencion.reduce((sum, s) => sum + (s.tax * RETEIVA_RATE), 0)

  // Cuentas por cobrar — usa datos reales de créditos con abonos parciales
  const cuentasPorCobrar = useMemo(() => {
    return completedSales
      .filter(s => s.paymentMethod === 'fiado' && s.creditStatus !== 'pagado')
      .map(s => {
        const creditInfo = credits.find((c: any) => (c.sale?.id || c.saleId) === s.id)
        const paidAmount = creditInfo?.paidAmount ?? 0
        const remainingBalance = creditInfo?.remainingBalance ?? s.total
        return {
          ...s,
          paidAmount,
          saldoPendiente: remainingBalance,
        }
      })
  }, [completedSales, credits])

  const totalCartera = cuentasPorCobrar.reduce((sum, s) => sum + s.saldoPendiente, 0)

  // Sesiones de caja del periodo
  const periodCashSessions = useMemo(() => {
    return cashSessions.filter(cs => {
      const d = new Date(cs.openedAt)
      return d.getMonth() === reportMonth && d.getFullYear() === reportYear
    })
  }, [cashSessions, reportMonth, reportYear])

  const closedPeriodSessions = periodCashSessions.filter(cs => cs.status === 'cerrada')
  const totalSesiones = periodCashSessions.length
  const sesionesConDiferencia = closedPeriodSessions.filter(cs => cs.closingStatus !== 'cuadrado')
  const totalDiferencias = closedPeriodSessions.reduce((sum, cs) => sum + (cs.difference ?? 0), 0)

  // Inventario por categoría
  const inventarioPorCategoria = useMemo(() => {
    const acc: Record<string, { unidades: number; costo: number; venta: number; items: number }> = {}
    products.forEach(p => {
      const catName = categories.find(c => c.id === p.category)?.name || p.category
      if (!acc[catName]) acc[catName] = { unidades: 0, costo: 0, venta: 0, items: 0 }
      acc[catName].unidades += p.stock
      acc[catName].costo += p.purchasePrice * p.stock
      acc[catName].venta += p.salePrice * p.stock
      acc[catName].items++
    })
    return Object.entries(acc).sort((a, b) => b[1].costo - a[1].costo)
  }, [products, categories])

  // Top vendidos del periodo
  const topVendidos = useMemo(() => {
    const acc: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {}
    completedSales.flatMap(s => s.items).forEach(item => {
      if (!acc[item.productId]) {
        const product = products.find(p => p.id === item.productId)
        acc[item.productId] = {
          name: item.productName,
          qty: 0,
          revenue: 0,
          cost: product ? product.purchasePrice : 0
        }
      }
      acc[item.productId].qty += item.quantity
      acc[item.productId].revenue += (item.subtotal || item.unitPrice * item.quantity)
    })
    return Object.entries(acc)
      .map(([id, data]) => ({ id, ...data, totalCost: data.cost * data.qty, profit: data.revenue - (data.cost * data.qty) }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [completedSales, products])

  // ====================================
  // EXPORTAR CSV
  // ====================================
  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return
    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = row[h]
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`
        return val
      }).join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}_${reportYear}_${String(reportMonth + 1).padStart(2, '0')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportLibroVentas = () => {
    const data = completedSales.map(s => ({
      'No. Factura': s.invoiceNumber,
      'Fecha': formatDate(s.createdAt),
      'Cliente': s.customerName || 'Consumidor Final',
      'Cédula/NIT': '',
      'Base Gravable': Math.round(s.subtotal),
      'IVA 19%': Math.round(s.tax),
      'Descuento': Math.round(s.discount),
      'Total': Math.round(s.total),
      'Método Pago': s.paymentMethod,
      'Estado': s.status,
      'Vendedor': s.sellerName || '',
    }))
    exportCSV(data, 'Libro_Ventas_DIAN')
  }

  const exportInventario = () => {
    const data = products.map(p => ({
      'SKU': p.sku,
      'Código Barras': p.barcode || '',
      'Producto': p.name,
      'Categoría': categories.find(c => c.id === p.category)?.name || p.category,
      'Tipo': p.productType,
      'Stock': p.stock,
      'Costo Unitario': p.purchasePrice,
      'Precio Venta': p.salePrice,
      'Valor Costo Total': p.purchasePrice * p.stock,
      'Valor Venta Total': p.salePrice * p.stock,
      'Margen %': p.salePrice > 0 ? Math.round(((p.salePrice - p.purchasePrice) / p.salePrice) * 100) : 0,
      'Proveedor': p.supplier || '',
      'Fecha Ingreso': p.entryDate,
    }))
    exportCSV(data, 'Inventario_Valorizado')
  }

  const exportEstadoResultados = () => {
    const data = [
      { 'Concepto': 'INGRESOS OPERACIONALES', 'Valor': '' },
      { 'Concepto': 'Ventas Brutas', 'Valor': Math.round(totalSubtotal + totalIVA) },
      { 'Concepto': '(-) Devoluciones/Anulaciones', 'Valor': -Math.round(cancelledSales.reduce((s, v) => s + v.total, 0)) },
      { 'Concepto': '(-) Descuentos', 'Valor': -Math.round(totalDescuentos) },
      { 'Concepto': 'Ventas Netas', 'Valor': Math.round(totalVentas) },
      { 'Concepto': '(-) IVA Generado', 'Valor': -Math.round(totalIVA) },
      { 'Concepto': 'Ingresos Netos (Base Gravable)', 'Valor': Math.round(totalSubtotal) },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'COSTO DE VENTAS', 'Valor': '' },
      { 'Concepto': 'Costo Mercancía Vendida (CMV)', 'Valor': -Math.round(costoMercancia) },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': 'UTILIDAD BRUTA', 'Valor': Math.round(utilidadBruta) },
      { 'Concepto': 'Margen Bruto %', 'Valor': `${margenBruto.toFixed(1)}%` },
    ]
    exportCSV(data, 'Estado_Resultados')
  }

  // ====================================
  // IMPRIMIR
  // ====================================
  const handlePrint = () => {
    window.print()
  }

  // ====================================
  // REPORTES
  // ====================================
  const reportTypes = [
    { id: 'libro-ventas', name: 'Libro de Ventas', icon: BookOpen, desc: 'Registro de facturas - Art. 772 ET' },
    { id: 'iva', name: 'Informe IVA', icon: Landmark, desc: 'Declaración IVA - Formulario 300' },
    { id: 'estado-resultados', name: 'Estado de Resultados', icon: TrendingUp, desc: 'P&G del periodo - NIC/NIIF' },
    { id: 'inventario', name: 'Inventario Valorizado', icon: Package, desc: 'Kardex valorizado - Art. 62 ET' },
    { id: 'cartera', name: 'Cuentas por Cobrar', icon: Users, desc: 'Cartera - Info exógena 1008/1009' },
    { id: 'conciliacion-caja', name: 'Conciliación de Caja', icon: Vault, desc: 'Cierre de caja y cuadre de efectivo' },
    { id: 'medios-pago', name: 'Medios de Pago', icon: DollarSign, desc: 'Conciliación por método de pago' },
    { id: 'retenciones', name: 'Retenciones', icon: Scale, desc: 'ReteFuente / ReteIVA estimado' },
    { id: 'resumen-ejecutivo', name: 'Resumen Ejecutivo', icon: ClipboardList, desc: 'Resumen completo para contador' },
  ]

  const periodLabel = `${getMonthName(reportMonth)} ${reportYear}`

  return (
    <div className="space-y-4">
      {/* Header del Reporte */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            Reportes Contables DIAN
          </h2>
          <p className="text-sm text-muted-foreground">
            Informes según normativa colombiana (Estatuto Tributario, NIIF para PyMEs)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Selector de Periodo */}
      <Card variant="glass" className="border-glass-border print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Período:</Label>
            </div>
            <Select value={String(reportMonth)} onValueChange={(v) => setReportMonth(Number(v))}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>{getMonthName(i)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(reportYear)} onValueChange={(v) => setReportYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-emerald-600 border-emerald-600">
              {completedSales.length} ventas | {cancelledSales.length} anuladas
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Navegación de Reportes */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {reportTypes.map(report => (
          <Button
            key={report.id}
            variant={activeReport === report.id ? 'default' : 'outline'}
            size="sm"
            className={activeReport === report.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            onClick={() => setActiveReport(report.id)}
          >
            <report.icon className="h-4 w-4 mr-1" />
            {report.name}
          </Button>
        ))}
      </div>

      {/* Contenido del Reporte */}
      <div ref={printRef} className="print:p-4">
        {/* Encabezado para impresión */}
        <div className="hidden print:block mb-6 border-b-2 border-black pb-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{storeInfo.name || 'Daimuz'}</h1>
            <p className="text-sm">{storeInfo.address}</p>
            <p className="text-sm">NIT: {storeInfo.taxId || 'No configurado'} | Tel: {storeInfo.phone}</p>
            <p className="text-sm">{storeInfo.email}</p>
            <hr className="my-2" />
            <h2 className="text-lg font-semibold mt-2">
              {reportTypes.find(r => r.id === activeReport)?.name} — {periodLabel}
            </h2>
            <p className="text-xs text-gray-600">Generado: {new Date().toLocaleDateString('es-CO')} | Usuario: {user?.name}</p>
          </div>
        </div>

        {activeReport === 'libro-ventas' && (
          <LibroVentas
            sales={completedSales}
            cancelledSales={cancelledSales}
            periodLabel={periodLabel}
            storeInfo={storeInfo}
            onExport={exportLibroVentas}
          />
        )}

        {activeReport === 'iva' && (
          <InformeIVA
            totalSubtotal={totalSubtotal}
            totalIVA={totalIVA}
            totalDescuentos={totalDescuentos}
            totalVentas={totalVentas}
            cancelledSales={cancelledSales}
            completedSales={completedSales}
            periodLabel={periodLabel}
          />
        )}

        {activeReport === 'estado-resultados' && (
          <EstadoResultados
            totalSubtotal={totalSubtotal}
            totalIVA={totalIVA}
            totalDescuentos={totalDescuentos}
            totalVentas={totalVentas}
            costoMercancia={costoMercancia}
            utilidadBruta={utilidadBruta}
            margenBruto={margenBruto}
            cancelledSales={cancelledSales}
            completedSales={completedSales}
            onExport={exportEstadoResultados}
            periodLabel={periodLabel}
          />
        )}

        {activeReport === 'inventario' && (
          <InventarioValorizado
            products={products}
            categories={categories}
            inventarioPorCategoria={inventarioPorCategoria}
            inventarioCosto={inventarioCosto}
            inventarioVenta={inventarioVenta}
            totalUnidades={totalUnidadesInventario}
            onExport={exportInventario}
            periodLabel={periodLabel}
          />
        )}

        {activeReport === 'cartera' && (
          <CuentasPorCobrar
            cuentasPorCobrar={cuentasPorCobrar}
            totalCartera={totalCartera}
            periodLabel={periodLabel}
          />
        )}

        {activeReport === 'conciliacion-caja' && (
          <ConciliacionCaja
            sessions={periodCashSessions}
            closedSessions={closedPeriodSessions}
            totalSesiones={totalSesiones}
            sesionesConDiferencia={sesionesConDiferencia}
            totalDiferencias={totalDiferencias}
            periodLabel={periodLabel}
          />
        )}

        {activeReport === 'medios-pago' && (
          <MediosDePago
            ventasPorMetodo={ventasPorMetodo}
            totalVentas={totalVentas}
            completedSales={completedSales}
            periodLabel={periodLabel}
            closedSessions={closedPeriodSessions}
          />
        )}

        {activeReport === 'retenciones' && (
          <InformeRetenciones
            ventasConRetencion={ventasConRetencion}
            retefuenteEstimada={retefuenteEstimada}
            reteIVAEstimado={reteIVAEstimado}
            totalVentas={totalVentas}
            totalIVA={totalIVA}
            umbralRetefuente={umbralRetefuente}
            periodLabel={periodLabel}
          />
        )}

        {activeReport === 'resumen-ejecutivo' && (
          <ResumenEjecutivo
            periodLabel={periodLabel}
            storeInfo={storeInfo}
            completedSales={completedSales}
            cancelledSales={cancelledSales}
            totalSubtotal={totalSubtotal}
            totalIVA={totalIVA}
            totalDescuentos={totalDescuentos}
            totalVentas={totalVentas}
            costoMercancia={costoMercancia}
            utilidadBruta={utilidadBruta}
            margenBruto={margenBruto}
            totalUnidadesVendidas={totalUnidadesVendidas}
            ventasPorMetodo={ventasPorMetodo}
            inventarioCosto={inventarioCosto}
            inventarioVenta={inventarioVenta}
            totalUnidadesInventario={totalUnidadesInventario}
            totalCartera={totalCartera}
            retefuenteEstimada={retefuenteEstimada}
            reteIVAEstimado={reteIVAEstimado}
            topVendidos={topVendidos}
            user={user}
            closedSessions={closedPeriodSessions}
            totalDiferencias={totalDiferencias}
          />
        )}
      </div>
    </div>
  )
}

// =====================================
// 1. LIBRO DE VENTAS
// Art. 772 Estatuto Tributario
// =====================================
function LibroVentas({ sales, cancelledSales, periodLabel, storeInfo, onExport }: {
  sales: Sale[]
  cancelledSales: Sale[]
  periodLabel: string
  storeInfo: any
  onExport: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Libro de Ventas — {periodLabel}
          </h3>
          <p className="text-xs text-muted-foreground">
            Art. 772 ET — Obligados a llevar contabilidad deben registrar el libro de ventas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} className="print:hidden">
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      <Card variant="glass" className="border-glass-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table variant="glass">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">No. Factura</TableHead>
                <TableHead className="text-xs font-semibold">Fecha</TableHead>
                <TableHead className="text-xs font-semibold">Cliente</TableHead>
                <TableHead className="text-xs font-semibold text-right">Base Gravable</TableHead>
                <TableHead className="text-xs font-semibold text-right">IVA 19%</TableHead>
                <TableHead className="text-xs font-semibold text-right">Descuento</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                <TableHead className="text-xs font-semibold">Método</TableHead>
                <TableHead className="text-xs font-semibold">Vendedor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No hay ventas en este periodo
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sales.map(sale => (
                    <TableRow key={sale.id} className="text-xs">
                      <TableCell className="font-mono font-medium">{sale.invoiceNumber}</TableCell>
                      <TableCell>{formatDate(sale.createdAt)}</TableCell>
                      <TableCell>{sale.customerName || 'Consumidor Final'}</TableCell>
                      <TableCell className="text-right">{formatCOP(sale.subtotal)}</TableCell>
                      <TableCell className="text-right">{formatCOP(sale.tax)}</TableCell>
                      <TableCell className="text-right">{sale.discount > 0 ? formatCOP(sale.discount) : '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCOP(sale.total)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {sale.paymentMethod === 'efectivo' ? '💵 Efectivo' :
                           sale.paymentMethod === 'tarjeta' ? '💳 Tarjeta' :
                           sale.paymentMethod === 'transferencia' ? '🏦 Transfer.' : '📋 Fiado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{sale.sellerName || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totales */}
                  <TableRow className="bg-muted/50 font-semibold border-t-2">
                    <TableCell colSpan={3} className="text-sm">TOTALES PERIODO</TableCell>
                    <TableCell className="text-right text-sm">{formatCOP(sales.reduce((s, v) => s + v.subtotal, 0))}</TableCell>
                    <TableCell className="text-right text-sm">{formatCOP(sales.reduce((s, v) => s + v.tax, 0))}</TableCell>
                    <TableCell className="text-right text-sm">{formatCOP(sales.reduce((s, v) => s + v.discount, 0))}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600">{formatCOP(sales.reduce((s, v) => s + v.total, 0))}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Facturas Anuladas */}
      {cancelledSales.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Facturas Anuladas — {cancelledSales.length} documento(s)
            </CardTitle>
            <CardDescription>Según Art. 617 ET, las facturas anuladas deben conservarse</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table variant="glass">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Factura</TableHead>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cancelledSales.map(s => (
                    <TableRow key={s.id} className="text-xs text-red-400">
                      <TableCell className="font-mono">{s.invoiceNumber}</TableCell>
                      <TableCell>{formatDate(s.createdAt)}</TableCell>
                      <TableCell className="text-right">{formatCOP(s.total)}</TableCell>
                      <TableCell>{s.notes || 'Anulación'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nota legal */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border print:border-black">
        <p className="font-semibold mb-1">📌 Notas para el Contador:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Libro de ventas según Art. 772 del Estatuto Tributario</li>
          <li>Numeración consecutiva de facturas conforme a Resolución de facturación DIAN</li>
          <li>Base gravable = Subtotal antes de IVA | IVA tarifa general 19%</li>
          <li>Las facturas anuladas se conservan y NO se reutiliza su numeración (Art. 617 ET)</li>
          <li>Exportar para formato 1001 (Info. Exógena) - pagos a terceros</li>
        </ul>
      </div>
    </div>
  )
}

// =====================================
// 2. INFORME IVA - Formulario 300
// =====================================
function InformeIVA({ totalSubtotal, totalIVA, totalDescuentos, totalVentas, cancelledSales, completedSales, periodLabel }: {
  totalSubtotal: number
  totalIVA: number
  totalDescuentos: number
  totalVentas: number
  cancelledSales: Sale[]
  completedSales: Sale[]
  periodLabel: string
}) {
  const ivaAnulaciones = cancelledSales.reduce((s, v) => s + v.tax, 0)
  const ivaNetoPagar = totalIVA - ivaAnulaciones

  // Bimestre
  const bimestres = ['Ene-Feb', 'Mar-Abr', 'May-Jun', 'Jul-Ago', 'Sep-Oct', 'Nov-Dic']

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Landmark className="h-5 w-5 text-violet-500" />
          Informe de IVA — {periodLabel}
        </h3>
        <p className="text-xs text-muted-foreground">
          Datos para Formulario 300 DIAN — Declaración bimestral/cuatrimestral de IVA
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* IVA Generado (Ventas) */}
        <Card variant="glass" className="border-glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-500" />
              IVA Generado (Ventas)
            </CardTitle>
            <CardDescription>Renglón 27-29 del Formulario 300</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Ingresos brutos gravados (tarifa 19%)</span>
                <span className="font-medium">{formatCOP(totalSubtotal)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">(-) Devoluciones en ventas</span>
                <span className="font-medium text-red-500">{formatCOP(cancelledSales.reduce((s, v) => s + v.subtotal, 0))}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">(-) Descuentos</span>
                <span className="font-medium text-red-500">{formatCOP(totalDescuentos)}</span>
              </div>
              <div className="flex justify-between py-1 border-b-2 border-emerald-500">
                <span className="font-semibold">Base gravable neta</span>
                <span className="font-bold text-emerald-600">{formatCOP(totalSubtotal - cancelledSales.reduce((s, v) => s + v.subtotal, 0) - totalDescuentos)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">IVA generado (19%)</span>
                <span className="font-bold text-lg text-emerald-600">{formatCOP(totalIVA)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen IVA */}
        <Card variant="glass" className="border-glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4 text-blue-500" />
              Liquidación IVA del Periodo
            </CardTitle>
            <CardDescription>Saldo a pagar estimado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Total IVA generado</span>
                <span className="font-medium">{formatCOP(totalIVA)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">(-) IVA facturas anuladas</span>
                <span className="font-medium text-red-500">{formatCOP(ivaAnulaciones)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">(-) IVA descontable (compras)*</span>
                <span className="font-medium text-amber-500">Pendiente del contador</span>
              </div>
              <div className="flex justify-between py-2 bg-emerald-500/10 rounded-lg px-3 border border-emerald-500/30">
                <span className="font-semibold">Saldo IVA a pagar (estimado)</span>
                <span className="font-bold text-lg text-emerald-600">{formatCOP(ivaNetoPagar)}</span>
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              * El IVA descontable por compras debe ser registrado por el contador con los soportes de compra
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla desglose por tarifa */}
      <Card variant="glass" className="border-glass-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Desglose por Tarifa de IVA</CardTitle>
          <CardDescription>Art. 468 ET — Tarifa general 19%</CardDescription>
        </CardHeader>
        <CardContent>
          <Table variant="glass">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tarifa</TableHead>
                <TableHead className="text-xs text-right">No. Facturas</TableHead>
                <TableHead className="text-xs text-right">Base Gravable</TableHead>
                <TableHead className="text-xs text-right">IVA Generado</TableHead>
                <TableHead className="text-xs text-right">Total con IVA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="text-sm">
                <TableCell><Badge className="bg-emerald-600">19%</Badge></TableCell>
                <TableCell className="text-right">{completedSales.length}</TableCell>
                <TableCell className="text-right">{formatCOP(totalSubtotal)}</TableCell>
                <TableCell className="text-right font-medium">{formatCOP(totalIVA)}</TableCell>
                <TableCell className="text-right font-bold">{formatCOP(totalVentas)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-semibold text-sm">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{completedSales.length}</TableCell>
                <TableCell className="text-right">{formatCOP(totalSubtotal)}</TableCell>
                <TableCell className="text-right">{formatCOP(totalIVA)}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatCOP(totalVentas)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border">
        <p className="font-semibold mb-1">📌 Notas para el Contador:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>IVA calculado según Art. 468 ET — Tarifa general del 19%</li>
          <li>Declaración bimestral (ingresos {'>'} 92.000 UVT) o cuatrimestral</li>
          <li>El IVA descontable de compras debe calcularse con facturas de proveedor</li>
          <li>Vencimiento según último dígito del NIT (Decreto 2229/2023)</li>
          <li>Formulario 300 DIAN — Declaración del Impuesto sobre las Ventas</li>
        </ul>
      </div>
    </div>
  )
}

// =====================================
// 3. ESTADO DE RESULTADOS - NIIF PyMEs
// =====================================
function EstadoResultados({ totalSubtotal, totalIVA, totalDescuentos, totalVentas, costoMercancia, utilidadBruta, margenBruto, cancelledSales, completedSales, onExport, periodLabel }: {
  totalSubtotal: number
  totalIVA: number
  totalDescuentos: number
  totalVentas: number
  costoMercancia: number
  utilidadBruta: number
  margenBruto: number
  cancelledSales: Sale[]
  completedSales: Sale[]
  onExport: () => void
  periodLabel: string
}) {
  const devolucionesVentas = cancelledSales.reduce((s, v) => s + v.total, 0)
  const ventasNetas = totalVentas - devolucionesVentas - totalDescuentos
  const ticketPromedio = completedSales.length > 0 ? totalVentas / completedSales.length : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Estado de Resultados — {periodLabel}
          </h3>
          <p className="text-xs text-muted-foreground">
            Sección 5 NIIF para PyMEs — Estado del Resultado Integral
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} className="print:hidden">
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      <Card variant="glass" className="border-glass-border">
        <CardContent className="p-6">
          <Table variant="glass">
            <TableBody>
              {/* INGRESOS OPERACIONALES */}
              <TableRow className="bg-blue-500/10">
                <TableCell colSpan={2} className="font-bold text-sm text-blue-600">
                  INGRESOS OPERACIONALES
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-sm">4135 - Comercio al por mayor y menor</TableCell>
                <TableCell className="text-right text-sm">{formatCOP(totalSubtotal + totalIVA)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-sm text-red-500">(-) Devoluciones y anulaciones</TableCell>
                <TableCell className="text-right text-sm text-red-500">{formatCOP(devolucionesVentas)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-sm text-red-500">(-) Descuentos en ventas</TableCell>
                <TableCell className="text-right text-sm text-red-500">{formatCOP(totalDescuentos)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-sm text-amber-500">(-) IVA Generado</TableCell>
                <TableCell className="text-right text-sm text-amber-500">{formatCOP(totalIVA)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow className="border-t-2 bg-muted/30">
                <TableCell className="pl-6 font-semibold text-sm">INGRESOS NETOS</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-bold text-sm">{formatCOP(totalSubtotal - devolucionesVentas - totalDescuentos)}</TableCell>
              </TableRow>

              {/* COSTO DE VENTAS */}
              <TableRow className="bg-orange-500/10 mt-4">
                <TableCell colSpan={2} className="font-bold text-sm text-orange-600">
                  COSTO DE VENTAS (CMV)
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-sm">6135 - Costo mercancía vendida</TableCell>
                <TableCell className="text-right text-sm">{formatCOP(costoMercancia)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow className="border-t-2 bg-muted/30">
                <TableCell className="pl-6 font-semibold text-sm">TOTAL COSTO DE VENTAS</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-bold text-sm text-orange-600">{formatCOP(costoMercancia)}</TableCell>
              </TableRow>

              {/* UTILIDAD BRUTA */}
              <TableRow className="bg-emerald-500/10 border-t-4 border-emerald-500">
                <TableCell className="font-bold text-base">UTILIDAD BRUTA</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-bold text-lg text-emerald-600">{formatCOP(utilidadBruta)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-xs text-muted-foreground">Margen de utilidad bruta</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right text-sm font-medium">{margenBruto.toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* KPIs adicionales */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Transacciones</p>
            <p className="text-2xl font-bold text-foreground">{completedSales.length}</p>
            <p className="text-xs text-muted-foreground">{cancelledSales.length} anuladas</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Ticket Promedio</p>
            <p className="text-2xl font-bold text-blue-500">{formatCOP(ticketPromedio)}</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Utilidad por Venta</p>
            <p className="text-2xl font-bold text-emerald-500">
              {formatCOP(completedSales.length > 0 ? utilidadBruta / completedSales.length : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border">
        <p className="font-semibold mb-1">📌 Notas para el Contador:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Cuentas PUC según Decreto 2649/93 y NIIF para PyMEs (Sección 5)</li>
          <li>Código 4135: Ingresos por comercio al por mayor y menor</li>
          <li>Código 6135: Costo de mercancía vendida — método promedio ponderado</li>
          <li>No incluye gastos operacionales (nómina, arriendo, etc.) — completar manualmente</li>
          <li>Para Renta (Formulario 110/210): sumar ingresos anuales y CMV anual</li>
        </ul>
      </div>
    </div>
  )
}

// =====================================
// 4. INVENTARIO VALORIZADO
// Art. 62 ET — Obligación de reportar inventario
// =====================================
function InventarioValorizado({ products, categories, inventarioPorCategoria, inventarioCosto, inventarioVenta, totalUnidades, onExport, periodLabel }: {
  products: Product[]
  categories: any[]
  inventarioPorCategoria: [string, { unidades: number; costo: number; venta: number; items: number }][]
  inventarioCosto: number
  inventarioVenta: number
  totalUnidades: number
  onExport: () => void
  periodLabel: string
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-500" />
            Inventario Valorizado — Corte: {periodLabel}
          </h3>
          <p className="text-xs text-muted-foreground">
            Art. 62-65 ET — Valoración de inventarios para efectos fiscales
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} className="print:hidden">
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Referencias</p>
            <p className="text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Unidades</p>
            <p className="text-2xl font-bold">{formatNumber(totalUnidades)}</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Valor al Costo</p>
            <p className="text-xl font-bold text-orange-500">{formatCOP(inventarioCosto)}</p>
            <p className="text-[10px] text-muted-foreground">Para declaración de renta</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Valor a Precio Venta</p>
            <p className="text-xl font-bold text-emerald-500">{formatCOP(inventarioVenta)}</p>
            <p className="text-[10px] text-muted-foreground">Margen potencial: {formatCOP(inventarioVenta - inventarioCosto)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventario por categoría */}
      <Card variant="glass" className="border-glass-border overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Resumen por Categoría</CardTitle>
          <CardDescription>Art. 65 ET — Sistema de inventarios permanentes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table variant="glass">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Categoría</TableHead>
                <TableHead className="text-xs font-semibold text-right">Referencias</TableHead>
                <TableHead className="text-xs font-semibold text-right">Unidades</TableHead>
                <TableHead className="text-xs font-semibold text-right">Valor Costo</TableHead>
                <TableHead className="text-xs font-semibold text-right">Valor Venta</TableHead>
                <TableHead className="text-xs font-semibold text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventarioPorCategoria.map(([name, data]) => (
                <TableRow key={name} className="text-xs">
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="text-right">{data.items}</TableCell>
                  <TableCell className="text-right">{formatNumber(data.unidades)}</TableCell>
                  <TableCell className="text-right">{formatCOP(data.costo)}</TableCell>
                  <TableCell className="text-right">{formatCOP(data.venta)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="text-[10px]">
                      {data.venta > 0 ? Math.round(((data.venta - data.costo) / data.venta) * 100) : 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold border-t-2 text-sm">
                <TableCell>TOTAL INVENTARIO</TableCell>
                <TableCell className="text-right">{products.length}</TableCell>
                <TableCell className="text-right">{formatNumber(totalUnidades)}</TableCell>
                <TableCell className="text-right text-orange-500">{formatCOP(inventarioCosto)}</TableCell>
                <TableCell className="text-right text-emerald-500">{formatCOP(inventarioVenta)}</TableCell>
                <TableCell className="text-right">
                  {inventarioVenta > 0 ? Math.round(((inventarioVenta - inventarioCosto) / inventarioVenta) * 100) : 0}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalle productos (top 20 por valor) */}
      <Card variant="glass" className="border-glass-border overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Detalle — Top 20 por Valor en Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table variant="glass">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">Producto</TableHead>
                  <TableHead className="text-xs text-right">Stock</TableHead>
                  <TableHead className="text-xs text-right">Costo Unit.</TableHead>
                  <TableHead className="text-xs text-right">Precio Venta</TableHead>
                  <TableHead className="text-xs text-right">Valor Costo Total</TableHead>
                  <TableHead className="text-xs text-right">Valor Venta Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products
                  .sort((a, b) => (b.purchasePrice * b.stock) - (a.purchasePrice * a.stock))
                  .slice(0, 20)
                  .map(p => (
                    <TableRow key={p.id} className="text-xs">
                      <TableCell className="font-mono">{p.sku}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{p.name}</TableCell>
                      <TableCell className="text-right">{p.stock}</TableCell>
                      <TableCell className="text-right">{formatCOP(p.purchasePrice)}</TableCell>
                      <TableCell className="text-right">{formatCOP(p.salePrice)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCOP(p.purchasePrice * p.stock)}</TableCell>
                      <TableCell className="text-right">{formatCOP(p.salePrice * p.stock)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border">
        <p className="font-semibold mb-1">📌 Notas para el Contador:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Inventario valorado al costo según Art. 62 ET (método promedio ponderado)</li>
          <li>Para Formulario 110/210 (Renta): declarar valor del inventario al 31 de diciembre</li>
          <li>Art. 64 ET: El inventario puede expresarse por métodos de valoración aceptados</li>
          <li>Información Exógena formato 1001 — reportar bienes por proveedores</li>
          <li>Exportar CSV para detalle completo de referencias</li>
        </ul>
      </div>
    </div>
  )
}

// =====================================
// 5. CUENTAS POR COBRAR - Info Exógena
// =====================================
function CuentasPorCobrar({ cuentasPorCobrar, totalCartera, periodLabel }: {
  cuentasPorCobrar: any[]
  totalCartera: number
  periodLabel: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          Cuentas por Cobrar (Cartera) — {periodLabel}
        </h3>
        <p className="text-xs text-muted-foreground">
          Formato 1008/1009 Info. Exógena DIAN — Cuentas por cobrar a terceros
        </p>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Cartera</p>
            <p className="text-2xl font-bold text-orange-500">{formatCOP(totalCartera)}</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Créditos Activos</p>
            <p className="text-2xl font-bold">{cuentasPorCobrar.length}</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Promedio por Crédito</p>
            <p className="text-2xl font-bold text-blue-500">
              {formatCOP(cuentasPorCobrar.length > 0 ? totalCartera / cuentasPorCobrar.length : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card variant="glass" className="border-glass-border overflow-hidden">
        <CardContent className="p-0">
          <Table variant="glass">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Factura</TableHead>
                <TableHead className="text-xs font-semibold">Fecha</TableHead>
                <TableHead className="text-xs font-semibold">Cliente</TableHead>
                <TableHead className="text-xs font-semibold">Estado</TableHead>
                <TableHead className="text-xs font-semibold text-right">Valor Total</TableHead>
                <TableHead className="text-xs font-semibold text-right">Abonado</TableHead>
                <TableHead className="text-xs font-semibold text-right">Saldo Pendiente</TableHead>
                <TableHead className="text-xs font-semibold">Vencimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuentasPorCobrar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                    No hay cuentas por cobrar pendientes en este periodo
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {cuentasPorCobrar.map(s => (
                    <TableRow key={s.id} className="text-xs">
                      <TableCell className="font-mono">{s.invoiceNumber}</TableCell>
                      <TableCell>{formatDate(s.createdAt)}</TableCell>
                      <TableCell>{s.customerName || 'Sin nombre'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          s.creditStatus === 'pendiente' ? 'text-red-500 border-red-500' :
                          s.creditStatus === 'parcial' ? 'text-amber-500 border-amber-500' :
                          'text-emerald-500 border-emerald-500'
                        }>
                          {s.creditStatus || 'pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCOP(s.total)}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {s.paidAmount > 0 ? formatCOP(s.paidAmount) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-orange-500">{formatCOP(s.saldoPendiente)}</TableCell>
                      <TableCell>{s.dueDate ? formatDate(s.dueDate) : 'Sin vencimiento'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold border-t-2 text-sm">
                    <TableCell colSpan={4}>TOTAL CARTERA</TableCell>
                    <TableCell className="text-right">{formatCOP(cuentasPorCobrar.reduce((sum, s) => sum + s.total, 0))}</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCOP(cuentasPorCobrar.reduce((sum, s) => sum + s.paidAmount, 0))}</TableCell>
                    <TableCell className="text-right text-orange-500">{formatCOP(totalCartera)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border">
        <p className="font-semibold mb-1">📌 Notas para el Contador:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Formato 1008 Info. Exógena: Cuentas por cobrar vigentes a dic 31</li>
          <li>Formato 1009: Cuentas por cobrar que fueron canceladas en el año</li>
          <li>Art. 145 ET: Deudas de difícil cobro permiten deducción provisional</li>
          <li>Cartera mayor a 1 año sin gestión puede calificarse como deterioro (NIIF - Sección 11)</li>
          <li>Documentar gestiones de cobro para soportar la cartera en declaración de renta</li>
        </ul>
      </div>
    </div>
  )
}

// =====================================
// 5.5 CONCILIACIÓN DE CAJA
// =====================================
function ConciliacionCaja({ sessions, closedSessions, totalSesiones, sesionesConDiferencia, totalDiferencias, periodLabel }: {
  sessions: CashSession[]
  closedSessions: CashSession[]
  totalSesiones: number
  sesionesConDiferencia: CashSession[]
  totalDiferencias: number
  periodLabel: string
}) {
  const sesionesAbiertas = sessions.filter(cs => cs.status === 'abierta')
  const totalVentasEfectivo = closedSessions.reduce((sum, cs) => sum + cs.totalCashSales, 0)
  const totalVentasTarjeta = closedSessions.reduce((sum, cs) => sum + cs.totalCardSales, 0)
  const totalVentasTransferencia = closedSessions.reduce((sum, cs) => sum + cs.totalTransferSales, 0)
  const totalVentasFiado = closedSessions.reduce((sum, cs) => sum + cs.totalFiadoSales, 0)
  const totalCambio = closedSessions.reduce((sum, cs) => sum + cs.totalChangeGiven, 0)
  const totalEntradas = closedSessions.reduce((sum, cs) => sum + cs.totalCashEntries, 0)
  const totalRetiros = closedSessions.reduce((sum, cs) => sum + cs.totalCashWithdrawals, 0)
  const totalAperturas = closedSessions.reduce((sum, cs) => sum + cs.openingAmount, 0)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Vault className="h-5 w-5 text-cyan-500" />
          Conciliación de Caja — {periodLabel}
        </h3>
        <p className="text-xs text-muted-foreground">
          Historial de cierres de caja, cuadres y diferencias del periodo
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Sesiones del Periodo</p>
            <p className="text-2xl font-bold">{totalSesiones}</p>
            <p className="text-xs text-muted-foreground">{closedSessions.length} cerradas</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Sesiones Cuadradas</p>
            <p className="text-2xl font-bold text-emerald-500">
              {closedSessions.filter(cs => cs.closingStatus === 'cuadrado').length}
            </p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Con Diferencia</p>
            <p className="text-2xl font-bold text-amber-500">{sesionesConDiferencia.length}</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="border-glass-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Diferencia Acumulada</p>
            <p className={`text-2xl font-bold ${totalDiferencias >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalDiferencias >= 0 ? '+' : ''}{formatCOP(totalDiferencias)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sesión abierta warning */}
      {sesionesAbiertas.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-600">Sesión de caja abierta</p>
              <p className="text-xs text-muted-foreground">
                Abierta por {sesionesAbiertas[0].openedByName} el{' '}
                {formatDateTime(sesionesAbiertas[0].openedAt)} — Los totales se actualizarán al cerrar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen consolidado del periodo */}
      {closedSessions.length > 0 && (
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Banknote className="h-4 w-4 text-cyan-500" />
              Resumen Consolidado de Caja — {closedSessions.length} cierre(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Aperturas de caja (base)</span>
                <span className="font-medium">{formatCOP(totalAperturas)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Ventas en efectivo</span>
                <span className="font-medium">{formatCOP(totalVentasEfectivo)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Ventas con tarjeta</span>
                <span className="font-medium">{formatCOP(totalVentasTarjeta)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Ventas por transferencia</span>
                <span className="font-medium">{formatCOP(totalVentasTransferencia)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Ventas a crédito (fiado)</span>
                <span className="font-medium">{formatCOP(totalVentasFiado)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Cambio entregado</span>
                <span className="font-medium text-red-500">-{formatCOP(totalCambio)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <PlusCircle className="h-3 w-3 text-emerald-500" /> Entradas manuales
                </span>
                <span className="font-medium text-emerald-500">+{formatCOP(totalEntradas)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MinusCircle className="h-3 w-3 text-red-500" /> Retiros de caja
                </span>
                <span className="font-medium text-red-500">-{formatCOP(totalRetiros)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalle por sesión */}
      <Card variant="glass" className="border-glass-border overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Detalle por Sesión de Caja</CardTitle>
          <CardDescription>Historial de aperturas y cierres del periodo</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table variant="glass">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Fecha Apertura</TableHead>
                  <TableHead className="text-xs font-semibold">Abierta por</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Monto Apertura</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Ventas (Efectivo)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Ventas (Total)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Esperado</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Conteo Real</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Diferencia</TableHead>
                  <TableHead className="text-xs font-semibold">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <Vault className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      No hay sesiones de caja en este periodo
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map(cs => {
                    const totalVentasSesion = cs.totalCashSales + cs.totalCardSales + cs.totalTransferSales + cs.totalFiadoSales
                    return (
                      <TableRow key={cs.id} className="text-xs">
                        <TableCell>{formatDateTime(cs.openedAt)}</TableCell>
                        <TableCell>{cs.openedByName}</TableCell>
                        <TableCell className="text-right">{formatCOP(cs.openingAmount)}</TableCell>
                        <TableCell className="text-right">{formatCOP(cs.totalCashSales)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCOP(totalVentasSesion)}</TableCell>
                        <TableCell className="text-right">
                          {cs.status === 'cerrada' ? formatCOP(cs.expectedCash ?? 0) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {cs.status === 'cerrada' ? formatCOP(cs.actualCash ?? 0) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {cs.status === 'cerrada' ? (
                            <span className={
                              cs.closingStatus === 'cuadrado' ? 'text-emerald-500' :
                              (cs.difference ?? 0) > 0 ? 'text-blue-500' : 'text-red-500'
                            }>
                              {(cs.difference ?? 0) > 0 ? '+' : ''}{formatCOP(cs.difference ?? 0)}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {cs.status === 'abierta' ? (
                            <Badge variant="outline" className="text-amber-500 border-amber-500 text-[10px]">Abierta</Badge>
                          ) : (
                            <Badge variant="outline" className={
                              cs.closingStatus === 'cuadrado' ? 'text-emerald-500 border-emerald-500 text-[10px]' :
                              cs.closingStatus === 'sobrante' ? 'text-blue-500 border-blue-500 text-[10px]' :
                              'text-red-500 border-red-500 text-[10px]'
                            }>
                              {cs.closingStatus === 'cuadrado' ? 'Cuadrado' :
                               cs.closingStatus === 'sobrante' ? 'Sobrante' : 'Faltante'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sesiones con diferencias */}
      {sesionesConDiferencia.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Sesiones con Diferencias — {sesionesConDiferencia.length} cierre(s)
            </CardTitle>
            <CardDescription>Cierres donde el conteo real no coincide con lo esperado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sesionesConDiferencia.map(cs => (
                <div key={cs.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border/50 gap-2">
                  <div>
                    <p className="text-sm font-medium">{formatDateTime(cs.openedAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      Cerrada por {cs.closedByName} — {cs.closedAt ? formatDateTime(cs.closedAt) : ''}
                    </p>
                    {cs.observations && (
                      <p className="text-xs text-muted-foreground mt-1 italic">Obs: {cs.observations}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Esperado: {formatCOP(cs.expectedCash ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Conteo: {formatCOP(cs.actualCash ?? 0)}</p>
                    <p className={`text-sm font-bold ${(cs.difference ?? 0) > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                      Diferencia: {(cs.difference ?? 0) > 0 ? '+' : ''}{formatCOP(cs.difference ?? 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border">
        <p className="font-semibold mb-1">📌 Notas para el Contador:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Cada sesión de caja registra apertura, ventas por método, movimientos manuales y cierre ciego</li>
          <li>El cierre ciego oculta el saldo esperado hasta que el cajero registra su conteo real</li>
          <li>Las diferencias (sobrante/faltante) quedan registradas como auditoría interna</li>
          <li>Efectivo esperado = Apertura + Ventas efectivo - Cambio + Entradas - Retiros</li>
          <li>Las observaciones del cierre documentan razones de discrepancias</li>
          <li>Conservar este registro como soporte de control interno (NIA 315)</li>
        </ul>
      </div>
    </div>
  )
}

// =====================================
// 6. MEDIOS DE PAGO
// =====================================
function MediosDePago({ ventasPorMetodo, totalVentas, completedSales, periodLabel, closedSessions }: {
  ventasPorMetodo: Record<string, { count: number; total: number }>
  totalVentas: number
  completedSales: Sale[]
  periodLabel: string
  closedSessions: CashSession[]
}) {
  const metodoLabels: Record<string, string> = {
    efectivo: '💵 Efectivo',
    tarjeta: '💳 Tarjeta Débito/Crédito',
    transferencia: '🏦 Transferencia Bancaria',
    fiado: '📋 Crédito / Fiado',
  }

  const totalCambioEntregado = completedSales
    .filter(s => s.paymentMethod === 'efectivo')
    .reduce((sum, s) => sum + s.change, 0)
  const totalAmountPaid = completedSales
    .filter(s => s.paymentMethod === 'efectivo')
    .reduce((sum, s) => sum + s.amountPaid, 0)
  // Net cash = amount received - change given back = sale total
  const efectivoNeto = ventasPorMetodo['efectivo']?.total ?? 0

  // Cash movements from closed sessions in the period
  const totalCashEntries = closedSessions.reduce((sum, cs) => sum + cs.totalCashEntries, 0)
  const totalCashWithdrawals = closedSessions.reduce((sum, cs) => sum + cs.totalCashWithdrawals, 0)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          Conciliación por Medios de Pago — {periodLabel}
        </h3>
        <p className="text-xs text-muted-foreground">
          Para conciliación bancaria y Formato 1019 Info. Exógena
        </p>
      </div>

      <Card variant="glass" className="border-glass-border overflow-hidden">
        <CardContent className="p-0">
          <Table variant="glass">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Método de Pago</TableHead>
                <TableHead className="text-xs font-semibold text-right">No. Transacciones</TableHead>
                <TableHead className="text-xs font-semibold text-right">Valor Total</TableHead>
                <TableHead className="text-xs font-semibold text-right">% del Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(ventasPorMetodo).map(([method, data]) => (
                <TableRow key={method} className="text-sm">
                  <TableCell className="font-medium">{metodoLabels[method] || method}</TableCell>
                  <TableCell className="text-right">{data.count}</TableCell>
                  <TableCell className="text-right font-medium">{formatCOP(data.total)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {totalVentas > 0 ? ((data.total / totalVentas) * 100).toFixed(1) : 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold border-t-2 text-sm">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{completedSales.length}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatCOP(totalVentas)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalle de efectivo - CORREGIDO */}
      {ventasPorMetodo['efectivo'] && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">💵 Cuadre de Caja (Efectivo)</CardTitle>
            <CardDescription>Desglose del flujo de efectivo por ventas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Efectivo recibido de clientes</span>
                <span className="font-medium">{formatCOP(totalAmountPaid)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">(-) Cambio entregado</span>
                <span className="font-medium text-red-500">-{formatCOP(totalCambioEntregado)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50 bg-emerald-500/10 rounded px-2">
                <span className="font-semibold">Efectivo neto por ventas</span>
                <span className="font-bold text-emerald-600">{formatCOP(efectivoNeto)}</span>
              </div>
              {(totalCashEntries > 0 || totalCashWithdrawals > 0) && (
                <>
                  <div className="flex justify-between py-1 border-b border-border/50 mt-1">
                    <span className="text-muted-foreground">(+) Entradas manuales de caja</span>
                    <span className="font-medium text-emerald-500">+{formatCOP(totalCashEntries)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">(-) Retiros/Salidas de caja</span>
                    <span className="font-medium text-red-500">-{formatCOP(totalCashWithdrawals)}</span>
                  </div>
                  <div className="flex justify-between py-1 bg-blue-500/10 rounded px-2">
                    <span className="font-semibold">Efectivo total ajustado</span>
                    <span className="font-bold text-blue-600">
                      {formatCOP(efectivoNeto + totalCashEntries - totalCashWithdrawals)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border">
        <p className="font-semibold mb-1">📌 Notas para el Contador:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Formato 1019 Info. Exógena: Movimiento de cuentas corrientes y/o ahorros</li>
          <li>Art. 771-5 ET: Pagos en efectivo {'>'} $100.000 requieren soporte para deducción</li>
          <li>Pagos con tarjeta: solicitar extracto bancario para conciliación</li>
          <li>Transferencias: verificar con extracto de la entidad financiera</li>
          <li>Ley 2277/2022: se limita el uso de efectivo sobre ciertos montos para efectos tributarios</li>
          <li>Ver reporte &quot;Conciliación de Caja&quot; para detalle de cierres y diferencias</li>
        </ul>
      </div>
    </div>
  )
}

// =====================================
// 7. RETENCIONES ESTIMADAS
// =====================================
function InformeRetenciones({ ventasConRetencion, retefuenteEstimada, reteIVAEstimado, totalVentas, totalIVA, umbralRetefuente, periodLabel }: {
  ventasConRetencion: Sale[]
  retefuenteEstimada: number
  reteIVAEstimado: number
  totalVentas: number
  totalIVA: number
  umbralRetefuente: number
  periodLabel: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Scale className="h-5 w-5 text-purple-500" />
          Retenciones Estimadas — {periodLabel}
        </h3>
        <p className="text-xs text-muted-foreground">
          Art. 392-401 ET — Retención en la fuente sobre pagos
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-sm text-amber-600 flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Valores estimados — Requiere validación del contador</p>
          <p className="text-xs mt-1">
            Las retenciones exactas dependen del régimen del comprador, el tipo de servicio/bien,
            y las resoluciones vigentes de la DIAN. Estos cálculos son referenciales.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ReteFuente */}
        <Card variant="glass" className="border-glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Retención en la Fuente</CardTitle>
            <CardDescription>Art. 392 ET — Por compras (2.5% sobre base gravable)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Umbral ReteFuente (27 UVT)</span>
                <span className="font-medium">{formatCOP(umbralRetefuente)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Valor UVT 2026 (estimado)</span>
                <span className="font-medium">{formatCOP(UVT_2026)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Ventas que superan umbral</span>
                <span className="font-medium">{ventasConRetencion.length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Base sujeta a retención</span>
                <span className="font-medium">{formatCOP(ventasConRetencion.reduce((s, v) => s + v.subtotal, 0))}</span>
              </div>
              <div className="flex justify-between py-2 bg-purple-500/10 rounded px-3">
                <span className="font-semibold">ReteFuente estimada (2.5%)</span>
                <span className="font-bold text-purple-600">{formatCOP(retefuenteEstimada)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ReteIVA */}
        <Card variant="glass" className="border-glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Retención de IVA (ReteIVA)</CardTitle>
            <CardDescription>Art. 437-1 ET — 15% del IVA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Total IVA generado</span>
                <span className="font-medium">{formatCOP(totalIVA)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">IVA de ventas con retención</span>
                <span className="font-medium">{formatCOP(ventasConRetencion.reduce((s, v) => s + v.tax, 0))}</span>
              </div>
              <div className="flex justify-between py-2 bg-purple-500/10 rounded px-3">
                <span className="font-semibold">ReteIVA estimado (15%)</span>
                <span className="font-bold text-purple-600">{formatCOP(reteIVAEstimado)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen obligaciones */}
      <Card variant="glass" className="border-glass-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Resumen de Obligaciones Tributarias del Periodo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table variant="glass">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Concepto</TableHead>
                <TableHead className="text-xs font-semibold">Formulario DIAN</TableHead>
                <TableHead className="text-xs font-semibold text-right">Valor Estimado</TableHead>
                <TableHead className="text-xs font-semibold">Periodicidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="text-sm">
                <TableCell>IVA por pagar</TableCell>
                <TableCell>Formulario 300</TableCell>
                <TableCell className="text-right font-medium">{formatCOP(totalIVA)}</TableCell>
                <TableCell>Bimestral/Cuatrimestral</TableCell>
              </TableRow>
              <TableRow className="text-sm">
                <TableCell>Retención en la Fuente</TableCell>
                <TableCell>Formulario 350</TableCell>
                <TableCell className="text-right font-medium">{formatCOP(retefuenteEstimada)}</TableCell>
                <TableCell>Mensual</TableCell>
              </TableRow>
              <TableRow className="text-sm">
                <TableCell>ReteIVA</TableCell>
                <TableCell>Formulario 350 (incluido)</TableCell>
                <TableCell className="text-right font-medium">{formatCOP(reteIVAEstimado)}</TableCell>
                <TableCell>Mensual</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-semibold text-sm border-t-2">
                <TableCell colSpan={2}>TOTAL ESTIMADO OBLIGACIONES</TableCell>
                <TableCell className="text-right text-red-500">{formatCOP(totalIVA + retefuenteEstimada + reteIVAEstimado)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border">
        <p className="font-semibold mb-1">📌 Notas para el Contador:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>ReteFuente por compras: 2.5% sobre base gravable cuando supera 27 UVT (Art. 392 ET)</li>
          <li>ReteIVA: 15% del IVA, aplicable a agentes retenedores (Art. 437-1 ET)</li>
          <li>ReteICA: varía según municipio y actividad económica (código CIIU)</li>
          <li>Declaración de retenciones: Formulario 350, presentación mensual</li>
          <li>Estos valores son estimaciones — el contador debe verificar con la situación real del contribuyente</li>
        </ul>
      </div>
    </div>
  )
}

// =====================================
// 8. RESUMEN EJECUTIVO PARA CONTADOR
// =====================================
function ResumenEjecutivo({ periodLabel, storeInfo, completedSales, cancelledSales, totalSubtotal, totalIVA, totalDescuentos, totalVentas, costoMercancia, utilidadBruta, margenBruto, totalUnidadesVendidas, ventasPorMetodo, inventarioCosto, inventarioVenta, totalUnidadesInventario, totalCartera, retefuenteEstimada, reteIVAEstimado, topVendidos, user, closedSessions, totalDiferencias }: {
  periodLabel: string
  storeInfo: any
  completedSales: Sale[]
  cancelledSales: Sale[]
  totalSubtotal: number
  totalIVA: number
  totalDescuentos: number
  totalVentas: number
  costoMercancia: number
  utilidadBruta: number
  margenBruto: number
  totalUnidadesVendidas: number
  ventasPorMetodo: Record<string, { count: number; total: number }>
  inventarioCosto: number
  inventarioVenta: number
  totalUnidadesInventario: number
  totalCartera: number
  retefuenteEstimada: number
  reteIVAEstimado: number
  topVendidos: { id: string; name: string; qty: number; revenue: number; cost: number; totalCost: number; profit: number }[]
  user: any
  closedSessions: CashSession[]
  totalDiferencias: number
}) {
  const metodoLabels: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    fiado: 'Crédito/Fiado',
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-indigo-500" />
          Resumen Ejecutivo Contable — {periodLabel}
        </h3>
        <p className="text-xs text-muted-foreground">
          Informe consolidado para el contador — Datos de {storeInfo.name || 'Daimuz'}
        </p>
      </div>

      {/* Encabezado empresa */}
      <Card className="border-indigo-500/30 bg-indigo-500/5">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-bold text-lg">{storeInfo.name || 'Mi Negocio'}</h4>
              <p className="text-sm text-muted-foreground">{storeInfo.address || 'Dirección no configurada'}</p>
              <p className="text-sm text-muted-foreground">NIT: {storeInfo.taxId || 'No configurado'}</p>
              <p className="text-sm text-muted-foreground">Tel: {storeInfo.phone || '-'} | {storeInfo.email || '-'}</p>
            </div>
            <div className="text-right">
              <Badge className="bg-indigo-600 text-white text-sm">{periodLabel}</Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Generado: {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-xs text-muted-foreground">Por: {user?.name || 'Admin'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1. Ventas */}
      <Card variant="glass" className="border-glass-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-500" />
            1. Resumen de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Facturas emitidas</span>
              <span className="font-medium">{completedSales.length + cancelledSales.length}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Facturas válidas</span>
              <span className="font-medium text-emerald-600">{completedSales.length}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Facturas anuladas</span>
              <span className="font-medium text-red-500">{cancelledSales.length}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Unidades vendidas</span>
              <span className="font-medium">{formatNumber(totalUnidadesVendidas)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Ventas brutas (con IVA)</span>
              <span className="font-medium">{formatCOP(totalSubtotal + totalIVA)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Descuentos otorgados</span>
              <span className="font-medium text-red-500">{formatCOP(totalDescuentos)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Base gravable (subtotal)</span>
              <span className="font-bold">{formatCOP(totalSubtotal)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">IVA generado (19%)</span>
              <span className="font-bold text-emerald-600">{formatCOP(totalIVA)}</span>
            </div>
            <div className="flex justify-between py-1 bg-emerald-500/10 rounded px-2 col-span-2">
              <span className="font-bold">Total ventas netas</span>
              <span className="font-bold text-lg text-emerald-600">{formatCOP(totalVentas)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Estado de Resultados Resumen */}
      <Card variant="glass" className="border-glass-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            2. Estado de Resultados (Simplificado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span>Ingresos netos (base gravable)</span>
              <span className="font-medium">{formatCOP(totalSubtotal)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-red-500">(-) Costo de mercancía vendida (CMV)</span>
              <span className="font-medium text-red-500">{formatCOP(costoMercancia)}</span>
            </div>
            <div className="flex justify-between py-2 bg-emerald-500/10 rounded px-2">
              <span className="font-bold">(=) Utilidad Bruta</span>
              <span className="font-bold text-emerald-600">{formatCOP(utilidadBruta)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Margen bruto</span>
              <span className="font-medium">{margenBruto.toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Medios de Pago */}
      <Card variant="glass" className="border-glass-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            3. Recaudo por Medios de Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            {Object.entries(ventasPorMetodo).map(([method, data]) => (
              <div key={method} className="flex justify-between py-1 border-b border-border/50">
                <span>{metodoLabels[method] || method} ({data.count} transacciones)</span>
                <span className="font-medium">{formatCOP(data.total)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. Inventario */}
      <Card variant="glass" className="border-glass-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-500" />
            4. Inventario al Corte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Total referencias</span>
              <span className="font-medium">{formatNumber(totalUnidadesInventario)} unidades</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Valor al costo (para Renta)</span>
              <span className="font-bold text-orange-500">{formatCOP(inventarioCosto)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Valor a precio venta</span>
              <span className="font-medium">{formatCOP(inventarioVenta)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Utilidad potencial en inventario</span>
              <span className="font-medium text-emerald-500">{formatCOP(inventarioVenta - inventarioCosto)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Cartera y Retenciones */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card variant="glass" className="border-glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-500" />
              5. Cuentas por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{formatCOP(totalCartera)}</p>
            <p className="text-xs text-muted-foreground">Cartera pendiente del periodo</p>
          </CardContent>
        </Card>

        <Card variant="glass" className="border-glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4 text-purple-500" />
              6. Retenciones Estimadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ReteFuente (2.5%)</span>
              <span className="font-medium">{formatCOP(retefuenteEstimada)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ReteIVA (15%)</span>
              <span className="font-medium">{formatCOP(reteIVAEstimado)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7. Conciliación de Caja */}
      {closedSessions.length > 0 && (
        <Card variant="glass" className="border-glass-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Vault className="h-4 w-4 text-cyan-500" />
              7. Conciliación de Caja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Cierres de caja realizados</span>
                <span className="font-medium">{closedSessions.length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Cierres cuadrados</span>
                <span className="font-medium text-emerald-500">
                  {closedSessions.filter(cs => cs.closingStatus === 'cuadrado').length}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Cierres con diferencia</span>
                <span className="font-medium text-amber-500">
                  {closedSessions.filter(cs => cs.closingStatus !== 'cuadrado').length}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Diferencia acumulada</span>
                <span className={`font-bold ${totalDiferencias >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {totalDiferencias >= 0 ? '+' : ''}{formatCOP(totalDiferencias)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 8. Top Vendidos */}
      <Card variant="glass" className="border-glass-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            8. Productos Más Vendidos (Top 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table variant="glass">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Producto</TableHead>
                  <TableHead className="text-xs text-right">Uds.</TableHead>
                  <TableHead className="text-xs text-right">Ingreso</TableHead>
                  <TableHead className="text-xs text-right">Costo</TableHead>
                  <TableHead className="text-xs text-right">Utilidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topVendidos.slice(0, 10).map((p, i) => (
                  <TableRow key={p.id} className="text-xs">
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{p.name}</TableCell>
                    <TableCell className="text-right">{p.qty}</TableCell>
                    <TableCell className="text-right">{formatCOP(p.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCOP(p.totalCost)}</TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">{formatCOP(p.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Firma y notas */}
      <Card className="border-indigo-500/30 bg-indigo-500/5">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-6 mt-4 pt-4 border-t border-indigo-500/30">
            <div className="text-center">
              <div className="border-b border-foreground w-48 mx-auto mb-1"></div>
              <p className="text-xs text-muted-foreground">Representante Legal</p>
              <p className="text-xs text-muted-foreground">{storeInfo.name}</p>
            </div>
            <div className="text-center">
              <div className="border-b border-foreground w-48 mx-auto mb-1"></div>
              <p className="text-xs text-muted-foreground">Contador Público</p>
              <p className="text-xs text-muted-foreground">T.P. ____________</p>
            </div>
            <div className="text-center">
              <div className="border-b border-foreground w-48 mx-auto mb-1"></div>
              <p className="text-xs text-muted-foreground">Revisor Fiscal</p>
              <p className="text-xs text-muted-foreground">(Si aplica)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border">
        <p className="font-semibold mb-1">📌 Recordatorio de Obligaciones DIAN:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Formulario 300</strong>: Declaración de IVA — bimestral o cuatrimestral según ingresos</li>
          <li><strong>Formulario 350</strong>: Declaración de Retención en la Fuente — mensual</li>
          <li><strong>Formulario 110/210</strong>: Declaración de Renta y Complementarios — anual</li>
          <li><strong>Información Exógena</strong>: Formatos 1001, 1003, 1005, 1006, 1007, 1008, 1009, 1010, 1012</li>
          <li><strong>RUT</strong>: Mantener actualizado el Registro Único Tributario</li>
          <li><strong>Facturación Electrónica</strong>: Resolución 000165/2023 — obligatorio para responsables de IVA</li>
          <li><strong>Nómina Electrónica</strong>: Si tiene empleados — Resolución 000013/2021</li>
        </ul>
      </div>
    </div>
  )
}
