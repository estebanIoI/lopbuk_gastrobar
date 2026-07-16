'use client'
import { useEffect, useState } from 'react'
import { eventsApi } from '@/lib/events-api'
import { Calendar, MapPin, Ticket } from 'lucide-react'

/**
 * Vitrina de eventos publicados — descubribilidad.
 * - `slug` presente  → eventos de ese comercio (link /evento/<slug>?e=<id>)
 * - `slug` ausente    → todos los eventos del marketplace (link /evento/<store_slug>?e=<id>)
 * Se auto-oculta si no hay eventos, así se puede montar sin condicionar.
 */
export function EventsShowcase({ slug, title = 'Eventos', dark = false, className = '' }: {
  slug?: string
  title?: string
  dark?: boolean
  className?: string
}) {
  const [items, setItems] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    eventsApi.getPublicEvents(slug || '')
      .then(r => { if (alive && r.success && Array.isArray(r.data)) setItems(r.data) })
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [slug])

  if (!loaded || items.length === 0) return null

  const hrefFor = (ev: any) => `/evento/${slug || ev.store_slug}?e=${ev.id}`
  const sub = dark ? 'text-white/60' : 'text-muted-foreground'
  const cardBg = dark ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-card border-border hover:shadow-lg'

  return (
    <section className={`w-full ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Ticket className="h-5 w-5 text-primary" />
        <h2 className={`text-lg font-bold ${dark ? 'text-white' : ''}`}>{title}</h2>
        <span className={`text-xs ${sub}`}>({items.length})</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {items.map((ev: any) => (
          <a
            key={ev.id}
            href={hrefFor(ev)}
            className={`shrink-0 w-60 rounded-xl border overflow-hidden transition-all hover:-translate-y-0.5 ${cardBg}`}
          >
            {ev.cover_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ev.cover_image} alt={ev.title} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Ticket className="h-8 w-8 text-white/30" />
              </div>
            )}
            <div className="p-3">
              <p className={`font-semibold text-sm line-clamp-1 ${dark ? 'text-white' : ''}`}>{ev.title}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${sub}`}>
                <Calendar className="h-3 w-3" />
                {new Date(ev.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
              </p>
              {(ev.venue_name || ev.city || ev.store_name) && (
                <p className={`text-xs mt-0.5 flex items-center gap-1 ${sub}`}>
                  <MapPin className="h-3 w-3" />
                  <span className="line-clamp-1">{ev.venue_name || ev.city || ev.store_name}</span>
                </p>
              )}
              {ev.price_from != null && (
                <p className={`text-sm font-bold mt-1.5 ${dark ? 'text-white' : ''}`}>
                  Desde ${Number(ev.price_from).toLocaleString('es-CO')}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

export default EventsShowcase
