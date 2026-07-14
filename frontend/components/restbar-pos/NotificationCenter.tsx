'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, ChefHat, GlassWater, CheckCircle2, AlertTriangle, X } from 'lucide-react'

export interface PosNotification {
  id: string
  type: 'kitchen' | 'bar' | 'ready' | 'payment' | 'alert' | 'info'
  message: string
  tableInfo?: string
  time: string
  read: boolean
}

interface NotificationCenterProps {
  notifications: PosNotification[]
  onMarkRead: (id: string) => void
  onClear: () => void
}

const ICONS: Record<string, React.ReactNode> = {
  kitchen: <ChefHat className="h-3.5 w-3.5 text-red-400" />,
  bar: <GlassWater className="h-3.5 w-3.5 text-blue-400" />,
  ready: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  payment: <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />,
  alert: <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />,
  info: <AlertTriangle className="h-3.5 w-3.5 text-zinc-400" />,
}

export function NotificationCenter({ notifications, onMarkRead, onClear }: NotificationCenterProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative">
      <button ref={btnRef}
        onClick={() => setOpen(!open)}
        className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors relative
          ${open ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}
        title="Notificaciones">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div ref={panelRef}
          className="absolute right-0 top-12 w-72 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-[300]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
            <span className="text-xs font-bold text-zinc-300">Notificaciones</span>
            {notifications.length > 0 && (
              <button onClick={onClear}
                className="text-[10px] text-zinc-500 hover:text-zinc-300">Limpiar</button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-zinc-600">
                Sin notificaciones
              </div>
            )}
            {notifications.map(n => (
              <div key={n.id}
                onClick={() => { onMarkRead(n.id); setOpen(false) }}
                className={`px-3 py-2.5 flex items-start gap-2 cursor-pointer transition-colors hover:bg-zinc-750 border-b border-zinc-800
                  ${!n.read ? 'bg-zinc-700/30' : ''}`}>
                <span className="mt-0.5 shrink-0">{ICONS[n.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-zinc-300 leading-tight">{n.message}</div>
                  {n.tableInfo && (
                    <div className="text-[10px] text-zinc-500 mt-0.5">{n.tableInfo}</div>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0">{n.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
