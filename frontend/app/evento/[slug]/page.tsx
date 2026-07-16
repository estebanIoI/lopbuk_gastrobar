'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { eventsApi } from '@/lib/events-api'
import { useEventStore } from '@/lib/store/event-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Ticket, Minus, Plus, Loader2 } from 'lucide-react'
import { DropLoader } from '@/components/drop-loader'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function EventLandingInner() {
  const { slug } = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const selectedId = searchParams.get('e') || ''

  const [list, setList] = useState<any[]>([])
  const [listLoaded, setListLoaded] = useState(false)
  const [event, setEvent] = useState<any>(null)
  const [availability, setAvailability] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const store = useEventStore()

  // Checkout state
  const [sending, setSending] = useState(false)
  const [step, setStep] = useState<'select' | 'customer' | 'redirect'>('select')

  // 1) Cartelera del comercio (todos los eventos publicados)
  useEffect(() => {
    if (!slug) return
    eventsApi.getPublicEvents(slug as string)
      .then(r => { if (r.success && Array.isArray(r.data)) setList(r.data) })
      .finally(() => setListLoaded(true))
  }, [slug])

  // Evento efectivo: el de la URL (?e=), o el único si el comercio tiene uno solo.
  const effectiveId = selectedId || (list.length === 1 ? list[0].id : '')

  // 2) Detalle del evento seleccionado
  const load = useCallback(async () => {
    if (!slug || !effectiveId) { setLoading(false); return }
    setLoading(true)
    setError('')
    setStep('select')
    try {
      const [evt, avail] = await Promise.all([
        eventsApi.getPublicEvent(slug as string, effectiveId),
        eventsApi.getAvailability(slug as string, effectiveId),
      ])
      if (evt.success && evt.data) {
        setEvent(evt.data)
        store.selectedEvent = evt.data
      } else {
        setError(evt.error || 'Evento no encontrado')
      }
      if (avail.success && avail.data) setAvailability(avail.data)
    } catch { setError('Error al cargar el evento') }
    setLoading(false)
  }, [slug, effectiveId])

  useEffect(() => { load() }, [load])

  // Countdown
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const fmtCountdown = (ms: number) => {
    if (ms <= 0) return 'Finalizado'
    const d = Math.floor(ms / 86400000)
    const h = Math.floor((ms % 86400000) / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return d > 0 ? `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleHold = async () => {
    if (!store.selectedTicketType) return
    setSending(true)
    try {
      const r = await eventsApi.createHold(slug as string, {
        ticketTypeId: store.selectedTicketType.id,
        quantity: store.quantity,
        eventId: effectiveId || undefined,
      })
      if (r.success && r.data) {
        store.setHold(r.data.holdToken, r.data.expiresAt)
        setStep('customer')
      } else setError(r.error || 'Error al reservar')
    } catch (e: any) { setError(e?.message || 'Error') }
    setSending(false)
  }

  const handleCheckout = async () => {
    if (!store.holdToken) return
    setSending(true)
    try {
      const r = await eventsApi.createCheckout(slug as string, {
        holdToken: store.holdToken,
        eventId: effectiveId || undefined,
        customerName: store.customerName,
        customerEmail: store.customerEmail || undefined,
        customerPhone: store.customerPhone || undefined,
        customerDocument: store.customerDocument || undefined,
        redirectUrl: `${window.location.origin}/evento/ticket/pending`,
      })
      if (r.success && r.data) {
        store.setCheckout(r.data.checkoutUrl, r.data.bookingId)
        setStep('redirect')
      } else setError(r.error || 'Error al iniciar pago')
    } catch (e: any) { setError(e?.message || 'Error') }
    setSending(false)
  }

  const countdownMs = event ? new Date(event.event_date).getTime() - now : 0

  // Aún resolviendo si el comercio tiene 1 evento (detalle) o varios (cartelera)
  if (!effectiveId && !listLoaded) {
    return <div className="min-h-screen flex items-center justify-center"><DropLoader /></div>
  }

  // Cartelera: varios eventos publicados y ninguno seleccionado
  if (!effectiveId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">Eventos</h1>
          <p className="text-muted-foreground text-sm mb-6">Elige un evento para ver las entradas y comprar.</p>
          {list.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No hay eventos publicados por ahora.</Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {list.map((ev: any) => (
                <button key={ev.id} onClick={() => router.push(`/evento/${slug}?e=${ev.id}`)} className="text-left group">
                  <Card className="overflow-hidden h-full transition-all hover:shadow-lg hover:-translate-y-0.5">
                    {ev.cover_image ? (
                      <img src={ev.cover_image} alt={ev.title} className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center"><Ticket className="h-10 w-10 text-white/30" /></div>
                    )}
                    <div className="p-4">
                      <p className="font-semibold line-clamp-1">{ev.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(ev.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      {(ev.venue_name || ev.city) && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.venue_name || ev.city}</p>}
                      {ev.price_from != null && <p className="text-sm font-bold mt-2">Desde ${Number(ev.price_from).toLocaleString('es-CO')}</p>}
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Detalle del evento
  if (loading) return <div className="min-h-screen flex items-center justify-center"><DropLoader /></div>
  if (error && !event) return <div className="min-h-screen flex items-center justify-center"><Card className="p-8 text-center max-w-md"><h2 className="text-xl font-bold mb-2">Evento no disponible</h2><p className="text-muted-foreground">{error}</p></Card></div>
  if (!event) return null

  const ticketTypes = event.ticketTypes || event.ticket_types || []

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative">
        {event.cover_image ? (
          <img src={event.cover_image} alt={event.title} className="w-full h-[40vh] md:h-[50vh] object-cover" />
        ) : (
          <div className="w-full h-[30vh] md:h-[35vh] bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Ticket className="h-16 w-16 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        {/* Countdown */}
        {countdownMs > 0 && (
          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur rounded-xl px-4 py-2 shadow-lg">
            <p className="text-xs text-muted-foreground">Comienza en</p>
            <p className="text-lg font-mono font-bold">{fmtCountdown(countdownMs)}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10 space-y-8 pb-20">
        {list.length > 1 && (
          <button onClick={() => router.push(`/evento/${slug}`)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Todos los eventos</button>
        )}
        {/* Title Card */}
        <Card className="p-6 shadow-xl">
          <h1 className="text-2xl md:text-3xl font-bold">{event.title}</h1>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(event.event_date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{event.venue_name || event.location || 'Por confirmar'}</span>
            {event.event_type && <Badge variant="secondary">{event.event_type === 'zones' ? 'Por zonas' : event.event_type === 'seats' ? 'Asientos' : 'General'}</Badge>}
          </div>
          {event.description && <p className="mt-4 text-muted-foreground leading-relaxed text-sm">{event.description}</p>}
        </Card>

        {/* Ticket Selector */}
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Entradas</h2>
          {ticketTypes.length > 0 ? (
            <div className="space-y-3">
              {ticketTypes.map((tt: any) => {
                const avail = availability.find((a: any) => a.id === tt.id)
                const available = avail?.available ?? (tt.capacity - tt.tickets_sold)
                const isSelected = store.selectedTicketType?.id === tt.id
                return (
                  <button
                    key={tt.id}
                    onClick={() => store.selectTicketType(tt, store.quantity)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{tt.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{tt.description || `${tt.capacity > 0 ? available : '∞'} disponibles`}</p>
                      </div>
                      <p className="text-lg font-bold">${Number(tt.price).toLocaleString('es-CO')}</p>
                    </div>
                  </button>
                )
              })}

              {/* Quantity + CTA */}
              {store.selectedTicketType && step === 'select' && (
                <>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => store.setQuantity(Math.max(1, store.quantity - 1))}><Minus className="h-3 w-3" /></Button>
                      <span className="font-medium w-6 text-center">{store.quantity}</span>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => store.setQuantity(store.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-xl font-bold">${(Number(store.selectedTicketType.price) * store.quantity).toLocaleString('es-CO')}</p>
                    </div>
                  </div>
                  {/* CTA desktop (en móvil se usa la barra sticky inferior) */}
                  <Button className="hidden md:flex w-full mt-4" size="lg" onClick={handleHold} disabled={sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ticket className="h-4 w-4 mr-2" />}
                    Reservar — ${(Number(store.selectedTicketType.price) * store.quantity).toLocaleString('es-CO')}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No hay tipos de entrada disponibles</p>
          )}

          {/* Errors */}
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </Card>

        {/* Customer Form (step 2) */}
        {step === 'customer' && store.holdToken && (
          <Card className="p-6 animate-in slide-in-from-bottom">
            <h2 className="font-semibold mb-4">Tus datos</h2>
            <div className="space-y-3">
              <Input placeholder="Nombre completo *" value={store.customerName} onChange={e => store.setCustomer({ customerName: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Teléfono" value={store.customerPhone} onChange={e => store.setCustomer({ customerPhone: e.target.value })} />
                <Input placeholder="Email" type="email" value={store.customerEmail} onChange={e => store.setCustomer({ customerEmail: e.target.value })} />
              </div>
              <Input placeholder="Documento (opcional)" value={store.customerDocument} onChange={e => store.setCustomer({ customerDocument: e.target.value })} />
              <Button className="w-full" onClick={handleCheckout} disabled={sending || !store.customerName}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pagar ${(Number(store.selectedTicketType?.price || 0) * store.quantity).toLocaleString('es-CO')}
              </Button>
              <button className="w-full text-xs text-muted-foreground hover:underline" onClick={() => { setStep('select'); store.reset() }}>← Volver</button>
            </div>
          </Card>
        )}

        {/* Redirect (step 3) */}
        {step === 'redirect' && store.checkoutUrl && (
          <Card className="p-6 text-center animate-in slide-in-from-bottom">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p className="font-medium">Redirigiendo al pago...</p>
            <p className="text-sm text-muted-foreground mt-1">Serás redirigido a la pasarela de pago</p>
            <Button className="mt-4 w-full" onClick={() => { if (store.checkoutUrl) window.location.href = store.checkoutUrl }}>
              Ir a pagar ahora
            </Button>
          </Card>
        )}

        {/* CTA sticky mobile */}
        {step === 'select' && store.selectedTicketType && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden z-50">
            <Button className="w-full" size="lg" onClick={handleHold} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ticket className="h-4 w-4 mr-2" />}
              Reservar — ${(Number(store.selectedTicketType.price) * store.quantity).toLocaleString('es-CO')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EventLanding() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><DropLoader /></div>}>
      <EventLandingInner />
    </Suspense>
  )
}
