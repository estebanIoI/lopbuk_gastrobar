'use client'

/**
 * LegendGate — soft paywall del Consumer OS (C7.9). Si el usuario tiene el
 * entitlement, renderiza children; si no, muestra un teaser elegante con CTA
 * (NUNCA "acceso denegado"). Mientras carga, muestra children (optimista) para
 * evitar parpadeo. Si el plan vence, vuelve solo a teaser.
 */
import type { ReactNode } from 'react'
import { Crown, Lock } from 'lucide-react'
import { useEntitlements } from '@/components/consumer/hooks/useEntitlements'

export default function LegendGate({
  entitlement, children, title, perks = [], onUpgrade, teaser,
}: {
  entitlement: string
  children: ReactNode
  title?: string
  perks?: string[]
  onUpgrade?: () => void
  teaser?: ReactNode
}) {
  const { has, loading } = useEntitlements()
  if (loading || has(entitlement)) return <>{children}</>

  return (
    <div className="relative rounded-2xl overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
      {teaser && <div className="absolute inset-0 blur-[3px] opacity-40 pointer-events-none">{teaser}</div>}
      <div className="relative">
        <div className="flex items-center gap-2 text-amber-600 font-extrabold"><Crown className="w-5 h-5" /> {title || 'Exclusivo LEGEND'}</div>
        {perks.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-neutral-600">
            {perks.map((p, i) => <li key={i} className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-amber-500" />{p}</li>)}
          </ul>
        )}
        {onUpgrade && (
          <button onClick={onUpgrade} className="mt-3 rounded-lg bg-amber-500 text-white text-sm font-semibold px-4 py-2 hover:bg-amber-600">
            Activar LEGEND
          </button>
        )}
      </div>
    </div>
  )
}
