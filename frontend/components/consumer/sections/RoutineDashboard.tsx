'use client'

/**
 * RoutineDashboard — "Rutina" como dashboard de widgets para escritorio (C7-polish).
 * Aprovecha el ancho: WeekStrip (driver diario) arriba + grid de rutinas con sus
 * actividades. Reusa WeekStrip y ActividadForm (sin duplicar UI). Datos por props.
 */
import { useState } from 'react'
import { Plus, Trash2, Repeat } from 'lucide-react'
import { api } from '@/lib/api'
import { WeekStrip, ActividadForm } from '@/components/consumer-routine'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function RoutineDashboard({ rutinas, onReload }: { rutinas: any[]; onReload: () => void }) {
  const [newName, setNewName] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null)

  const crear = async () => {
    if (!newName.trim()) return
    await api.createRutina({ name: newName.trim(), type: 'general' })
    setNewName(''); onReload()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {/* Driver diario: semana + check-off */}
      <div className="lg:col-span-1">
        <WeekStrip rutinas={rutinas} />
      </div>

      {/* Mis rutinas */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') crear() }}
            placeholder="Nueva rutina (ej: Mañanas)"
            className="flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
          />
          <button onClick={crear} className="bg-orange-500 text-white rounded-xl px-4 shrink-0"><Plus className="w-5 h-5" /></button>
        </div>

        {rutinas?.length ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {rutinas.map((r: any) => (
              <div key={r.id} className="rounded-2xl bg-white border border-black/[0.07] p-4 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><Repeat className="w-4 h-4 text-orange-500" /><span className="font-semibold">{r.name}</span></div>
                  <button onClick={async () => { await api.deleteRutina(r.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="space-y-1.5">
                  {(r.activities || []).map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm bg-neutral-50 rounded-lg px-3 py-2">
                      <span className="text-[11px] font-bold text-orange-600 w-10">{a.startTime ? a.startTime.slice(0, 5) : '—'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600">{a.dayOfWeek === null ? 'Diario' : DAYS[a.dayOfWeek]}</span>
                      <span className="flex-1 truncate">{a.title}</span>
                      <button onClick={async () => { await api.deleteActividad(a.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {(r.activities || []).length === 0 && <p className="text-xs text-neutral-400 py-1">Sin actividades.</p>}
                </div>
                {addingTo === r.id
                  ? <ActividadForm rutinaId={r.id} onDone={() => { setAddingTo(null); onReload() }} onCancel={() => setAddingTo(null)} />
                  : <button onClick={() => setAddingTo(r.id)} className="mt-2 text-xs text-orange-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Agregar actividad</button>}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-black/[0.07] p-10 text-center text-neutral-400">
            <Repeat className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Crea tu primera rutina para organizar tu semana.</p>
          </div>
        )}
      </div>
    </div>
  )
}
