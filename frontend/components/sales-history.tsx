'use client'

import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import type { Sale } from '@/lib/types'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Search,
  FileText,
  Printer,
  Eye,
  Calendar,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  X,
  CreditCard,
  Banknote,
  Building
} from 'lucide-react'

export function SalesHistory() {
  const { sales, fetchSales, storeInfo } = useStore()
  const { user } = useAuthStore()
  const isVendedor = user?.role === 'vendedor'

  useEffect(() => {
    fetchSales()
  }, [fetchSales])
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // Filter and sort sales (newest first)
  const filteredSales = sales.filter(sale => {
    const matchesSearch =
      sale.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      sale.items.some(item => item.productName.toLowerCase().includes(search.toLowerCase()))

    const matchesPayment = paymentFilter === 'all' || sale.paymentMethod === paymentFilter

    const saleDate = new Date(sale.createdAt)
    const matchesStartDate = !dateRange.start || saleDate >= new Date(dateRange.start)
    const matchesEndDate = !dateRange.end || saleDate <= new Date(dateRange.end + 'T23:59:59')

    return matchesSearch && matchesPayment && matchesStartDate && matchesEndDate
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Calculate summary metrics
  const totalSales = filteredSales.filter(s => s.status === 'completada').length
  const totalRevenue = filteredSales
    .filter(s => s.status === 'completada')
    .reduce((sum, s) => sum + s.total, 0)
  const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'efectivo':
        return <Banknote className="h-4 w-4" />
      case 'tarjeta':
        return <CreditCard className="h-4 w-4" />
      case 'transferencia':
        return <Building className="h-4 w-4" />
      default:
        return null
    }
  }

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale)
    setIsDetailOpen(true)
  }

  const handlePrint = (sale: Sale) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Factura ${sale.invoiceNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
              .header h1 { font-size: 28px; margin-bottom: 5px; }
              .header p { color: #666; }
              .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
              .invoice-info-section h3 { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
              .invoice-info-section p { margin: 4px 0; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th { background: #f5f5f5; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; }
              td { padding: 12px; border-bottom: 1px solid #eee; }
              .text-right { text-align: right; }
              .totals { margin-left: auto; width: 250px; }
              .totals .row { display: flex; justify-content: space-between; padding: 8px 0; }
              .totals .total { border-top: 2px solid #333; font-size: 18px; font-weight: bold; margin-top: 8px; padding-top: 12px; }
              .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
              .daimuz-watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 55%; max-width: 360px; opacity: 0.05; z-index: 0; pointer-events: none; }
              body > *:not(.daimuz-watermark) { position: relative; z-index: 1; }
              @media print {
                body { padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .daimuz-watermark { opacity: 0.045; }
              }
            </style>
          </head>
          <body>
            <img class="daimuz-watermark" src="${typeof window !== 'undefined' ? window.location.origin : ''}/daimuz-icon-transparent.png" alt="" />
            <div class="header">
              <h1>${storeInfo.name}</h1>
              <p>${storeInfo.address}</p>
              <p>Tel: ${storeInfo.phone} | ${storeInfo.email}</p>
              <p>NIT: ${storeInfo.taxId}</p>
            </div>

            <div class="invoice-info">
              <div class="invoice-info-section">
                <h3>Factura</h3>
                <p><strong>${sale.invoiceNumber}</strong></p>
                <p>Fecha: ${new Date(sale.createdAt).toLocaleDateString('es-CO')}</p>
                <p>Hora: ${new Date(sale.createdAt).toLocaleTimeString('es-CO')}</p>
              </div>
              <div class="invoice-info-section">
                <h3>Vendedor</h3>
                <p>${sale.sellerName || sale.seller || ''}</p>
                ${(sale.customerName || sale.customer?.name) ? `
                  <h3 style="margin-top: 16px;">Cliente</h3>
                  <p>${sale.customerName || sale.customer?.name}</p>
                  ${(sale.customerPhone || sale.customer?.phone) ? `<p>Tel: ${sale.customerPhone || sale.customer?.phone}</p>` : ''}
                ` : ''}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th class="text-right">Cant.</th>
                  <th class="text-right">Precio</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items.map(item => `
                  <tr>
                    <td>${item.productName}</td>
                    <td>${item.productSku || item.sku || ''}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">$${item.unitPrice.toLocaleString('es-CO')}</td>
                    <td class="text-right">$${(item.subtotal || item.total || 0).toLocaleString('es-CO')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="totals">
              <div class="row">
                <span>Subtotal:</span>
                <span>$${sale.subtotal.toLocaleString('es-CO')}</span>
              </div>
              ${sale.discount > 0 ? `
                <div class="row" style="color: #dc2626;">
                  <span>Descuento:</span>
                  <span>-$${sale.discount.toLocaleString('es-CO')}</span>
                </div>
              ` : ''}
              <div class="row">
                <span>IVA (19%):</span>
                <span>$${sale.tax.toLocaleString('es-CO')}</span>
              </div>
              <div class="row total">
                <span>Total:</span>
                <span>$${sale.total.toLocaleString('es-CO')}</span>
              </div>
              <div class="row">
                <span>Método de Pago:</span>
                <span style="text-transform: capitalize;">${sale.paymentMethod}</span>
              </div>
              ${sale.paymentMethod === 'efectivo' && sale.change > 0 ? `
                <div class="row">
                  <span>Recibido:</span>
                  <span>$${sale.amountPaid.toLocaleString('es-CO')}</span>
                </div>
                <div class="row">
                  <span>Cambio:</span>
                  <span>$${sale.change.toLocaleString('es-CO')}</span>
                </div>
              ` : ''}
            </div>

            <div class="footer">
              <p>¡Gracias por su compra!</p>
              <p>Conserve este ticket para cualquier devolución o garantía</p>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Ventas</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{totalSales}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-1.5 sm:p-2">
                <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Ingresos</p>
                <p className="text-lg sm:text-2xl font-bold text-primary truncate">
                  {formatCOP(totalRevenue)}
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-1.5 sm:p-2">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card col-span-2 md:col-span-1">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Promedio</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground truncate">
                  {formatCOP(avgSale)}
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-1.5 sm:p-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border bg-card">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar factura..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-none"
              />
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full sm:w-[140px] bg-secondary border-none text-sm">
                  <SelectValue placeholder="Pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transfer.</SelectItem>
                  <SelectItem value="fiado">Fiado</SelectItem>
                </SelectContent>
              </Select>
              {isVendedor ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  Ventas del día de hoy
                </div>
              ) : (
                <>
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full sm:w-[130px] bg-secondary border-none text-sm"
                  />
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full sm:w-[130px] bg-secondary border-none text-sm"
                  />
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-sm sm:text-base font-medium">
            {isVendedor ? 'Mis Ventas de Hoy' : 'Historial de Ventas'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs sm:text-sm">Factura</TableHead>
                  <TableHead className="text-muted-foreground text-xs sm:text-sm hidden sm:table-cell">Fecha</TableHead>
                  <TableHead className="text-muted-foreground text-xs sm:text-sm hidden md:table-cell">Productos</TableHead>
                  <TableHead className="text-muted-foreground text-xs sm:text-sm text-right">Total</TableHead>
                  <TableHead className="text-muted-foreground text-xs sm:text-sm hidden sm:table-cell">Pago</TableHead>
                  <TableHead className="text-muted-foreground text-xs sm:text-sm">Estado</TableHead>
                  <TableHead className="text-muted-foreground text-xs sm:text-sm text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No se encontraron ventas</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id} className="border-border">
                    <TableCell className="py-2 sm:py-4">
                      <div>
                        <span className="font-medium text-xs sm:text-sm text-foreground">{sale.invoiceNumber}</span>
                        <p className="text-[10px] text-muted-foreground sm:hidden">
                          {new Date(sale.createdAt).toLocaleDateString('es-CO')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div>
                        <p className="text-sm text-foreground">
                          {new Date(sale.createdAt).toLocaleDateString('es-CO')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleTimeString('es-CO')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="max-w-[200px]">
                        {sale.items.slice(0, 2).map((item, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground truncate">
                            {item.productName} x{item.quantity}
                          </p>
                        ))}
                        {sale.items.length > 2 && (
                          <p className="text-xs text-muted-foreground">
                            +{sale.items.length - 2} más
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2 sm:py-4">
                      <span className="font-semibold text-xs sm:text-sm text-primary">
                        {formatCOP(sale.total)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        {getPaymentIcon(sale.paymentMethod)}
                        <span className="text-xs sm:text-sm capitalize text-muted-foreground">
                          {sale.paymentMethod}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 sm:py-4">
                      <Badge
                        variant={sale.status === 'completada' ? 'default' : 'destructive'}
                        className={`text-[10px] sm:text-xs ${sale.status === 'completada'
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : ''}`
                        }
                      >
                        <span className="hidden sm:inline">{sale.status === 'completada' ? 'Completada' : 'Anulada'}</span>
                        <span className="sm:hidden">{sale.status === 'completada' ? 'OK' : 'X'}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-2 sm:py-4">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => handleViewDetails(sale)}
                        >
                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => handlePrint(sale)}
                        >
                          <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sale Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalle de Venta
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">N° Factura</Label>
                  <p className="font-semibold text-foreground">{selectedSale.invoiceNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha</Label>
                  <p className="font-semibold text-foreground">
                    {new Date(selectedSale.createdAt).toLocaleString('es-CO')}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vendedor</Label>
                  <p className="font-semibold text-foreground">{selectedSale.sellerName || selectedSale.seller || ''}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Método de Pago</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getPaymentIcon(selectedSale.paymentMethod)}
                    <span className="capitalize">{selectedSale.paymentMethod}</span>
                  </div>
                </div>
                {(selectedSale.customerName || selectedSale.customer) && (
                  <>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Cliente</Label>
                      <p className="font-semibold text-foreground">
                        {selectedSale.customerName || selectedSale.customer?.name}
                        {(selectedSale.customerPhone || selectedSale.customer?.phone) && ` | ${selectedSale.customerPhone || selectedSale.customer?.phone}`}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block">Productos</Label>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead className="text-muted-foreground">Producto</TableHead>
                        <TableHead className="text-muted-foreground text-center">Cant.</TableHead>
                        <TableHead className="text-muted-foreground text-right">Precio</TableHead>
                        <TableHead className="text-muted-foreground text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items.map((item, index) => (
                        <TableRow key={index} className="border-border">
                          <TableCell>
                            <p className="text-foreground">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.productSku || item.sku || ''}</p>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCOP(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground">
                            {formatCOP(item.subtotal || item.total || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCOP(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Descuento</span>
                    <span>-{formatCOP(selectedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA (19%)</span>
                  <span>{formatCOP(selectedSale.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-foreground border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">
                    {formatCOP(selectedSale.total)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handlePrint(selectedSale)}
                  className="flex-1"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir Factura
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDetailOpen(false)}
                  className="flex-1 bg-transparent"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
