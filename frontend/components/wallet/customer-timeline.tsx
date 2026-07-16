'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface TimelineItem {
  date: string
  category: 'event' | 'transaction'
  type: string
  icon: string
  label: string
  detail: string
}

interface CustomerTimelineProps {
  accountId: string
  limit?: number
}

export function CustomerTimeline({ accountId, limit = 30 }: CustomerTimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accountId) return
    setLoading(true)
    api.getEngagementCustomerTimeline(accountId, limit)
      .then(r => { if (r.success && r.data) setItems(r.data.timeline) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [accountId, limit])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!items.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sin actividad registrada</p>
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-1">
        {items.map((item, i) => {
          const dateObj = new Date(item.date)
          const isToday = dateObj.toDateString() === new Date().toDateString()
          const dateLabel = isToday
            ? `Hoy ${dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
            : dateObj.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

          return (
            <div key={i} className="flex items-start gap-3 py-2 relative">
              {/* Icon */}
              <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-base shrink-0 z-10">
                {item.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground">{dateLabel}</span>
                </div>
                {item.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
