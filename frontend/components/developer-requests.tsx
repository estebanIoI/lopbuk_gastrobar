'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Clock,
  DollarSign,
  Sparkles,
  Target,
  Wrench,
  RefreshCw,
  Bug,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  CreditCard,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

type RequestType = 'objetivo' | 'mejora' | 'actualizacion' | 'bug' | 'otro'
type Priority    = 'baja' | 'media' | 'alta'
type Status =
  | 'pendiente' | 'en_revision' | 'cotizado' | 'aprobado'
  | 'en_progreso' | 'completado' | 'rechazado'

interface DevRequest {
  id: string
  title: string
  description: string
  type: RequestType
  priority: Priority
  status: Status
  estimatedHours: number | null
  pricePerHour: number | null
  totalPrice: number | null
  adminNotes: string | null
  rejectionReason: string | null
  createdAt: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<RequestType, { label: string; icon: React.ElementType; color: string }> = {
  objetivo:     { label: 'Objetivo',      icon: Target,     color: 'text-blue-400 bg-blue-400/10' },
  mejora:       { label: 'Mejora',        icon: Sparkles,   color: 'text-purple-400 bg-purple-400/10' },
  actualizacion:{ label: 'Actualización', icon: RefreshCw,  color: 'text-cyan-400 bg-cyan-400/10' },
  bug:          { label: 'Bug / Error',   icon: Bug,        color: 'text-red-400 bg-red-400/10' },
  otro:         { label: 'Otro',          icon: HelpCircle, color: 'text-gray-400 bg-gray-400/10' },
}

const PRIORITY_LABELS: Record<Priority, { label: string; color: string }> = {
  baja:  { label: 'Baja',  color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  media: { label: 'Media', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  alta:  { label: 'Alta',  color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

const STATUS_LABELS: Record<Status, { label: string; icon: React.ElementType; color: string }> = {
  pendiente:   { label: 'Pendiente',    icon: Clock,         color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
  en_revision: { label: 'En revisión',  icon: Loader2,       color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  cotizado:    { label: 'Cotizado',     icon: DollarSign,    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  aprobado:    { label: 'Aprobado',     icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  en_progreso: { label: 'En progreso',  icon: Wrench,        color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
  completado:  { label: 'Completado',   icon: CheckCircle2,  color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  rechazado:   { label: 'Rechazado',    icon: XCircle,       color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function DeveloperRequests() {
  const [requests, setRequests] = useState<DevRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null)
  const [devWhatsapp, setDevWhatsapp] = useState('')
  const [whatsappPendingReq, setWhatsappPendingReq] = useState<DevRequest | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'mejora' as RequestType,
    priority: 'media' as Priority,
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [reqRes, contactRes] = await Promise.all([
      api.getMyDevRequests(),
      api.getDevContactInfo(),
    ])
    if (reqRes.success && reqRes.data) setRequests(reqRes.data as DevRequest[])
    if (contactRes.success && contactRes.data) setDevWhatsapp(contactRes.data.whatsapp || '')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('El título y la descripción son requeridos')
      return
    }
    setSubmitting(true)
    const res = await api.createDevRequest(form)
    if (res.success) {
      toast.success('Solicitud enviada correctamente')
      setShowForm(false)
      setForm({ title: '', description: '', type: 'mejora', priority: 'media' })
      load()
    } else {
      toast.error(res.error || 'Error al enviar la solicitud')
    }
    setSubmitting(false)
  }

  const handleConfirmQuote = async (id: string) => {
    setConfirmingId(id)
    const res = await api.confirmDevRequestQuote(id)
    if (res.success) {
      toast.success('Confirmado por WhatsApp. El equipo te contactará pronto.')
      load()
    } else {
      toast.error(res.error || 'Error al confirmar')
    }
    setConfirmingId(null)
  }

  const handlePayWithMP = async (req: DevRequest) => {
    setCheckingOutId(req.id)
    const res = await api.createDevRequestCheckout(req.id)
    if (res.success && res.data?.initPoint) {
      window.location.href = res.data.initPoint
    } else {
      toast.error(res.error || 'No se pudo iniciar el pago')
      setCheckingOutId(null)
    }
  }

  const openWhatsApp = (req: DevRequest) => {
    const num = devWhatsapp.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Hola! Quiero confirmar la cotización para la solicitud *"${req.title}"*.\n\n` +
      `- Horas estimadas: ${req.estimatedHours}h\n` +
      `- Total: $${(req.totalPrice || 0).toLocaleString('es-CO')}\n\n` +
      `Quedo atento para coordinar el inicio del desarrollo.`
    )
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
    // Show confirmation dialog — do NOT change status until merchant explicitly confirms
    setWhatsappPendingReq(req)
  }

  const handleDelete = async (id: string) => {
    const res = await api.deleteDevRequest(id)
    if (res.success) {
      toast.success('Solicitud eliminada')
      setDeleteConfirmId(null)
      load()
    } else {
      toast.error(res.error || 'No se pudo eliminar')
    }
  }

  const statusCounts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const pendingTotal = requests
    .filter(r => r.status === 'cotizado' || r.status === 'aprobado')
    .reduce((s, r) => s + (r.totalPrice || 0), 0)

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes de Desarrollo</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Solicita mejoras, actualizaciones u objetivos para tu plataforma
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Nueva Solicitud
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: requests.length, color: 'text-foreground' },
          { label: 'Pendientes', value: (statusCounts['pendiente'] || 0) + (statusCounts['en_revision'] || 0), color: 'text-blue-400' },
          { label: 'En progreso', value: statusCounts['en_progreso'] || 0, color: 'text-cyan-400' },
          { label: 'Completadas', value: statusCounts['completado'] || 0, color: 'text-green-400' },
        ].map(s => (
          <Card key={s.label} className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Cotizaciones pendientes de aprobación ── */}
      {pendingTotal > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-4">
          <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-300">Tienes cotizaciones por confirmar</p>
            <p className="text-xs text-muted-foreground">
              Valor estimado total: <span className="text-yellow-400 font-semibold">{formatCOP(pendingTotal)}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="rounded-full bg-muted p-5">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">Sin solicitudes aún</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Describe qué quieres mejorar en tu plataforma y el equipo te enviará una cotización
            </p>
            <Button onClick={() => setShowForm(true)} className="mt-2 gap-2">
              <Plus className="h-4 w-4" />
              Crear primera solicitud
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const typeInfo   = TYPE_LABELS[req.type]
            const statusInfo = STATUS_LABELS[req.status]
            const prioInfo   = PRIORITY_LABELS[req.priority]
            const TypeIcon   = typeInfo.icon as React.ComponentType<{ className?: string }>
            const StatusIcon = statusInfo.icon as React.ComponentType<{ className?: string }>
            const isExpanded = expandedId === req.id

            return (
              <Card key={req.id} className="border-border bg-card overflow-hidden">
                <div
                  className="w-full text-left cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  onKeyDown={e => e.key === 'Enter' && setExpandedId(isExpanded ? null : req.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <div className={`mt-0.5 rounded-md p-2 shrink-0 ${typeInfo.color}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-medium truncate">{req.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${prioInfo.color}`}>
                            {prioInfo.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${statusInfo.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(req.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          {req.totalPrice !== null && (
                            <span className="text-xs font-semibold text-yellow-400">
                              {formatCOP(req.totalPrice)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expand / delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        {req.status === 'pendiente' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(req.id) }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Descripción</p>
                      <p className="text-sm whitespace-pre-wrap">{req.description}</p>
                    </div>

                    {req.estimatedHours !== null && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-xs text-muted-foreground">Horas estimadas</p>
                          <p className="text-base font-bold text-foreground">{req.estimatedHours}h</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-xs text-muted-foreground">Tarifa/hora</p>
                          <p className="text-base font-bold text-foreground">{formatCOP(req.pricePerHour || 0)}</p>
                        </div>
                        <div className="rounded-lg bg-yellow-400/10 p-3 text-center border border-yellow-400/20 col-span-2 sm:col-span-1">
                          <p className="text-xs text-muted-foreground">Total estimado</p>
                          <p className="text-base font-bold text-yellow-400">{formatCOP(req.totalPrice || 0)}</p>
                        </div>
                      </div>
                    )}

                    {req.adminNotes && (
                      <div className="rounded-lg bg-blue-400/5 border border-blue-400/20 p-3">
                        <p className="text-xs text-blue-400 font-medium mb-1">Notas del equipo</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{req.adminNotes}</p>
                      </div>
                    )}

                    {req.status === 'cotizado' && req.totalPrice !== null && (
                      <div className="rounded-lg border border-yellow-400/40 bg-yellow-400/5 p-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-yellow-300">Cotización recibida</p>
                            <p className="text-xs text-muted-foreground">
                              {req.estimatedHours}h × {formatCOP(req.pricePerHour || 0)}/h = <strong className="text-yellow-400">{formatCOP(req.totalPrice)}</strong>
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Elige cómo confirmar y pagar. Al aprobar, el equipo comenzará el desarrollo.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3">
                          {/* Opción 1: MercadoPago */}
                          <button
                            onClick={e => { e.stopPropagation(); handlePayWithMP(req) }}
                            disabled={checkingOutId === req.id}
                            className="flex flex-col items-center gap-2 rounded-lg border-2 border-blue-400/40 bg-blue-400/5 hover:bg-blue-400/10 hover:border-blue-400/70 transition-all p-4 cursor-pointer disabled:opacity-50"
                          >
                            {checkingOutId === req.id
                              ? <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                              : <CreditCard className="h-6 w-6 text-blue-400" />
                            }
                            <div className="text-center">
                              <p className="text-sm font-semibold text-blue-300">Pagar en línea</p>
                              <p className="text-xs text-muted-foreground">MercadoPago · tarjeta, PSE, efectivo</p>
                            </div>
                            <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                              {formatCOP(req.totalPrice)}
                            </span>
                          </button>

                          {/* Opción 2: WhatsApp */}
                          <button
                            onClick={e => { e.stopPropagation(); openWhatsApp(req) }}
                            disabled={confirmingId === req.id || !devWhatsapp}
                            className="flex flex-col items-center gap-2 rounded-lg border-2 border-green-400/40 bg-green-400/5 hover:bg-green-400/10 hover:border-green-400/70 transition-all p-4 cursor-pointer disabled:opacity-50"
                          >
                            {confirmingId === req.id
                              ? <Loader2 className="h-6 w-6 animate-spin text-green-400" />
                              : <MessageCircle className="h-6 w-6 text-green-400" />
                            }
                            <div className="text-center">
                              <p className="text-sm font-semibold text-green-300">Confirmar por WhatsApp</p>
                              <p className="text-xs text-muted-foreground">Coordiná el pago directamente</p>
                            </div>
                            {!devWhatsapp && (
                              <span className="text-xs text-muted-foreground">No configurado</span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {req.rejectionReason && (
                      <div className="rounded-lg bg-red-400/5 border border-red-400/20 p-3">
                        <p className="text-xs text-red-400 font-medium mb-1">Motivo de rechazo</p>
                        <p className="text-sm text-muted-foreground">{req.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── New Request Dialog ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Solicitud de Desarrollo</DialogTitle>
            <DialogDescription>
              Describe lo que necesitas y el equipo te enviará una cotización con el costo estimado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Ej: Agregar módulo de fidelización de clientes"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as RequestType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="objetivo">🎯 Objetivo</SelectItem>
                    <SelectItem value="mejora">✨ Mejora</SelectItem>
                    <SelectItem value="actualizacion">🔄 Actualización</SelectItem>
                    <SelectItem value="bug">🐛 Bug / Error</SelectItem>
                    <SelectItem value="otro">❓ Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v as Priority }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">🟢 Baja</SelectItem>
                    <SelectItem value="media">🟡 Media</SelectItem>
                    <SelectItem value="alta">🔴 Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción detallada *</Label>
              <Textarea
                placeholder="Describe con el mayor detalle posible qué necesitas, el contexto, y el comportamiento esperado..."
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={5}
                className="resize-none"
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-3 flex gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                El equipo revisará tu solicitud y te enviará una cotización con las horas estimadas y el costo total antes de comenzar.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar solicitud</DialogTitle>
            <DialogDescription>¿Estás seguro de que quieres eliminar esta solicitud? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── WhatsApp post-send confirmation Dialog ── */}
      <Dialog
        open={!!whatsappPendingReq}
        onOpenChange={open => { if (!open) setWhatsappPendingReq(null) }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-400" />
              ¿Ya coordinaste el pago?
            </DialogTitle>
            <DialogDescription>
              Se abrió WhatsApp para coordinar el pago. <strong className="text-foreground">La solicitud no será ejecutada</strong> hasta que confirmes el pago en línea o el equipo reciba tu confirmación por WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {whatsappPendingReq && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <p className="font-medium truncate">{whatsappPendingReq.title}</p>
              <p className="text-muted-foreground text-xs">
                {whatsappPendingReq.estimatedHours}h · <span className="text-yellow-400 font-semibold">{formatCOP(whatsappPendingReq.totalPrice || 0)}</span>
              </p>
            </div>
          )}

          <div className="rounded-lg bg-red-400/5 border border-red-400/20 p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Si no confirmas el pago aquí o no pagas en línea, <strong className="text-red-400">el equipo no iniciará el desarrollo</strong> de tu solicitud.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="w-full gap-2 bg-green-600 hover:bg-green-500 text-white h-11"
              disabled={confirmingId === whatsappPendingReq?.id}
              onClick={() => {
                if (whatsappPendingReq) {
                  handleConfirmQuote(whatsappPendingReq.id)
                  setWhatsappPendingReq(null)
                }
              }}
            >
              {confirmingId === whatsappPendingReq?.id
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirmando…</>
                : <><CheckCircle2 className="h-4 w-4" /> Sí, ya acordé el pago</>
              }
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 h-11"
              onClick={() => {
                if (!whatsappPendingReq) return
                const num = devWhatsapp.replace(/\D/g, '')
                const msg = encodeURIComponent(
                  `Hola! Quiero confirmar la cotización para la solicitud *"${whatsappPendingReq.title}"*.\n\n` +
                  `- Horas estimadas: ${whatsappPendingReq.estimatedHours}h\n` +
                  `- Total: $${(whatsappPendingReq.totalPrice || 0).toLocaleString('es-CO')}\n\n` +
                  `Quedo atento para coordinar el inicio del desarrollo.`
                )
                window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
              }}
            >
              <MessageCircle className="h-4 w-4 text-green-400" /> Volver a WhatsApp
            </Button>
            <button
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2 text-center"
              onClick={() => setWhatsappPendingReq(null)}
            >
              Cancelar — lo haré después
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
