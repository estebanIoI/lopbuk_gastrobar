'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useCashStore } from '@/lib/cash-store'
import { formatCOP } from '@/lib/utils'
import type { CashSession, SalesBookEntry } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ShiftSelector, EmployeePicker, ShiftEmployeeManager, BonusDiscountPanel, DailySummaryView, ShiftBadge,
  type ShiftType, type PickedEmployee, type ShiftBonus,
} from '@/components/cash-shifts/shift-components'
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
import {
  Banknote,
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
  Lock,
  Unlock,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  PlusCircle,
  Landmark,
  HandCoins,
  Receipt,
  Calculator,
  RotateCcw,
  Coins,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
} from 'lucide-react'
import { toast } from 'sonner'

export function CashRegister() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'comerciante' || user?.role === 'superadmin'

  // Session state (centralized in cashStore)
  const {
    activeSession, totals: liveTotals, movements, sessionHistory, isLoading,
    fetchActiveSession, fetchTotals, fetchMovements, fetchHistory,
    openSession: storeOpenSession, closeSession: storeCloseSession,
    addMovement: storeAddMovement, reset: resetStore,
  } = useCashStore()

  // Opening form
  const [openingAmount, setOpeningAmount] = useState('')
  const [isOpening, setIsOpening] = useState(false)
  // Turnos
  const [shiftType, setShiftType] = useState<ShiftType>('unico')
  const [pickedEmployees, setPickedEmployees] = useState<PickedEmployee[]>([])
  const [closeBonuses, setCloseBonuses] = useState<ShiftBonus[]>([])
  const [showDailySummary, setShowDailySummary] = useState(false)

  // Movement dialog
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementType, setMovementType] = useState<'entrada' | 'salida'>('entrada')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [movementNotes, setMovementNotes] = useState('')
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false)

  // Cierre dialog
  const [isCierreDialogOpen, setIsCierreDialogOpen] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [observations, setObservations] = useState('')
  const [cierreResult, setCierreResult] = useState<CashSession | null>(null)
  const [cierreStep, setCierreStep] = useState<'input' | 'result'>('input')
  const [isClosing, setIsClosing] = useState(false)

  // Denomination calculator for cierre
  const DENOMINATIONS = [
    { value: 100000, label: '$100.000', type: 'billete' },
    { value: 50000, label: '$50.000', type: 'billete' },
    { value: 20000, label: '$20.000', type: 'billete' },
    { value: 10000, label: '$10.000', type: 'billete' },
    { value: 5000, label: '$5.000', type: 'billete' },
    { value: 2000, label: '$2.000', type: 'billete' },
    { value: 1000, label: '$1.000', type: 'moneda' },
    { value: 500, label: '$500', type: 'moneda' },
    { value: 200, label: '$200', type: 'moneda' },
    { value: 100, label: '$100', type: 'moneda' },
    { value: 50, label: '$50', type: 'moneda' },
  ] as const
  const [showCierreDenomCalc, setShowCierreDenomCalc] = useState(false)
  const [cierreDenomCounts, setCierreDenomCounts] = useState<Record<number, number>>({})
  const [detailSession, setDetailSession] = useState<CashSession | null>(null) // revisar cierre pasado

  const cierreDenomTotal = Object.entries(cierreDenomCounts).reduce(
    (sum, [denom, count]) => sum + Number(denom) * count, 0
  )

  const handleCierreDenomChange = (denom: number, delta: number) => {
    setCierreDenomCounts(prev => {
      const current = prev[denom] || 0
      const next = Math.max(0, current + delta)
      const updated = { ...prev }
      if (next === 0) delete updated[denom]
      else updated[denom] = next
      return updated
    })
  }

  const handleCierreDenomSet = (denom: number, count: number) => {
    setCierreDenomCounts(prev => {
      const updated = { ...prev }
      if (count <= 0) delete updated[denom]
      else updated[denom] = count
      return updated
    })
  }

  const resetCierreDenomCalc = () => setCierreDenomCounts({})

  // Sync denomination total to actualCash when using calculator
  useEffect(() => {
    if (showCierreDenomCalc && cierreDenomTotal > 0) {
      setActualCash(cierreDenomTotal.toString())
    }
  }, [cierreDenomTotal, showCierreDenomCalc])

  useEffect(() => {
    fetchActiveSession()
    if (isAdmin) fetchHistory()
  }, [fetchActiveSession, fetchHistory, isAdmin])

  useEffect(() => {
    if (activeSession) {
      fetchTotals()
      fetchMovements()
    }
  }, [activeSession, fetchTotals, fetchMovements])

  // Auto-refresh totals every 30 seconds
  useEffect(() => {
    if (!activeSession) return
    const interval = setInterval(() => {
      fetchTotals()
      fetchMovements()
    }, 30000)
    return () => clearInterval(interval)
  }, [activeSession, fetchTotals, fetchMovements])

  const handleOpenSession = async () => {
    const amount = parseFloat(openingAmount)
    if (isNaN(amount) || amount < 0) {
      toast.error('Ingrese un monto valido')
      return
    }
    setIsOpening(true)
    const result = await storeOpenSession(amount, user?.name || 'Usuario', {
      shiftType,
      employees: pickedEmployees,
    })
    if (result.success) {
      setOpeningAmount('')
      setPickedEmployees([])
      setShiftType('unico')
      toast.success('Caja abierta exitosamente')
    } else {
      toast.error(result.error || 'Error al abrir caja')
    }
    setIsOpening(false)
  }

  const handleAddMovement = async () => {
    const amount = parseFloat(movementAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingrese un monto valido')
      return
    }
    if (!movementReason.trim()) {
      toast.error('Ingrese una razon')
      return
    }
    setIsSubmittingMovement(true)
    const result = await storeAddMovement({
      type: movementType,
      amount,
      reason: movementReason.trim(),
      notes: movementNotes.trim() || undefined,
      userName: user?.name,
    })
    if (result.success) {
      setIsMovementDialogOpen(false)
      setMovementAmount('')
      setMovementReason('')
      setMovementNotes('')
      fetchTotals()
      fetchMovements()
      toast.success(`${movementType === 'entrada' ? 'Entrada' : 'Salida'} registrada`)
    } else {
      toast.error(result.error || 'Error al registrar movimiento')
    }
    setIsSubmittingMovement(false)
  }

  const handleCloseCaja = async () => {
    const amount = parseFloat(actualCash)
    if (isNaN(amount) || amount < 0) {
      toast.error('Ingrese el monto contado')
      return
    }
    setIsClosing(true)
    const result = await storeCloseSession(amount, user?.name || 'Usuario', {
      observations: observations.trim() || undefined,
      bonuses: closeBonuses.length ? closeBonuses : undefined,
    })
    if (result.success && result.data) {
      setCierreResult(result.data)
      setCierreStep('result')
      setCloseBonuses([])
    } else {
      toast.error(result.error || 'Error al cerrar caja')
    }
    setIsClosing(false)
  }

  const handleCierreAccept = () => {
    setIsCierreDialogOpen(false)
    setCierreStep('input')
    setCierreResult(null)
    setActualCash('')
    setObservations('')
    setShowCierreDenomCalc(false)
    resetCierreDenomCalc()
    resetStore()
    if (isAdmin) fetchHistory()
  }

  const openMovementDialog = (type: 'entrada' | 'salida') => {
    setMovementType(type)
    setMovementAmount('')
    setMovementReason('')
    setMovementNotes('')
    setIsMovementDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // =============== STATE A: No active session ===============
  if (!activeSession) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground">Caja Registradora</h2>
          <p className="text-sm lg:text-base text-muted-foreground">Gestiona la apertura y cierre de caja</p>
        </div>

        {/* Open session card */}
        <Card className="border-border bg-card max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <Unlock className="h-5 w-5 text-primary" />
              Apertura de Caja
            </CardTitle>
            <CardDescription>Registre el fondo inicial para iniciar el turno</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selector de turno (opcional: 'Único' = flujo de hoy) */}
            <ShiftSelector value={shiftType} onChange={setShiftType} />

            <div className="space-y-2">
              <Label htmlFor="openingAmount">Fondo de caja (efectivo inicial)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  id="openingAmount"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="100000"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="pl-7"
                  onKeyDown={(e) => e.key === 'Enter' && handleOpenSession()}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Dinero disponible para dar cambio al inicio del turno
              </p>
            </div>

            {/* Empleados del turno (opcional) */}
            <EmployeePicker value={pickedEmployees} onChange={setPickedEmployees} />

            <Button onClick={handleOpenSession} disabled={isOpening} className="w-full gap-2">
              <Unlock className="h-4 w-4" />
              {isOpening ? 'Abriendo...' : 'Abrir Caja'}
            </Button>
          </CardContent>
        </Card>

        {/* Session History */}
        {isAdmin && sessionHistory.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Historial de Cierres
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* ── Tarjetas (móvil) ── */}
              <div className="md:hidden divide-y divide-border">
                {sessionHistory.map((session) => (
                  <div key={session.id} className="p-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setDetailSession(session)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {new Date(session.openedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{session.openedByName}</p>
                      </div>
                      <ClosingStatusBadge status={session.closingStatus} difference={session.difference} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                      <div><p className="text-[10px] text-muted-foreground">Apertura</p><p className="text-xs font-medium">{formatCOP(session.openingAmount)}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Esperado</p><p className="text-xs font-medium">{session.expectedCash != null ? formatCOP(session.expectedCash) : '-'}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Real</p><p className="text-xs font-medium">{session.actualCash != null ? formatCOP(session.actualCash) : '-'}</p></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Tabla (escritorio) ── */}
              <div className="hidden md:block overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Fecha</TableHead>
                    <TableHead className="text-muted-foreground">Cajero</TableHead>
                    <TableHead className="text-muted-foreground text-right">Apertura</TableHead>
                    <TableHead className="text-muted-foreground text-right">Esperado</TableHead>
                    <TableHead className="text-muted-foreground text-right">Real</TableHead>
                    <TableHead className="text-muted-foreground text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionHistory.map((session) => (
                    <TableRow key={session.id} className="border-border cursor-pointer hover:bg-muted/40" onClick={() => setDetailSession(session)}>
                      <TableCell className="text-sm">
                        {new Date(session.openedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-sm">{session.openedByName}</TableCell>
                      <TableCell className="text-right text-sm">{formatCOP(session.openingAmount)}</TableCell>
                      <TableCell className="text-right text-sm">{session.expectedCash != null ? formatCOP(session.expectedCash) : '-'}</TableCell>
                      <TableCell className="text-right text-sm">{session.actualCash != null ? formatCOP(session.actualCash) : '-'}</TableCell>
                      <TableCell className="text-center">
                        <ClosingStatusBadge status={session.closingStatus} difference={session.difference} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detalle de un cierre pasado con su libro de ventas (Fase 1 GastroBar) */}
        <SessionDetailDialog session={detailSession} onClose={() => setDetailSession(null)} />
      </div>
    )
  }

  // =============== STATE B: Active session ===============
  const totalAllSales = (liveTotals?.cashSales || 0) + (liveTotals?.cardSales || 0) + (liveTotals?.transferSales || 0) + (liveTotals?.fiadoSales || 0)

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
            Caja Registradora
            <ShiftBadge shiftType={(activeSession as any).shiftType} shiftLabel={(activeSession as any).shiftLabel} />
          </h2>
          <p className="text-sm text-muted-foreground">
            Abierta por <span className="font-medium text-foreground">{activeSession.openedByName}</span> el{' '}
            {new Date(activeSession.openedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {' '}| Fondo: <span className="font-medium text-foreground">{formatCOP(activeSession.openingAmount)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDailySummary(true)} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Resumen del día
          </Button>
          <Button variant="outline" size="sm" onClick={() => { fetchTotals(); fetchMovements() }} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setCierreStep('input'); setActualCash(''); setObservations(''); setIsCierreDialogOpen(true) }}
              className="gap-1"
            >
              <Lock className="h-4 w-4" />
              Cerrar Caja
            </Button>
          )}
        </div>
      </div>

      {/* Empleados del turno (solo si la sesión usa turnos) */}
      {activeSession.shiftType && (
        <Card className="border-border bg-card">
          <CardContent className="pt-4">
            <ShiftEmployeeManager sessionId={activeSession.id} />
          </CardContent>
        </Card>
      )}

      {/* Resumen del día (modal) */}
      <Dialog open={showDailySummary} onOpenChange={setShowDailySummary}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Resumen consolidado del día</DialogTitle></DialogHeader>
          <DailySummaryView />
        </DialogContent>
      </Dialog>

      {/* Live Totals Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <TotalCard
          title="Ventas Efectivo"
          value={liveTotals?.cashSales || 0}
          icon={<Banknote className="h-5 w-5 text-green-500" />}
        />
        <TotalCard
          title="Ventas Tarjeta"
          value={liveTotals?.cardSales || 0}
          icon={<CreditCard className="h-5 w-5 text-blue-500" />}
        />
        <TotalCard
          title="Transferencias"
          value={liveTotals?.transferSales || 0}
          icon={<Landmark className="h-5 w-5 text-purple-500" />}
        />
        <TotalCard
          title="Fiados"
          value={liveTotals?.fiadoSales || 0}
          icon={<HandCoins className="h-5 w-5 text-orange-500" />}
        />
        <TotalCard
          title="Total Ventas"
          value={totalAllSales}
          subtitle={`${liveTotals?.salesCount || 0} ventas`}
          icon={<Receipt className="h-5 w-5 text-primary" />}
          highlight
        />
        <TotalCard
          title="Cambio Entregado"
          value={liveTotals?.changeGiven || 0}
          subtitle="Informativo"
          icon={<Coins className="h-5 w-5 text-muted-foreground" />}
        />
        <TotalCard
          title="Entradas"
          value={liveTotals?.cashEntries || 0}
          icon={<PlusCircle className="h-5 w-5 text-green-400" />}
        />
        <TotalCard
          title="Salidas"
          value={liveTotals?.cashWithdrawals || 0}
          icon={<MinusCircle className="h-5 w-5 text-red-500" />}
        />
      </div>

      {/* Action Buttons + Movements */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => openMovementDialog('entrada')} className="gap-2">
          <ArrowUpCircle className="h-4 w-4 text-green-500" />
          Registrar Entrada
        </Button>
        <Button variant="outline" onClick={() => openMovementDialog('salida')} className="gap-2">
          <ArrowDownCircle className="h-4 w-4 text-red-500" />
          Registrar Salida
        </Button>
      </div>

      {/* Movements Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base lg:text-lg">Movimientos de Caja</CardTitle>
          <CardDescription>Entradas y salidas de efectivo durante esta sesion</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* ── Tarjetas (móvil) ── */}
          <div className="md:hidden">
            {movements.length === 0 ? (
              <p className="h-20 flex items-center justify-center text-center text-muted-foreground text-sm">No hay movimientos registrados</p>
            ) : (
              <div className="divide-y divide-border">
                {movements.map((mov) => (
                  <div key={mov.id} className="flex items-start justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={mov.type === 'entrada' ? 'default' : 'destructive'} className="text-[10px]">
                          {mov.type === 'entrada' ? 'Entrada' : 'Salida'}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(mov.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{mov.reason}</p>
                      {mov.notes && <p className="text-xs text-muted-foreground">{mov.notes}</p>}
                      <p className="text-[11px] text-muted-foreground">{mov.createdByName}</p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${mov.type === 'entrada' ? 'text-green-500' : 'text-red-500'}`}>
                      {mov.type === 'entrada' ? '+' : '-'}{formatCOP(mov.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Tabla (escritorio) ── */}
          <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Hora</TableHead>
                <TableHead className="text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-muted-foreground">Razon</TableHead>
                <TableHead className="text-muted-foreground">Responsable</TableHead>
                <TableHead className="text-muted-foreground text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((mov) => (
                  <TableRow key={mov.id} className="border-border">
                    <TableCell className="text-sm">
                      {new Date(mov.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={mov.type === 'entrada' ? 'default' : 'destructive'} className="text-xs">
                        {mov.type === 'entrada' ? 'Entrada' : 'Salida'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {mov.reason}
                      {mov.notes && <span className="text-xs text-muted-foreground block">{mov.notes}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{mov.createdByName}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${mov.type === 'entrada' ? 'text-green-500' : 'text-red-500'}`}>
                      {mov.type === 'entrada' ? '+' : '-'}{formatCOP(mov.amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Movement Dialog */}
      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {movementType === 'entrada' ? (
                <ArrowUpCircle className="h-5 w-5 text-green-500" />
              ) : (
                <ArrowDownCircle className="h-5 w-5 text-red-500" />
              )}
              Registrar {movementType === 'entrada' ? 'Entrada' : 'Salida'} de Caja
            </DialogTitle>
            <DialogDescription>
              {movementType === 'entrada'
                ? 'Registre dinero que ingresa a la caja (ej. prestamos, aportes)'
                : 'Registre dinero que sale de la caja (ej. pago a proveedores, compras)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="1"
                  step="100"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  className="pl-7"
                  placeholder="50000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Razon</Label>
              <Input
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder={movementType === 'entrada' ? 'Ej: Aporte de socio' : 'Ej: Pago a proveedor'}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={movementNotes}
                onChange={(e) => setMovementNotes(e.target.value)}
                placeholder="Detalles adicionales..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddMovement} disabled={isSubmittingMovement}>
              {isSubmittingMovement ? 'Registrando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cierre Dialog - CIERRE CIEGO */}
      <Dialog open={isCierreDialogOpen} onOpenChange={(open) => {
        if (!open && cierreStep === 'result') {
          handleCierreAccept()
        } else if (!open) {
          setIsCierreDialogOpen(false)
          setShowCierreDenomCalc(false)
          resetCierreDenomCalc()
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {cierreStep === 'input' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-destructive" />
                  Cierre de Caja - Conteo
                </DialogTitle>
                <DialogDescription>
                  Cuente el dinero en efectivo en la caja y registre el total. No se muestra el saldo esperado para garantizar un conteo imparcial.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Toggle denomination calculator */}
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Efectivo contado en caja</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setShowCierreDenomCalc(!showCierreDenomCalc)
                      if (!showCierreDenomCalc) resetCierreDenomCalc()
                    }}
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    {showCierreDenomCalc ? 'Ocultar' : 'Contar billetes'}
                    {showCierreDenomCalc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>

                {/* Denomination Calculator for Cierre */}
                {showCierreDenomCalc && (
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5" />
                        Contar billetes y monedas
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={resetCierreDenomCalc}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Limpiar
                      </Button>
                    </div>

                    {/* Billetes */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Billetes</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {DENOMINATIONS.filter(d => d.type === 'billete').map(d => {
                          const count = cierreDenomCounts[d.value] || 0
                          return (
                            <div
                              key={d.value}
                              className={`flex flex-col items-center rounded-md border p-1.5 transition-colors ${
                                count > 0 ? 'border-primary bg-primary/5' : 'border-border bg-card'
                              }`}
                            >
                              <span className="text-[10px] font-medium text-muted-foreground">{d.label}</span>
                              <div className="flex items-center gap-1 mt-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => handleCierreDenomChange(d.value, -1)}
                                  disabled={count === 0}
                                >
                                  <Minus className="h-2.5 w-2.5" />
                                </Button>
                                <input
                                  type="number"
                                  min="0"
                                  value={count || ''}
                                  placeholder="0"
                                  onChange={(e) => handleCierreDenomSet(d.value, parseInt(e.target.value) || 0)}
                                  className="w-8 text-center text-sm font-semibold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => handleCierreDenomChange(d.value, 1)}
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                              {count > 0 && (
                                <span className="text-[10px] text-primary font-medium">
                                  {formatCOP(d.value * count)}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Monedas */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Monedas</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {DENOMINATIONS.filter(d => d.type === 'moneda').map(d => {
                          const count = cierreDenomCounts[d.value] || 0
                          return (
                            <div
                              key={d.value}
                              className={`flex flex-col items-center rounded-md border p-1.5 transition-colors ${
                                count > 0 ? 'border-primary bg-primary/5' : 'border-border bg-card'
                              }`}
                            >
                              <span className="text-[10px] font-medium text-muted-foreground">{d.label}</span>
                              <div className="flex items-center gap-0.5 mt-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => handleCierreDenomChange(d.value, -1)}
                                  disabled={count === 0}
                                >
                                  <Minus className="h-2.5 w-2.5" />
                                </Button>
                                <input
                                  type="number"
                                  min="0"
                                  value={count || ''}
                                  placeholder="0"
                                  onChange={(e) => handleCierreDenomSet(d.value, parseInt(e.target.value) || 0)}
                                  className="w-6 text-center text-xs font-semibold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => handleCierreDenomChange(d.value, 1)}
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                              {count > 0 && (
                                <span className="text-[10px] text-primary font-medium">
                                  {formatCOP(d.value * count)}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Denomination Total */}
                    <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2">
                      <span className="text-sm font-medium text-foreground">Total contado:</span>
                      <span className="text-lg font-bold text-primary">{formatCOP(cierreDenomTotal)}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      className="pl-7 text-lg h-12"
                      placeholder="0"
                      autoFocus={!showCierreDenomCalc}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observaciones (opcional)</Label>
                  <Textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Ej: Se encontro un billete falso de $50.000..."
                    rows={3}
                  />
                </div>

                {/* Bonos y descuentos por empleado (si la sesión tiene turno) */}
{activeSession.shiftType && (
                  <div className="border-t pt-3">
                    <BonusDiscountPanel sessionId={activeSession.id} onChange={setCloseBonuses} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCierreDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleCloseCaja} disabled={isClosing}>
                  {isClosing ? 'Cerrando...' : 'Registrar Conteo y Cerrar'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {cierreResult?.closingStatus === 'cuadrado' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {cierreResult?.closingStatus === 'sobrante' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                  {cierreResult?.closingStatus === 'faltante' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                  Resultado del Cierre
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Status Badge */}
                <div className="flex justify-center">
                  <ClosingStatusBadge status={cierreResult?.closingStatus} difference={cierreResult?.difference} large />
                </div>

                {/* Main numbers */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Esperado</p>
                    <p className="text-sm font-semibold text-foreground">
                      {cierreResult?.expectedCash != null ? formatCOP(cierreResult.expectedCash) : '-'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Contado</p>
                    <p className="text-sm font-semibold text-foreground">
                      {cierreResult?.actualCash != null ? formatCOP(cierreResult.actualCash) : '-'}
                    </p>
                  </div>
                  <div className={`rounded-lg p-3 ${
                    cierreResult?.closingStatus === 'cuadrado' ? 'bg-green-500/10' :
                    cierreResult?.closingStatus === 'sobrante' ? 'bg-yellow-500/10' : 'bg-red-500/10'
                  }`}>
                    <p className="text-xs text-muted-foreground">Diferencia</p>
                    <p className={`text-sm font-semibold ${
                      cierreResult?.closingStatus === 'cuadrado' ? 'text-green-500' :
                      cierreResult?.closingStatus === 'sobrante' ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {cierreResult?.difference != null ? formatCOP(cierreResult.difference) : '-'}
                    </p>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Desglose</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fondo de apertura</span>
                    <span>{formatCOP(cierreResult?.openingAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">+ Ventas en efectivo</span>
                    <span className="text-green-500">{formatCOP(cierreResult?.totalCashSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">+ Entradas de caja</span>
                    <span className="text-green-500">{formatCOP(cierreResult?.totalCashEntries || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">- Salidas de caja</span>
                    <span className="text-red-400">{formatCOP(cierreResult?.totalCashWithdrawals || 0)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-medium">
                    <span>= Saldo esperado</span>
                    <span>{cierreResult?.expectedCash != null ? formatCOP(cierreResult.expectedCash) : '-'}</span>
                  </div>
                </div>

                {/* Other sales summary */}
                <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Otros metodos de pago</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tarjeta</span>
                    <span>{formatCOP(cierreResult?.totalCardSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transferencia</span>
                    <span>{formatCOP(cierreResult?.totalTransferSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fiado</span>
                    <span>{formatCOP(cierreResult?.totalFiadoSales || 0)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-medium">
                    <span>Total ventas ({cierreResult?.totalSalesCount || 0})</span>
                    <span>{formatCOP(
                      (cierreResult?.totalCashSales || 0) +
                      (cierreResult?.totalCardSales || 0) +
                      (cierreResult?.totalTransferSales || 0) +
                      (cierreResult?.totalFiadoSales || 0)
                    )}</span>
                  </div>
                </div>

                {/* Libro de ventas del turno (Fase 1 GastroBar) */}
                <SalesBookPanel salesBook={cierreResult?.salesBook} />
              </div>
              <DialogFooter>
                <Button onClick={handleCierreAccept} className="w-full">Aceptar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============= Helper Components =============

// Libro de ventas del turno: desglose por producto (cantidad + valor) con buscador.
// Reutilizable en el modal de cierre y en la revisión de cierres pasados.
function SalesBookPanel({ salesBook }: { salesBook?: SalesBookEntry[] }) {
  const [q, setQ] = useState('')
  const book = salesBook ?? []
  if (book.length === 0) return null
  const term = q.trim().toLowerCase()
  const rows = term ? book.filter(r => r.name.toLowerCase().includes(term)) : book
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0)
  const totalVal = rows.reduce((s, r) => s + r.total, 0)
  return (
    <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Libro de ventas del turno</p>
        <span className="text-[11px] text-muted-foreground">{book.length} productos</span>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto (ej: aguacate)…" className="pl-8 h-8 text-xs" />
      </div>
      <div className="max-h-56 overflow-y-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left font-medium py-1 px-1">Producto</th>
              <th className="text-right font-medium py-1 px-1 w-12">Cant.</th>
              <th className="text-right font-medium py-1 px-1 w-24">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-3">Sin coincidencias</td></tr>
            ) : rows.map(r => (
              <tr key={r.productId} className="border-b border-border/50 last:border-0">
                <td className="py-1 px-1 truncate max-w-[160px]">{r.name}</td>
                <td className="py-1 px-1 text-right tabular-nums font-medium">{r.quantity}</td>
                <td className="py-1 px-1 text-right tabular-nums">{formatCOP(r.total)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="py-1 px-1">Total{term ? ' (filtrado)' : ''}</td>
                <td className="py-1 px-1 text-right tabular-nums">{totalQty}</td>
                <td className="py-1 px-1 text-right tabular-nums">{formatCOP(totalVal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// Detalle de un cierre pasado: resumen + libro de ventas con buscador.
function SessionDetailDialog({ session, onClose }: { session: CashSession | null; onClose: () => void }) {
  if (!session) return null
  const totalSales = (session.totalCashSales || 0) + (session.totalCardSales || 0) + (session.totalTransferSales || 0) + (session.totalFiadoSales || 0)
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Cierre del {new Date(session.openedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </DialogTitle>
          <DialogDescription>{session.openedByName} · {session.totalSalesCount || 0} ventas · {formatCOP(totalSales)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[10px] text-muted-foreground">Apertura</p><p className="text-sm font-medium">{formatCOP(session.openingAmount)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Esperado</p><p className="text-sm font-medium">{session.expectedCash != null ? formatCOP(session.expectedCash) : '-'}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Real</p><p className="text-sm font-medium">{session.actualCash != null ? formatCOP(session.actualCash) : '-'}</p></div>
          </div>
          {session.salesBook && session.salesBook.length > 0 ? (
            <SalesBookPanel salesBook={session.salesBook} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
              Este cierre no tiene libro de ventas (se cerró antes de activar esta función).
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TotalCard({ title, value, subtitle, icon, highlight }: {
  title: string
  value: number
  subtitle?: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Card className={`border-border ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{title}</span>
          {icon}
        </div>
        <p className={`text-lg font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>
          {formatCOP(value)}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function ClosingStatusBadge({ status, difference, large }: {
  status?: string | null
  difference?: number | null
  large?: boolean
}) {
  if (!status) return <Badge variant="secondary" className="text-xs">-</Badge>

  const config = {
    cuadrado: { label: 'Cuadrado', className: 'bg-green-500/15 text-green-500 border-green-500/30' },
    sobrante: { label: `Sobrante`, className: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30' },
    faltante: { label: `Faltante`, className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  }[status] || { label: status, className: '' }

  const diffText = difference != null && difference !== 0 ? ` (${difference > 0 ? '+' : ''}${formatCOP(difference)})` : ''

  return (
    <Badge
      variant="outline"
      className={`${config.className} ${large ? 'text-base px-4 py-1.5' : 'text-xs'}`}
    >
      {config.label}{diffText}
    </Badge>
  )
}
