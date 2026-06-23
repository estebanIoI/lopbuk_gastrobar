'use client'

/**
 * ProgressCard — Transformation tracking (F4.3). Muestra el Progress Score, peso
 * actual, delta y una mini-tendencia. Permite registrar el peso del día.
 */
import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, TrendingDown, Minus, Plus, X, LineChart } from 'lucide-react'
import { api } from '@/lib/api'
import ProgressView from '../ProgressView'

function Sparkline({ points }: { points: { weightKg: number | null }[] }) {
  const vals = points.map(p => p.weightKg).filter((v): v is number => v != null)
  if (vals.length < 2) return null
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const w = 120, h = 32
  const step = w / (vals.length - 1)
  const d = vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - ((v - min) / range) * h).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ProgressCard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [showFull, setShowFull] = useState(false)

  const load = async () => { const r = await api.getProgress(); if (r.success) setData(r.data); setLoading(false) }
  useEffect(() => { load() }, [])

  if (loading) return null
  const s = data || {}
  const hasData = s.latestWeightKg != null || s.logsCount > 0
  const delta = s.deltaKg
  const TrendIcon = delta == null || delta === 0 ? Minus : delta < 0 ? TrendingDown : TrendingUp
  // Para "bajar de peso" un delta negativo es bueno (verde).
  const good = delta != null && ((s.goal === 'bajar_peso' && delta < 0) || (s.goal === 'subir_masa' && delta > 0))

  return (
    <div className="px-4 pt-3">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Score ring */}
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f1f1" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${(s.score || 0) * 0.974} 100`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-neutral-900">{s.score || 0}</div>
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-900">Mi transformación</p>
              {hasData ? (
                <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                  {s.latestWeightKg != null && <span>{s.latestWeightKg} kg</span>}
                  {delta != null && delta !== 0 && (
                    <span className={`inline-flex items-center gap-0.5 ${good ? 'text-emerald-600' : 'text-neutral-500'}`}>
                      <TrendIcon className="w-3 h-3" />{Math.abs(delta)} kg
                    </span>
                  )}
                  {s.toGoalKg != null && s.toGoalKg !== 0 && <span className="text-neutral-400">· faltan {Math.abs(s.toGoalKg)} kg</span>}
                </p>
              ) : (
                <p className="text-[11px] text-neutral-400">Registra tu peso para empezar a medir.</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {s.trend?.length >= 2 && <div className="text-sky-500 hidden sm:block"><Sparkline points={s.trend} /></div>}
            {s.lastPhotoUrl && <img src={s.lastPhotoUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-black/10" />}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setOpen(true)} className="flex-1 rounded-xl bg-neutral-900 text-white text-sm font-semibold py-2 hover:bg-black flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> Registrar
          </button>
          <button onClick={() => setShowFull(true)} className="rounded-xl border border-neutral-200 text-neutral-600 text-sm font-medium px-3 hover:bg-neutral-50 flex items-center gap-1.5">
            <LineChart className="w-4 h-4" /> Ver progreso
          </button>
        </div>
      </div>
      {open && <LogModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load() }} />}
      {showFull && <ProgressView onClose={() => setShowFull(false)} />}
    </div>
  )
}

function LogModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [note, setNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!weight && !bodyFat && !photoUrl.trim()) { setErr('Ingresa tu peso o una foto.'); return }
    setBusy(true); setErr('')
    const r = await api.logBody({ weightKg: weight ? Number(weight) : undefined, bodyFat: bodyFat ? Number(bodyFat) : undefined, note: note.trim() || undefined, photoUrl: photoUrl.trim() || undefined })
    setBusy(false)
    if (r.success) onSaved(); else setErr(r.error || 'No se pudo guardar.')
  }

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-neutral-900">Registro de hoy</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-xs text-neutral-500">Peso (kg)</span>
            <input inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="75.5" className="w-full mt-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" /></label>
          <label className="block"><span className="text-xs text-neutral-500">% grasa (opc.)</span>
            <input inputMode="decimal" value={bodyFat} onChange={e => setBodyFat(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="18" className="w-full mt-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" /></label>
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (opcional)" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
        <input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="Foto de progreso (URL, opcional)" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
        {err && <p className="text-xs text-red-500">{err}</p>}
        <button onClick={save} disabled={busy} className="w-full rounded-xl bg-neutral-900 text-white text-sm font-semibold py-2.5 hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
