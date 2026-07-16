'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Calendar, Clock, Users, ChevronRight, ChevronLeft,
  UtensilsCrossed, Check, MapPin, Plus, Minus, X,
  PartyPopper, Phone, Mail, User, FileText, CalendarCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

type Step = 1 | 2 | 3 | 4 | 'done'

interface Config {
  storeName: string
  openTime: string
  closeTime: string
  slotMinutes: number
  maxAdvanceDays: number
  minAdvanceHours: number
  occasions: string[]
}

interface TableOption {
  id: string
  number: string
  area: string | null
  capacity: number
}

interface MenuItem {
  id: string
  name: string
  category: string
  description?: string
  price: number
  imageUrl?: string
  preparationArea: string
}

interface PreOrderItem {
  menuItemId: string
  name: string
  quantity: number
  unitPrice: number
}

interface Reservation {
  tableId: string
  date: string
  time: string
  guests: number
  occasion: string
  notes: string
  preOrder: PreOrderItem[]
  preOrderNotes: string
  customerName: string
  customerPhone: string
  customerEmail: string
}

const EMPTY: Reservation = {
  tableId: '', date: '', time: '', guests: 2, occasion: '', notes: '',
  preOrder: [], preOrderNotes: '',
  customerName: '', customerPhone: '', customerEmail: '',
}

