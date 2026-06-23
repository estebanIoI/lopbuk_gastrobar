'use client'

/**
 * DesktopShell — Layout de escritorio del Consumer OS (C2, primera versión).
 * Sidebar de navegación + área principal. Reusa `useConsumerData` y las MISMAS
 * secciones del panel móvil (sin duplicar UI). El pulido premium (glass, grid de
 * widgets, Command Center) llega en C3/C4.
 */
import { useState, type CSSProperties } from 'react'
import {
  Home, Repeat, ChefHat, CalendarDays, ShoppingBasket, Crown, Dumbbell,
  Compass, Sparkles, Settings, Loader2, Award, KeyRound, Users,
} from 'lucide-react'
import { useConsumerData, type ConsumerTab } from '@/components/consumer/hooks/useConsumerData'
import { useConsumerTheme } from '@/components/consumer/hooks/useConsumerTheme'
import {
  GymView, PerfilModal, ChatAssistant,
} from '@/components/consumer-routine'
import PlanesView from '@/components/consumer-plans-view'
import LegendReveal from '@/components/legend-reveal'
import LegendBadge from '@/components/legend-badge'
import CommandCenter from '@/components/consumer/widgets/CommandCenter'
import TodayDashboard from '@/components/consumer/sections/TodayDashboard'
import RoutineDashboard from '@/components/consumer/sections/RoutineDashboard'
import PlanDashboard from '@/components/consumer/sections/PlanDashboard'
import KitchenDashboard from '@/components/consumer/sections/KitchenDashboard'
import ShoppingDashboard from '@/components/consumer/sections/ShoppingDashboard'
import ExploreSection from '@/components/consumer/sections/explore/ExploreSection'
import CoachSection from '@/components/consumer/sections/CoachSection'
import VaultSection from '@/components/consumer/sections/VaultSection'
import CommunitySection from '@/components/consumer/sections/CommunitySection'
import AdaptiveCards from '@/components/consumer/widgets/AdaptiveCards'
import MissionControl from '@/components/consumer/widgets/MissionControl'
import ProgressCard from '@/components/consumer/widgets/ProgressCard'
import CartButton from '@/components/consumer/widgets/CartButton'
import ActiveProgramBanner from '@/components/consumer/widgets/ActiveProgramBanner'

const TITLES: Record<string, string> = {
  hoy: 'Today', rutina: 'Rutina', cocina: 'Cocina', plan: 'Plan',
  compras: 'Compras', planes: 'Planes', gym: 'Gym', comunidad: 'Comunidad',
}

