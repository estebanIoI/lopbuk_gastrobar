'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import type { Service } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Calendar, Clock, CheckCircle, ChevronLeft, ChevronRight, Lock,
  Sparkles, ClipboardList, CalendarPlus, ShieldCheck, Plus, Check, UserRound, Users,
} from 'lucide-react'

type Addon = { id: string; name: string; price: number; priceType: string; durationMinutes?: number | null; description?: string | null }
type Specialist = { id: string; name: string; title?: string | null; photoUrl?: string | null }

interface Props {
  service: Service
  storeSlug: string
  onClose: () => void
}

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const BUDGET_OPTIONS = [
  'Menos de $500.000',
  '$500.000 - $1.000.000',
  '$1.000.000 - $3.000.000',
  'Más de $3.000.000',
  'Sin presupuesto definido',
]

export function ServiceBookingModal({ service, storeSlug, onClose }: Props) {
  const [step, setStep] = useState<'calendar' | 'form' | 'success'>('calendar')

  // Calendar
  const [calDate, setCalDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState('')
  type Slot = { time: string; endTime: string; status: string; spotsLeft: number }
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slotNotice, setSlotNotice] = useState<string | null>(null) // motivo de un slot no disponible
  // Ocupación por día del mes visible: { 'YYYY-MM-DD': { available, status } }
  const [monthAvail, setMonthAvail] = useState<Record<string, { available: number; status: string }>>({})
  // Reserva temporal (F2): apartar el cupo 5 min mientras el cliente completa datos
  const [holdToken, setHoldToken] = useState<string | null>(null)
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(0)
  const [holding, setHolding] = useState(false)

  // Form
  const [form, setForm] = useState({
    clientName: '', clientPhone: '', clientEmail: '', clientNotes: '',
    preferredDateRange: '', projectDescription: '', budgetRange: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cross-sell (F4): complementos que suben el ticket
  const [addons, setAddons] = useState<Addon[]>([])
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])

  // Especialista (F5): elegir profesional (o "sin preferencia")
  const [specialists, setSpecialists] = useState<Specialist[]>([])
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string>('') // '' = sin preferencia

  // Lista de espera (F6): cuando un día no tiene cupos
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistForm, setWaitlistForm] = useState({ name: '', phone: '' })
  const [waitlistDone, setWaitlistDone] = useState(false)
  const [waitlistSending, setWaitlistSending] = useState(false)

  const isCita = service.serviceType === 'cita'
  const isAsesoria = service.serviceType === 'asesoria'
  const benefits = (service.benefits || []).filter(Boolean)

  // Total = precio base (si es fijo/desde) + complementos elegidos
  const basePrice = ['fijo', 'desde'].includes(service.priceType) ? service.price : 0
  const selectedAddons = addons.filter((a) => selectedAddonIds.includes(a.id))
  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0)
  const total = basePrice + addonsTotal
  const toggleAddon = (id: string) =>
    setSelectedAddonIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])
  const selectedSpecialist = specialists.find((s) => s.id === selectedSpecialistId) || null

  // For contact/asesoria types, skip to form directly
  useEffect(() => {
    if (!isCita) setStep('form')
  }, [isCita])

  // Cargar complementos (cross-sell) — solo tiene sentido en citas
  useEffect(() => {
    if (!isCita) return
    api.getServiceAddons(service.id, storeSlug)
      .then((res) => { if (res.success && res.data) setAddons(res.data as Addon[]) })
      .catch(() => {})
  }, [service.id, storeSlug, isCita])

  // Cargar especialistas del servicio
  useEffect(() => {
    if (!isCita) return
    api.getPublicServiceSpecialists(service.id, storeSlug)
      .then((res) => { if (res.success && res.data) setSpecialists(res.data as Specialist[]) })
      .catch(() => {})
  }, [service.id, storeSlug, isCita])

  // Load slots (con estado) when date is selected
  useEffect(() => {
    if (!selectedDate || !isCita) return
    setLoadingSlots(true)
    setSlots([])
    setSelectedSlot('')
    setSlotNotice(null)
    setWaitlistOpen(false)
    setWaitlistDone(false)
    api.getPublicSlotsDetailed(service.id, storeSlug, selectedDate).then((res) => {
      if (res.success && res.data) setSlots(res.data.slots || [])
    }).finally(() => setLoadingSlots(false))
  }, [selectedDate, service.id, storeSlug, isCita])

  // Load month availability when the visible month changes → cupos por día
  useEffect(() => {
    if (!isCita) return
    api.getServiceMonthAvailability(service.id, storeSlug, calDate.getFullYear(), calDate.getMonth() + 1)
      .then((res) => { if (res.success && res.data) setMonthAvail(res.data as any) })
      .catch(() => {})
  }, [calDate, service.id, storeSlug, isCita])

  const calYear = calDate.getFullYear()
  const calMonth = calDate.getMonth()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + service.maxAdvanceDays)

  const isDaySelectable = (day: number) => {
    const d = new Date(calYear, calMonth, day)
    return d >= today && d <= maxDate
  }

  const handleDayClick = (day: number) => {
    if (!isDaySelectable(day)) return
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateStr)
  }

  // Liberar el hold en el backend (best-effort) y limpiar el estado local
  const releaseHold = () => {
    if (holdToken) { api.releaseServiceHold(holdToken).catch(() => {}); setHoldToken(null); setHoldSecondsLeft(0) }
  }

  // Continuar: apartar el cupo antes de mostrar el formulario (anti doble reserva)
  const handleContinue = async () => {
    if (!selectedDate || !selectedSlot) return
    setHolding(true); setSlotNotice(null)
    try {
      const res = await api.holdServiceSlot(service.id, storeSlug, selectedDate, selectedSlot.split('-')[0])
      if (res.success && res.data) {
        setHoldToken(res.data.holdToken)
        setHoldSecondsLeft(300)
        setStep('form')
      } else {
        // Alguien tomó el cupo mientras decidías → recargar disponibilidad
        setSlotNotice('Ese horario acaba de ocuparse. Elige otro, por favor.')
        setSelectedSlot('')
        api.getPublicSlotsDetailed(service.id, storeSlug, selectedDate).then(r => { if (r.success && r.data) setSlots(r.data.slots || []) })
      }
    } finally { setHolding(false) }
  }

  // Unirse a la lista de espera para el día seleccionado
  const submitWaitlist = async () => {
    if (!waitlistForm.name.trim() || !waitlistForm.phone.trim()) return
    setWaitlistSending(true)
    try {
      const res = await api.joinWaitlist(service.id, storeSlug, {
        clientName: waitlistForm.name.trim(),
        clientPhone: waitlistForm.phone.trim(),
        desiredDate: selectedDate || undefined,
      })
      if (res.success) { setWaitlistDone(true); setWaitlistOpen(false) }
    } finally { setWaitlistSending(false) }
  }

  // Cuenta regresiva del hold; al llegar a 0 lo suelta y vuelve al calendario
  useEffect(() => {
    if (!holdToken || step !== 'form') return
    if (holdSecondsLeft <= 0) {
      setHoldToken(null)
      setSelectedSlot('')
      setStep('calendar')
      setSlotNotice('Se agotó el tiempo para completar la reserva. Elige tu horario de nuevo.')
      if (selectedDate) api.getPublicSlotsDetailed(service.id, storeSlug, selectedDate).then(r => { if (r.success && r.data) setSlots(r.data.slots || []) })
      return
    }
    const t = setTimeout(() => setHoldSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [holdToken, holdSecondsLeft, step, selectedDate, service.id, storeSlug])

  // Soltar el hold si se cierra el modal
  useEffect(() => () => { if (holdToken) api.releaseServiceHold(holdToken).catch(() => {}) }, []) // eslint-disable-line

  const handleSubmit = async () => {
    setError(null)
    if (!form.clientName.trim()) { setError('Nombre requerido'); return }
    if (!form.clientPhone.trim()) { setError('Teléfono requerido'); return }
    if (isCita && !selectedSlot) { setError('Selecciona un horario'); return }

    setSubmitting(true)
    try {
      const res = await api.createPublicBooking(storeSlug, {
        serviceId: service.id,
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone.trim(),
        clientEmail: form.clientEmail.trim() || undefined,
        clientNotes: form.clientNotes.trim() || undefined,
        ...(isCita && selectedDate && selectedSlot ? {
          bookingDate: selectedDate,
          startTime: selectedSlot.split('-')[0],
          holdToken: holdToken || undefined,
          addonIds: selectedAddonIds.length ? selectedAddonIds : undefined,
          specialistId: selectedSpecialistId || undefined,
        } : {}),
        ...(isAsesoria ? {
          preferredDateRange: form.preferredDateRange || undefined,
          projectDescription: form.projectDescription || undefined,
          budgetRange: form.budgetRange || undefined,
        } : {}),
      })

      if (res.success) {
        setHoldToken(null) // el backend ya consumió el hold al crear la reserva
        setStep('success')
      } else {
        setError(res.error || 'No se pudo enviar la reserva')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const priceLabel = () => {
    if (service.priceType === 'gratis') return 'Gratis'
    if (service.priceType === 'cotizacion') return 'Cotización'
    return `${service.priceType === 'desde' ? 'Desde ' : ''}${formatCOP(service.price)}`
  }

  const longDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  // Enlace "Añadir a Google Calendar" para la confirmación
  const gcalLink = () => {
    if (!selectedDate || !selectedSlot) return '#'
    const [start, end] = selectedSlot.split('-')
    const day = selectedDate.replace(/-/g, '')
    const fmt = (t: string) => `${day}T${t.replace(':', '')}00`
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: service.name,
      dates: `${fmt(start)}/${fmt(end || start)}`,
      details: `Reserva de ${service.name}. Valor: ${priceLabel()}.`,
      ctz: 'America/Bogota',
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
  }

  const firstName = form.clientName.trim().split(' ')[0] || ''

  // ── Resumen fijo lateral (vende la experiencia) ─────────────────
  const Summary = (
    <aside className="md:order-2 md:w-[300px] shrink-0 border-t md:border-t-0 md:border-l bg-muted/30 flex flex-col md:overflow-y-auto">
      {service.imageUrl && (
        <div className="relative h-28 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={service.imageUrl} alt={service.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div>
          <p className="font-semibold leading-tight">{service.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{priceLabel()}</span>
            {service.durationMinutes && (
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {service.durationMinutes} min</span>
            )}
            <Badge variant="outline" className="text-[10px] capitalize">{service.serviceType}</Badge>
          </div>
        </div>

        {benefits.length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Incluye
            </p>
            <ul className="space-y-1">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isCita && (
          <div className="border-t pt-3">
            {selectedDate && selectedSlot ? (
              <div className="rounded-lg bg-primary/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-primary/70 font-semibold">Tu cita</p>
                <p className="text-sm font-semibold capitalize text-primary">{longDate(selectedDate)}</p>
                <p className="text-sm font-semibold text-primary">{selectedSlot.split('-')[0]}</p>
                {selectedSpecialist && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary/90">
                    <UserRound className="h-3 w-3" /> {selectedSpecialist.name}
                  </p>
                )}
                {holdToken && holdSecondsLeft > 0 && (
                  <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium tabular-nums ${holdSecondsLeft <= 60 ? 'text-red-600' : 'text-primary/80'}`}>
                    <Clock className="h-3 w-3" /> Apartado {Math.floor(holdSecondsLeft / 60)}:{String(holdSecondsLeft % 60).padStart(2, '0')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Elige una fecha y hora para continuar.</p>
            )}
          </div>
        )}

        {isCita && service.preparation && (
          <div className="border-t pt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ClipboardList className="h-3.5 w-3.5 text-primary" /> Cómo prepararte
            </p>
            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{service.preparation}</p>
          </div>
        )}

        {/* Desglose de total con complementos (cross-sell) */}
        {isCita && (basePrice > 0 || selectedAddons.length > 0) && (
          <div className="border-t pt-3 space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>{service.name}</span>
              <span>{basePrice > 0 ? formatCOP(basePrice) : priceLabel()}</span>
            </div>
            {selectedAddons.map((a) => (
              <div key={a.id} className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1"><Plus className="h-3 w-3" />{a.name}</span>
                <span>{formatCOP(a.price)}</span>
              </div>
            ))}
            {total > 0 && (
              <div className="flex justify-between border-t pt-1 text-sm font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCOP(total)}</span>
              </div>
            )}
          </div>
        )}

        {isCita && service.cancellationHours > 0 && (
          <p className="flex items-start gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            Cancela gratis hasta {service.cancellationHours}h antes.
          </p>
        )}
      </div>
    </aside>
  )

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[56rem] w-[95vw] p-0 gap-0 overflow-hidden max-h-[92vh]">
        {/* ── Step: Success (pantalla completa, confirmación emocional) ── */}
        {step === 'success' ? (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <DialogHeader className="items-center space-y-2">
              <div className="rounded-full bg-green-100 p-4 duration-500 animate-in zoom-in">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <DialogTitle className="text-xl">
                {isCita ? '¡Tu cita está reservada! 🎉' : '¡Solicitud recibida! 🎉'}
              </DialogTitle>
            </DialogHeader>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {isCita
                ? `${firstName ? `Gracias, ${firstName}. ` : '¡Gracias! '}Guardamos tu lugar para ${service.name}.`
                : 'Hemos recibido tu solicitud. Nos pondremos en contacto contigo muy pronto.'}
            </p>

            {isCita && selectedDate && selectedSlot && (
              <div className="mt-4 w-full max-w-sm space-y-2 rounded-xl border bg-muted/40 p-4 text-left text-sm">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Servicio</span><span className="font-medium text-right">{service.name}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Fecha</span><span className="font-medium capitalize text-right">{longDate(selectedDate)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Hora</span><span className="font-medium">{selectedSlot.split('-')[0]}</span></div>
                {selectedSpecialist && (
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Especialista</span><span className="font-medium">{selectedSpecialist.name}</span></div>
                )}
                {selectedAddons.map((a) => (
                  <div key={a.id} className="flex justify-between gap-2 text-xs"><span className="flex items-center gap-1 text-muted-foreground"><Plus className="h-3 w-3" />{a.name}</span><span>{formatCOP(a.price)}</span></div>
                ))}
                <div className="flex justify-between gap-2 border-t pt-2"><span className="text-muted-foreground">{selectedAddons.length ? 'Total' : 'Valor'}</span><span className="font-semibold">{total > 0 ? formatCOP(total) : priceLabel()}</span></div>
              </div>
            )}

            <div className="mt-4 w-full max-w-sm rounded-lg bg-amber-50 px-4 py-3 text-left text-xs text-amber-800">
              <span className="font-semibold">¿Qué sigue?</span>{' '}
              {isCita
                ? 'Tu cita queda pendiente de confirmación. Te escribiremos para confirmarte el horario.'
                : 'Revisaremos tu solicitud y te contactaremos con los siguientes pasos.'}
            </div>

            {isCita && selectedDate && selectedSlot && (
              <a href={gcalLink()} target="_blank" rel="noopener noreferrer" className="mt-4 w-full max-w-sm">
                <Button variant="outline" className="w-full">
                  <CalendarPlus className="mr-2 h-4 w-4" /> Añadir a Google Calendar
                </Button>
              </a>
            )}
            {service.cancellationHours > 0 && isCita && (
              <p className="mt-3 text-xs text-muted-foreground">
                Cancelaciones con mínimo {service.cancellationHours}h de anticipación.
              </p>
            )}
            <Button onClick={onClose} className="mt-4 w-full max-w-sm">Listo</Button>
          </div>
        ) : (
          <div className="flex max-h-[92vh] flex-col md:flex-row">
            {/* ── Columna principal: flujo (en móvil va primero) ── */}
            <div className="md:order-1 flex-1 min-w-0 space-y-4 overflow-y-auto p-5 sm:p-6">
              <DialogHeader>
                <DialogTitle>
                  {step === 'calendar' ? 'Elige fecha y hora' : isCita ? 'Confirma tus datos' : service.name}
                </DialogTitle>
                {step === 'form' && service.description && !isCita && (
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                )}
              </DialogHeader>

              {/* ── Step: Calendar ────────────────────────────── */}
              {step === 'calendar' && isCita && (
                <div className="space-y-4">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setCalDate(new Date(calYear, calMonth - 1, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-medium capitalize">
                      {calDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setCalDate(new Date(calYear, calMonth + 1, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
                    {DAYS_SHORT.map((d) => <div key={d} className="py-1">{d}</div>)}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const selectable = isDaySelectable(day)
                      const isSelected = selectedDate === dateStr
                      const isToday = new Date().toDateString() === new Date(calYear, calMonth, day).toDateString()
                      const avail = monthAvail[dateStr]
                      const full = selectable && avail && avail.status === 'lleno'
                      const dot = !selectable || isSelected ? '' :
                        avail?.status === 'libre' ? 'bg-emerald-500' :
                        avail?.status === 'pocos' ? 'bg-amber-500' :
                        avail?.status === 'lleno' ? 'bg-red-500' : ''
                      return (
                        <button key={day}
                          disabled={!selectable || full}
                          onClick={() => handleDayClick(day)}
                          title={avail ? (avail.status === 'lleno' ? 'Completo' : avail.status === 'cerrado' ? 'Cerrado' : `${avail.available} disponibles`) : undefined}
                          className={`
                            relative h-10 w-full rounded-md text-sm font-medium transition-colors flex flex-col items-center justify-center gap-0.5
                            ${!selectable ? 'text-muted-foreground/40 cursor-not-allowed' : full ? 'text-muted-foreground/50 cursor-not-allowed line-through' : 'hover:bg-accent cursor-pointer'}
                            ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}
                            ${isToday && !isSelected ? 'border border-primary text-primary' : ''}
                          `}
                        >
                          <span>{day}</span>
                          {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Time slots */}
                  {selectedDate && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Horarios disponibles — {longDate(selectedDate)}
                      </p>
                      {loadingSlots ? (
                        <div className="flex justify-center py-4">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="rounded-lg border bg-muted/30 p-4 text-center">
                          <p className="text-sm text-muted-foreground">No hay cupos disponibles para este día.</p>
                          {waitlistDone ? (
                            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-600">
                              <CheckCircle className="h-4 w-4" /> ¡Listo! Te avisaremos si se libera un cupo.
                            </p>
                          ) : waitlistOpen ? (
                            <div className="mt-3 space-y-2 text-left">
                              <Input placeholder="Tu nombre" value={waitlistForm.name}
                                onChange={(e) => setWaitlistForm((p) => ({ ...p, name: e.target.value }))} />
                              <Input placeholder="Tu teléfono / WhatsApp" value={waitlistForm.phone}
                                onChange={(e) => setWaitlistForm((p) => ({ ...p, phone: e.target.value }))} />
                              <Button className="w-full" size="sm" disabled={waitlistSending || !waitlistForm.name.trim() || !waitlistForm.phone.trim()}
                                onClick={submitWaitlist}>
                                {waitlistSending ? 'Enviando…' : 'Avísame cuando haya cupo'}
                              </Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="mt-3" onClick={() => setWaitlistOpen(true)}>
                              🔔 Avísame si se libera un cupo
                            </Button>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {slots.map((slot) => {
                              const value = `${slot.time}-${slot.endTime}`
                              const isSelected = selectedSlot === value
                              const free = slot.status === 'disponible' || slot.status === 'ultimos_cupos'
                              const handle = () => {
                                if (free) { setSelectedSlot(isSelected ? '' : value); setSlotNotice(null) }
                                else setSlotNotice(
                                  slot.status === 'ocupado' ? `Las ${slot.time} ya están reservadas.`
                                  : slot.status === 'bloqueado' ? `A las ${slot.time} no hay atención en esta franja.`
                                  : `Las ${slot.time} ya pasaron.`
                                )
                              }
                              const cls =
                                isSelected ? 'bg-primary text-primary-foreground border-primary'
                                : slot.status === 'ultimos_cupos' ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : slot.status === 'ocupado' ? 'border-border bg-muted/60 text-muted-foreground/60 line-through cursor-not-allowed'
                                : slot.status === 'bloqueado' ? 'border-transparent bg-muted/30 text-muted-foreground/40 cursor-not-allowed'
                                : slot.status === 'pasado' ? 'border-transparent text-muted-foreground/30 cursor-not-allowed'
                                : 'border-border hover:bg-accent'
                              return (
                                <button key={value} onClick={handle}
                                  title={slot.status === 'ultimos_cupos' ? '¡Últimos cupos!' : undefined}
                                  className={`relative rounded-lg border py-2 text-sm font-medium transition-colors ${cls}`}
                                >
                                  {(slot.status === 'ocupado') && <Lock className="absolute top-1 right-1 h-3 w-3 opacity-70" />}
                                  {slot.time}
                                  {slot.status === 'ultimos_cupos' && <span className="block text-[9px] font-semibold leading-none">último{slot.spotsLeft === 1 ? '' : 's'}</span>}
                                </button>
                              )
                            })}
                          </div>
                          {/* Leyenda de estados + aviso al tocar uno no disponible */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Disponible</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Últimos cupos</span>
                            <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Reservado</span>
                          </div>
                          {slotNotice && <p className="text-xs text-amber-600">{slotNotice}</p>}
                        </>
                      )}
                    </div>
                  )}

                  {slotNotice && !selectedDate && <p className="text-xs text-amber-600">{slotNotice}</p>}

                  {/* Elegir especialista (F5) — aparece al tener un horario */}
                  {specialists.length > 0 && selectedSlot && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Users className="h-4 w-4 text-primary" /> ¿Con quién quieres tu cita?
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {/* Sin preferencia */}
                        <button type="button" onClick={() => setSelectedSpecialistId('')}
                          className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${selectedSpecialistId === '' ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </span>
                          <span className="min-w-0 text-xs font-medium">Sin preferencia</span>
                        </button>
                        {specialists.map((sp) => {
                          const active = selectedSpecialistId === sp.id
                          return (
                            <button key={sp.id} type="button" onClick={() => setSelectedSpecialistId(sp.id)}
                              className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}>
                              {sp.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={sp.photoUrl} alt={sp.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                              ) : (
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                  <UserRound className="h-4 w-4 text-primary" />
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium">{sp.name}</span>
                                {sp.title && <span className="block truncate text-[10px] text-muted-foreground">{sp.title}</span>}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button disabled={!selectedDate || !selectedSlot || holding} onClick={handleContinue}>
                      {holding ? 'Apartando…' : 'Continuar'} <Calendar className="ml-2 h-4 w-4" />
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {/* ── Step: Form ────────────────────────────────── */}
              {step === 'form' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label>Nombre <span className="text-destructive">*</span></Label>
                      <Input placeholder="Tu nombre completo" value={form.clientName}
                        onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Teléfono <span className="text-destructive">*</span></Label>
                      <Input placeholder="300 123 4567" value={form.clientPhone}
                        onChange={(e) => setForm((p) => ({ ...p, clientPhone: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" placeholder="tu@email.com" value={form.clientEmail}
                        onChange={(e) => setForm((p) => ({ ...p, clientEmail: e.target.value }))} />
                    </div>

                    {isAsesoria && (
                      <>
                        <div className="col-span-2 space-y-1.5">
                          <Label>¿Qué necesitas?</Label>
                          <Textarea rows={3} placeholder="Describe tu proyecto o necesidad..."
                            value={form.projectDescription}
                            onChange={(e) => setForm((p) => ({ ...p, projectDescription: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>¿Cuándo lo necesitas?</Label>
                          <Input placeholder="Ej: Próximo mes, urgente..." value={form.preferredDateRange}
                            onChange={(e) => setForm((p) => ({ ...p, preferredDateRange: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Presupuesto aproximado</Label>
                          <Select value={form.budgetRange}
                            onValueChange={(v) => setForm((p) => ({ ...p, budgetRange: v }))}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>
                              {BUDGET_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <div className="col-span-2 space-y-1.5">
                      <Label>{isAsesoria ? 'Notas adicionales' : 'Notas (opcional)'}</Label>
                      <Textarea rows={2} placeholder="Alguna indicación especial..."
                        value={form.clientNotes}
                        onChange={(e) => setForm((p) => ({ ...p, clientNotes: e.target.value }))} />
                    </div>
                  </div>

                  {/* Cross-sell: agrega complementos antes de confirmar */}
                  {isCita && addons.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <Sparkles className="h-4 w-4 text-primary" /> Agrega a tu experiencia
                      </p>
                      <div className="space-y-1.5">
                        {addons.map((a) => {
                          const checked = selectedAddonIds.includes(a.id)
                          return (
                            <button key={a.id} type="button" onClick={() => toggleAddon(a.id)}
                              className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${checked ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-accent'}`}
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                                {checked ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{a.name}</span>
                                {a.description && <span className="block truncate text-xs text-muted-foreground">{a.description}</span>}
                              </span>
                              <span className="shrink-0 text-sm font-semibold text-primary">
                                +{a.priceType === 'gratis' ? 'Gratis' : formatCOP(a.price)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {total > 0 && (
                        <div className="flex items-center justify-between border-t border-primary/20 pt-2 text-sm">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-bold text-primary">{formatCOP(total)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {error && <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>}

                  <DialogFooter>
                    {isCita && (
                      <Button variant="outline" onClick={() => { releaseHold(); setStep('calendar') }}>
                        <ChevronLeft className="mr-1 h-4 w-4" /> Cambiar hora
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => { releaseHold(); onClose() }}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                      {submitting ? (
                        <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Enviando...</>
                      ) : (
                        isCita ? 'Confirmar reserva' : 'Enviar solicitud'
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>

            {Summary}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
