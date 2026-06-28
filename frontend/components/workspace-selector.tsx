'use client'

/**
 * workspace-selector.tsx — Selector de espacio estilo split-screen diagonal.
 * Para cuentas con doble acceso (comerciante + OS): elige "Panel Lopbuk" o "OS LEGEND".
 * Desktop: dos mitades partidas en diagonal. Móvil: dos paneles apilados.
 */
import { Store, Dumbbell, ChevronRight } from 'lucide-react'
import { BRAND } from '@/lib/brand'

interface WorkspaceSelectorProps {
  userName?: string | null
  onSelectMerchant: () => void
  onSelectOS: () => void
}

export function WorkspaceSelector({ userName, onSelectMerchant, onSelectOS }: WorkspaceSelectorProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black text-white overflow-hidden select-none">
      {/* Marca + saludo */}
      <div className="absolute top-5 left-5 z-30 flex items-center gap-2.5 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.isotipo} alt={BRAND.name} className="h-9 w-9 rounded-lg object-contain bg-white/90 p-1" />
        <span className="text-[11px] font-light tracking-[0.3em] uppercase text-white/60">{BRAND.name}</span>
      </div>
      <p className="absolute top-6 right-6 z-30 text-[11px] uppercase tracking-[0.18em] text-white/45 pointer-events-none">
        {userName ? `Hola, ${userName}` : 'Bienvenido'} · elige tu espacio
      </p>

      {/* Contenedor: apilado en móvil, diagonal en desktop */}
      <div className="flex flex-col md:block h-full w-full">

        {/* ───────── PANEL LOPBUK (comerciante) ───────── */}
        <button
          onClick={onSelectMerchant}
          aria-label="Entrar al Panel Comerciante Lopbuk"
          className="group relative flex-1 w-full md:absolute md:inset-0 overflow-hidden text-left
                     md:[clip-path:polygon(0_0,58%_0,42%_100%,0_100%)]"
        >
          {/* Fondo */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,#1e2a5e_0%,#0a0f24_55%,#04060f_100%)] transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-500" />
          {/* Brillo al hover */}
          <div className="absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: 'radial-gradient(60% 60% at 30% 60%, rgba(99,102,241,.25), transparent 70%)' }} />

          {/* Contenido */}
          <div className="relative z-10 h-full flex flex-col justify-center md:justify-end p-8 md:p-16 md:pb-20 md:pl-16 md:max-w-[46%]">
            <Store className="h-14 w-14 md:h-20 md:w-20 text-indigo-300/90 mb-4 transition-transform duration-500 group-hover:-translate-y-1" strokeWidth={1.2} />
            <p className="text-[11px] uppercase tracking-[0.3em] text-indigo-300/70 mb-1">Lopbuk</p>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Panel Comerciante</h2>
            <p className="text-sm text-white/55 mt-2 max-w-xs">Gestiona tu negocio: ventas, inventario, pedidos y tu tienda en línea.</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-200 opacity-80 group-hover:opacity-100 group-hover:gap-3 transition-all">
              Entrar <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </button>

        {/* ───────── OS LEGEND ───────── */}
        <button
          onClick={onSelectOS}
          aria-label="Entrar a tu OS LEGEND"
          className="group relative flex-1 w-full md:absolute md:inset-0 overflow-hidden text-left md:text-right
                     md:[clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]"
        >
          {/* Fondo */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_80%_0%,#3a2a06_0%,#1a1304_50%,#0a0700_100%)] transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-500" />
          <div className="absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: 'radial-gradient(60% 60% at 70% 60%, rgba(245,200,66,.22), transparent 70%)' }} />

          {/* Contenido (alineado a la derecha en desktop) */}
          <div className="relative z-10 h-full flex flex-col justify-center md:justify-end md:items-end p-8 md:p-16 md:pb-20 md:pr-16 md:ml-auto md:max-w-[46%]">
            <Dumbbell className="h-14 w-14 md:h-20 md:w-20 text-amber-300/90 mb-4 transition-transform duration-500 group-hover:-translate-y-1" strokeWidth={1.2} />
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-300/70 mb-1">DAIMUZ OS</p>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-amber-200">OS LEGEND</h2>
            <p className="text-sm text-white/55 mt-2 max-w-xs md:text-right">Tu rutina, tu coach con IA, progreso y comunidad. Tu estilo de vida fitness.</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200 opacity-80 group-hover:opacity-100 group-hover:gap-3 transition-all">
              Entrar <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </button>
      </div>

      {/* Línea diagonal decorativa (solo desktop) */}
      <div className="hidden md:block absolute inset-0 z-20 pointer-events-none">
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"
          style={{ transform: 'translateX(-50%) skewX(-9.4deg)' }} />
      </div>

      {/* Footer */}
      <div className="absolute bottom-3 inset-x-0 z-30 text-center text-[10px] text-white/30 pointer-events-none">
        © {new Date().getFullYear()} DAIMUZ · Todos los derechos reservados
      </div>
    </div>
  )
}
