'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { WalletCard } from './wallet-card'
import { CustomerTimeline } from './customer-timeline'

const LEVEL_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#E5E4E2',
}

const LEVEL_LABELS: Record<string, string> = {
  bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino',
}

interface Customer360Props {
  accountId: string
  onClose: () => void
}

type Section = 'overview' | 'timeline' | 'purchases' | 'wallet' | 'rewards' | 'segments' | 'prediction' | 'notes'

export function Customer360({ accountId, onClose }: Customer360Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<Section>('overview')
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.getEngagementCustomer360(accountId)
      if (r.success) setData(r.data)
    } catch {}
    setLoading(false)
  }, [accountId])

  useEffect(() => { load() }, [load])

  const addNote = async () => {
    if (!newNote.trim()) return
    setAddingNote(true)
    const r = await api.addEngagementCustomerNote(accountId, newNote.trim())
    if (r.success) {
      setNewNote('')
      load()
    }
    setAddingNote(false)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) return null

  const { profile, timeline, sales, orders, favoriteProducts, redeemedRewards, segments, notes, prediction } = data

  const SECTIONS: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: 'Resumen', icon: '👤' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
    { id: 'purchases', label: 'Compras', icon: '🛒' },
    { id: 'wallet', label: 'Wallet', icon: '📱' },
    { id: 'rewards', label: 'Recompensas', icon: '🎁' },
    { id: 'segments', label: 'Segmentos', icon: '🏷️' },
    { id: 'prediction', label: 'Predicción', icon: '🤖' },
    { id: 'notes', label: 'Notas', icon: '📝' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] flex overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="w-48 bg-accent/30 border-r border-border p-3 flex flex-col shrink-0">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground mb-3 text-left">← Volver</button>
          <div className="text-center mb-4">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl mx-auto mb-2">
              {profile.customer_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <p className="font-bold text-sm truncate">{profile.customer_name || 'Sin nombre'}</p>
            <p className="text-[10px] text-muted-foreground">{profile.customer_phone}</p>
            <div className="mt-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[profile.level] + '20', color: LEVEL_COLORS[profile.level] }}>
                {LEVEL_LABELS[profile.level] || profile.level}
              </span>
            </div>
          </div>

          <nav className="space-y-0.5 flex-1">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${section === s.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}>
                <span>{s.icon}</span> {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Overview */}
          {section === 'overview' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold">Resumen del Cliente</h2>
                {profile.churnRisk === 'high' && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Riesgo alto</span>}
                {profile.wallet_status === 'active' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Wallet activa</span>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-accent/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-amber-500">{profile.points_balance}</p>
                  <p className="text-[11px] text-muted-foreground">Puntos</p>
                </div>
                <div className="bg-accent/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black">{profile.visits}</p>
                  <p className="text-[11px] text-muted-foreground">Visitas</p>
                </div>
                <div className="bg-accent/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black">${Number(profile.total_spent || 0).toLocaleString('es-CO')}</p>
                  <p className="text-[11px] text-muted-foreground">Total gastado</p>
                </div>
                <div className="bg-accent/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black">{prediction.averageTicket ? `$${prediction.averageTicket.toLocaleString('es-CO')}` : '—'}</p>
                  <p className="text-[11px] text-muted-foreground">Ticket promedio</p>
                </div>
              </div>

              <div className="flex justify-center">
                <WalletCard compact name={profile.customer_name} balance={profile.points_balance} level={profile.level} visits={profile.visits} totalSpent={profile.total_spent} />
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-accent/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Email</p><p className="font-semibold">{profile.customer_email || '—'}</p></div>
                <div className="bg-accent/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Cumpleaños</p><p className="font-semibold">{profile.birthday || '—'}</p></div>
                <div className="bg-accent/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Última visita</p><p className="font-semibold">{profile.last_visit ? new Date(profile.last_visit).toLocaleDateString() : '—'}</p></div>
                <div className="bg-accent/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Canal de adquisición</p><p className="font-semibold">{profile.acquisition_channel || '—'}</p></div>
              </div>

              {/* Favorite Products */}
              {favoriteProducts?.length > 0 && (
                <div>
                  <p className="font-semibold text-sm mb-2">Productos favoritos</p>
                  <div className="space-y-1">
                    {favoriteProducts.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm bg-accent/30 rounded-lg px-3 py-2">
                        <span>{p.name}</span>
                        <span className="text-muted-foreground">{p.count}x · ${(p.totalSpent || 0).toLocaleString('es-CO')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          {section === 'timeline' && (
            <div>
              <h2 className="text-lg font-bold mb-4">📅 Timeline</h2>
              <CustomerTimeline accountId={accountId} limit={50} />
            </div>
          )}

          {/* Purchases */}
          {section === 'purchases' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold mb-4">🛒 Compras</h2>
              {sales?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Ventas POS ({sales.length})</p>
                  <div className="space-y-1">
                    {sales.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between bg-accent/30 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold">{s.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">${Number(s.total).toLocaleString('es-CO')}</p>
                          <p className="text-xs text-muted-foreground">{s.paymentMethod}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {orders?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Pedidos online ({orders.length})</p>
                  <div className="space-y-1">
                    {orders.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between bg-accent/30 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold">#{o.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{new Date(o.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">${Number(o.total).toLocaleString('es-CO')}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${o.status === 'entregado' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{o.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!sales?.length && !orders?.length && <p className="text-sm text-muted-foreground text-center py-8">Sin compras registradas</p>}
            </div>
          )}

          {/* Wallet */}
          {section === 'wallet' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold mb-4">📱 Wallet</h2>
              <div className="flex justify-center">
                <WalletCard name={profile.customer_name} phone={profile.customer_phone} balance={profile.points_balance} level={profile.level} visits={profile.visits} totalSpent={profile.total_spent} totalEarned={profile.total_earned} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-accent/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Estado</p><p className="font-semibold">{profile.wallet_status === 'active' ? '✅ Activa' : '—'}</p></div>
                <div className="bg-accent/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Provider</p><p className="font-semibold">{profile.wallet_provider || '—'}</p></div>
              </div>
            </div>
          )}

          {/* Rewards */}
          {section === 'rewards' && (
            <div>
              <h2 className="text-lg font-bold mb-4">🎁 Recompensas canjeadas</h2>
              {redeemedRewards?.length > 0 ? (
                <div className="space-y-1">
                  {redeemedRewards.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-accent/30 rounded-lg px-3 py-2">
                      <p className="text-sm">{r.reason}</p>
                      <span className="text-xs text-amber-500 font-bold">{r.points} pts</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Sin canjes</p>}
            </div>
          )}

          {/* Segments */}
          {section === 'segments' && (
            <div>
              <h2 className="text-lg font-bold mb-4">🏷️ Segmentos</h2>
              {segments?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {segments.map((s: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 text-sm font-semibold">{s}</span>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">No pertenece a ningún segmento</p>}
            </div>
          )}

          {/* Prediction */}
          {section === 'prediction' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold mb-4">🤖 Predicción IA</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-accent/30 rounded-xl p-4 text-center">
                  <p className="text-3xl font-black" style={{ color: prediction.churnProbability > 60 ? '#ef4444' : prediction.churnProbability > 30 ? '#eab308' : '#22c55e' }}>{prediction.churnProbability}%</p>
                  <p className="text-xs text-muted-foreground">Prob. de abandono</p>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 text-center">
                  <p className="text-3xl font-black text-green-400">{prediction.returnProbability}%</p>
                  <p className="text-xs text-muted-foreground">Prob. de regreso</p>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 text-center">
                  <p className="text-xl font-black">${prediction.estimatedLTV?.toLocaleString('es-CO')}</p>
                  <p className="text-xs text-muted-foreground">LTV estimado</p>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 text-center">
                  <p className="text-xl font-black">{prediction.visitFrequencyDays} días</p>
                  <p className="text-xs text-muted-foreground">Frecuencia de visita</p>
                </div>
              </div>
              {prediction.nextPurchaseInDays > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold">Próxima compra estimada</p>
                  <p className="text-2xl font-black text-amber-500 mt-1">En {prediction.nextPurchaseInDays} días</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {section === 'notes' && (
            <div>
              <h2 className="text-lg font-bold mb-4">📝 Notas internas</h2>
              <div className="flex gap-2 mb-4">
                <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()}
                  placeholder="Agregar nota..." className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm" />
                <button onClick={addNote} disabled={addingNote || !newNote.trim()} className="rounded-lg bg-amber-500 text-black font-semibold px-4 py-2 text-sm disabled:opacity-50">Agregar</button>
              </div>
              {notes?.length > 0 ? (
                <div className="space-y-2">
                  {notes.map((n: any) => (
                    <div key={n.id} className="bg-accent/30 rounded-lg px-3 py-2">
                      <p className="text-sm">{n.note}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{n.createdBy} · {new Date(n.date).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Sin notas</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
