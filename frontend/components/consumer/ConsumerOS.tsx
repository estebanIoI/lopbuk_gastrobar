'use client'

/**
 * ConsumerOS — Raíz del sistema operativo del consumidor (C2).
 * El usuario `cliente` vive aquí (no en el marketplace). Elige shell por breakpoint:
 *   - móvil   → MobileShell (el panel actual `consumer-routine`)
 *   - desktop → DesktopShell (sidebar + main)
 * El marketplace se integra como vista "Explore" (sin sacar al usuario del OS).
 * Inicia en Today. El pulido premium del desktop continúa en C3/C4.
 */
import { useState } from 'react'
import { ArrowLeft, Compass } from 'lucide-react'
import ConsumerRoutine from '@/components/consumer-routine'
import DesktopShell from '@/components/consumer/layouts/DesktopShell'
import { useIsDesktop } from '@/components/consumer/hooks/useIsDesktop'
import { LandingPage } from '@/components/landing-page'

export default function ConsumerOS() {
  const [view, setView] = useState<'os' | 'market'>('os')
  const isDesktop = useIsDesktop()

  if (view === 'market') {
    return (
      <div className="relative">
        {/* Barra de OS: Explore se siente parte del ecosistema, no otra app */}
        <div className="sticky top-0 z-[120] flex items-center gap-3 bg-neutral-900 text-white px-4 py-2.5">
          <button onClick={() => setView('os')} className="flex items-center gap-1.5 text-sm font-semibold rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5">
            <ArrowLeft className="w-4 h-4" /> Mi OS
          </button>
          <span className="text-sm font-bold flex items-center gap-1.5"><Compass className="w-4 h-4 text-emerald-400" /> Explore</span>
          <span className="ml-auto text-[11px] text-white/40">DAIMUZ</span>
        </div>
        <LandingPage onGoToLogin={() => {}} />
      </div>
    )
  }

  // Un solo shell por viewport (sin doble-montaje). null = aún midiendo.
  if (isDesktop === null) return null
  return isDesktop
    ? <DesktopShell onExplore={() => setView('market')} />
    : <ConsumerRoutine onClose={() => setView('market')} />
}
