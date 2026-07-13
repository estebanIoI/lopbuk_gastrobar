'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import type { CreditDetail, CreditPayment, PaymentMethod } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  Search,
  CreditCard,
  DollarSign,
  Users,
  Receipt,
  Calendar,
  Banknote,
  Building,
  Check,
  Clock,
  AlertCircle,
} from 'lucide-react'

interface PendingCredit {
  id: string
  invoiceNumber: string
  customerId: string
  customerName: string
  customerPhone?: string
  total: number
  paidAmount: number
  remainingBalance: number
  creditStatus: 'pendiente' | 'parcial' | 'pagado'
  dueDate?: string
  createdAt: string
}

type PendingCreditWithDue = PendingCredit & { dueDateParsed: Date }

export function Credits() {
  const [credits, setCredits] = useState<PendingCredit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedCredit, setSelectedCredit] = useState<CreditDetail | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<Exclude<PaymentMethod, 'fiado'>>('efectivo')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [summary, setSummary] = useState({ totalPending: 0, totalCredits: 0, customersWithDebt: 0 })
  const [creditLimit, setCreditLimit] = useState(0)
  const [creditDays, setCreditDays] = useState(30)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedLimit = localStorage.getItem('fiado.maxLimit')
    const savedDays = localStorage.getItem('fiado.dueDays')
    if (savedLimit) setCreditLimit(Number(savedLimit))
    if (savedDays) setCreditDays(Number(savedDays))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('fiado.maxLimit', String(creditLimit || 0))
    localStorage.setItem('fiado.dueDays', String(creditDays || 0))
  }, [creditLimit, creditDays])

  useEffect(() => {
    fetchCredits()
    fetchSummary()
  }, [])

  const fetchCredits = async () => {
    setIsLoading(true)
    const result = await api.getPendingCredits({ limit: 100 })
    if (result.success && result.data) {
      // Transform CreditDetail to PendingCredit format
      const rawData = result.data.data || result.data.credits || result.data || []
      const transformed: PendingCredit[] = rawData.map((item: any) => {
        // Handle both flat format and nested sale format
        if (item.sale) {
          return {
            id: item.sale.id,
            invoiceNumber: item.sale.invoiceNumber,
            customerId: item.sale.customerId,
            customerName: item.sale.customerName,
            customerPhone: item.sale.customerPhone,
            total: item.totalAmount || item.sale.total,
            paidAmount: item.paidAmount,
            remainingBalance: item.remainingBalance,
            creditStatus: item.status,
            dueDate: item.sale.dueDate,
            createdAt: item.sale.createdAt,
          }
        }
        return item
      })
      setCredits(transformed)
    }
    setIsLoading(false)
  }

  const fetchSummary = async () => {
    const result = await api.getCreditsSummary()
    if (result.success && result.data) {
      setSummary(result.data)
    }
  }

  const handleViewDetail = async (credit: PendingCredit) => {
    const result = await api.getCreditDetail(credit.id)
    if (result.success && result.data) {
      setSelectedCredit(result.data)
      setIsDetailOpen(true)
    }
  }

  const handleOpenPayment = () => {
    if (!selectedCredit) return
    setPaymentAmount(selectedCredit.remainingBalance.toString())
    setPaymentMethod('efectivo')
    setPaymentNotes('')
    setIsPaymentOpen(true)
  }

  const handleRegisterPayment = async () => {
    if (!selectedCredit || !paymentAmount) return
    setIsProcessing(true)

    const result = await api.registerPayment(selectedCredit.sale.id, {
      amount: parseFloat(paymentAmount),
      paymentMethod,
      notes: paymentNotes || undefined,
    })

    if (result.success) {
      setIsPaymentOpen(false)
      setIsDetailOpen(false)
      await fetchCredits()
      await fetchSummary()
    }

    setIsProcessing(false)
  }

  const addDays = (date: Date, days: number) => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  const creditsWithDueDate: PendingCreditWithDue[] = credits.map(c => ({
    ...c,
    dueDateParsed: c.dueDate
      ? new Date(c.dueDate)
      : addDays(new Date(c.createdAt), creditDays),
  }))

  const now = new Date()
  const dueSoonLimit = addDays(now, 7)

  const overdueCredits = creditsWithDueDate.filter(c => c.creditStatus !== 'pagado' && c.dueDateParsed < now)
  const dueSoonCredits = creditsWithDueDate.filter(
    c => c.creditStatus !== 'pagado' && c.dueDateParsed >= now && c.dueDateParsed <= dueSoonLimit
  )

  const balanceByCustomer = creditsWithDueDate.reduce((acc, c) => {
    acc[c.customerId] = (acc[c.customerId] || 0) + c.remainingBalance
    return acc
  }, {} as Record<string, number>)

  const customersOverLimit = creditLimit > 0
    ? Object.values(balanceByCustomer).filter(balance => balance > creditLimit).length
    : 0

  const filteredCredits = creditsWithDueDate.filter(c => {
    const matchesSearch =
      (c.customerName?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (c.invoiceNumber?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (c.customerPhone && c.customerPhone.includes(search))

    const matchesStatus = statusFilter === 'all' || c.creditStatus === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendiente':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Pendiente</Badge>
      case 'parcial':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" /> Parcial</Badge>
      case 'pagado':
        return <Badge variant="outline" className="text-green-600 border-green-600"><Check className="h-3 w-3 mr-1" /> Pagado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Fiados - Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Control de fiados, vencimientos y límites de crédito</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-destructive truncate">{formatCOP(summary.totalPending)}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Saldo pendiente</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Créditos Activos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{summary.totalCredits}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Ventas pendientes</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-destructive">{overdueCredits.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Fuera de plazo</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sobre Límite</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{customersOverLimit}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Superan límite</p>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card variant="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Parámetros de Fiado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Monto máximo de fiado (COP)</Label>
              <Input
                type="number"
                min="0"
                value={creditLimit || ''}
                onChange={(e) => setCreditLimit(Number(e.target.value) || 0)}
                placeholder="0 = sin límite"
              />
              <p className="text-xs text-muted-foreground">0 = sin límite</p>
            </div>
            <div className="space-y-2">
              <Label>Días límite de pago</Label>
              <Input
                type="number"
                min="1"
                value={creditDays || ''}
                onChange={(e) => setCreditDays(Number(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Se usa para calcular vencimientos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Próximos Vencimientos */}
      <Card variant="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Próximos vencimientos (7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          {dueSoonCredits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay fiados próximos a vencer.</p>
          ) : (
            <div className="space-y-2">
              {dueSoonCredits
                .sort((a, b) => a.dueDateParsed.getTime() - b.dueDateParsed.getTime())
                .slice(0, 5)
                .map((credit) => {
                  const daysLeft = Math.ceil((credit.dueDateParsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={credit.id} className="flex items-center justify-between rounded-md border border-border p-2">
                      <div>
                        <p className="text-sm font-medium">{credit.customerName}</p>
                        <p className="text-xs text-muted-foreground">Factura {credit.invoiceNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCOP(credit.remainingBalance)}</p>
                        <Badge variant="outline" className="text-xs">Vence en {daysLeft} días</Badge>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card variant="glass">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente o factura..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card variant="glass">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Cargando créditos...</p>
            </div>
          ) : filteredCredits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No se encontraron créditos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                    <TableHead className="hidden md:table-cell">Vence</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Abonado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCredits.map((credit, index) => {
                    const daysLeft = Math.ceil((credit.dueDateParsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    const isOverdue = credit.creditStatus !== 'pagado' && credit.dueDateParsed < now
                    return (
                      <TableRow key={credit.id || `credit-${index}`}>
                        <TableCell className="font-mono text-sm">
                          {credit.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{credit.customerName}</p>
                            {credit.customerPhone && (
                              <p className="text-xs text-muted-foreground">{credit.customerPhone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {new Date(credit.createdAt).toLocaleDateString('es-CO')}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-xs text-muted-foreground">
                            {credit.dueDateParsed.toLocaleDateString('es-CO')}
                          </div>
                          {credit.creditStatus !== 'pagado' && (
                            isOverdue ? (
                              <Badge variant="destructive" className="mt-1 text-[10px]">Vencido</Badge>
                            ) : (
                              <Badge variant="outline" className="mt-1 text-[10px]">En {daysLeft} días</Badge>
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCOP(credit.total)}
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell text-green-600">
                          {formatCOP(credit.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-destructive">
                          {formatCOP(credit.remainingBalance)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(credit.creditStatus)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="text-xs sm:text-sm px-2 sm:px-3"
                            onClick={() => handleViewDetail(credit)}
                          >
                            <span className="hidden sm:inline">Ver / Abonar</span>
                            <span className="sm:hidden">Ver</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Detalle de Crédito
            </DialogTitle>
            <DialogDescription>
              {selectedCredit && `Factura ${selectedCredit.sale.invoiceNumber}`}
            </DialogDescription>
          </DialogHeader>

          {selectedCredit && (
            <div className="space-y-4 py-4">
              {/* Customer Info */}
              <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedCredit.sale.customerName}</span>
                </div>
                {selectedCredit.sale.customerPhone && (
                  <p className="text-sm text-muted-foreground ml-6">{selectedCredit.sale.customerPhone}</p>
                )}
                <div className="flex items-center gap-2 ml-6">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {new Date(selectedCredit.sale.createdAt).toLocaleDateString('es-CO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Amounts */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de la venta</span>
                  <span className="font-medium">{formatCOP(selectedCredit.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Total abonado</span>
                  <span className="font-medium">{formatCOP(selectedCredit.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Saldo pendiente</span>
                  <span className="text-destructive">{formatCOP(selectedCredit.remainingBalance)}</span>
                </div>
              </div>

              {/* Payment History */}
              {selectedCredit.payments && selectedCredit.payments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase">Historial de Abonos</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedCredit.payments.map((payment: CreditPayment) => (
                      <div key={payment.id} className="flex items-center justify-between text-sm p-2 rounded bg-secondary/30">
                        <div className="flex items-center gap-2">
                          {payment.paymentMethod === 'efectivo' && <Banknote className="h-3 w-3" />}
                          {payment.paymentMethod === 'tarjeta' && <CreditCard className="h-3 w-3" />}
                          {payment.paymentMethod === 'transferencia' && <Building className="h-3 w-3" />}
                          <span>{new Date(payment.createdAt).toLocaleDateString('es-CO')}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-green-600">{formatCOP(payment.amount)}</span>
                          {payment.receiptNumber && (
                            <p className="text-xs text-muted-foreground">{payment.receiptNumber}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="flex justify-center">
                {getStatusBadge(selectedCredit.status)}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Cerrar
            </Button>
            {selectedCredit && selectedCredit.remainingBalance > 0 && (
              <Button onClick={handleOpenPayment}>
                <DollarSign className="h-4 w-4 mr-2" />
                Registrar Abono
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Registrar Abono
            </DialogTitle>
            <DialogDescription>
              {selectedCredit && (
                <>
                  Saldo pendiente: <strong className="text-destructive">{formatCOP(selectedCredit.remainingBalance)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label>Monto del Abono <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="1"
                max={selectedCredit?.remainingBalance}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="text-lg"
              />
              {selectedCredit && parseFloat(paymentAmount) > selectedCredit.remainingBalance && (
                <p className="text-xs text-destructive">
                  El monto no puede ser mayor al saldo pendiente
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === 'efectivo' ? 'default' : 'outline'}
                  className="flex flex-col gap-1 h-auto py-3"
                  onClick={() => setPaymentMethod('efectivo')}
                >
                  <Banknote className="h-5 w-5" />
                  <span className="text-xs">Efectivo</span>
                </Button>
                <Button
                  variant={paymentMethod === 'tarjeta' ? 'default' : 'outline'}
                  className="flex flex-col gap-1 h-auto py-3"
                  onClick={() => setPaymentMethod('tarjeta')}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs">Tarjeta</span>
                </Button>
                <Button
                  variant={paymentMethod === 'transferencia' ? 'default' : 'outline'}
                  className="flex flex-col gap-1 h-auto py-3"
                  onClick={() => setPaymentMethod('transferencia')}
                >
                  <Building className="h-5 w-5" />
                  <span className="text-xs">Transfer.</span>
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Observaciones sobre el pago..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterPayment}
              disabled={
                isProcessing ||
                !paymentAmount ||
                parseFloat(paymentAmount) <= 0 ||
                !!(selectedCredit && parseFloat(paymentAmount) > selectedCredit.remainingBalance)
              }
            >
              {isProcessing ? 'Procesando...' : 'Confirmar Abono'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
