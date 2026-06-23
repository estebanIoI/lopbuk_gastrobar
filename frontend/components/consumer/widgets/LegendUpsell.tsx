'use client'

/**
 * LegendUpsell — upsell contextual a LEGEND (P1). Solo aparece para usuarios FREE
 * en momentos de alto intento (terminar el día, ver progreso, tocar algo bloqueado).
 * Reusa useEntitlements para no mostrarse a quien ya es LEGEND.
 */
import { Crown, ChevronRight } from 'lucide-react'
import { useEntitlements } from '../hooks/useEntitlements'
import type { ConsumerTab } from '../hooks/useConsumerData'

export default function LegendUpsell({ reason, onGoTo }: { reason?: string; onGoTo: (t: ConsumerTab) => void }) {
  const { isLegend, loading } = useEntitlements()
  if (loading || isLegend) return null
  return (
    <button onClick={() => onGoTo('planes')} className="w-full text-left rounded-2xl p-3.5 text-white flex items-center gap-3 active:scale-[0.99]" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #4a3a0c 130%)' }}>
      <Crown className="w-5 h-5 shrink-0" style={{ color: '#D4AF37' }} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm">Desbloquea LEGEND</p>
        <p className="text-[11px] text-white/55">{reason || 'IA avanzada, descuentos, combos y comunidad élite.'}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
    </button>
  )
}
