'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

const CHANNEL_LABELS: Record<string, string> = {
  pos_direct: '🏪 POS Directo',
  storefront: '🌐 Tienda Online',
  whatsapp: '💬 WhatsApp',
  ai_chatbot: '🤖 Chatbot IA',
  referral: '👥 Referidos',
  campaign: '📢 Campañas',
  wallet: '📱 Wallet',
  geo_push: '📍 Geo Push',
  qr: '📷 QR Mesa',
}

const CHANNEL_COLORS: Record<string, string> = {
  pos_direct: '#6366f1',
  storefront: '#22c55e',
  whatsapp: '#25d366',
  ai_chatbot: '#8b5cf6',
  referral: '#f59e0b',
  campaign: '#ec4899',
  wallet: '#0ea5e9',
  geo_push: '#f97316',
  qr: '#14b8a6',
}

export function RevenueAttribution() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.getEngagementRevenueAttribution(days)
      if (r.success) setData(r.data)
    } catch {}
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) return null

  const totalSalesRevenue = data.salesByChannel.reduce((sum: number, c: any) => sum + Number(c.revenue || 0), 0)
  const totalOrderRevenue = data.ordersByChannel.reduce((sum: number, c: any) => sum + Number(c.revenue || 0), 0)
  const totalRevenue = totalSalesRevenue + totalOrderRevenue

  // Merge sales + orders channels
  const allChannels: Record<string, { count: number; revenue: number }> = {}
  for (const ch of data.salesByChannel) {
    const key = ch.channel || 'pos_direct'
    allChannels[key] = { count: Number(ch.count), revenue: Number(ch.revenue || 0) }
  }
  for (const ch of data.ordersByChannel) {
    const key = ch.channel || 'storefront'
    if (allChannels[key]) {
      allChannels[key].count += Number(ch.count)
      allChannels[key].revenue += Number(ch.revenue || 0)
    } else {
      allChannels[key] = { count: Number(ch.count), revenue: Number(ch.revenue || 0) }
    }
  }

  const sortedChannels = Object.entries(allChannels)
    .sort(([, a], [, b]) => b.revenue - a.revenue)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <h3 className="font-bold text-sm">Revenue Attribution</h3>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="rounded-lg bg-background border border-border px-2 py-1 text-xs">
          <option value={7}>7 días</option>
          <option value={30}>30 días</option>
          <option value={90}>90 días</option>
        </select>
      </div>

      {/* Total Revenue */}
      <div className="rounded-xl bg-accent/30 p-4 text-center">
        <p className="text-xs text-muted-foreground">Revenue total ({days}d)</p>
        <p className="text-3xl font-black text-amber-500">${totalRevenue.toLocaleString('es-CO')}</p>
        <p className="text-xs text-muted-foreground mt-1">{sortedChannels.length} canales activos</p>
      </div>

      {/* Channel Breakdown */}
      <div className="space-y-2">
        {sortedChannels.map(([channel, stats]) => {
          const pct = totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0
          return (
            <div key={channel} className="bg-accent/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{CHANNEL_LABELS[channel] || channel}</span>
                <span className="text-sm font-bold">${stats.revenue.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-accent rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: CHANNEL_COLORS[channel] || '#6366f1' }} />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{stats.count} transacciones</p>
            </div>
          )
        })}
      </div>

      {/* Top Campaigns */}
      {data.topCampaigns?.length > 0 && (
        <div>
          <p className="font-semibold text-sm mb-2">🏆 Top campañas</p>
          <div className="space-y-1">
            {data.topCampaigns.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-accent/20 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.sent} enviados · {c.opened} abiertos</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-400">{c.conversion_rate}%</p>
                  <p className="text-[10px] text-muted-foreground">{c.converted} conversiones</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customers by Channel */}
      {data.customersByChannel?.length > 0 && (
        <div>
          <p className="font-semibold text-sm mb-2">👥 Clientes por canal de adquisición</p>
          <div className="flex flex-wrap gap-2">
            {data.customersByChannel.map((c: any, i: number) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-accent/50 text-xs font-semibold">
                {CHANNEL_LABELS[c.channel] || c.channel}: {c.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
