'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import type { Sale } from '@/lib/types'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Search,
  Eye,
  Printer,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  Filter,
  Settings,
  Save,
} from 'lucide-react'

export function Invoicing() {
  const { sales, fetchSales, storeInfo, updateStoreInfo, cancelSale, invoicesDateFilter, clearInvoicesFilter } = useStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  useEffect(() => {
    if (invoicesDateFilter) {
      setDateRange({ start: invoicesDateFilter, end: invoicesDateFilter })
      clearInvoicesFilter()
    }
  }, [invoicesDateFilter, clearInvoicesFilter])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editInfo, setEditInfo] = useState(storeInfo)

  // Cargar storeInfo desde la BD al montar
  useEffect(() => {
    api.getStoreInfo().then((res) => {
      if (res.success && res.data) {
        updateStoreInfo(res.data)
        setEditInfo((prev) => ({ ...prev, ...res.data }))
      }
    })
  }, [])

  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.items.some(item => item.productName.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus =
      statusFilter === 'all' || sale.status === statusFilter
    const saleDate = new Date(sale.createdAt)
    const matchesDate =
      (!dateRange.start || saleDate >= new Date(dateRange.start)) &&
      (!dateRange.end || saleDate <= new Date(dateRange.end + 'T23:59:59'))
    return matchesSearch && matchesStatus && matchesDate
  })

  const getStatusBadge = (status: Sale['status']) => {
    switch (status) {
      case 'completada':
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completada
          </Badge>
        )
      case 'anulada':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            <XCircle className="w-3 h-3 mr-1" />
            Anulada
          </Badge>
        )
    }
  }

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale)
    setIsDetailOpen(true)
  }

  const paymentLabels: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
  }

  const handlePrint = (sale: Sale) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Factura ${sale.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #333; font-size: 14px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 5px 0; font-size: 22px; }
            .header p { margin: 3px 0; color: #555; font-size: 13px; }
            .header .nit { font-weight: bold; font-size: 14px; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .invoice-info h3 { margin: 0 0 8px 0; font-size: 13px; color: #666; text-transform: uppercase; }
            .invoice-info p { margin: 3px 0; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f0f0f0; padding: 10px 8px; text-align: left; border-bottom: 2px solid #ccc; font-size: 12px; text-transform: uppercase; }
            td { padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
            .text-right { text-align: right; }
            .totals { width: 300px; margin-left: auto; }
            .totals tr td { padding: 5px 8px; }
            .totals .total-row td { font-size: 16px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
            .payment-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .payment-info h3 { margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #666; }
            .payment-info p { margin: 3px 0; font-size: 13px; }
            .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px dashed #ccc; font-size: 12px; color: #777; }
            .footer p { margin: 4px 0; }
            .daimuz-watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 55%; max-width: 360px; opacity: 0.05; z-index: 0; pointer-events: none; }
            body > *:not(.daimuz-watermark) { position: relative; z-index: 1; }
            @media print { body { padding: 15px; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .daimuz-watermark { opacity: 0.045; } }
          </style>
        </head>
        <body>
          <img class="daimuz-watermark" src="${typeof window !== 'undefined' ? window.location.origin : ''}/daimuz-icon-transparent.png" alt="" />
          <div class="header">
            ${storeInfo.invoiceLogo ? `<img src="${storeInfo.invoiceLogo}" alt="Logo" style="max-height:70px;max-width:200px;object-fit:contain;margin-bottom:8px;" />` : ''}
            <h1>${storeInfo.name}</h1>
            <p class="nit">NIT: ${storeInfo.taxId}</p>
            <p>${storeInfo.address}</p>
            <p>Tel: ${storeInfo.phone} | ${storeInfo.email}</p>
          </div>
          <div class="invoice-info">
            <div>
              <h3>Factura de Venta</h3>
              <p><strong>No: ${sale.invoiceNumber}</strong></p>
              <p>Fecha: ${new Date(sale.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p>Hora: ${new Date(sale.createdAt).toLocaleTimeString('es-CO')}</p>
            </div>
            <div>
              <h3>Cliente</h3>
              ${(sale.customerName || sale.customer?.name) ? `<p>${sale.customerName || sale.customer?.name}</p>` : '<p>Consumidor Final</p>'}
              ${sale.customerPhone ? `<p>Tel: ${sale.customerPhone}</p>` : ''}
              ${sale.sellerName ? `<p style="margin-top:10px"><strong>Vendedor:</strong> ${sale.sellerName}</p>` : ''}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Cant.</th>
                <th class="text-right">P. Unit.</th>
                <th class="text-right">Desc.</th>
                <th class="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map(item => `
                <tr>
                  <td>${item.productName}</td>
                  <td>${item.sku || item.productSku || '-'}</td>
                  <td>${item.quantity}</td>
                  <td class="text-right">$${item.unitPrice.toLocaleString('es-CO')}</td>
                  <td class="text-right">${item.discount > 0 ? `$${item.discount.toLocaleString('es-CO')}` : '-'}</td>
                  <td class="text-right">$${(item.subtotal || item.total || 0).toLocaleString('es-CO')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <table class="totals">
            <tr><td>Subtotal:</td><td class="text-right">$${sale.subtotal.toLocaleString('es-CO')}</td></tr>
            ${sale.discount > 0 ? `<tr><td>Descuento:</td><td class="text-right">-$${sale.discount.toLocaleString('es-CO')}</td></tr>` : ''}
            <tr><td>IVA (19%):</td><td class="text-right">$${sale.tax.toLocaleString('es-CO')}</td></tr>
            <tr class="total-row"><td>TOTAL:</td><td class="text-right">$${sale.total.toLocaleString('es-CO')}</td></tr>
          </table>
          <div class="payment-info">
            <h3>Información de Pago</h3>
            <p><strong>Método:</strong> ${paymentLabels[sale.paymentMethod] || sale.paymentMethod}</p>
            <p><strong>Monto Recibido:</strong> $${sale.amountPaid.toLocaleString('es-CO')}</p>
            ${sale.change > 0 ? `<p><strong>Cambio:</strong> $${sale.change.toLocaleString('es-CO')}</p>` : ''}
          </div>
          <div class="footer">
            <p><strong>${storeInfo.invoiceGreeting || '¡Gracias por su compra!'}</strong></p>
            ${(storeInfo.invoicePolicy || '').split('\n').map(line => `<p>${line}</p>`).join('')}
            <p>${storeInfo.name} - ${storeInfo.phone}</p>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const totalCompleted = sales
    .filter((s) => s.status === 'completada')
    .reduce((sum, s) => sum + s.total, 0)
  const totalCancelled = sales
    .filter((s) => s.status === 'anulada')
    .reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Facturación</h1>
          <p className="text-muted-foreground">
            Gestiona y consulta todas las facturas emitidas
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => { setEditInfo(storeInfo); setIsSettingsOpen(true) }}
        >
          <Settings className="w-4 h-4 mr-2" />
          Configurar Factura
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Facturas</p>
                <p className="text-2xl font-bold text-foreground">
                  {sales.length}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completadas</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCOP(totalCompleted)}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Anuladas</p>
                <p className="text-2xl font-bold text-destructive">
                  {formatCOP(totalCancelled)}
                </p>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar factura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-secondary border-border"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="completada">Completadas</SelectItem>
                <SelectItem value="anulada">Anuladas</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                className="bg-secondary border-border"
              />
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="bg-secondary border-border"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Lista de Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          {/* ── Tarjetas (móvil) ── */}
          <div className="md:hidden space-y-2.5">
            {filteredSales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No se encontraron facturas</p>
            ) : (
              filteredSales.map((sale) => (
                <div key={sale.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{sale.invoiceNumber}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleDateString('es-CO')}
                        {(sale.sellerName || sale.seller) ? ` · ${sale.sellerName || sale.seller}` : ''}
                        {` · ${sale.items.length} prod.`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">{formatCOP(sale.total)}</p>
                      <div className="mt-0.5">{getStatusBadge(sale.status)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border/60">
                    <Button variant="ghost" size="icon" onClick={() => handleViewDetails(sale)} className="h-8 w-8 hover:bg-primary/10"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handlePrint(sale)} className="h-8 w-8 hover:bg-primary/10"><Printer className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Tabla (escritorio) ── */}
          <div className="hidden md:block rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="text-muted-foreground">
                    N° Factura
                  </TableHead>
                  <TableHead className="text-muted-foreground">Fecha</TableHead>
                  <TableHead className="text-muted-foreground">
                    Vendedor
                  </TableHead>
                  <TableHead className="text-muted-foreground">Items</TableHead>
                  <TableHead className="text-muted-foreground text-right">
                    Total
                  </TableHead>
                  <TableHead className="text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-muted-foreground text-center">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No se encontraron facturas
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow
                      key={sale.id}
                      className="border-border hover:bg-secondary/30"
                    >
                      <TableCell className="font-medium text-foreground">
                        {sale.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleDateString('es-CO')}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {sale.sellerName || sale.seller || ''}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.items.length} producto(s)
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {formatCOP(sale.total)}
                      </TableCell>
                      <TableCell>{getStatusBadge(sale.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(sale)}
                            className="h-8 w-8 hover:bg-primary/10"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePrint(sale)}
                            className="h-8 w-8 hover:bg-primary/10"
                          >
                            <Printer className="w-4 h-4" />
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

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Detalle de Factura
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              {/* Store Header */}
              <div className="text-center border-b border-border pb-4">
                {storeInfo.invoiceLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storeInfo.invoiceLogo} alt="Logo" className="h-16 max-w-[180px] object-contain mx-auto mb-2" />
                )}
                <h2 className="text-xl font-bold text-foreground">{storeInfo.name}</h2>
                <p className="text-sm text-muted-foreground font-medium">NIT: {storeInfo.taxId}</p>
                <p className="text-sm text-muted-foreground">{storeInfo.address}</p>
                <p className="text-sm text-muted-foreground">Tel: {storeInfo.phone} | {storeInfo.email}</p>
              </div>

              {/* Invoice & Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Factura de Venta</h3>
                  <p className="text-sm font-bold text-foreground">{selectedSale.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedSale.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedSale.createdAt).toLocaleTimeString('es-CO')}
                  </p>
                  <div className="mt-2">
                    {getStatusBadge(selectedSale.status)}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Cliente</h3>
                  <p className="text-sm text-foreground">
                    {selectedSale.customerName || selectedSale.customer?.name || 'Consumidor Final'}
                  </p>
                  {selectedSale.customerPhone && (
                    <p className="text-sm text-muted-foreground">Tel: {selectedSale.customerPhone}</p>
                  )}
                  {selectedSale.sellerName && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <span className="font-medium">Vendedor:</span> {selectedSale.sellerName}
                    </p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-muted-foreground">Producto</TableHead>
                      <TableHead className="text-muted-foreground">SKU</TableHead>
                      <TableHead className="text-muted-foreground text-center">Cant.</TableHead>
                      <TableHead className="text-muted-foreground text-right">P. Unit.</TableHead>
                      <TableHead className="text-muted-foreground text-right">Desc.</TableHead>
                      <TableHead className="text-muted-foreground text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.items.map((item, index) => (
                      <TableRow key={index} className="border-border">
                        <TableCell className="text-foreground">{item.productName}</TableCell>
                        <TableCell className="text-muted-foreground">{item.sku || item.productSku || '-'}</TableCell>
                        <TableCell className="text-center text-foreground">{item.quantity}</TableCell>
                        <TableCell className="text-right text-foreground">{formatCOP(item.unitPrice)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.discount > 0 ? formatCOP(item.discount) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {formatCOP(item.subtotal || item.total || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatCOP(selectedSale.subtotal)}</span>
                  </div>
                  {selectedSale.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="text-destructive">-{formatCOP(selectedSale.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IVA (19%)</span>
                    <span className="text-foreground">{formatCOP(selectedSale.tax)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                    <span className="text-foreground">TOTAL</span>
                    <span className="text-primary">{formatCOP(selectedSale.total)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">Información de Pago</h3>
                <p className="text-sm text-foreground">
                  <span className="font-medium">Método:</span> {paymentLabels[selectedSale.paymentMethod] || selectedSale.paymentMethod}
                </p>
                <p className="text-sm text-foreground">
                  <span className="font-medium">Monto Recibido:</span> {formatCOP(selectedSale.amountPaid)}
                </p>
                {selectedSale.change > 0 && (
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Cambio:</span> {formatCOP(selectedSale.change)}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="text-center border-t border-dashed border-border pt-3 space-y-1">
                <p className="text-sm font-medium text-foreground">{storeInfo.invoiceGreeting || '¡Gracias por su compra!'}</p>
                {(storeInfo.invoicePolicy || '').split('\n').map((line, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{line}</p>
                ))}
                <p className="text-xs text-muted-foreground">{storeInfo.name} - {storeInfo.phone}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-border hover:bg-secondary bg-transparent"
                  onClick={() => setIsDetailOpen(false)}
                >
                  Cerrar
                </Button>
                <Button
                  onClick={() => handlePrint(selectedSale)}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir Factura
                </Button>
              </div>

              {selectedSale.status === 'completada' && (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await cancelSale(selectedSale.id, 'Anulada por usuario')
                    setIsDetailOpen(false)
                  }}
                  className="w-full"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Anular Factura
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="bg-card border-border w-full max-w-lg mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuración de Factura
            </DialogTitle>
            <DialogDescription>
              Edita la información que aparece en las facturas impresas y en la vista previa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto max-h-[65vh] pr-1">
            <div className="space-y-2">
              <Label>Logo de la Factura</Label>
              <CloudinaryUpload
                value={editInfo.invoiceLogo || ''}
                onChange={(url) => setEditInfo({ ...editInfo, invoiceLogo: url })}
                previewClassName="h-16 max-w-[180px] object-contain rounded border"
              />
              <p className="text-xs text-muted-foreground">Aparece encima del nombre del negocio en la factura impresa.</p>
            </div>
            <div className="space-y-2">
              <Label>Nombre del Negocio</Label>
              <Input
                value={editInfo.name}
                onChange={(e) => setEditInfo({ ...editInfo, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>NIT / Identificación Fiscal</Label>
              <Input
                value={editInfo.taxId}
                onChange={(e) => setEditInfo({ ...editInfo, taxId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={editInfo.address}
                onChange={(e) => setEditInfo({ ...editInfo, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={editInfo.phone}
                  onChange={(e) => setEditInfo({ ...editInfo, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editInfo.email}
                  onChange={(e) => setEditInfo({ ...editInfo, email: e.target.value })}
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Pie de Factura</p>
              <div className="space-y-2">
                <Label>Mensaje de Agradecimiento</Label>
                <Input
                  value={editInfo.invoiceGreeting || ''}
                  onChange={(e) => setEditInfo({ ...editInfo, invoiceGreeting: e.target.value })}
                  placeholder="¡Gracias por su compra!"
                />
              </div>
              <div className="space-y-2 mt-3">
                <Label>Política de Cambios y Devoluciones</Label>
                <Textarea
                  value={editInfo.invoicePolicy || ''}
                  onChange={(e) => setEditInfo({ ...editInfo, invoicePolicy: e.target.value })}
                  placeholder="Cambios y devoluciones dentro de los 30 días..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Usa saltos de línea para separar párrafos.</p>
              </div>
              <div className="space-y-2 mt-3">
                <Label>Copias al imprimir factura</Label>
                <div className="flex gap-2">
                  {([1, 2] as (1 | 2)[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setEditInfo({ ...editInfo, invoiceCopies: n })}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                        (editInfo.invoiceCopies ?? 1) === n
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground hover:border-muted-foreground'
                      }`}
                    >
                      {n} {n === 1 ? 'copia' : 'copias'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" onClick={async () => {
              updateStoreInfo(editInfo)
              await api.updateStoreInfo(editInfo)
              setIsSettingsOpen(false)
            }}>
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
