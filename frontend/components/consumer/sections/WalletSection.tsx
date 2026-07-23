'use client'

/**
 * WalletSection — "Mi Wallet" del ConsumerOS.
 * Muestra TODAS las tarjetas de fidelización del consumidor a través de los comercios,
 * agregadas por su teléfono. El backend resuelve el teléfono desde la cuenta del usuario
 * (endpoint /engagement/my-cards), así que no se puede consultar el de otra persona.
 */
import { useState, useEffect, useCallback } from 'react'
import { Wallet, Store, Loader2, ChevronRight, Sparkles, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { api, type MyCardsResponse } from '@/lib/api'
import { WalletCard } from '@/components/wallet/wallet-card'

const LEVEL_BADGE: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' }

export default function WalletSection({ onExplore }: { onExplore?: () => void }) {
  const [data, setData] = useState<MyCardsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.getMyCards()
      if (r.success && r.data) setData(r.data)
    } catch { /* silencioso: se muestra estado vacío */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const savePhone = async () => {
    if (!phone.trim()) { toast.error('Escribe tu teléfono'); return }
    setSaving(true)
    try {
      const r = await api.setMyPhone(phone.trim())
      if (r.success && r.data) {
        setData(r.data)
        toast.success('Teléfono vinculado')
      } else {
        toast.error(r.error || 'No se pudo vincular')
      }
    } catch { toast.error('Error de conexión') }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  // Estado 1: sin teléfono vinculado → capturarlo (se guarda en la cuenta del usuario)
  if (data && !data.hasPhone) {
    return (
      <div className="p-4">
        <SectionHeader total={0} stores={0} />
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
            <Phone className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="font-bold text-neutral-900">Vincula tu teléfono</h3>
          <p className="text-sm text-neutral-500 mt-1 mb-4">
            Con tu número reunimos todas tus tarjetas de fidelización de los comercios en un solo lugar.
          </p>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              placeholder="Tu número de WhatsApp"
              className="flex-1 rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
            <button
              onClick={savePhone}
              disabled={saving}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 text-sm transition disabled:opacity-60"
            >
              {saving ? '…' : 'Vincular'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const cards = data?.cards || []

  // Estado 2: con teléfono pero sin tarjetas → invitar a explorar comercios
  if (cards.length === 0) {
    return (
      <div className="p-4">
        <SectionHeader total={0} stores={0} />
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
            <Wallet className="w-6 h-6 text-neutral-400" />
          </div>
          <h3 className="font-bold text-neutral-900">Aún no tienes tarjetas</h3>
          <p className="text-sm text-neutral-500 mt-1 mb-4">
            Únete al programa de fidelización de un comercio y empieza a acumular puntos con cada compra.
          </p>
          {onExplore && (
            <button
              onClick={onExplore}
              className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold px-5 py-2.5 text-sm transition"
            >
              <Store className="w-4 h-4" /> Explorar comercios
            </button>
          )}
        </div>
      </div>
    )
  }

  // Estado 3: tarjetas
  return (
    <div className="p-4">
      <SectionHeader total={data?.totalBalance || 0} stores={data?.totalStores || 0} />
      <div className="mt-4 space-y-5">
        {cards.map(c => (
          <div key={c.id}>
            <div className="flex items-center gap-2 mb-2 px-1">
              {c.storeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.storeLogo} alt={c.storeName} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <span className="text-base">{LEVEL_BADGE[c.level] || '🏬'}</span>
              )}
              <span className="text-sm font-bold text-neutral-800 truncate">{c.storeName}</span>
            </div>
            <WalletCard
              name={c.name}
              phone={c.phone}
              balance={c.balance}
              level={c.level}
              visits={c.visits}
              totalSpent={c.totalSpent}
              totalEarned={c.totalEarned}
            />
            {c.storeSlug && (
              <a
                href={`/wallet/${c.storeSlug}`}
                className="mt-2 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition"
              >
                <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-amber-500" /> Ver tarjeta y recompensas</span>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ total, stores }: { total: number; stores: number }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-amber-500" /> Mi Wallet
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {stores > 0 ? `${stores} ${stores === 1 ? 'comercio' : 'comercios'}` : 'Tus tarjetas de fidelización'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-black text-neutral-900 leading-none">{total.toLocaleString('es-CO')}</p>
        <p className="text-[11px] text-neutral-400">puntos totales</p>
      </div>
    </div>
  )
}
