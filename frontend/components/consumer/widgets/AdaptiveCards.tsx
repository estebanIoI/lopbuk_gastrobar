'use client'

/**
 * AdaptiveCards — Adaptive OS (F4.1). Versión compacta para mobile (~80px).
 * Muestra nudges priorizados como líneas densas, sin emojis grandes ni botones internos.
 * Cada card lleva a un tab del OS o se descarta (recordado en localStorage 24h).
 */
import { useEffect, useState } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import type { ConsumerTab } from '../hooks/useConsumerData'

const KIND_BAR: Record<string, string> = {
  coach: 'bg-sky-500',
  drop: 'bg-red-500',
  streak: 'bg-amber-500',
  membership: 'bg-amber-400',
  achievement: 'bg-violet-500',
  program: 'bg-emerald-500',
  predictive: 'bg-indigo-500',
  motivation: 'bg-amber-500',
}

const DISMISS_KEY = 'dz_adaptive_dismissed'
function loadDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') } catch { return {} }
}
function saveDismissed(d: Record<string, number>) { try { localStorage.setItem(DISMISS_KEY, JSON.stringify(d)) } catch { /* noop */ } }

export default function AdaptiveCards({ onGoTo }: { onGoTo: (tab: ConsumerTab) => void }) {
  const [items, setItems] = useState<any[]>([])
  const [dismissed, setDismissed] = useState<Record<string, number>>({})

  useEffect(() => {
    setDismissed(loadDismissed())
    api.getAdaptiveNudges().then(r => { if (r.success) setItems(r.data || []) }).catch(() => {})
  }, [])

  const now = Date.now()
  const visible = items.filter(n => !(dismissed[n.id] && now - dismissed[n.id] < 24 * 3600 * 1000))
  if (visible.length === 0) return null

  const dismiss = (id: string) => { const d = { ...dismissed, [id]: Date.now() }; setDismissed(d); saveDismissed(d) }

  return (
    <div className="px-4 pt-3 space-y-1.5">
      {visible.slice(0, 2).map(n => {
        const bar = KIND_BAR[n.kind] || 'bg-neutral-400'
        const clickable = n.action?.type === 'tab'
        const Wrapper = clickable ? 'button' : 'div'
        const wrapperProps = clickable
          ? { onClick: () => onGoTo(n.action.target as ConsumerTab), className: `w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-black/5 shadow-sm text-left` }
          : { className: `flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-black/5 shadow-sm` }

        return (
          <Wrapper key={n.id} {...(wrapperProps as any)}>
            <div className={`w-1.5 h-8 rounded-full shrink-0 ${bar}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">{n.title}</p>
              {n.body && <p className="text-xs text-neutral-400 truncate">{n.body}</p>}
            </div>
            {clickable
              ? <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" />
              : <button onClick={(e) => { e.stopPropagation(); dismiss(n.id) }} className="text-neutral-300 hover:text-neutral-500 shrink-0"><X className="w-4 h-4" /></button>
            }
          </Wrapper>
        )
      })}
    </div>
  )
}
