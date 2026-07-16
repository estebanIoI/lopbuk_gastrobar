'use client'

const LEVEL_STYLES: Record<string, { bg: string; text: string; badge: string }> = {
  bronze:   { bg: 'from-amber-700 to-amber-900', text: 'text-amber-300', badge: '🥉 Bronce' },
  silver:   { bg: 'from-gray-400 to-gray-600', text: 'text-gray-100', badge: '🥈 Plata' },
  gold:     { bg: 'from-yellow-500 to-yellow-700', text: 'text-yellow-100', badge: '🥇 Oro' },
  platinum: { bg: 'from-purple-500 to-indigo-700', text: 'text-purple-100', badge: '💎 Platino' },
}

interface WalletCardProps {
  name?: string | null
  phone?: string
  balance?: number
  level?: string
  visits?: number
  totalSpent?: number
  totalEarned?: number
  compact?: boolean
}

export function WalletCard({ name, phone, balance = 0, level = 'bronze', visits = 0, totalSpent = 0, compact }: WalletCardProps) {
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.bronze

  if (compact) {
    return (
      <div className={`rounded-xl bg-gradient-to-br ${style.bg} p-4 shadow-lg text-white`}>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">{name || 'Cliente'}</p>
          <span className="text-lg">{style.badge.split(' ')[0]}</span>
        </div>
        <p className="text-2xl font-black">{balance} <span className="text-xs font-normal opacity-70">pts</span></p>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${style.bg} p-6 shadow-xl text-white max-w-sm w-full`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest opacity-70">Lopbuk Rewards</span>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/20">{style.badge}</span>
      </div>

      {/* Name + Points */}
      <p className="font-bold text-xl mb-1">{name || 'Sin nombre'}</p>
      <p className="text-4xl font-black mb-5">{balance} <span className="text-sm font-normal opacity-70">pts</span></p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-white/10 rounded-xl py-2 px-1">
          <p className="text-lg font-bold">{visits}</p>
          <p className="text-[10px] opacity-70">Visitas</p>
        </div>
        <div className="bg-white/10 rounded-xl py-2 px-1">
          <p className="text-lg font-bold">${(totalSpent || 0).toLocaleString('es-CO')}</p>
          <p className="text-[10px] opacity-70">Total gastado</p>
        </div>
        <div className="bg-white/10 rounded-xl py-2 px-1">
          <p className="text-lg font-bold">{style.badge.split(' ')[0]}</p>
          <p className="text-[10px] opacity-70">Nivel</p>
        </div>
      </div>

      {/* Phone + CTA */}
      {phone && (
        <p className="text-[11px] text-center mt-4 opacity-50">ID: {phone}</p>
      )}
    </div>
  )
}
