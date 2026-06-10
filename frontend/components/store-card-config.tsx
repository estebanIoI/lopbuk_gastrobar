'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Save, Clock, Store, RefreshCw, Copy } from 'lucide-react'

type Slot = { open: string; close: string }
type Hours = Record<string, Slot[]>

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
]

const DAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '')
  if (!m) return null
  const h = +m[1], mi = +m[2]
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null
  return h * 60 + mi
}

function slotContains(s: Slot, minutes: number): boolean {
  const o = toMin(s.open), c = toMin(s.close)
  if (o === null || c === null) return false
  if (c > o) return minutes >= o && minutes < c
  if (c < o) return minutes >= o || minutes < c
  return true
}

/** Estado abierto/cerrado en zona horaria de Colombia (espejo del backend). */
function computeOpenNow(hours: Hours): boolean | null {
  const any = DAY_ORDER.some(d => (hours[d]?.length ?? 0) > 0)
  if (!any) return null // sin horario → el backend lo deja abierto por defecto
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const wd = get('weekday').toLowerCase().slice(0, 3)
  let h = parseInt(get('hour'), 10); if (h === 24) h = 0
  const minutes = h * 60 + parseInt(get('minute'), 10)
  const dayKey = DAY_ORDER.includes(wd) ? wd : 'mon'
  for (const s of hours[dayKey] ?? []) if (slotContains(s, minutes)) return true
  // franja nocturna iniciada ayer
  const yIdx = (DAY_ORDER.indexOf(dayKey) + 6) % 7
  for (const s of hours[DAY_ORDER[yIdx]] ?? []) {
    const o = toMin(s.open), c = toMin(s.close)
    if (o !== null && c !== null && c < o && minutes < c) return true
  }
  return false
}

export function StoreCardConfig() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [coverUrl, setCoverUrl] = useState('')
  const [cardDescription, setCardDescription] = useState('')
  const [hours, setHours] = useState<Hours>({})
  const [theme, setTheme] = useState<'theme1' | 'theme2'>('theme1')

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getCardConfig()
        if (res.success && res.data) {
          setCoverUrl(res.data.coverUrl ?? '')
          setCardDescription(res.data.cardDescription ?? '')
          setHours((res.data.businessHours as Hours) ?? {})
          setTheme(res.data.theme === 'theme2' ? 'theme2' : 'theme1')
        }
      } catch { /* noop */ }
      setLoading(false)
    })()
  }, [])

  const openNow = useMemo(() => computeOpenNow(hours), [hours])

  const addSlot = (day: string) => {
    setHours(prev => ({ ...prev, [day]: [...(prev[day] ?? []), { open: '08:00', close: '18:00' }] }))
  }
  const removeSlot = (day: string, idx: number) => {
    setHours(prev => ({ ...prev, [day]: (prev[day] ?? []).filter((_, i) => i !== idx) }))
  }
  const updateSlot = (day: string, idx: number, field: 'open' | 'close', value: string) => {
    setHours(prev => ({
      ...prev,
      [day]: (prev[day] ?? []).map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }))
  }
  const copyMondayToAll = () => {
    const base = hours['mon'] ?? []
    setHours(() => {
      const next: Hours = {}
      for (const d of DAY_ORDER) next[d] = base.map(s => ({ ...s }))
      return next
    })
    toast.success('Horario del lunes copiado a todos los días')
  }

  const save = async () => {
    setSaving(true)
    try {
      // Limpia franjas vacías/ inválidas
      const clean: Hours = {}
      for (const d of DAY_ORDER) {
        const slots = (hours[d] ?? []).filter(s => toMin(s.open) !== null && toMin(s.close) !== null)
        if (slots.length) clean[d] = slots
      }
      const res = await api.updateCardConfig({
        coverUrl: coverUrl.trim() || null,
        cardDescription: cardDescription.trim() || null,
        businessHours: Object.keys(clean).length ? clean : null,
        theme,
      })
      if (res.success) toast.success('Tarjeta guardada')
      else toast.error(res.error || 'No se pudo guardar')
    } catch {
      toast.error('Error al guardar la tarjeta')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Store className="h-5 w-5 text-muted-foreground" />
            Tarjeta del comercio
          </h2>
          <p className="text-sm text-muted-foreground">
            Así se presenta tu negocio en la página principal. El estado abierto/cerrado se calcula automáticamente con tu horario.
          </p>
        </div>
        {openNow !== null && (
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${openNow ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'}`}>
            Ahora: {openNow ? 'ABIERTO' : 'CERRADO'}
          </span>
        )}
      </div>

      {/* Selector de tema de la tienda */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Tema de la tienda</h3>
          <p className="text-xs text-muted-foreground">Elige cómo se ve tu tienda pública. Puedes cambiarlo cuando quieras.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { id: 'theme1', name: 'Tema 1 · Clásico', desc: 'Tu diseño actual de tienda.' },
            { id: 'theme2', name: 'Tema 2 · Gastronómico', desc: 'Estilo oscuro con hero, favoritos, sedes y pedidos.' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`text-left rounded-lg border p-3 transition-colors ${theme === opt.id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:bg-muted'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full border-2 ${theme === opt.id ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
                <span className="text-sm font-medium">{opt.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 pl-5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Portada + descripción */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Imagen de portada (URL)</label>
          <Input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://..." />
          {coverUrl.trim() && (
            <div className="mt-2 rounded-lg overflow-hidden border border-border" style={{ aspectRatio: '16/10', maxWidth: 320 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="Portada" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Descripción corta</label>
          <Input
            value={cardDescription}
            onChange={e => setCardDescription(e.target.value)}
            placeholder="Ej: Cocina peruana auténtica"
            maxLength={300}
          />
          <p className="text-xs text-muted-foreground mt-1">{cardDescription.length}/300</p>
        </div>
      </div>

      {/* Horario por día con franjas */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Horario de atención
          </h3>
          <Button variant="outline" size="sm" onClick={copyMondayToAll}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar lunes a todos
          </Button>
        </div>

        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const slots = hours[key] ?? []
            return (
              <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-2 py-2 border-b border-border last:border-0">
                <div className="w-24 shrink-0 pt-1.5 text-sm font-medium">{label}</div>
                <div className="flex-1 space-y-2">
                  {slots.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">Cerrado</span>
                  ) : (
                    slots.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={s.open}
                          onChange={e => updateSlot(key, idx, 'open', e.target.value)}
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                        />
                        <span className="text-muted-foreground text-sm">a</span>
                        <input
                          type="time"
                          value={s.close}
                          onChange={e => updateSlot(key, idx, 'close', e.target.value)}
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeSlot(key, idx)}
                          className="h-8 w-8 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                          aria-label="Quitar franja"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => addSlot(key)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Añadir franja
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: para horarios nocturnos (ej. 18:00 a 02:00) usa la hora de cierre menor que la de apertura; se entiende que cruza la medianoche.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ml-1.5">Guardar tarjeta</span>
        </Button>
      </div>
    </div>
  )
}
