'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, ChefHat, GlassWater, FileText, CheckSquare, ShieldCheck, Check, Settings, Volume2, VolumeX, Vibrate } from 'lucide-react'
import { NotificationCenter, type PosNotification } from './NotificationCenter'
import type { PosCapabilities } from '@/lib/pos-permissions'

interface PosTopBarProps {
  onDone: () => void
  onSearch: (q: string) => void
  searchQuery: string
  onSendKitchen: () => void
  onSendBar: () => void
  onPrintBill: () => void
  onOpenPayment: () => void
  selectedOrder: any | null
  selectedCount: number
  onSendSelected: () => void
  notifications: PosNotification[]
  onMarkNotificationRead: (id: string) => void
  onClearNotifications: () => void
  pendingKitchen: number
  pendingBar: number
  preparingCount: number
  readyCount: number
  alertCount: number
  caps: PosCapabilities
  sentFlash: { area: 'cocina' | 'bar'; ts: number } | null
  soundEnabled: boolean
  vibrationEnabled: boolean
  onToggleSound: () => void
  onToggleVibration: () => void
}

export function PosTopBar({
  onDone, onSearch, searchQuery, onSendKitchen, onSendBar,
  onPrintBill, selectedOrder,
  selectedCount, onSendSelected,
  notifications, onMarkNotificationRead, onClearNotifications,
  pendingKitchen, pendingBar, preparingCount, readyCount, alertCount, caps, sentFlash,
  soundEnabled, vibrationEnabled, onToggleSound, onToggleVibration,
}: PosTopBarProps) {
  // Feedback "✓ Enviado": al confirmarse un envío, el botón del área se ilumina ~1.2s.
  const [flashArea, setFlashArea] = useState<'cocina' | 'bar' | null>(null)
  useEffect(() => {
    if (!sentFlash) return
    setFlashArea(sentFlash.area)
    const t = setTimeout(() => setFlashArea(null), 1200)
    return () => clearTimeout(t)
  }, [sentFlash?.ts])

  // Menú de ajustes (sonido / vibración)
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showSettings) return
    const onDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showSettings])

  return (
    <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2 px-3 shrink-0">
      {/* Done */}
      <button onClick={onDone}
        className="h-10 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-semibold transition-colors">
        Done
      </button>

      {/* Perfil activo (rol) */}
      <span className="hidden sm:flex items-center gap-1 h-7 px-2 rounded-md bg-zinc-800/80 text-[11px] font-semibold text-zinc-400"
        title={`Perfil: ${caps.profileLabel}`}>
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        {caps.profileLabel}
      </span>

      {/* Search */}
      <div className="flex-1 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          placeholder="Buscar o PLU..."
          className="w-full h-10 pl-9 pr-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100
            placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        {searchQuery && (
          <button onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table name */}
      {selectedOrder && (
        <>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-base font-extrabold text-amber-300 shadow-sm shadow-amber-900/20">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Mesa {selectedOrder.tableNumber}
          </div>
          {/* Counters */}
          {pendingKitchen > 0 && (
            <span className="text-[10px] bg-red-500/20 text-red-400 rounded-full px-2 py-0.5 font-bold flex items-center gap-1">
              <ChefHat className="h-3 w-3" />{pendingKitchen}
            </span>
          )}
          {pendingBar > 0 && (
            <span className="text-[10px] bg-blue-500/20 text-blue-400 rounded-full px-2 py-0.5 font-bold flex items-center gap-1">
              <GlassWater className="h-3 w-3" />{pendingBar}
            </span>
          )}
          {preparingCount > 0 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 rounded-full px-2 py-0.5 font-bold">{preparingCount} prep</span>
          )}
          {readyCount > 0 && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded-full px-2 py-0.5 font-bold animate-pulse">{readyCount} listo</span>
          )}
        </>
      )}

      <div className="flex-1" />

      {/* Selected count */}
      {selectedCount > 0 && (
        <button onClick={onSendSelected}
          className="h-10 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          title="Enviar selección">
          <CheckSquare className="h-4 w-4" />
          {selectedCount}
        </button>
      )}

      {/* Action buttons — visibles según el perfil (rol) */}
      {caps.canSend && (
        <button onClick={onSendKitchen}
          disabled={!selectedOrder}
          className={`h-10 px-4 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
            ${flashArea === 'cocina' ? 'bg-emerald-500 text-white scale-105 ring-2 ring-emerald-300/60' : 'bg-red-700 hover:bg-red-600 text-white'}`}
          title="Enviar a Cocina">
          {flashArea === 'cocina'
            ? <><Check className="h-4 w-4" /> ENVIADO</>
            : <><ChefHat className="h-4 w-4" /> COCINA</>}
        </button>
      )}

      {caps.canSend && (
        <button onClick={onSendBar}
          disabled={!selectedOrder}
          className={`h-10 px-4 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
            ${flashArea === 'bar' ? 'bg-emerald-500 text-white scale-105 ring-2 ring-emerald-300/60' : 'bg-blue-700 hover:bg-blue-600 text-white'}`}
          title="Enviar a Bar">
          {flashArea === 'bar'
            ? <><Check className="h-4 w-4" /> ENVIADO</>
            : <><GlassWater className="h-4 w-4" /> BAR</>}
        </button>
      )}

      {caps.canPrintBill && (
        <button onClick={onPrintBill}
          disabled={!selectedOrder}
          className="h-10 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Imprimir pre-cuenta">
          <FileText className="h-4 w-4" /> CUENTA
        </button>
      )}
      {/* COBRAR vive solo en el pie de la comanda (botón grande con el total) para
          no duplicar la acción de cobro. */}

      {/* Notifications */}
      <NotificationCenter
        notifications={notifications}
        onMarkRead={onMarkNotificationRead}
        onClear={onClearNotifications}
      />

      {/* Ajustes: sonido / vibración */}
      <div className="relative" ref={settingsRef}>
        <button onClick={() => setShowSettings(v => !v)}
          className="h-10 w-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center transition-colors"
          title="Ajustes de sonido y vibración">
          <Settings className={`h-5 w-5 ${showSettings ? 'text-zinc-100' : 'text-zinc-400'}`} />
        </button>
        {showSettings && (
          <div className="absolute right-0 top-12 z-[260] w-60 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
            <p className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Retroalimentación</p>
            <button onClick={onToggleSound}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors text-left">
              {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-zinc-500" />}
              <span className="flex-1 text-sm text-zinc-200">Sonidos</span>
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${soundEnabled ? 'bg-emerald-500' : 'bg-zinc-600'}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
            </button>
            <button onClick={onToggleVibration}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors text-left">
              <Vibrate className={`h-4 w-4 ${vibrationEnabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span className="flex-1 text-sm text-zinc-200">Vibración <span className="text-[10px] text-zinc-500">(táctil)</span></span>
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${vibrationEnabled ? 'bg-emerald-500' : 'bg-zinc-600'}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${vibrationEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
