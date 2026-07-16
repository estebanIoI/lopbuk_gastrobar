'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { eventsApi } from '@/lib/events-api'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Ticket, Plus, Pencil, Trash2, Eye, EyeOff, Users, BarChart3 } from 'lucide-react'

interface Event {
  id: string; title: string; event_date: string; location?: string; status: string;
  cover_image?: string; event_type: string; capacity?: number; description?: string;
  venue_name?: string; ticket_types?: any[];
}

export default function EventAdmin() {
  const [events, setEvents] = useState<Event[]>([])
  const [venues, setVenues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [eventType, setEventType] = useState('general')
  const [capacity, setCapacity] = useState('0')
  const [venueId, setVenueId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [evt, ven] = await Promise.all([
        eventsApi.getEvents(),
        eventsApi.getVenues(),
      ])
      if (evt.success && evt.data) setEvents(Array.isArray(evt.data) ? evt.data : evt.data.data || [])
      if (ven.success && ven.data) setVenues(Array.isArray(ven.data) ? ven.data : [])
      else if (evt.error) setError(evt.error)
    } catch { setError('Error al cargar eventos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setTitle(''); setDescription(''); setEventDate(''); setLocation('')
    setCoverImage(''); setEventType('general'); setCapacity('0'); setVenueId('')
    setEditing(null)
  }

  const openCreate = () => { resetForm(); setOpen(true) }
  const openEdit = (e: Event) => {
    setEditing(e)
    setTitle(e.title)
    setDescription(e.description || '')
    setEventDate(e.event_date?.slice(0, 16) || '')
    setLocation(e.location || '')
    setCoverImage(e.cover_image || '')
    setEventType(e.event_type || 'general')
    setCapacity(String(e.capacity || 0))
    setVenueId(e.venue_name ? '' : '')
    setOpen(true)
  }

  const save = async () => {
    if (!title || !eventDate) { setError('Título y fecha son requeridos'); return }
    setSaving(true)
    try {
      const data = { title, description, eventDate, location, coverImage, eventType,
        capacity: Number(capacity) || 0, venueId: venueId || null }
      if (editing) {
        await eventsApi.updateEvent(editing.id, data)
      } else {
        await eventsApi.createEvent(data)
      }
      setOpen(false)
      load()
    } catch (e: any) { setError(e?.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const publishEvent = async (id: string) => {
    try { await eventsApi.publishEvent(id); load() }
    catch { setError('Error al publicar') }
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return
    try { await eventsApi.deleteEvent(id); load() }
    catch { setError('Error al eliminar') }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { draft: 'Borrador', published: 'Publicado', cancelled: 'Cancelado', completed: 'Finalizado' }
    const colors: Record<string, string> = { draft: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', published: 'bg-green-500/10 text-green-500 border-green-500/20', cancelled: 'bg-red-500/10 text-red-500 border-red-500/20', completed: 'bg-slate-500/10 text-slate-500 border-slate-500/20' }
    return <Badge variant="outline" className={colors[s] || ''}>{map[s] || s}</Badge>
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando eventos...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground mt-1">Gestiona tus eventos, tipos de entrada y publicaciones</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nuevo Evento</Button>
      </div>

      {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>}

      {events.length === 0
        ? <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">No tienes eventos creados</p>
              <p className="mb-4">Crea tu primer evento para empezar a vender entradas</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Crear Evento</Button>
            </CardContent>
          </Card>
        : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map(e => (
              <Card key={e.id} className="hover:shadow-md transition-shadow">
                {e.cover_image && (
                  <img src={e.cover_image} alt={e.title} className="w-full h-40 object-cover rounded-t-xl" />
                )}
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{e.title}</CardTitle>
                    {statusBadge(e.status)}
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <Calendar className="h-3 w-3" />
                    {new Date(e.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {e.venue_name || e.location || 'Sin ubicación'}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span>{e.event_type === 'zones' ? 'Por zonas' : e.event_type === 'seats' ? 'Asientos' : 'General'}</span>
                    {e.capacity ? <span>{e.capacity} capacidad</span> : null}
                  </div>
                  <div className="flex gap-2 pt-2">
                    {e.status === 'draft' && (
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => publishEvent(e.id)}>
                        <Eye className="h-3 w-3 mr-1" /> Publicar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(e)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => deleteEvent(e.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
      }

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); setOpen(v) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Evento' : 'Nuevo Evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre del evento" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha y hora *</Label>
                <Input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General (sin asientos)</SelectItem>
                    <SelectItem value="zones">Por zonas (VIP/General/Palco)</SelectItem>
                    <SelectItem value="seats">Con asientos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe tu evento..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ubicación</Label>
                <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Dirección del evento" />
              </div>
              <div>
                <Label>Venue</Label>
                <Select value={venueId} onValueChange={setVenueId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar venue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin venue</SelectItem>
                    {venues.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Imagen de portada (URL)</Label>
                <Input value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label>Capacidad total</Label>
                <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} min="0" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { resetForm(); setOpen(false) }}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Evento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