export default function DesktopShell({ onExplore }: { onExplore: () => void }) {
  const {
    tab, setTab, today, loading,
    assistantOn, hasGym, legend, setLegend, legendCfg, planState, streak, activeProgram,
    resumen, despensa, recetas, puedoHacer, rutinas, plan, compras, gym,
    load,
  } = useConsumerData('hoy')

  const [showPerfil, setShowPerfil] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)
  const [showReveal, setShowReveal] = useState(false)

  const nav: { k: ConsumerTab; icon: any; label: string }[] = [
    { k: 'hoy', icon: Home, label: 'Today' },
    { k: 'rutina', icon: Repeat, label: 'Rutina' },
    { k: 'cocina', icon: ChefHat, label: 'Cocina' },
    { k: 'plan', icon: CalendarDays, label: 'Plan' },
    { k: 'compras', icon: ShoppingBasket, label: 'Compras' },
    { k: 'explore', icon: Compass, label: 'Explore' },
    { k: 'coach', icon: Award, label: 'Coach' },
    { k: 'comunidad', icon: Users, label: 'Comunidad' },
    { k: 'planes', icon: Crown, label: 'Planes' },
    { k: 'vault', icon: KeyRound, label: 'Vault' },
    ...(hasGym ? [{ k: 'gym' as ConsumerTab, icon: Dumbbell, label: 'Gym' }] : []),
  ]

  const theme = useConsumerTheme(legend, legendCfg)
  const accent = theme.accent

  return (
    <div
      className="hidden md:flex h-screen w-full text-neutral-900"
      style={{ background: theme.ambient, ...theme.vars } as CSSProperties}
    >
      {/* ── Sidebar ── */}
      <aside
        className={`w-64 shrink-0 flex flex-col border-r ${legend ? 'border-white/10 text-white' : 'border-black/10 bg-white'}`}
        style={legend ? { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(8px)' } : undefined}
      >
        <div className="px-5 py-5 flex items-center gap-2">
          {legend ? <Crown className="w-6 h-6" style={{ color: accent }} /> : <Sparkles className="w-6 h-6 text-orange-500" />}
          <span className="font-extrabold tracking-wide" style={{ color: legend ? accent : undefined }}>{legend ? 'LEGEND OS' : 'Mi Rutina'}</span>
        </div>

        {legend && (
          <div className="px-5 pb-3">
            <LegendBadge glow />
          </div>
        )}

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {nav.map(({ k, icon: Icon, label }) => {
            const active = tab === k
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? (legend ? 'bg-white/10' : 'bg-orange-50 text-orange-600')
                    : (legend ? 'text-white/60 hover:bg-white/5' : 'text-neutral-500 hover:bg-neutral-50')
                }`}
                style={active && legend ? { color: accent } : undefined}
              >
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                {label}
              </button>
            )
          })}
        </nav>

        <div className={`px-3 py-3 border-t ${legend ? 'border-white/10' : 'border-black/10'} space-y-1`}>
          <CartButton label="Carrito" className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${legend ? 'text-white/70 hover:bg-white/5' : 'text-neutral-600 hover:bg-neutral-50'}`} />
          {assistantOn && (
            <button onClick={() => setShowAssistant(true)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${legend ? 'text-white/70 hover:bg-white/5' : 'text-neutral-600 hover:bg-neutral-50'}`}>
              <Sparkles style={{ width: 18, height: 18 }} /> Asistente IA
            </button>
          )}
          <button onClick={() => setShowPerfil(true)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${legend ? 'text-white/70 hover:bg-white/5' : 'text-neutral-600 hover:bg-neutral-50'}`}>
            <Settings style={{ width: 18, height: 18 }} /> Mi perfil
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Saludo Today */}
        <div className={`px-8 pt-6 pb-2 ${legend ? 'text-white' : 'text-neutral-900'}`}>
          <h1 className="text-2xl font-extrabold tracking-tight">{TITLES[tab] || ''}</h1>
          {tab === 'hoy' && (
            <p className={`text-sm mt-0.5 ${legend ? 'text-white/60' : 'text-neutral-500'}`}>
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
              {streak > 1 ? ` · 🔥 ${streak} días seguidos` : ''}
              {legend && planState?.powerDays != null ? ` · 👑 ${planState.powerDays}d LEGEND` : ''}
            </p>
          )}
        </div>
        {/* Today = grid de widgets a todo el ancho (C3b) */}
        {tab === 'hoy' && !loading && (
          <>
            <div className="max-w-md px-2"><MissionControl onGoTo={setTab} /></div>
            {activeProgram && <div className="px-6 pt-2"><ActiveProgramBanner program={activeProgram} onOpen={() => setTab('coach')} /></div>}
            <div className="px-2"><AdaptiveCards onGoTo={setTab} /></div>
            <div className="px-4 max-w-md"><ProgressCard /></div>
            <TodayDashboard resumen={resumen} plan={plan} rutinas={rutinas} planState={planState} legend={legend}
              onReload={() => load('hoy')} onGoTo={setTab} onExplore={() => setTab('explore')} />
          </>
        )}
        {/* Explore = marketplace modular dentro del OS (C4) */}
        {tab === 'explore' && (
          <ExploreSection goal={resumen?.perfil?.goal} onFullStore={onExplore} onGoPlanes={() => setTab('planes')} />
        )}
        {/* Coach = catálogo de entrenadores (T2) */}
        {tab === 'coach' && <CoachSection />}
        {tab === 'vault' && <VaultSection />}
        {tab === 'comunidad' && <div className="max-w-3xl mx-auto px-6 py-4"><CommunitySection /></div>}
        {/* Rutina = dashboard de widgets (desktop) */}
        {tab === 'rutina' && !loading && (
          <RoutineDashboard rutinas={rutinas} onReload={() => load('rutina')} />
        )}
        {/* Plan = dashboard de comidas (desktop) */}
        {tab === 'plan' && !loading && (
          <PlanDashboard plan={plan} today={today} onReload={() => load('plan')} />
        )}
        {/* Cocina = despensa + recetas a la vez (desktop) */}
        {tab === 'cocina' && !loading && (
          <KitchenDashboard despensa={despensa} recetas={recetas} puedoHacer={puedoHacer} onReload={() => load('cocina')} />
        )}
        {/* Compras = pendientes + comprados (desktop) */}
        {tab === 'compras' && !loading && (
          <ShoppingDashboard items={compras} onReload={() => load('compras')} />
        )}
        {/* Resto: contenedor centrado, reusa las vistas (planes, gym) */}
        {(tab === 'planes' || tab === 'gym') && (
          <div className={`mx-auto max-w-3xl ${legend ? 'bg-neutral-50 mx-8 my-4 rounded-2xl shadow-xl border border-amber-500/20 min-h-[calc(100vh-9rem)]' : 'min-h-[calc(100vh-5rem)]'}`}>
            {tab === 'planes' && <PlanesView onUpgrade={() => { setLegend(true); setShowReveal(true) }} />}
            {!loading && tab === 'gym' && <GymView data={gym} onReload={() => load('gym')} />}
          </div>
        )}
        {(tab === 'hoy' || tab === 'rutina' || tab === 'plan' || tab === 'cocina' || tab === 'compras' || tab === 'gym') && loading && <div className="flex justify-center py-16 text-neutral-300"><Loader2 className="w-7 h-7 animate-spin" /></div>}
      </main>

      {/* ── Command Center (AI Insights, solo xl) ── */}
      <CommandCenter resumen={resumen} planState={planState} legend={legend} onExplore={() => setTab('explore')} />

      {showPerfil && <PerfilModal onClose={() => setShowPerfil(false)} onSaved={() => { setShowPerfil(false); load('hoy') }} />}
      {showAssistant && <ChatAssistant onClose={() => setShowAssistant(false)} onChanged={() => load(tab)} />}
      {showReveal && <LegendReveal config={legendCfg} onDone={() => setShowReveal(false)} />}
    </div>
  )
}
