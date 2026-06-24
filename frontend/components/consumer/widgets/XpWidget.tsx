'use client'

/**
 * XpWidget — gamificación (P2). Nivel + barra de XP + liga semanal. Motiva con
 * progreso visible. Compacto (chip) o completo (card). Recarga ligera.
 */
import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { api } from '@/lib/api'

export default function XpWidget({ compact = false }: { compact?: boolean }) {
  const [p, setP] = useState<any>(null)
  useEffect(() => { api.getXpProfile().then(r => { if (r.success) setP(r.data) }).catch(() => {}) }, [])
  if (!p) return null
  const lg = p.league || {}

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
        <Zap className="w-3.5 h-3.5 text-amber-300" /> Nv {p.level} · {lg.emoji} {lg.label}
      </span>
    )
  }

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-neutral-900 text-amber-300 font-extrabold flex items-center justify-center text-sm">{p.level}</span>
          <div>
            <p className="text-sm font-bold text-neutral-900">Nivel {p.level}</p>
            <p className="text-[11px] text-neutral-400">{p.totalXp} XP totales</p>
          </div>
        </div>
        <span className="text-xs font-bold rounded-full bg-amber-50 text-amber-700 px-2.5 py-1">{lg.emoji} {lg.label}</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all" style={{ width: `${p.levelProgress || 0}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[11px] text-neutral-400">
        <span>{p.intoLevel}/{p.levelSpan} al nivel {p.level + 1}</span>
        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" />{p.weeklyXp} esta semana</span>
      </div>
      {lg.next && lg.next.toGo > 0 && (
        <p className="text-[11px] text-neutral-500 mt-2 text-center">Te faltan <b className="text-amber-600">{lg.next.toGo} XP</b> esta semana para subir a {lg.next.emoji} {lg.next.label}</p>
      )}
    </div>
  )
}
