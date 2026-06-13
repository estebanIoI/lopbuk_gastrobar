'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import type {
  Service, ServiceType, ServiceAvailability, ServiceBlockedPeriod, ServiceBooking, BookingStatus,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Scissors, Calendar, MessageSquare, Plus, Edit, Trash2, Eye, Clock,
  CalendarOff, ToggleLeft, ToggleRight, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Image, X,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const SERVICE_TYPE_ICON = {
  cita: <Scissors className="h-4 w-4" />,
  asesoria: <MessageSquare className="h-4 w-4" />,
  contacto: <MessageSquare className="h-4 w-4" />,
}

const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  cita: 'Cita con calendario',
  asesoria: 'Asesoría / Cotización',
  contacto: 'Solo contacto',
}

const STATUS_BADGE: Record<BookingStatus, React.JSX.Element> = {
  pendiente: <Badge className="bg-yellow-100 text-yellow-700">Pendiente</Badge>,
  confirmada: <Badge className="bg-blue-100 text-blue-700">Confirmada</Badge>,
  completada: <Badge className="bg-green-100 text-green-700">Completada</Badge>,
  cancelada: <Badge className="bg-red-100 text-red-700">Cancelada</Badge>,
  no_asistio: <Badge className="bg-gray-100 text-gray-600">No asistió</Badge>,
}

// ─── Helpers ──────────────────────────────────────────────────────
const emptyServiceForm = () => ({
  name: '', description: '', category: '', serviceType: 'cita' as ServiceType,
  price: 0, priceType: 'fijo', durationMinutes: 60,
  requiresPayment: false, maxAdvanceDays: 30, cancellationHours: 24,
  imageUrl: '',
})

