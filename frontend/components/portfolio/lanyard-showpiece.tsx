'use client'

// Carga el Lanyard 3D solo en cliente (ssr:false) y lo aísla con un límite de
// error: si el WebGL/3D falla en tiempo de ejecución, degrada a una credencial
// estática en vez de romper la página del portafolio.
import React from 'react'
import dynamic from 'next/dynamic'

const Lanyard = dynamic(() => import('./lanyard'), {
  ssr: false,
  loading: () => <StaticBadge subtitle="Cargando credencial…" />,
})

class LanyardErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return <StaticBadge subtitle="Vista 3D no disponible" />
    return this.props.children
  }
}

function StaticBadge({ subtitle }: { subtitle?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 select-none">
      <div className="w-1.5 h-16 rounded-full" style={{ background: 'linear-gradient(#666,#06b6d4cc)' }} />
      <div
        className="w-[150px] h-[210px] rounded-2xl border flex flex-col items-center justify-center text-center gap-2"
        style={{ background: 'linear-gradient(160deg,#0d0d1f,#111827)', borderColor: '#06b6d455', boxShadow: '0 20px 50px rgba(0,0,0,.6)' }}
      >
        <div className="w-12 h-12 rounded-full" style={{ background: '#06b6d4' }} />
        <p className="text-white text-xs font-semibold tracking-widest">DAIMUZ</p>
        {subtitle && <p className="text-[10px] text-gray-400 px-3">{subtitle}</p>}
      </div>
    </div>
  )
}

export function LanyardShowpiece({
  height = 480,
  cardImageUrl = '',
  bandImageUrl = '',
}: {
  height?: number | string
  cardImageUrl?: string
  bandImageUrl?: string
}) {
  return (
    <div style={{ width: '100%', height }}>
      <LanyardErrorBoundary>
        <Lanyard cardImageUrl={cardImageUrl} bandImageUrl={bandImageUrl} />
      </LanyardErrorBoundary>
    </div>
  )
}

export default LanyardShowpiece
