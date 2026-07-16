'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

interface ActivityItem {
  date: string
  type: string
  icon: string
  label: string
  customerName: string
  detail: string
}

export function LiveActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const r = await api.getEngagementLiveActivity(20)
      if (r.success && r.data) setItems(r.data.activity)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!items.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sin actividad reciente</p>
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const dateObj = new Date(item.date)
        const now = new Date()
        const diffMs = now.getTime() - dateObj.getTime()
        const diffMin = Math.floor(diffMs / 60000)
        const timeAgo = diffMin < 1 ? 'Ahora' : diffMin < 60 ? `Hace ${diffMin}m`
          : diffMin < 1440 ? `Hace ${Math.floor(diffMin / 60)}h`
          : dateObj.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

        return (
          <div key={i} className="flex items-center gap-3 py-2 px-1 border-b border-border/50 last:border-0">
            <span className="text-lg shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold">{item.customerName}</span>
                {' · '}
                <span className="text-muted-foreground">{item.label}</span>
              </p>
              {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
          </div>
        )
      })}
    </div>
  )
}
