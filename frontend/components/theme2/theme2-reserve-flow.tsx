'use client'

import { useMemo, useState } from 'react'
import { X, ChevronRight, ChevronLeft, MapPin, CalendarDays, Plus, Minus } from 'lucide-react'

interface Sede { id: string; name: string; address?: string | null }
interface Info { name?: string; socialWhatsapp?: string | null }

const INP = 'w-full rounded-xl bg-[#161616] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-400/50 focus:outline-none'

/**
 * Tema 2 — Reservar Mesa.
 * Modal de sede → formulario. Envía la solicitud por WhatsApp al restaurante,
 * que la confirma (igual que la referencia). Independiente del Tema 1.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export function Theme2ReserveFlow({
  slug, info, sedes, onClose,
}: { slug: string; info: Info; sedes: Sede[]; onClose: () => void }) {
  const [step, setStep] = useState<'sede' | 'form' | 'done'>(sedes.length > 1 ? 'sede' : 'form')
  const [busy, setBusy] = useState(false)
  const [resNumber, setResNumber] = useState('')
  const [error, setError] = useState('')
  const [sede, setSede] = useState<Sede | null>(sedes.length === 1 ? sedes[0] : null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [guests, setGuests] = useState(1)
  const [notes, setNotes] = useState('')

  const missing = useMemo(() => {
    const m: string[] = []
    if (!name.trim()) m.push('Nombre')
    if (!phone.trim()) m.push('Teléfono')
    if (!date) m.push('Fecha')
    if (!time) m.push('Hora')
    return m
  }, [name, phone, date, time])

  // Mensaje de WhatsApp con todo el formulario (segunda opción, en el paso de éxito).
  const openWhatsApp = () => {
    const phoneTo = String(info.socialWhatsapp || '').replace(/\D/g, '')
    const lines = [
      `*Reserva de mesa — ${info.name || ''}*`,
      sede ? `Sede: ${sede.name}` : '',
      resNumber ? `N°: ${resNumber}` : '',
      '',
      `Nombre: ${name.trim()}`,
      `Teléfono: +57 ${phone.trim()}`,
      `Fecha: ${date}`,
      `Hora: ${time}`,
      `Personas: ${guests}`,
      notes.trim() ? `Notas: ${notes.trim()}` : '',
    ].filter(Boolean)
    window.open(`https://wa.me/${phoneTo}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  // Guarda la reserva en el backend (visible en el panel) y pasa al paso de éxito.
  const send = async () => {
    if (missing.length > 0 || busy) return
    setBusy(true); setError('')
    try {
      const r = await fetch(`${API_URL}/restbar/reservations/public-quick`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, customerName: name.trim(), customerPhone: phone.trim(),
          reservationDate: date, reservationTime: time, guestsCount: guests,
          notes: notes.trim() || undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) { setError(j?.error || 'No se pudo crear la reserva'); return }
      setResNumber(j.data?.reservationNumber || '')
      setStep('done')
    } catch { setError('No se pudo conectar. Intenta de nuevo.') }
    finally { setBusy(false) }
  }

  // ════ SELECTOR DE SEDE ════
  if (step === 'sede') {
    return (
      <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-[#141414] border border-cyan-400/40 overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-lg font-bold text-white">Selecciona Sede</h3>
                <p className="text-xs text-white/40">Elige disponible</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
            {sedes.map(s => (
              <button
                key={s.id}
                onClick={() => { setSede(s); setStep('form') }}
                className="w-full text-left flex items-center gap-3 rounded-xl bg-[#1b1b1b] border border-white/[0.06] hover:border-cyan-400/40 p-3 transition-colors"
              >
                <div className="w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-white/40" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{s.name}</p>
                  {s.address && <p className="text-xs text-white/40 truncate">{s.address}</p>}
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ════ ÉXITO ════
  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-sm rounded-2xl bg-[#141414] border border-green-400/40 overflow-hidden text-center p-6" onClick={e => e.stopPropagation()}>
          <div className="text-5xl mb-3">✅</div>
          <h3 className="text-xl font-extrabold text-white mb-1">¡Reserva exitosa!</h3>
          {resNumber && <p className="text-xs text-cyan-400 font-semibold mb-2">N° {resNumber}</p>}
          <p className="text-sm text-white/60 mb-5">Te llamaremos para confirmar tu reserva. También puedes continuar por WhatsApp para coordinarla más rápido.</p>
          <button onClick={openWhatsApp} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold py-3 mb-2">
            Continuar por WhatsApp
          </button>
          <button onClick={onClose} className="w-full rounded-xl border border-white/15 text-white/70 font-semibold py-2.5">Cerrar</button>
        </div>
      </div>
    )
  }

  // ════ FORMULARIO ════
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md my-auto rounded-2xl bg-[#141414] border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Reservar Mesa</h3>
              {sede && <p className="text-xs text-white/50 font-semibold">{sede.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sedes.length > 1 && <button onClick={() => setStep('sede')} className="text-white/40 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>}
            <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-white/50 mb-1">Nombre <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre completo" className={INP} />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-white/50 mb-1">Teléfono <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              <span className="shrink-0 rounded-xl bg-[#1b1b1b] border border-white/[0.08] px-3 py-2.5 text-sm text-white/60">co +57</span>
              <input value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="300 123 4567" className={INP} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-white/50 mb-1">Fecha <span className="text-red-400">*</span></label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INP} />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-white/50 mb-1">Hora <span className="text-red-400">*</span></label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={INP} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-white/50 mb-1">Personas <span className="text-red-400">*</span></label>
            <div className="flex items-center justify-between rounded-xl bg-[#161616] border border-white/[0.08] p-2">
              <button onClick={() => setGuests(g => Math.max(1, g - 1))} className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"><Minus className="w-4 h-4" /></button>
              <div className="text-center">
                <p className="text-xl font-extrabold leading-none">{guests}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/40 mt-0.5">Personas</p>
              </div>
              <button onClick={() => setGuests(g => g + 1)} className="w-10 h-10 rounded-lg bg-cyan-500 text-black flex items-center justify-center hover:opacity-90"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-white/50 mb-1">Notas (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Cumpleaños, alergias, zona preferida..." className={`${INP} resize-none`} />
          </div>

          {error && <p className="text-[13px] text-red-400 text-center">{error}</p>}

          <button
            onClick={send}
            disabled={missing.length > 0 || busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-bold py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy
              ? 'Enviando…'
              : missing.length > 0
                ? <span className="text-[12px]">Falta: {missing.join(', ')}</span>
                : <><CalendarDays className="w-5 h-5" /> Enviar Reserva</>}
          </button>
        </div>
      </div>
    </div>
  )
}