export default function ReservationPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>(1)
  const [reservation, setReservation] = useState<Reservation>(EMPTY)

  // Step 1 state
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Step 2 state
  const [tables, setTables] = useState<TableOption[]>([])
  const [loadingTables, setLoadingTables] = useState(false)

  // Step 3 state
  const [menuItems, setMenuItems] = useState<Record<string, MenuItem[]>>({})
  const [loadingMenu, setLoadingMenu] = useState(false)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<any>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`${API_URL}/restbar/reservations/public-config/${slug}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setConfig(json.data)
        else setError(json.error || 'Reservas no disponibles')
      })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false))
  }, [slug])

  const fetchSlots = useCallback((date: string) => {
    if (!date || !slug) return
    setLoadingSlots(true)
    setSlots([])
    setReservation(r => ({ ...r, time: '' }))
    fetch(`${API_URL}/restbar/reservations/available-slots/${slug}?date=${date}`)
      .then(r => r.json())
      .then(json => { if (json.success) setSlots(json.data) })
      .finally(() => setLoadingSlots(false))
  }, [slug])

  const fetchTables = useCallback(() => {
    const { date, time, guests } = reservation
    if (!date || !time || !guests || !slug) return
    setLoadingTables(true)
    setTables([])
    fetch(`${API_URL}/restbar/reservations/available-tables/${slug}?date=${date}&time=${time}&guests=${guests}`)
      .then(r => r.json())
      .then(json => { if (json.success) setTables(json.data) })
      .finally(() => setLoadingTables(false))
  }, [slug, reservation])

  const fetchMenu = useCallback(() => {
    if (!slug || Object.keys(menuItems).length > 0) return
    setLoadingMenu(true)
    fetch(`${API_URL}/restbar/public-menu/${slug}`)
      .then(r => r.json())
      .then(json => { if (json.success) setMenuItems(json.data.categories) })
      .finally(() => setLoadingMenu(false))
  }, [slug, menuItems])

  const goToStep2 = () => {
    fetchTables()
    setStep(2)
  }

  const goToStep3 = () => {
    fetchMenu()
    setStep(3)
  }

  const handleQtyChange = (item: MenuItem, delta: number) => {
    setReservation(r => {
      const existing = r.preOrder.find(p => p.menuItemId === item.id)
      if (!existing && delta > 0) {
        return { ...r, preOrder: [...r.preOrder, { menuItemId: item.id, name: item.name, quantity: 1, unitPrice: item.price }] }
      }
      if (!existing) return r
      const newQty = existing.quantity + delta
      if (newQty <= 0) return { ...r, preOrder: r.preOrder.filter(p => p.menuItemId !== item.id) }
      return { ...r, preOrder: r.preOrder.map(p => p.menuItemId === item.id ? { ...p, quantity: newQty } : p) }
    })
  }

  const getQty = (itemId: string) =>
    reservation.preOrder.find(p => p.menuItemId === itemId)?.quantity || 0

  const preOrderTotal = reservation.preOrder.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/restbar/reservations/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          tableId: reservation.tableId,
          customerName: reservation.customerName,
          customerPhone: reservation.customerPhone,
          customerEmail: reservation.customerEmail || undefined,
          reservationDate: reservation.date,
          reservationTime: reservation.time,
          guestsCount: reservation.guests,
          occasion: reservation.occasion || undefined,
          notes: reservation.notes || undefined,
          preOrderItems: reservation.preOrder.length > 0 ? reservation.preOrder : undefined,
          preOrderNotes: reservation.preOrderNotes || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setConfirmation(json.data)
        setStep('done')
      } else {
        alert(json.error || 'Error al reservar')
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  // Min date = today, max = today + maxAdvanceDays
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const maxDate = config ? (() => {
    const d = new Date(); d.setDate(d.getDate() + config.maxAdvanceDays)
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  })() : ''

  // ── Screen: loading ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 text-white px-6">
      <CalendarCheck className="h-12 w-12 opacity-30" />
      <p className="text-center text-white/50">{error}</p>
    </div>
  )

  if (!config) return null

  // ── Screen: done ─────────────────────────────────────────────────────────────
  if (step === 'done' && confirmation) return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-400/15 border border-amber-400/30 mx-auto">
          <Check className="h-10 w-10 text-amber-400" />
        </div>
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-widest font-semibold mb-1">Reserva recibida</p>
          <h1 className="text-3xl font-black text-white">{confirmation.reservationNumber}</h1>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3">
          <Row icon={<MapPin className="h-4 w-4" />} label={`Mesa ${confirmation.tableName}${confirmation.tableArea ? ` · ${confirmation.tableArea}` : ''}`} />
          <Row icon={<Calendar className="h-4 w-4" />} label={formatDate(confirmation.date)} />
          <Row icon={<Clock className="h-4 w-4" />} label={confirmation.time} />
          <Row icon={<Users className="h-4 w-4" />} label={`${confirmation.guestsCount} ${confirmation.guestsCount === 1 ? 'persona' : 'personas'}`} />
          {reservation.occasion && <Row icon={<PartyPopper className="h-4 w-4" />} label={reservation.occasion} />}
        </div>
        <p className="text-white/40 text-sm leading-relaxed">
          Tu solicitud está <span className="text-amber-400 font-semibold">pendiente de confirmación</span>.<br />
          Te contactaremos al {reservation.customerPhone} para confirmar.
        </p>
        <p className="text-[11px] text-white/20 uppercase tracking-widest">Powered by Daimuz</p>
      </div>
    </div>
  )

  const step1Valid = reservation.date && reservation.time && reservation.guests >= 1
  const step2Valid = !!reservation.tableId
  const step4Valid = reservation.customerName.trim() && reservation.customerPhone.trim()

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* Header fijo */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-white/8">
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/15 shrink-0">
            <CalendarCheck className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white truncate">{config.storeName}</h1>
            <p className="text-[11px] text-white/40 uppercase tracking-widest">Reservar mesa</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-4 pb-3">
          {([1, 2, 3, 4] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0',
                step === s ? 'bg-amber-400 text-zinc-900'
                  : (step === 'done' || (typeof step === 'number' && step > s))
                    ? 'bg-amber-400/20 text-amber-400'
                    : 'bg-white/8 text-white/30'
              )}>
                {(step === 'done' || (typeof step === 'number' && step > s)) ? <Check className="h-3 w-3" /> : s}
              </div>
              {i < 3 && <div className={cn('h-px flex-1', typeof step === 'number' && step > s ? 'bg-amber-400/40' : 'bg-white/10')} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-24 space-y-5">

        {/* ── PASO 1: Detalles ── */}
        {step === 1 && (
          <div className="space-y-5">
            <SectionTitle>¿Cuándo y para cuántos?</SectionTitle>

            {/* Fecha */}
            <Field label="Fecha" icon={<Calendar className="h-4 w-4" />}>
              <input
                type="date"
                min={todayStr}
                max={maxDate}
                value={reservation.date}
                onChange={e => {
                  setReservation(r => ({ ...r, date: e.target.value }))
                  fetchSlots(e.target.value)
                }}
                className="w-full bg-transparent text-white text-sm focus:outline-none [color-scheme:dark]"
              />
            </Field>

            {/* Hora */}
            <Field label="Hora" icon={<Clock className="h-4 w-4" />}>
              {!reservation.date ? (
                <p className="text-white/30 text-sm">Selecciona una fecha primero</p>
              ) : loadingSlots ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-white/40 text-sm">Cargando horarios…</span>
                </div>
              ) : slots.length === 0 ? (
                <p className="text-white/30 text-sm">Sin horarios disponibles para esta fecha</p>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {slots.map(s => (
                    <button
                      key={s}
                      onClick={() => setReservation(r => ({ ...r, time: s }))}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                        reservation.time === s
                          ? 'bg-amber-400 text-zinc-900 border-amber-400'
                          : 'bg-white/5 text-white/70 border-white/10 hover:border-white/30'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </Field>

            {/* Personas */}
            <Field label="Personas" icon={<Users className="h-4 w-4" />}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setReservation(r => ({ ...r, guests: Math.max(1, r.guests - 1) }))}
                  className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/70 hover:bg-white/15"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-lg font-bold w-8 text-center">{reservation.guests}</span>
                <button
                  onClick={() => setReservation(r => ({ ...r, guests: Math.min(50, r.guests + 1) }))}
                  className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/70 hover:bg-white/15"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </Field>

            {/* Ocasión */}
            {config.occasions.length > 0 && (
              <Field label="Ocasión (opcional)" icon={<PartyPopper className="h-4 w-4" />}>
                <div className="flex flex-wrap gap-2 pt-1">
                  {config.occasions.map(occ => (
                    <button
                      key={occ}
                      onClick={() => setReservation(r => ({ ...r, occasion: r.occasion === occ ? '' : occ }))}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                        reservation.occasion === occ
                          ? 'bg-amber-400 text-zinc-900 border-amber-400'
                          : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30'
                      )}
                    >
                      {occ}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {/* Descripción */}
            <Field label="Descripción / peticiones especiales (opcional)" icon={<FileText className="h-4 w-4" />}>
              <textarea
                rows={3}
                placeholder="Ej: decoración con globos, menú vegetariano, silla para bebé…"
                value={reservation.notes}
                onChange={e => setReservation(r => ({ ...r, notes: e.target.value }))}
                className="w-full bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none resize-none"
              />
            </Field>
          </div>
        )}

        {/* ── PASO 2: Elegir mesa ── */}
        {step === 2 && (
          <div className="space-y-4">
            <SectionTitle>Elige tu mesa</SectionTitle>
            <p className="text-white/40 text-sm">
              {formatDate(reservation.date)} · {reservation.time} · {reservation.guests} personas
            </p>

            {loadingTables ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tables.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin mesas disponibles para este horario</p>
                <button onClick={() => setStep(1)} className="mt-4 text-amber-400 text-sm underline">
                  Cambiar fecha u hora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {tables.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setReservation(r => ({ ...r, tableId: t.id }))}
                    className={cn(
                      'p-4 rounded-2xl border text-left transition-all',
                      reservation.tableId === t.id
                        ? 'bg-amber-400/15 border-amber-400 ring-1 ring-amber-400/50'
                        : 'bg-white/4 border-white/10 hover:border-white/25'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-base font-bold text-white">Mesa {t.number}</span>
                      {reservation.tableId === t.id && (
                        <Check className="h-4 w-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    {t.area && (
                      <p className="text-xs text-amber-400/70 mb-1">{t.area}</p>
                    )}
                    <p className="text-xs text-white/40 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Hasta {t.capacity} personas
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PASO 3: Pre-pedido ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <SectionTitle>Pre-pedido (opcional)</SectionTitle>
              <button
                onClick={() => setStep(4)}
                className="text-xs text-white/40 hover:text-white/70 underline shrink-0 mt-1"
              >
                Omitir
              </button>
            </div>
            <p className="text-white/40 text-sm">Adelanta tu pedido y lo tenemos listo para cuando llegues.</p>

            {loadingMenu ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(menuItems).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400/60 mb-3">{cat}</p>
                    <div className="space-y-2">
                      {items.map((item: MenuItem) => {
                        const qty = getQty(item.id)
                        return (
                          <div key={item.id} className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-xl p-3">
                            {item.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white line-clamp-1">{item.name}</p>
                              <p className="text-xs text-amber-400 font-bold">{formatCOP(item.price)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {qty > 0 ? (
                                <>
                                  <button onClick={() => handleQtyChange(item, -1)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="text-sm font-bold w-4 text-center">{qty}</span>
                                  <button onClick={() => handleQtyChange(item, 1)} className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => handleQtyChange(item, 1)} className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-amber-400 hover:bg-amber-400/15">
                                  <Plus className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Notas del pre-pedido */}
                {reservation.preOrder.length > 0 && (
                  <Field label="Notas del pedido (opcional)" icon={<FileText className="h-4 w-4" />}>
                    <textarea
                      rows={2}
                      placeholder="Ej: sin gluten, término 3/4, sin cebolla…"
                      value={reservation.preOrderNotes}
                      onChange={e => setReservation(r => ({ ...r, preOrderNotes: e.target.value }))}
                      className="w-full bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none resize-none"
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PASO 4: Datos personales ── */}
        {step === 4 && (
          <div className="space-y-5">
            <SectionTitle>Tus datos</SectionTitle>

            {/* Resumen */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-2 text-sm">
              <SummaryRow icon={<Calendar className="h-3.5 w-3.5" />} text={`${formatDate(reservation.date)} · ${reservation.time}`} />
              <SummaryRow icon={<Users className="h-3.5 w-3.5" />} text={`${reservation.guests} personas`} />
              <SummaryRow icon={<MapPin className="h-3.5 w-3.5" />} text={`Mesa ${tables.find(t => t.id === reservation.tableId)?.number || ''}`} />
              {reservation.occasion && <SummaryRow icon={<PartyPopper className="h-3.5 w-3.5" />} text={reservation.occasion} />}
              {reservation.preOrder.length > 0 && (
                <SummaryRow icon={<UtensilsCrossed className="h-3.5 w-3.5" />} text={`${reservation.preOrder.length} ítem(s) pre-pedido · ${formatCOP(preOrderTotal)}`} />
              )}
            </div>

            <Field label="Nombre completo *" icon={<User className="h-4 w-4" />}>
              <input
                type="text"
                placeholder="Juan García"
                value={reservation.customerName}
                onChange={e => setReservation(r => ({ ...r, customerName: e.target.value }))}
                className="w-full bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none"
              />
            </Field>

            <Field label="Teléfono *" icon={<Phone className="h-4 w-4" />}>
              <input
                type="tel"
                placeholder="300 000 0000"
                value={reservation.customerPhone}
                onChange={e => setReservation(r => ({ ...r, customerPhone: e.target.value }))}
                className="w-full bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none"
              />
            </Field>

            <Field label="Email (opcional)" icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                placeholder="juan@email.com"
                value={reservation.customerEmail}
                onChange={e => setReservation(r => ({ ...r, customerEmail: e.target.value }))}
                className="w-full bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Barra de navegación fija inferior */}
      <div className="fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-t border-white/8 px-4 py-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {step !== 1 && (
            <button
              onClick={() => setStep(s => (s === 'done' ? 4 : Math.max(1, (s as number) - 1)) as Step)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/8 text-white/70 text-sm font-semibold hover:bg-white/15"
            >
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
          )}
          <button
            disabled={
              (step === 1 && !step1Valid) ||
              (step === 2 && !step2Valid) ||
              (step === 4 && (!step4Valid || submitting))
            }
            onClick={() => {
              if (step === 1) goToStep2()
              else if (step === 2) goToStep3()
              else if (step === 3) setStep(4)
              else if (step === 4) handleSubmit()
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all',
              ((step === 1 && !step1Valid) || (step === 2 && !step2Valid) || (step === 4 && (!step4Valid || submitting)))
                ? 'bg-white/8 text-white/30 cursor-not-allowed'
                : 'bg-amber-400 text-zinc-900 hover:bg-amber-300'
            )}
          >
            {step === 4
              ? submitting ? 'Enviando…' : 'Confirmar reserva'
              : step === 3 ? 'Continuar'
              : <>Siguiente <ChevronRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-white">{children}</h2>
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white/4 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
        {icon}
        <span className="uppercase tracking-wide font-semibold">{label}</span>
      </div>
      {children}
    </div>
  )
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-white/80">
      <span className="text-amber-400/60 shrink-0">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function SummaryRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-white/60">
      <span className="text-white/30 shrink-0">{icon}</span>
      <span className="text-xs">{text}</span>
    </div>
  )
}
