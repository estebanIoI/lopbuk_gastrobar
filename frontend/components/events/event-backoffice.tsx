'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { eventsApi } from '@/lib/events-api'
import { useAuthStore } from '@/lib/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus, Pencil, Trash2, Eye, Calendar, MapPin, Ticket, Users,
  BarChart3, Clock, TrendingUp, DollarSign, CheckCircle, XCircle,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

interface EventItem { id: string; title: string; event_date: string; location?: string; status: string; cover_image?: string; event_type: string; capacity?: number; venue_name?: string; ticket_types?: any[]; }
interface VenueItem { id: string; name: string; address?: string; city?: string; capacity?: number; }
interface TicketTypeItem { id: string; name: string; price: number; capacity: number; tickets_sold: number; }

export default function EventBackoffice() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [venues, setVenues] = useState<VenueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('list')
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const tenantSlug = useAuthStore(s => s.user?.tenantSlug)

  // Abre la landing pública del evento (nueva pestaña). Requiere slug del comercio.
  const openPublic = (id: string) => {
    if (!tenantSlug) { alert('Tu comercio no tiene un identificador (slug) configurado. Configúralo en Mi tienda.'); return }
    window.open(`/evento/${tenantSlug}?e=${id}`, '_blank', 'noopener')
  }

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [eventType, setEventType] = useState('general')
  const [capacity, setCapacity] = useState('0')
  const [refundPolicy, setRefundPolicy] = useState('none')
  const [minAge, setMinAge] = useState('0')
  const [maxTickets, setMaxTickets] = useState('10')
  const [venueId, setVenueId] = useState('')
  const [ticketTypes, setTicketTypes] = useState<TicketTypeItem[]>([])
  const [newTicket, setNewTicket] = useState({ name: '', price: '', capacity: '' })

  // Venue dialog
  const [venueOpen, setVenueOpen] = useState(false)
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [venueCity, setVenueCity] = useState('')
  const [venueCap, setVenueCap] = useState('')

  // Timeline
  const [timeline, setTimeline] = useState<any[]>([])
  const [timelineMetrics, setTimelineMetrics] = useState<any>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [evt, ven] = await Promise.all([eventsApi.getEvents(), eventsApi.getVenues()])
      if (evt.success ) setEvents(Array.isArray(evt.data) ? evt.data : evt.data?.data || [])
      if (ven.success && ven.data) setVenues(Array.isArray(ven.data) ? ven.data : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadTimeline = async (eventId: string) => {
    setSelectedEventId(eventId)
    setTab('timeline')
    try {
      const r = await eventsApi.getTimeline(eventId)
      if (r.success && r.data) { setTimeline(r.data.entries || []); setTimelineMetrics(r.data.metrics) }
    } catch { setTimeline([]) }
  }

  // Stats
  const stats = {
    total: events.length,
    published: events.filter(e => e.status === 'published').length,
    draft: events.filter(e => e.status === 'draft').length,
    upcoming: events.filter(e => new Date(e.event_date) > new Date()).length,
  }

  const resetEditor = () => {
    setTitle(''); setDescription(''); setEventDate(''); setEndDate(''); setLocation('')
    setCoverImage(''); setEventType('general'); setCapacity('0'); setRefundPolicy('none')
    setMinAge('0'); setMaxTickets('10'); setVenueId('')
    setTicketTypes([]); setNewTicket({ name: '', price: '', capacity: '' })
    setEditingId(null)
  }

  const openCreate = () => { resetEditor(); setEditorOpen(true) }
  const openEdit = async (e: EventItem) => {
    setEditingId(e.id)
    setTitle(e.title); setDescription((e as any).description || '')
    setEventDate(e.event_date?.slice(0, 16) || '')
    setLocation(e.location || ''); setCoverImage(e.cover_image || '')
    setEventType(e.event_type || 'general'); setCapacity(String(e.capacity || 0))
    setVenueId('')
    // Load ticket types
    try {
      const r = await eventsApi.getTicketTypes(e.id)
      if (r.success && r.data) setTicketTypes(r.data)
    } catch {}
    setEditorOpen(true)
  }

  const saveEvent = async () => {
    if (!title || !eventDate) return
    setSaving(true)
    try {
      const data = { title, description, eventDate, endDate: endDate || undefined,
        location: location || undefined, coverImage: coverImage || undefined,
        eventType, capacity: Number(capacity) || 0, venueId: venueId || null,
        refundPolicy, minAge: Number(minAge), maxTicketsPerUser: Number(maxTickets) }
      if (editingId) await eventsApi.updateEvent(editingId, data)
      else await eventsApi.createEvent(data)
      setEditorOpen(false)
      load()
    } catch {} finally { setSaving(false) }
  }

  const addTicketType = async () => {
    if (!newTicket.name || !newTicket.price || !editingId) return
    try {
      await eventsApi.createTicketType(editingId, {
        name: newTicket.name, price: Number(newTicket.price),
        capacity: Number(newTicket.capacity) || 0,
      })
      const r = await eventsApi.getTicketTypes(editingId)
      if (r.success && r.data) setTicketTypes(r.data)
      setNewTicket({ name: '', price: '', capacity: '' })
    } catch {}
  }

  const removeTicketType = async (ttid: string) => {
    if (!editingId) return
    try {
      await eventsApi.deleteTicketType(editingId, ttid)
      setTicketTypes(prev => prev.filter(t => t.id !== ttid))
    } catch {}
  }

  const publishEvent = async (id: string) => {
    try { await eventsApi.publishEvent(id); load() } catch {}
  }
  const deleteEvent = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return
    try { await eventsApi.deleteEvent(id); load() } catch {}
  }

  const createVenue = async () => {
    if (!venueName) return
    try {
      await eventsApi.createVenue({ name: venueName, address: venueAddress, city: venueCity, capacity: Number(venueCap) || 0 })
      const r = await eventsApi.getVenues()
      if (r.success && r.data) setVenues(Array.isArray(r.data) ? r.data : [])
      setVenueOpen(false); setVenueName(''); setVenueAddress(''); setVenueCity(''); setVenueCap('')
    } catch {}
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { draft: 'Borrador', published: 'Publicado', cancelled: 'Cancelado', completed: 'Finalizado' }
    const colors: Record<string, string> = { draft: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', cancelled: 'bg-red-500/10 text-red-400 border-red-500/20', completed: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
    return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colors[s] || ''}`}>{map[s] || s}</Badge>
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando...</div>

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard icon={<Calendar className="h-4 w-4" />} label="Eventos" value={stats.total} sub={`${stats.published} publicados`} />
        <StatsCard icon={<Ticket className="h-4 w-4" />} label="Próximos" value={stats.upcoming} sub={`${stats.draft} borradores`} color="emerald" />
        <StatsCard icon={<TrendingUp className="h-4 w-4" />} label="Vendidos" value="—" sub="—" color="blue" />
        <StatsCard icon={<DollarSign className="h-4 w-4" />} label="Ingresos" value="—" sub="—" color="amber" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gestiona tus experiencias</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setVenueOpen(true)}>
            <MapPin className="h-4 w-4 mr-1" /> Venues
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo Evento
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start gap-2 bg-transparent p-0 h-auto">
          <TabsTrigger value="list" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm">Lista</TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm">Calendario</TabsTrigger>
          <TabsTrigger value="timeline" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm">Timeline</TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('grid')}>Grid</Button>
            <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('table')}>Tabla</Button>
          </div>

          {events.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Ticket className="h-12 w-12 mx-auto mb-4 opacity-15" />
                <p className="text-lg font-medium mb-2">No tienes eventos</p>
                <p className="text-muted-foreground mb-4 text-sm">Crea tu primer evento para empezar</p>
                <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Crear Evento</Button>
              </CardContent>
            </Card>
          ) : view === 'table' ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b"><tr>
                  <th className="text-left p-3 font-medium">Evento</th>
                  <th className="text-left p-3 font-medium">Fecha</th>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Estado</th>
                  <th className="text-right p-3 font-medium">Acciones</th>
                </tr></thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{e.title}</td>
                      <td className="p-3 text-muted-foreground text-xs">{new Date(e.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-3 text-xs">{e.event_type === 'zones' ? 'Zonas' : e.event_type === 'seats' ? 'Asientos' : 'General'}</td>
                      <td className="p-3">{statusBadge(e.status)}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {e.status === 'draft' && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => publishEvent(e.id)}><Eye className="h-3 w-3 mr-1" /> Publicar</Button>}
                          {e.status === 'published' && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openPublic(e.id)}><ArrowUpRight className="h-3 w-3 mr-1" /> Ver público</Button>}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(e)}><Pencil className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => loadTimeline(e.id)}><Clock className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => deleteEvent(e.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {events.map(e => (
                <Card key={e.id} className="hover:shadow-md transition-all group overflow-hidden">
                  {e.cover_image ? (
                    <img src={e.cover_image} alt={e.title} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Ticket className="h-10 w-10 text-primary/30" />
                    </div>
                  )}
                  <CardHeader className="pb-1 pt-3">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-sm font-semibold leading-tight">{e.title}</CardTitle>
                      {statusBadge(e.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 pb-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(e.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{e.venue_name || e.location || 'Sin ubicación'}</p>
                    <div className="flex gap-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {e.status === 'draft' && <Button size="sm" className="h-7 text-xs flex-1" onClick={() => publishEvent(e.id)}><Eye className="h-3 w-3 mr-1" /> Publicar</Button>}
                      {e.status === 'published' && <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => openPublic(e.id)}><ArrowUpRight className="h-3 w-3 mr-1" /> Ver público</Button>}
                      <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => openEdit(e)}><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => loadTimeline(e.id)}><Clock className="h-3 w-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Próximos eventos</CardTitle></CardHeader>
            <CardContent>
              {events.filter(e => new Date(e.event_date) > new Date()).length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No hay eventos próximos</p>
              ) : (
                <div className="space-y-2">
                  {events.filter(e => new Date(e.event_date) > new Date()).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()).map(e => (
                    <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-primary">{new Date(e.event_date).getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(e.event_date).toLocaleDateString('es-CO', { month: 'short', weekday: 'short' })} · {new Date(e.event_date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      {statusBadge(e.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          {!selectedEventId ? (
            <Card className="border-dashed"><CardContent className="py-16 text-center text-muted-foreground text-sm">Selecciona un evento para ver su timeline</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {timelineMetrics && (
                <div className="grid grid-cols-3 gap-3">
                  <StatsCard icon={<Ticket className="h-3 w-3" />} label="Vendidos" value={timelineMetrics.totalSales || 0} sub="" color="emerald" />
                  <StatsCard icon={<CheckCircle className="h-3 w-3" />} label="Check-ins" value={timelineMetrics.totalCheckins || 0} sub="" color="blue" />
                  <StatsCard icon={<DollarSign className="h-3 w-3" />} label="Ingresos" value={`$${Number(timelineMetrics.totalRevenue || 0).toLocaleString('es-CO')}`} sub="" color="amber" />
                </div>
              )}
              <div className="space-y-1">
                {timeline.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No hay actividad registrada</p>}
                {timeline.map((entry, i) => (
                  <div key={entry.id || i} className="flex gap-3 py-2 border-b border-muted last:border-0">
                    <span className="text-lg flex-shrink-0 mt-0.5">{entry.icon || '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{entry.description}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{entry.actor ? ` · ${entry.actor}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Event Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={v => { if (!v) resetEditor(); setEditorOpen(v) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Evento' : 'Nuevo Evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium">Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre del evento" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-medium">Fecha inicio *</Label><Input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs font-medium">Fecha fin</Label><Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" /></div>
            </div>
            <div>
              <Label className="text-xs font-medium">Descripción</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs font-medium">Tipo</Label><Select value={eventType} onValueChange={setEventType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">General</SelectItem><SelectItem value="zones">Zonas</SelectItem><SelectItem value="seats">Asientos</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs font-medium">Capacidad</Label><Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs font-medium">Política devolución</Label><Select value={refundPolicy} onValueChange={setRefundPolicy}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin devolución</SelectItem><SelectItem value="24h">24h antes</SelectItem><SelectItem value="48h">48h antes</SelectItem><SelectItem value="auto">Automática</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs font-medium">Ubicación</Label><Input value={location} onChange={e => setLocation(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs font-medium">Imagen portada (URL)</Label><Input value={coverImage} onChange={e => setCoverImage(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs font-medium">Venue</Label><Select value={venueId} onValueChange={setVenueId}><SelectTrigger className="mt-1"><SelectValue placeholder="Sin venue" /></SelectTrigger><SelectContent>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs font-medium">Edad mínima</Label><Input type="number" value={minAge} onChange={e => setMinAge(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs font-medium">Max entradas/persona</Label><Input type="number" value={maxTickets} onChange={e => setMaxTickets(e.target.value)} className="mt-1" /></div>
              <div />
            </div>

            {/* Ticket Types (only when editing) */}
            {editingId && (
              <div className="border-t pt-4">
                <Label className="text-xs font-medium mb-2 block">Tipos de entrada</Label>
                <div className="space-y-2 mb-3">
                  {ticketTypes.map(tt => (
                    <div key={tt.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{tt.name}</span>
                        <span className="text-muted-foreground ml-2">${Number(tt.price).toLocaleString('es-CO')}</span>
                        <span className="text-muted-foreground ml-2 text-xs">({tt.tickets_sold || 0}/{tt.capacity || '∞'})</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500" onClick={() => removeTicketType(tt.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Nombre" value={newTicket.name} onChange={e => setNewTicket(p => ({ ...p, name: e.target.value }))} className="h-8 text-xs flex-1" />
                  <Input placeholder="Precio" type="number" value={newTicket.price} onChange={e => setNewTicket(p => ({ ...p, price: e.target.value }))} className="h-8 text-xs w-24" />
                  <Input placeholder="Cupo" type="number" value={newTicket.capacity} onChange={e => setNewTicket(p => ({ ...p, capacity: e.target.value }))} className="h-8 text-xs w-20" />
                  <Button size="sm" className="h-8 text-xs" onClick={addTicketType}><Plus className="h-3 w-3 mr-1" /> Agregar</Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => { resetEditor(); setEditorOpen(false) }}>Cancelar</Button>
              <Button size="sm" onClick={saveEvent} disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Evento'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Venue Dialog */}
      <Dialog open={venueOpen} onOpenChange={setVenueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gestionar Venues</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {venues.map(v => (
              <div key={v.id} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg text-sm">
                <div><span className="font-medium">{v.name}</span><span className="text-muted-foreground ml-2 text-xs">{v.city || ''}</span></div>
                <span className="text-xs text-muted-foreground">{v.capacity || 0} cap.</span>
              </div>
            ))}
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs">Nuevo Venue</Label>
              <Input placeholder="Nombre" value={venueName} onChange={e => setVenueName(e.target.value)} className="h-8 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Ciudad" value={venueCity} onChange={e => setVenueCity(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Capacidad" type="number" value={venueCap} onChange={e => setVenueCap(e.target.value)} className="h-8 text-sm" />
              </div>
              <Input placeholder="Dirección" value={venueAddress} onChange={e => setVenueAddress(e.target.value)} className="h-8 text-sm" />
              <Button size="sm" onClick={createVenue} className="w-full"><Plus className="h-3 w-3 mr-1" /> Crear Venue</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatsCard({ icon, label, value, sub, color = 'default' }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color?: string }) {
  const borders: Record<string, string> = { emerald: 'border-l-emerald-500', blue: 'border-l-blue-500', amber: 'border-l-amber-500', default: 'border-l-primary' }
  return (
    <Card className={`border-l-2 ${borders[color] || borders.default}`}>
      <CardContent className="p-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
          {sub ? <p className="text-[10px] text-muted-foreground">{sub}</p> : null}
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  )
}
