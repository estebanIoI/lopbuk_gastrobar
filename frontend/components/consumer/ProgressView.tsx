'use client'

/**
 * ProgressView — Vista de progreso completa (P1). Timeline de registros, comparación
 * before/after de fotos y predicción simple por tendencia. Se abre desde ProgressCard.
 */
import { useEffect, useState } from 'react'
import { X, Loader2, TrendingDown, TrendingUp, Minus, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

export default function ProgressView({ onClose }: { onClose: () => void }) {
  const [summary, setSummary] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getProgress(), api.getProgressLogs(120)]).then(([s, l]) => {
      if (s.success) setSummary(s.data)
      if (l.success) setLogs(l.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const photos = logs.filter(l => l.photoUrl)
  const firstPhoto = photos[0]
  const lastPhoto = photos.length > 1 ? photos[photos.length - 1] : null
  const weights = logs.filter(l => l.weightKg != null)

  // Predicción simple: tasa semanal × 12.
  let prediction: string | null = null
  if (weights.length >= 2) {
    const first = weights[0], last = weights[weights.length - 1]
    const days = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000)
    const ratePerWeek = ((last.weightKg - first.weightKg) / days) * 7
    if (Math.abs(ratePerWeek) >= 0.05) {
      const proj = Math.round(ratePerWeek * 12 * 10) / 10
      prediction = `Si mantienes este ritmo: ${proj > 0 ? '+' : ''}${proj} kg en 12 semanas.`
    }
  }

  const s = summary || {}
  const delta = s.deltaKg
  const TrendIcon = delta == null || delta === 0 ? Minus : delta < 0 ? TrendingDown : TrendingUp

  return (
    <div className="fixed inset-0 z-[150] bg-neutral-50 flex flex-col">
      <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 bg-white shrink-0">
        <h2 className="font-bold text-neutral-900">Mi progreso</h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full">
        {loading ? <div className="flex justify-center py-16 text-neutral-300"><Loader2 className="w-7 h-7 animate-spin" /></div> : (
          <div className="space-y-5">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Score" value={String(s.score ?? 0)} />
              <Stat label="Peso actual" value={s.latestWeightKg != null ? `${s.latestWeightKg} kg` : '—'} />
              <Stat label="Cambio" value={delta != null ? `${delta > 0 ? '+' : ''}${delta} kg` : '—'} icon={TrendIcon} />
            </div>

            {/* Predicción */}
            {prediction && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <div><p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Proyección</p><p className="text-sm text-indigo-900/80">{prediction}</p></div>
              </div>
            )}

            {/* Before / After */}
            {firstPhoto && (
              <div>
                <h3 className="text-sm font-bold text-neutral-800 mb-2">Antes / Después</h3>
                <div className="grid grid-cols-2 gap-2">
                  <PhotoCard label={`Inicio · ${fmtDate(firstPhoto.date)}`} url={firstPhoto.photoUrl} weight={firstPhoto.weightKg} />
                  {lastPhoto
                    ? <PhotoCard label={`Hoy · ${fmtDate(lastPhoto.date)}`} url={lastPhoto.photoUrl} weight={lastPhoto.weightKg} />
                    : <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 flex items-center justify-center text-center text-[11px] text-neutral-400 p-4">Sube otra foto<br />para comparar</div>}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="text-sm font-bold text-neutral-800 mb-2">Historial</h3>
              {logs.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-8">Aún no tienes registros. Empieza a medir tu transformación.</p>
              ) : (
                <div className="space-y-2">
                  {[...logs].reverse().map((l, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-3">
                      {l.photoUrl ? <img src={l.photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" /> : <div className="w-12 h-12 rounded-lg bg-neutral-100 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-800">{l.weightKg != null ? `${l.weightKg} kg` : 'Registro'}{l.bodyFat != null ? ` · ${l.bodyFat}% grasa` : ''}</p>
                        <p className="text-[11px] text-neutral-400">{fmtDate(l.date)}{l.note ? ` · ${l.note}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-3 text-center">
      <p className="text-lg font-extrabold text-neutral-900 flex items-center justify-center gap-1">{Icon && <Icon className="w-4 h-4 text-neutral-400" />}{value}</p>
      <p className="text-[11px] text-neutral-400">{label}</p>
    </div>
  )
}
function PhotoCard({ label, url, weight }: { label: string; url: string; weight?: number | null }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-black/[0.06] bg-white">
      <img src={url} alt="" className="w-full h-44 object-cover" />
      <div className="p-2"><p className="text-[11px] text-neutral-500">{label}</p>{weight != null && <p className="text-sm font-bold text-neutral-800">{weight} kg</p>}</div>
    </div>
  )
}
