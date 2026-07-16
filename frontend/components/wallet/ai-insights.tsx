'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

interface Insight {
  icon: string
  priority: 'high' | 'medium' | 'low'
  title: string
  action: string
  type: string
}

export function AIInsights() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const r = await api.getEngagementAIInsights()
      if (r.success && r.data) setInsights(r.data.insights)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!insights.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-2xl mb-2">🤖</p>
        <p className="text-sm text-muted-foreground">Necesitas más datos para generar insights. Sigue acumulando actividad.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🤖</span>
        <p className="font-bold text-sm">Insights de IA</p>
      </div>
      {insights.map((insight, i) => (
        <div key={i} className={`rounded-xl border p-4 flex items-start gap-3 ${
          insight.priority === 'high' ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card'
        }`}>
          <span className="text-xl shrink-0">{insight.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{insight.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{insight.action}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