// ─── Main Component ───────────────────────────────────────────────
export function ServicesManagement() {
  const [services, setServices] = useState<Service[]>([])
  const [bookings, setBookings] = useState<ServiceBooking[]>([])
  const [blocked, setBlocked] = useState<ServiceBlockedPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('catalogo')

  // Form state
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [serviceForm, setServiceForm] = useState(emptyServiceForm())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Availability
  const [showAvailability, setShowAvailability] = useState<Service | null>(null)
  const [availability, setAvailability] = useState<ServiceAvailability[]>([])
  const [availDraft, setAvailDraft] = useState<Array<{
    dayOfWeek: number; startTime: string; endTime: string;
    slotDurationMinutes: number; maxSimultaneous: number;
  }>>([])

  // Blocked periods
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockForm, setBlockForm] = useState({
    serviceId: '', blockedDate: '', startTime: '', endTime: '', reason: '',
  })

  // Bookings
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null)
  const [bookingNote, setBookingNote] = useState('')

  // Calendar navigation
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [bookingFilter, setBookingFilter] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [svcRes, bkgRes, blkRes] = await Promise.all([
        api.getServices(),
        api.getServiceBookings({ limit: 50 }),
        api.getBlockedPeriods(),
      ])
      if (svcRes.success) setServices(svcRes.data || [])
      if (bkgRes.success) setBookings(bkgRes.data || [])
      if (blkRes.success) setBlocked(blkRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Service CRUD ─────────────────────────────────────────────
  const openCreate = () => {
    setEditingService(null)
    setServiceForm(emptyServiceForm())
    setFormError(null)
    setShowServiceForm(true)
  }

  const openEdit = (svc: Service) => {
    setEditingService(svc)
    setServiceForm({
      name: svc.name,
      description: svc.description || '',
      category: svc.category || '',
      serviceType: svc.serviceType,
      price: svc.price,
      priceType: svc.priceType,
      durationMinutes: svc.durationMinutes || 60,
      requiresPayment: svc.requiresPayment,
      maxAdvanceDays: svc.maxAdvanceDays,
      cancellationHours: svc.cancellationHours,
      imageUrl: svc.imageUrl || '',
    })
    setFormError(null)
    setShowServiceForm(true)
  }

  const submitService = async () => {
    setFormError(null)
    if (!serviceForm.name.trim()) { setFormError('El nombre es requerido'); return }
    setSubmitting(true)
    try {
      const payload = {
        ...serviceForm,
        price: Number(serviceForm.price),
        durationMinutes: serviceForm.serviceType === 'cita' ? Number(serviceForm.durationMinutes) : undefined,
        description: serviceForm.description || undefined,
        category: serviceForm.category || undefined,
        imageUrl: serviceForm.imageUrl || undefined,
      }
      const res = editingService
        ? await api.updateService(editingService.id, payload)
        : await api.createService(payload as Parameters<typeof api.createService>[0])
      if (res.success) {
        setShowServiceForm(false)
        await loadAll()
      } else {
        setFormError(res.error || 'Error al guardar')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const togglePublished = async (svc: Service) => {
    await api.updateService(svc.id, { isPublished: !svc.isPublished })
    await loadAll()
  }

  const deleteService = async (svc: Service) => {
    if (!confirm(`¿Eliminar "${svc.name}"? Esta acción no se puede deshacer.`)) return
    await api.deleteService(svc.id)
    await loadAll()
  }

  // ── Availability ─────────────────────────────────────────────
  const openAvailability = async (svc: Service) => {
    const res = await api.getServiceAvailability(svc.id)
    const current: ServiceAvailability[] = res.success ? (res.data || []) : []
    setAvailability(current)
    setAvailDraft(current.map((a) => ({
      dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime,
      slotDurationMinutes: a.slotDurationMinutes, maxSimultaneous: a.maxSimultaneous,
    })))
    setShowAvailability(svc)
  }

  const addAvailSlot = () => {
    setAvailDraft((p) => [...p, { dayOfWeek: 1, startTime: '08:00', endTime: '18:00', slotDurationMinutes: 30, maxSimultaneous: 1 }])
  }

  const saveAvailability = async () => {
    if (!showAvailability) return
    const normalized = availDraft.map(s => ({
      ...s,
      startTime: s.startTime.slice(0, 5),
      endTime: s.endTime.slice(0, 5),
    }))
    const res = await api.setServiceAvailability(showAvailability.id, normalized)
    if (res.success) { setShowAvailability(null); await loadAll() }
  }

  // ── Blocked periods ──────────────────────────────────────────
  const submitBlock = async () => {
    if (!blockForm.blockedDate) return
    const res = await api.addBlockedPeriod({
      serviceId: blockForm.serviceId || undefined,
      blockedDate: blockForm.blockedDate,
      startTime: blockForm.startTime || undefined,
      endTime: blockForm.endTime || undefined,
      reason: blockForm.reason || undefined,
    })
    if (res.success) {
      setShowBlockForm(false)
      setBlockForm({ serviceId: '', blockedDate: '', startTime: '', endTime: '', reason: '' })
      await loadAll()
    }
  }

  // ── Booking status ───────────────────────────────────────────
  const updateStatus = async (id: string, status: string) => {
    const res = await api.updateBookingStatus(id, { status, merchantNotes: bookingNote || undefined })
    if (res.success) { setSelectedBooking(null); setBookingNote(''); await loadAll() }
  }

  // ── Calendar helpers ─────────────────────────────────────────
  const calYear = calendarDate.getFullYear()
  const calMonth = calendarDate.getMonth()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  const bookingsForDay = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return bookings.filter((b) => b.bookingDate?.toString().startsWith(dateStr) && b.status !== 'cancelada')
  }

  const filteredBookings = bookings.filter((b) => {
    if (!bookingFilter) return true
    const f = bookingFilter.toLowerCase()
    return b.clientName.toLowerCase().includes(f) ||
      b.clientPhone.includes(f) ||
      b.serviceName.toLowerCase().includes(f)
  })

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tus servicios, horarios y reservas
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="reservas">
            Reservas
            {bookings.filter((b) => b.status === 'pendiente').length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 justify-center bg-destructive text-white text-xs">
                {bookings.filter((b) => b.status === 'pendiente').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="bloqueos">Bloqueos</TabsTrigger>
        </TabsList>

        {/* ── TAB: Catálogo ─────────────────────────────────────── */}
        <TabsContent value="catalogo" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo Servicio
            </Button>
          </div>

          {services.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Scissors className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="font-medium text-muted-foreground">Sin servicios aún</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Crea tu primer servicio para empezar a recibir reservas
                </p>
                <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Crear servicio</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {services.map((svc) => (
                <Card key={svc.id} className={!svc.isPublished ? 'opacity-70' : ''}>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-primary/10 p-1.5">
                          {SERVICE_TYPE_ICON[svc.serviceType]}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{svc.name}</p>
                          <p className="text-xs text-muted-foreground">{SERVICE_TYPE_LABEL[svc.serviceType]}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => togglePublished(svc)}
                        title={svc.isPublished ? 'Publicado - clic para ocultar' : 'Oculto - clic para publicar'}
                      >
                        {svc.isPublished
                          ? <ToggleRight className="h-6 w-6 text-green-500" />
                          : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                      </button>
                    </div>

                    {svc.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{svc.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {svc.priceType === 'gratis' ? 'Gratis'
                          : svc.priceType === 'cotizacion' ? 'Cotización'
                          : `${svc.priceType === 'desde' ? 'Desde ' : ''}${formatCOP(svc.price)}`}
                      </span>
                      {svc.durationMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />{svc.durationMinutes} min
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1 pt-1">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(svc)}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      {svc.serviceType === 'cita' && (
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openAvailability(svc)}>
                          <Calendar className="h-3.5 w-3.5 mr-1" /> Horarios
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteService(svc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Reservas ─────────────────────────────────────── */}
        <TabsContent value="reservas" className="mt-4 space-y-4">
          <Input
            placeholder="Buscar por nombre, teléfono o servicio..."
            value={bookingFilter}
            onChange={(e) => setBookingFilter(e.target.value)}
            className="max-w-sm"
          />

          {filteredBookings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">No hay reservas aún</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Fecha / Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{b.clientName}</p>
                        <p className="text-xs text-muted-foreground">{b.clientPhone}</p>
                      </TableCell>
                      <TableCell className="text-sm">{b.serviceName}</TableCell>
                      <TableCell className="text-sm">
                        {b.bookingDate
                          ? `${new Date(b.bookingDate).toLocaleDateString('es-CO')} ${b.startTime ? `• ${b.startTime}` : ''}`
                          : b.preferredDateRange || <span className="text-muted-foreground text-xs">Sin fecha</span>
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{b.bookingType}</Badge>
                      </TableCell>
                      <TableCell>{STATUS_BADGE[b.status]}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedBooking(b); setBookingNote(b.merchantNotes || '') }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Calendario ───────────────────────────────────── */}
        <TabsContent value="calendario" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base capitalize">
                  {calendarDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setCalendarDate(new Date(calYear, calMonth - 1, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setCalendarDate(new Date(calYear, calMonth + 1, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
                {DAYS.map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const dayBookings = bookingsForDay(day)
                  const isToday = new Date().toDateString() === new Date(calYear, calMonth, day).toDateString()
                  return (
                    <div key={day} className={`min-h-[60px] rounded-md p-1 border text-xs ${isToday ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <span className={`font-semibold ${isToday ? 'text-primary' : ''}`}>{day}</span>
                      {dayBookings.slice(0, 3).map((b) => (
                        <button key={b.id}
                          onClick={() => { setSelectedBooking(b); setBookingNote(b.merchantNotes || '') }}
                          className="mt-0.5 w-full truncate rounded bg-blue-100 px-1 text-blue-700 text-left hover:bg-blue-200 transition-colors"
                        >
                          {b.startTime ? `${b.startTime} ` : ''}{b.clientName.split(' ')[0]}
                        </button>
                      ))}
                      {dayBookings.length > 3 && (
                        <span className="text-muted-foreground">+{dayBookings.length - 3} más</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Bloqueos ─────────────────────────────────────── */}
        <TabsContent value="bloqueos" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowBlockForm(true)}>
              <CalendarOff className="mr-2 h-4 w-4" /> Bloquear fecha
            </Button>
          </div>

          {blocked.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <CalendarOff className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Sin fechas bloqueadas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Servicio afectado</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocked.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        {new Date(b.blockedDate).toLocaleDateString('es-CO')}
                      </TableCell>
                      <TableCell>
                        {b.startTime ? `${b.startTime} - ${b.endTime}` : 'Día completo'}
                      </TableCell>
                      <TableCell>
                        {b.serviceId
                          ? services.find((s) => s.id === b.serviceId)?.name || b.serviceId
                          : <span className="text-muted-foreground text-xs">Todos los servicios</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.reason || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-destructive"
                          onClick={async () => { await api.removeBlockedPeriod(b.id); await loadAll() }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Service Form Dialog ────────────────────────────────── */}
      <Dialog open={showServiceForm} onOpenChange={(o) => { if (!submitting) setShowServiceForm(o) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Nombre del servicio <span className="text-destructive">*</span></Label>
                <Input placeholder="Ej: Esmaltado de uñas"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Tipo de servicio</Label>
                <Select value={serviceForm.serviceType}
                  onValueChange={(v) => setServiceForm((p) => ({ ...p, serviceType: v as ServiceType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cita">Cita con calendario (ej: estética, médico)</SelectItem>
                    <SelectItem value="asesoria">Asesoría / Cotización (ej: web, tapicería)</SelectItem>
                    <SelectItem value="contacto">Solo contacto / Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Precio</Label>
                <Input type="number" min={0} value={serviceForm.price}
                  onChange={(e) => setServiceForm((p) => ({ ...p, price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de precio</Label>
                <Select value={serviceForm.priceType}
                  onValueChange={(v) => setServiceForm((p) => ({ ...p, priceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fijo">Precio fijo</SelectItem>
                    <SelectItem value="desde">Desde</SelectItem>
                    <SelectItem value="gratis">Gratis</SelectItem>
                    <SelectItem value="cotizacion">Cotización</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {serviceForm.serviceType === 'cita' && (
                <div className="space-y-1.5">
                  <Label>Duración (min)</Label>
                  <Input type="number" min={5} step={5} value={serviceForm.durationMinutes}
                    onChange={(e) => setServiceForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Input placeholder="Ej: Uñas, Pestañas..." value={serviceForm.category}
                  onChange={(e) => setServiceForm((p) => ({ ...p, category: e.target.value }))} />
              </div>

              {serviceForm.serviceType === 'cita' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Máx. días anticipación</Label>
                    <Input type="number" min={1} value={serviceForm.maxAdvanceDays}
                      onChange={(e) => setServiceForm((p) => ({ ...p, maxAdvanceDays: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Horas mín. para cancelar</Label>
                    <Input type="number" min={0} value={serviceForm.cancellationHours}
                      onChange={(e) => setServiceForm((p) => ({ ...p, cancellationHours: Number(e.target.value) }))} />
                  </div>
                </>
              )}

              <div className="col-span-2 space-y-1.5">
                <Label>Descripción</Label>
                <Textarea placeholder="Describe el servicio..." rows={3} value={serviceForm.description}
                  onChange={(e) => setServiceForm((p) => ({ ...p, description: e.target.value }))} />
              </div>

              {/* Image URL */}
              <div className="col-span-2 space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5" /> Imagen del servicio
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://... URL de la imagen"
                    value={serviceForm.imageUrl}
                    onChange={(e) => setServiceForm((p) => ({ ...p, imageUrl: e.target.value }))}
                  />
                  {serviceForm.imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setServiceForm((p) => ({ ...p, imageUrl: '' }))}
                      title="Quitar imagen"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {serviceForm.imageUrl && (
                  <div className="relative w-full h-36 rounded-md overflow-hidden border bg-muted mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={serviceForm.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                )}
              </div>
            </div>
            {formError && <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceForm(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={submitService} disabled={submitting}>
              {submitting ? 'Guardando...' : editingService ? 'Actualizar' : 'Crear servicio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Availability Dialog ──────────────────────────────────── */}
      <Dialog open={!!showAvailability} onOpenChange={(o) => { if (!o) setShowAvailability(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Horarios — {showAvailability?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Define los días y rangos horarios en que ofreces este servicio. Cada fila es un turno.
            </p>
            {availDraft.map((slot, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end rounded-md border p-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Día</Label>
                  <Select value={String(slot.dayOfWeek)}
                    onValueChange={(v) => setAvailDraft((p) => p.map((s, j) => j === i ? { ...s, dayOfWeek: Number(v) } : s))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS_FULL.map((d, idx) => <SelectItem key={idx} value={String(idx)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Inicio</Label>
                  <Input type="time" className="h-8 text-xs" value={slot.startTime}
                    onChange={(e) => setAvailDraft((p) => p.map((s, j) => j === i ? { ...s, startTime: e.target.value } : s))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fin</Label>
                  <Input type="time" className="h-8 text-xs" value={slot.endTime}
                    onChange={(e) => setAvailDraft((p) => p.map((s, j) => j === i ? { ...s, endTime: e.target.value } : s))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Slot (min)</Label>
                  <Input type="number" min={5} className="h-8 text-xs" value={slot.slotDurationMinutes}
                    onChange={(e) => setAvailDraft((p) => p.map((s, j) => j === i ? { ...s, slotDurationMinutes: Number(e.target.value) } : s))} />
                </div>
                <div className="flex items-end gap-1">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Máx. sim.</Label>
                    <Input type="number" min={1} className="h-8 text-xs" value={slot.maxSimultaneous}
                      onChange={(e) => setAvailDraft((p) => p.map((s, j) => j === i ? { ...s, maxSimultaneous: Number(e.target.value) } : s))} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive mb-0"
                    onClick={() => setAvailDraft((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addAvailSlot}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar turno
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAvailability(null)}>Cancelar</Button>
            <Button onClick={saveAvailability}>Guardar horarios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Block Period Dialog ──────────────────────────────────── */}
      <Dialog open={showBlockForm} onOpenChange={setShowBlockForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bloquear fecha / horario</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Servicio afectado (opcional)</Label>
              <Select value={blockForm.serviceId || '__all__'}
                onValueChange={(v) => setBlockForm((p) => ({ ...p, serviceId: v === '__all__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Todos los servicios" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los servicios</SelectItem>
                  {services.filter((s) => s.serviceType === 'cita').map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha <span className="text-destructive">*</span></Label>
              <Input type="date" value={blockForm.blockedDate}
                onChange={(e) => setBlockForm((p) => ({ ...p, blockedDate: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hora inicio (opcional)</Label>
                <Input type="time" value={blockForm.startTime}
                  onChange={(e) => setBlockForm((p) => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora fin</Label>
                <Input type="time" value={blockForm.endTime}
                  onChange={(e) => setBlockForm((p) => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Input placeholder="Vacaciones, festivo, mantenimiento..." value={blockForm.reason}
                onChange={(e) => setBlockForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockForm(false)}>Cancelar</Button>
            <Button onClick={submitBlock} disabled={!blockForm.blockedDate}>Bloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Booking Detail Dialog ────────────────────────────────── */}
      {selectedBooking && (
        <Dialog open onOpenChange={() => { setSelectedBooking(null); setBookingNote('') }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reserva — {selectedBooking.serviceName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Cliente</p><p className="font-semibold">{selectedBooking.clientName}</p></div>
                <div><p className="text-muted-foreground text-xs">Teléfono</p><p className="font-semibold">{selectedBooking.clientPhone}</p></div>
                {selectedBooking.clientEmail && (
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">Email</p><p>{selectedBooking.clientEmail}</p></div>
                )}
                {selectedBooking.bookingDate && (
                  <div><p className="text-muted-foreground text-xs">Fecha</p>
                    <p className="font-semibold">{new Date(selectedBooking.bookingDate).toLocaleDateString('es-CO')}</p>
                  </div>
                )}
                {selectedBooking.startTime && (
                  <div><p className="text-muted-foreground text-xs">Hora</p><p className="font-semibold">{selectedBooking.startTime}</p></div>
                )}
                {selectedBooking.projectDescription && (
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">Descripción</p><p>{selectedBooking.projectDescription}</p></div>
                )}
                {selectedBooking.clientNotes && (
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">Notas del cliente</p><p>{selectedBooking.clientNotes}</p></div>
                )}
                <div><p className="text-muted-foreground text-xs">Estado</p>{STATUS_BADGE[selectedBooking.status]}</div>
              </div>

              <div className="space-y-1.5">
                <Label>Notas internas</Label>
                <Textarea rows={2} placeholder="Notas para tu equipo..." value={bookingNote}
                  onChange={(e) => setBookingNote(e.target.value)} />
              </div>

              {selectedBooking.status === 'pendiente' && (
                <div className="flex gap-2">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" size="sm"
                    onClick={() => updateStatus(selectedBooking.id, 'confirmada')}>
                    <CheckCircle className="mr-1.5 h-4 w-4" /> Confirmar
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1"
                    onClick={() => updateStatus(selectedBooking.id, 'cancelada')}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Cancelar
                  </Button>
                </div>
              )}
              {selectedBooking.status === 'confirmada' && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1"
                    onClick={() => updateStatus(selectedBooking.id, 'completada')}>
                    <CheckCircle className="mr-1.5 h-4 w-4" /> Marcar completada
                  </Button>
                  <Button variant="outline" size="sm"
                    onClick={() => updateStatus(selectedBooking.id, 'no_asistio')}>
                    No asistió
                  </Button>
                </div>
              )}
              {!['pendiente', 'confirmada'].includes(selectedBooking.status) && bookingNote !== (selectedBooking.merchantNotes || '') && (
                <Button size="sm" onClick={() => updateStatus(selectedBooking.id, selectedBooking.status)}>
                  Guardar nota
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedBooking(null); setBookingNote('') }}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
