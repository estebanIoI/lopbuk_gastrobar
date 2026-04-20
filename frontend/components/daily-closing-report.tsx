'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import type { DailyReportData, SedeReportData } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Printer, RefreshCw, TrendingUp, ShoppingCart, Banknote,
  CreditCard, Building, PackageSearch, CalendarDays, CircleDollarSign,
} from 'lucide-react'
import { toast } from 'sonner'

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  fiado: 'Crédito / Fiado',
  addi: 'Addi',
  sistecredito: 'Sistecredito',
  mixto: 'Mixto',
}

const PAYMENT_COLORS: Record<string, string> = {
  efectivo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  tarjeta: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  transferencia: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  fiado: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  addi: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  sistecredito: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  mixto: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('es-CO')}`
}

function SedeCard({ sedeData, sedeName }: { sedeData: SedeReportData; sedeName: string }) {
  return (
    <div className="flex-1 min-w-0 border border-border rounded-xl overflow-hidden bg-card">
      {/* Sede header */}
      <div className="bg-[#2d9e8c] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-white/80" />
          <span className="text-white font-semibold">{sedeName}</span>
        </div>
        <span className="text-white/80 text-sm">{sedeData.salesCount} venta{sedeData.salesCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary totals */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Subtotal</p>
            <p className="text-sm font-semibold">{fmt(sedeData.subtotal)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">IVA</p>
            <p className="text-sm font-semibold">{fmt(sedeData.tax)}</p>
          </div>
          <div className="bg-[#2d9e8c]/10 border border-[#2d9e8c]/30 rounded-lg p-3 text-center">
            <p className="text-xs text-[#2d9e8c] mb-0.5 font-medium">Total</p>
            <p className="text-base font-bold text-[#2d9e8c]">{fmt(sedeData.total)}</p>
          </div>
        </div>

        {/* Payment methods */}
        {Object.keys(sedeData.byPaymentMethod).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por método de pago</p>
            <div className="space-y-1.5">
              {Object.entries(sedeData.byPaymentMethod).map(([method, data]) => (
                <div key={method}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[method] || 'bg-muted text-muted-foreground'}`}>
                      {PAYMENT_LABELS[method] || method}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{data.count} vta{data.count !== 1 ? 's' : ''}</span>
                      <span className="font-semibold">{fmt(data.total)}</span>
                    </div>
                  </div>
                  {method === 'mixto' && data.mixedEfectivo != null && data.mixedEfectivo > 0 && (
                    <div className="ml-2 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>↳ Efectivo</span>
                        <span className="font-medium text-foreground">{fmt(data.mixedEfectivo)}</span>
                      </div>
                      {data.mixedSecond != null && data.mixedSecond > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>↳ {PAYMENT_LABELS[data.mixedSecondMethod || ''] || data.mixedSecondMethod || 'Otro'}</span>
                          <span className="font-medium text-foreground">{fmt(data.mixedSecond)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Products sold */}
        {sedeData.products.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Productos vendidos ({sedeData.products.length})
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Código</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Producto</th>
                    <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Cant.</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sedeData.products.map((p) => (
                    <tr key={p.productId} className="border-b border-border/40 last:border-b-0 hover:bg-muted/20">
                      <td className="px-2 py-1.5 text-muted-foreground font-mono">{p.productSku}</td>
                      <td className="px-2 py-1.5 max-w-[160px] truncate font-medium">{p.productName}</td>
                      <td className="px-2 py-1.5 text-center font-bold">{p.quantity}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(p.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sedeData.salesCount === 0 && (
          <div className="py-6 text-center text-muted-foreground text-sm">
            <PackageSearch className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Sin ventas registradas
          </div>
        )}
      </div>
    </div>
  )
}

export function DailyClosingReport() {
  const { sedes, storeInfo } = useStore()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [report, setReport] = useState<DailyReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerate = async () => {
    setIsLoading(true)
    try {
      const result = await api.getDailyReport(selectedDate)
      if (result.success && result.data) {
        setReport(result.data)
      } else {
        toast.error(result.error || 'Error al generar el reporte')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  const getSedeName = (sedeId: string | null, sedeName?: string | null) => {
    if (!sedeId) return 'Sin Sede'
    if (sedeName) return sedeName
    const sede = sedes.find(s => s.id === sedeId)
    return sede?.name || `Sede ${sedeId.slice(0, 6)}`
  }

  const handlePrint = () => {
    if (!report) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const dateLabel = new Date(report.date + 'T12:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const sedeHtml = report.sedes.map(sede => {
      const sedeName = getSedeName(sede.sedeId, sede.sedeName)
      const productsRows = sede.products.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${p.productSku}</td>
          <td>${p.productName}</td>
          <td style="text-align:center">${p.quantity}</td>
          <td style="text-align:right">$${Math.round(p.subtotal).toLocaleString('es-CO')}</td>
        </tr>`).join('')

      const paymentRows = Object.entries(sede.byPaymentMethod).map(([m, d]) => {
        const mainRow = `
        <tr>
          <td>${PAYMENT_LABELS[m] || m}</td>
          <td style="text-align:center">${d.count}</td>
          <td style="text-align:right">$${Math.round(d.total).toLocaleString('es-CO')}</td>
        </tr>`
        if (m === 'mixto' && d.mixedEfectivo != null && d.mixedEfectivo > 0) {
          const efectivoRow = `
        <tr style="color:#666;font-size:0.85em">
          <td style="padding-left:16px">↳ Efectivo</td>
          <td></td>
          <td style="text-align:right">$${Math.round(d.mixedEfectivo).toLocaleString('es-CO')}</td>
        </tr>`
          const secondRow = d.mixedSecond != null && d.mixedSecond > 0 ? `
        <tr style="color:#666;font-size:0.85em">
          <td style="padding-left:16px">↳ ${PAYMENT_LABELS[d.mixedSecondMethod || ''] || d.mixedSecondMethod || 'Otro'}</td>
          <td></td>
          <td style="text-align:right">$${Math.round(d.mixedSecond).toLocaleString('es-CO')}</td>
        </tr>` : ''
          return mainRow + efectivoRow + secondRow
        }
        return mainRow
      }).join('')

      return `
        <div class="sede-block">
          <h2 class="sede-title">${sedeName}</h2>
          <div class="totals-row">
            <span>Ventas: <strong>${sede.salesCount}</strong></span>
            <span>Subtotal: <strong>$${Math.round(sede.subtotal).toLocaleString('es-CO')}</strong></span>
            <span>IVA: <strong>$${Math.round(sede.tax).toLocaleString('es-CO')}</strong></span>
            <span class="total-highlight">Total: <strong>$${Math.round(sede.total).toLocaleString('es-CO')}</strong></span>
          </div>
          ${paymentRows ? `
          <h3>Métodos de Pago</h3>
          <table><thead><tr><th>Método</th><th>Ventas</th><th>Total</th></tr></thead>
          <tbody>${paymentRows}</tbody></table>` : ''}
          ${productsRows ? `
          <h3>Productos Vendidos</h3>
          <table><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Cant.</th><th>Total</th></tr></thead>
          <tbody>${productsRows}</tbody></table>` : '<p>Sin productos registrados</p>'}
        </div>`
    }).join('<div class="page-break"></div>')

    printWindow.document.write(`
      <html><head>
        <title>Cierre del Día - ${report.date}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 20px; }
          .report-header { text-align: center; border-bottom: 2px solid #2d9e8c; padding-bottom: 12px; margin-bottom: 20px; }
          .report-header h1 { font-size: 20px; color: #2d9e8c; }
          .report-header p { color: #666; margin-top: 4px; }
          .grand-summary { display: flex; gap: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
          .grand-summary span { flex: 1; text-align: center; }
          .grand-summary .highlight { font-size: 16px; font-weight: bold; color: #2d9e8c; }
          .sede-block { margin-bottom: 24px; }
          .sede-title { font-size: 14px; background: #2d9e8c; color: white; padding: 6px 12px; border-radius: 4px; margin-bottom: 10px; }
          .totals-row { display: flex; gap: 16px; background: #f5f5f5; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; font-size: 12px; }
          .total-highlight { color: #2d9e8c; }
          h3 { font-size: 11px; text-transform: uppercase; color: #666; margin: 10px 0 6px; letter-spacing: 0.05em; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          th { background: #f0f0f0; padding: 5px 6px; text-align: left; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #ccc; }
          td { padding: 4px 6px; border-bottom: 1px solid #eee; font-size: 11px; }
          .page-break { border-top: 2px dashed #ccc; margin: 20px 0; page-break-after: always; }
          @media print { body { padding: 10px; } }
        </style>
      </head><body>
        <div class="report-header">
          <h1>Reporte de Cierre del Día</h1>
          <p>${storeInfo.name} &bull; ${dateLabel}</p>
          <p>Generado: ${new Date().toLocaleTimeString('es-CO')}</p>
        </div>
        <div class="grand-summary">
          <span>Total ventas: <strong>${report.totalSales}</strong></span>
          <span>Subtotal: <strong>$${Math.round(report.grandSubtotal).toLocaleString('es-CO')}</strong></span>
          <span>IVA: <strong>$${Math.round(report.grandTax).toLocaleString('es-CO')}</strong></span>
          <span class="highlight">TOTAL: $${Math.round(report.grandTotal).toLocaleString('es-CO')}</span>
        </div>
        ${sedeHtml || '<p>No hay ventas registradas para esta fecha.</p>'}
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const formattedDate = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : ''

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reporte de Cierre del Día</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ventas por sede — comparativo diario</p>
        </div>
        {report && (
          <Button onClick={handlePrint} className="gap-2 bg-[#2d9e8c] hover:bg-[#268a7a]">
            <Printer className="h-4 w-4" />
            Imprimir Reporte
          </Button>
        )}
      </div>

      {/* Date picker + generate */}
      <Card className="border-border">
        <CardContent className="p-4 flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Fecha del reporte
            </label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setReport(null) }}
              className="h-9 w-44 text-sm border-border"
            />
          </div>
          {selectedDate && (
            <p className="text-sm text-muted-foreground pb-1 capitalize">{formattedDate}</p>
          )}
          <div className="ml-auto">
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !selectedDate}
              className="h-9 gap-2 bg-[#2d9e8c] hover:bg-[#268a7a]"
            >
              {isLoading
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generando...</>
                : <><TrendingUp className="h-4 w-4" /> Generar Reporte</>
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grand summary cards */}
      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Ventas</p>
                  <p className="text-xl font-bold">{report.totalSales}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                  <CircleDollarSign className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-lg font-bold">{fmt(report.grandSubtotal)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IVA</p>
                  <p className="text-lg font-bold">{fmt(report.grandTax)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#2d9e8c] bg-[#2d9e8c]/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2d9e8c]/20">
                  <Banknote className="h-5 w-5 text-[#2d9e8c]" />
                </div>
                <div>
                  <p className="text-xs text-[#2d9e8c] font-medium">Total del Día</p>
                  <p className="text-xl font-bold text-[#2d9e8c]">{fmt(report.grandTotal)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sede columns */}
          {report.sedes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-16 text-center">
                <PackageSearch className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground">Sin ventas para esta fecha</p>
                <p className="text-sm text-muted-foreground mt-1">No se encontraron ventas completadas el {formattedDate}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex gap-4 flex-wrap lg:flex-nowrap">
              {/* All sedes from store — always show each one, even if 0 sales */}
              {sedes.length > 0 ? (
                sedes.map(sede => {
                  const sedeData = report.sedes.find(s => s.sedeId === sede.id) ?? {
                    sedeId: sede.id,
                    salesCount: 0,
                    subtotal: 0,
                    tax: 0,
                    discount: 0,
                    total: 0,
                    byPaymentMethod: {},
                    products: [],
                  }
                  return <SedeCard key={sede.id} sedeData={sedeData} sedeName={sede.name} />
                })
              ) : (
                // No sedes configured — show report sedes as-is
                report.sedes.map(sedeData => (
                  <SedeCard
                    key={sedeData.sedeId ?? '__none__'}
                    sedeData={sedeData}
                    sedeName={getSedeName(sedeData.sedeId, sedeData.sedeName)}
                  />
                ))
              )}
              {/* Ventas sin sede (if any) */}
              {sedes.length > 0 && report.sedes.some(s => s.sedeId === null) && (
                <SedeCard
                  sedeData={report.sedes.find(s => s.sedeId === null)!}
                  sedeName="Sin Sede"
                />
              )}
            </div>
          )}
        </>
      )}

      {!report && !isLoading && (
        <Card className="border-border border-dashed">
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Selecciona una fecha y haz clic en <strong>Generar Reporte</strong></p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
