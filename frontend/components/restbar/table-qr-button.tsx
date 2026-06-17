'use client'

// Panel del mesero para administrar el QR de la mesa (sesión del cliente):
// generar/regenerar, ver quiénes están en la mesa y el consumo de cada uno,
// compartir el enlace y eliminar (cerrar) el QR.
import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Users, Share2, Copy, RefreshCw, Trash2, X, MessageCircle } from 'lucide-react'

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

interface GuestConsumption { id: string | null; name: string; total: number; items: { name: string; quantity: number; subtotal: number }[] }
interface SessionData {
  active: boolean
  token?: string
  path?: string
  tableNumber?: string | number
  waiterName?: string
  expiresAt?: string | null
  guestCount?: number
  guests?: GuestConsumption[]
  unassigned?: { total: number; items: { name: string; quantity: number; subtotal: number }[] }
  orderTotal?: number
}

export function TableQrButton({ tableId, tableNumber }: { tableId: string; tableNumber?: string | number }) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = session?.path ? `${origin}${session.path}` : ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getTableQrSession(tableId)
      if (res.success) setSession(res.data as SessionData)
      else { setSession({ active: false }); toast.error(res.error || 'No se pudo cargar el QR') }
    } finally { setLoading(false) }
  }, [tableId])

  useEffect(() => { if (open) load() }, [open, load])

  const generate = async () => {
    setBusy(true)
    try {
      const res = await api.createTableQrSession(tableId)
      if (res.success && (res.data as any)?.token) await load()
      else toast.error(res.error || 'No se pudo generar el QR')
    } finally { setBusy(false) }
  }

  const closeSession = async () => {
    if (!confirm('¿Eliminar el QR de esta mesa? Los clientes ya no podrán pedir desde su celular (la comanda no se cierra).')) return
    setBusy(true)
    try {
      const res = await api.closeTableQrSession(tableId)
      if (res.success) { toast.success('QR eliminado'); await load() }
      else toast.error(res.error || 'No se pudo eliminar el QR')
    } finally { setBusy(false) }
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Enlace copiado') }
    catch { toast.error('No se pudo copiar') }
  }
  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Únete a la Mesa ${session?.tableNumber ?? tableNumber} y pide desde tu celular: ${url}`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }
  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title: `Mesa ${session?.tableNumber ?? tableNumber}`, text: 'Pide desde tu celular', url }) } catch { /* cancelado */ }
    } else copyLink()
  }

  const guests = session?.guests ?? []
  const hasUnassigned = (session?.unassigned?.items?.length ?? 0) > 0

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="w-full rounded-lg border border-sky-500/30 py-1 text-[11px] text-sky-400 font-medium hover:bg-sky-500/10 transition-colors flex items-center justify-center gap-1"
      >
        📱 QR de mesa
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white text-gray-900 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-lg">Mesa {session?.tableNumber ?? tableNumber}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5">
              {loading ? (
                <p className="text-center text-sm text-gray-500 py-10">Cargando…</p>
              ) : !session?.active ? (
                // ── Sin QR activo ──
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-4">No hay un QR activo en esta mesa. Genéralo para que los clientes entren con su nombre y pidan desde su celular.</p>
                  <button onClick={generate} disabled={busy} className="w-full rounded-xl bg-gray-900 text-white py-3 font-semibold disabled:opacity-50">
                    {busy ? 'Generando…' : 'Generar QR'}
                  </button>
                </div>
              ) : (
                // ── QR activo: administración ──
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="flex justify-center mb-3"><QRCodeSVG value={url} size={180} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={copyLink} className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 py-2 text-[11px] font-medium text-gray-700 hover:bg-gray-50">
                        <Copy className="w-4 h-4" /> Copiar
                      </button>
                      <button onClick={shareWhatsApp} className="flex flex-col items-center gap-1 rounded-xl border border-green-200 bg-green-50 py-2 text-[11px] font-medium text-green-700 hover:bg-green-100">
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </button>
                      <button onClick={nativeShare} className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 py-2 text-[11px] font-medium text-gray-700 hover:bg-gray-50">
                        <Share2 className="w-4 h-4" /> Compartir
                      </button>
                    </div>
                  </div>

                  {/* En la mesa */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-800">
                        <Users className="w-4 h-4 text-sky-600" /> En la mesa ({session.guestCount ?? guests.length})
                      </span>
                      <button onClick={load} className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800">
                        <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                      </button>
                    </div>

                    {guests.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">Aún nadie se ha unido a la mesa.</p>
                    ) : (
                      <div className="space-y-2">
                        {guests.map((g, i) => (
                          <div key={g.id || i} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-gray-800">{g.name}</span>
                              <span className="font-bold text-sm text-gray-900">{COP(g.total)}</span>
                            </div>
                            {g.items.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5">
                                {g.items.map((it, j) => (
                                  <li key={j} className="flex justify-between text-[11px] text-gray-500">
                                    <span>{it.quantity}× {it.name}</span><span>{COP(it.subtotal)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {hasUnassigned && (
                      <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-amber-800">Sin asignar / mesa</span>
                          <span className="font-bold text-sm text-amber-900">{COP(session.unassigned!.total)}</span>
                        </div>
                        <ul className="mt-1.5 space-y-0.5">
                          {session.unassigned!.items.map((it, j) => (
                            <li key={j} className="flex justify-between text-[11px] text-amber-700/80">
                              <span>{it.quantity}× {it.name}</span><span>{COP(it.subtotal)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between rounded-xl bg-gray-900 text-white px-4 py-3">
                    <span className="text-sm font-medium">Consumo total</span>
                    <span className="text-lg font-extrabold">{COP(session.orderTotal ?? 0)}</span>
                  </div>

                  {/* Acciones */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={generate} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      <RefreshCw className="w-4 h-4" /> Regenerar
                    </button>
                    <button onClick={closeSession} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50">
                      <Trash2 className="w-4 h-4" /> Eliminar QR
                    </button>
                  </div>
                  {session.expiresAt && (
                    <p className="text-center text-[11px] text-gray-400">Expira: {new Date(session.expiresAt).toLocaleString('es-CO')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
