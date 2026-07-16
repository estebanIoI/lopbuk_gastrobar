'use client'
import { useEffect, useState } from 'react'
import { eventsApi } from '@/lib/events-api'
import { Card } from '@/components/ui/card'
import { Calendar, MapPin, Ticket } from 'lucide-react'
import { DropLoader } from '@/components/drop-loader'

/**
 * Cartelera global del marketplace — todos los eventos publicados de todos los comercios.
 * Cada tarjeta lleva a /evento/<store_slug>?e=<id> (landing del comercio con el evento).
 */
export default function EventsIndex() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    eventsApi.getPublicEvents('')
      .then(r => { if (r.success && Array.isArray(r.data)) setItems(r.data) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-1">
          <Ticket className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Eventos</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-6">Descubre los próximos eventos de los comercios.</p>

        {loading ? (
          <div className="flex justify-center py-20"><DropLoader label="Cargando eventos…" /></div>
        ) : items.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">Aún no hay eventos publicados.</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((ev: any) => (
              <a key={ev.id} href={`/evento/${ev.store_slug}?e=${ev.id}`} className="group">
                <Card className="overflow-hidden h-full transition-all hover:shadow-lg hover:-translate-y-0.5">
                  {ev.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.cover_image} alt={ev.title} className="w-full h-44 object-cover" />
                  ) : (
                    <div className="w-full h-44 bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center"><Ticket className="h-10 w-10 text-white/30" /></div>
                  )}
                  <div className="p-4">
                    <p className="font-semibold line-clamp-1">{ev.title}</p>
                    {ev.store_name && <p className="text-xs text-primary mt-0.5 line-clamp-1">{ev.store_name}</p>}
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(ev.event_date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    {(ev.venue_name || ev.city) && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /><span className="line-clamp-1">{ev.venue_name || ev.city}</span></p>}
                    {ev.price_from != null && <p className="text-sm font-bold mt-2">Desde ${Number(ev.price_from).toLocaleString('es-CO')}</p>}
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
