'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  UtensilsCrossed, Users, ShoppingCart, RefreshCw,
  Plus, Minus, X, Edit2, Clock, UserPlus, ChevronLeft,
  FileText, LogOut, ChefHat, Check,
  Trash2, Search, ChevronUp, ChevronDown, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Guest {
  number: number
  name: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const ITEM_STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  pendiente:      { label: 'Pendiente',      cls: 'bg-zinc-700/60 text-zinc-300',  icon: '⏳' },
  en_preparacion: { label: 'En Prep.',       cls: 'bg-amber-500/20 text-amber-400', icon: '👨‍🍳' },
  listo:          { label: 'Listo',          cls: 'bg-green-500/20 text-green-400', icon: '✅' },
  entregado:      { label: 'Entregado',      cls: 'bg-blue-500/20 text-blue-400',  icon: '🍽️' },
}

const GUEST_COLORS = [
  'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
]

function guestColor(n: number) { return GUEST_COLORS[(n - 1) % GUEST_COLORS.length] }

// ─── Main Export ──────────────────────────────────────────────────────────────

export function MeseroPanel() {
  const { user, logout } = useAuthStore()
  const [tables, setTables]   = useState<any[]>([])
  const [orders, setOrders]   = useState<any[]>([])
  const [menu, setMenu]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState<any>(null)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [isOrderOpen, setIsOrderOpen]     = useState(false)
  const [isPerforming, setIsPerforming]   = useState(false)
  const [initialGuest, setInitialGuest]   = useState<number | null>(null)

  const perfRef = useRef(isPerforming)
  perfRef.current = isPerforming

  const load = useCallback(async () => {
    const [tabR, ordR, menR] = await Promise.all([
      api.getRestbarTables(),
      api.getRestbarOrders(),
      api.getRestbarMenu(),
    ])
    if (tabR.success) setTables(tabR.data ?? [])
    if (ordR.success) setOrders(ordR.data ?? [])
    if (menR.success) setMenu((menR.data ?? []).filter((m: any) => m.availableInMenu))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(async () => {
        if (!perfRef.current) await load()
        schedule()
      }, 5000 + Math.random() * 3000)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [load])

  const openTable = async (table: any, startGuest?: number | null) => {
    setSelectedTable(table)
    setSelectedOrder(null)
    setInitialGuest(startGuest ?? null)
    setIsOrderOpen(true)
    if (table.activeOrder?.id) {
      const r = await api.getRestbarOrder(table.activeOrder.id)
      if (r.success) setSelectedOrder(r.data)
    }
  }

  const refreshOrder = useCallback(async (orderId: string) => {
    const r = await api.getRestbarOrder(orderId)
    if (r.success) setSelectedOrder(r.data)
  }, [])

  const closeModal = () => {
    setIsOrderOpen(false)
    setSelectedTable(null)
    setSelectedOrder(null)
    setInitialGuest(null)
    load()
  }

  const occupiedCount = tables.filter(t => t.status === 'ocupada').length

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
            <UtensilsCrossed className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none">{user?.name ?? 'Mesero'}</p>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
              {occupiedCount} mesa{occupiedCount !== 1 ? 's' : ''} activa{occupiedCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setLoading(true); load() }}
            className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button onClick={logout}
            className="rounded-full border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Table Grid ── */}
      <div className="flex-1 px-3 py-3 overflow-y-auto">
        {loading && tables.length === 0 ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <UtensilsCrossed className="h-10 w-10 opacity-30" />
            <p className="text-sm">Sin mesas configuradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables.map(t => (
              <TableCard key={t.id} table={t}
                onOpen={() => openTable(t)}
                onAddGuest={() => openTable(t, -1)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Order Modal ── */}
      {isOrderOpen && selectedTable && (
        <OrderModal
          table={selectedTable}
          order={selectedOrder}
          menu={menu}
          initialGuest={initialGuest}
          onClose={closeModal}
          onOrderCreated={(o) => { setSelectedOrder(o); load() }}
          onOrderUpdated={(id) => refreshOrder(id)}
          setIsPerforming={setIsPerforming}
        />
      )}
    </div>
  )
}

// ─── Table Card ───────────────────────────────────────────────────────────────

function TableCard({ table, onOpen, onAddGuest }: { table: any; onOpen: () => void; onAddGuest: () => void }) {
  const isOccupied = table.status === 'ocupada'
  const isInactive = table.status === 'inactiva'
  const order = table.activeOrder

  return (
    <div className={cn(
      'rounded-2xl border-2 bg-card p-3 flex flex-col gap-2 transition-all',
      isOccupied  ? 'border-amber-500/60 bg-amber-500/5' :
      isInactive  ? 'border-border opacity-40' :
                    'border-border',
    )}>
      <div
        role="button"
        tabIndex={isInactive ? -1 : 0}
        onClick={isInactive ? undefined : onOpen}
        onKeyDown={e => { if (!isInactive && (e.key === 'Enter' || e.key === ' ')) onOpen() }}
        className={cn('flex flex-col gap-2 flex-1 cursor-pointer active:opacity-70 transition-opacity', isInactive && 'cursor-not-allowed')}
      >
        <div className="flex items-center justify-between">
          <p className="font-bold text-base">Mesa {table.number}</p>
          <span className={cn(
            'h-2 w-2 rounded-full',
            isOccupied ? 'bg-amber-400' : isInactive ? 'bg-zinc-600' : 'bg-green-500',
          )} />
        </div>

        {isOccupied && order ? (
          <>
            <p className="text-lg font-bold text-amber-400 leading-none">{fmt(order.total ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">{order.itemsCount ?? 0} ítem{(order.itemsCount ?? 0) !== 1 ? 's' : ''}</p>
          </>
        ) : (
          <p className="text-xs text-green-500 font-medium">Disponible</p>
        )}
      </div>

      {isOccupied && (
        <button
          onClick={onAddGuest}
          className="w-full mt-auto rounded-lg border border-violet-500/30 py-1 text-[11px] text-violet-400 font-medium hover:bg-violet-500/10 transition-colors flex items-center justify-center gap-1"
        >
          <UserPlus className="h-3 w-3" /> Comensal
        </button>
      )}
    </div>
  )
}

// ─── Order Modal (full-screen mobile) ────────────────────────────────────────

function OrderModal({
  table, order, menu, initialGuest, onClose, onOrderCreated, onOrderUpdated, setIsPerforming,
}: {
  table: any; order: any | null; menu: any[]
  initialGuest: number | null
  onClose: () => void
  onOrderCreated: (o: any) => void
  onOrderUpdated: (orderId: string) => void | Promise<void>
  setIsPerforming: (v: boolean) => void
}) {
  const [menuSearch, setMenuSearch]     = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [creatingOrder, setCreatingOrder]   = useState(false)
  const [guestsCount, setGuestsCount]       = useState('2')
  const [addingItemId, setAddingItemId]         = useState<string | null>(null)
  const [bouncingItemId, setBouncingItemId]     = useState<string | null>(null)
  const [cartOpen, setCartOpen]                 = useState(false)
  const [guestPickerOpen, setGuestPickerOpen]   = useState(false)   // for mode selector
  const [reassigningItem, setReassigningItem]   = useState<any>(null) // cart item being reassigned
  const [editingNote, setEditingNote]       = useState<string | null>(null)
  const [noteText, setNoteText]             = useState('')
  const [savingNote, setSavingNote]         = useState(false)

  // ── Guest management ──────────────────────────────────────────────────────
  const [guests, setGuests]             = useState<Guest[]>([])
  const [activeGuest, setActiveGuest]   = useState<number | null>(null)
  const [newGuestName, setNewGuestName] = useState('')
  const [savingGuests, setSavingGuests] = useState(false)
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [guestMode, setGuestMode]       = useState<'general' | 'individual'>('general')

  const searchRef = useRef<HTMLInputElement>(null)

  // Load guest names from order notes
  useEffect(() => {
    if (!order) return
    try {
      const parsed = JSON.parse(order.notes ?? '{}')
      if (Array.isArray(parsed.guests)) setGuests(parsed.guests)
    } catch { /* no guests stored */ }
  }, [order?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialGuest === -1 && order) {
      setGuestMode('individual')
      setShowAddGuest(true)
    }
  }, [initialGuest, order?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveGuestNames = useCallback(async (updatedGuests: Guest[], orderId: string) => {
    if (!orderId) return
    setSavingGuests(true)
    try {
      const parsed = (() => { try { return JSON.parse(order?.notes ?? '{}') } catch { return {} } })()
      await api.updateRestbarOrderNotes(orderId, JSON.stringify({ ...parsed, guests: updatedGuests }))
    } catch { /* silent */ }
    setSavingGuests(false)
  }, [order?.notes])

  const addGuest = async () => {
    const trimmed = newGuestName.trim()
    if (!trimmed || !order?.id) return
    const num = guests.length > 0 ? Math.max(...guests.map(g => g.number)) + 1 : 1
    const updated = [...guests, { number: num, name: trimmed }]
    setGuests(updated)
    setNewGuestName('')
    setShowAddGuest(false)
    setActiveGuest(num)
    await saveGuestNames(updated, order.id)
    toast.success(`"${trimmed}" agregado`)
  }

  const removeGuest = async (num: number) => {
    const updated = guests.filter(g => g.number !== num)
    setGuests(updated)
    if (activeGuest === num) setActiveGuest(null)
    if (order?.id) await saveGuestNames(updated, order.id)
  }

  // ── Menu helpers ──────────────────────────────────────────────────────────
  const categories = ['all', ...new Set(menu.map(m => m.category || 'General').filter(Boolean))]

  const filteredMenu = menu.filter(m => {
    const matchCat = activeCategory === 'all' || (m.category || 'General') === activeCategory
    const matchSearch = !menuSearch || m.name.toLowerCase().includes(menuSearch.toLowerCase())
    return matchCat && matchSearch
  })

  // ── Order actions ─────────────────────────────────────────────────────────
  const createOrder = async () => {
    setCreatingOrder(true); setIsPerforming(true)
    const r = await api.createRestbarOrder({ tableId: table.id, guestsCount: Number(guestsCount) })
    if (r.success) { toast.success('Comanda abierta'); onOrderCreated(r.data) }
    else toast.error(r.error ?? 'Error al crear comanda')
    setCreatingOrder(false); setIsPerforming(false)
  }

  const addItem = async (menuItem: any) => {
    if (!order?.id) return
    setAddingItemId(menuItem.id); setBouncingItemId(menuItem.id); setIsPerforming(true)
    setTimeout(() => setBouncingItemId(null), 250)
    const guestNum = guestMode === 'individual' ? (activeGuest ?? undefined) : undefined
    const r = await api.addRestbarOrderItem(order.id, {
      menuItemId: menuItem.id, quantity: 1,
      guestNumber: guestNum,
    })
    if (r.success) {
      const target = guestNum ? guestName(guestNum) : 'Mesa'
      toast.success(`${menuItem.name} → ${target}`)
      onOrderUpdated(order.id)
    } else toast.error(r.error ?? 'Error al agregar')
    setAddingItemId(null); setIsPerforming(false)
  }

  const increaseItem = async (item: any) => {
    if (!order?.id) return; setIsPerforming(true)
    const r = await api.updateRestbarOrderItem(order.id, item.id, { quantity: item.quantity + 1 })
    if (r.success) onOrderUpdated(order.id); else toast.error(r.error ?? 'Error')
    setIsPerforming(false)
  }

  const decreaseItem = async (item: any) => {
    if (!order?.id) return; setIsPerforming(true)
    if (item.quantity <= 1) {
      const r = await api.removeRestbarOrderItem(order.id, item.id)
      if (r.success) onOrderUpdated(order.id); else toast.error(r.error ?? 'Error')
    } else {
      const r = await api.updateRestbarOrderItem(order.id, item.id, { quantity: item.quantity - 1 })
      if (r.success) onOrderUpdated(order.id); else toast.error(r.error ?? 'Error')
    }
    setIsPerforming(false)
  }

  const removeItem = async (item: any) => {
    if (!order?.id) return; setIsPerforming(true)
    const r = await api.removeRestbarOrderItem(order.id, item.id)
    if (r.success) { toast.success('Ítem eliminado'); onOrderUpdated(order.id) }
    else toast.error(r.error ?? 'Error')
    setIsPerforming(false)
  }

  const saveNote = async () => {
    if (!order?.id || !editingNote) return
    setSavingNote(true); setIsPerforming(true)
    const r = await api.updateRestbarOrderItem(order.id, editingNote, { itemNotes: noteText || undefined })
    if (r.success) { onOrderUpdated(order.id); setEditingNote(null) }
    else toast.error(r.error ?? 'Error al guardar nota')
    setSavingNote(false); setIsPerforming(false)
  }

  const sendToKitchen = async () => {
    if (!order?.id) return; setIsPerforming(true)
    const r = await api.sendRestbarOrderToKitchen(order.id)
    if (r.success) {
      toast.success('Enviado a cocina/bar ✓')
      await onOrderUpdated(order.id)   // await so cart refreshes before re-render
    } else toast.error(r.error ?? 'Error')
    setIsPerforming(false)
  }

  const guestName = (num: number) => guests.find(g => g.number === num)?.name ?? `C${num}`

  const activeItems   = order?.items?.filter((i: any) => i.status !== 'cancelado' && i.status !== 'entregado') ?? []
  // "Por enviar" = pendiente Y no enviado a cocina aún
  const pendingItems  = order?.items?.filter((i: any) => i.status === 'pendiente' && !i.sentToKitchenAt) ?? []
  // "En cocina" = enviados pero aún no entregados (pendiente con sentToKitchenAt, en_preparacion, listo)
  const kitchenItems  = order?.items?.filter((i: any) =>
    (i.status === 'pendiente' && i.sentToKitchenAt) ||
    i.status === 'en_preparacion' ||
    i.status === 'listo'
  ) ?? []
  const cartTotal    = order?.total ?? 0

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">

      {/* ════ HEADER ════ */}
      <div className="shrink-0 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onClose}
          className="h-9 w-9 rounded-full flex items-center justify-center bg-accent text-muted-foreground shrink-0 active:scale-95 transition-transform">
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-base leading-none">Mesa {table.number}</p>
            <span className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full',
              order ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400',
            )}>
              {order ? 'Ocupada' : 'Libre'}
            </span>
            {savingGuests && <span className="text-[10px] text-muted-foreground animate-pulse">Guardando...</span>}
          </div>
          {order && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{order.orderNumber}</p>
          )}
        </div>

        {order && (
          <p className="text-lg font-bold text-amber-400 shrink-0">{fmt(cartTotal)}</p>
        )}
      </div>

      {/* ════ BODY (scrollable) ════ */}
      {!order ? (
        /* ── Create order screen ── */
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <UtensilsCrossed className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-bold text-xl">Mesa {table.number}</p>
            <p className="text-sm text-muted-foreground">¿Cuántos comensales?</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setGuestsCount(v => String(Math.max(1, Number(v) - 1)))}
              className="h-12 w-12 rounded-full bg-accent flex items-center justify-center text-xl font-bold active:scale-95 transition-transform">
              −
            </button>
            <span className="text-4xl font-bold w-16 text-center">{guestsCount}</span>
            <button onClick={() => setGuestsCount(v => String(Math.min(30, Number(v) + 1)))}
              className="h-12 w-12 rounded-full bg-accent flex items-center justify-center text-xl font-bold active:scale-95 transition-transform">
              +
            </button>
          </div>
          <Button className="w-full max-w-xs h-14 text-base rounded-2xl" onClick={createOrder} disabled={creatingOrder}>
            {creatingOrder ? 'Abriendo...' : 'Abrir Comanda'}
          </Button>
        </div>
      ) : (
        <>
          {/* ── Quick actions bar ── */}
          <div className="shrink-0 bg-accent/30 border-b border-border px-3 py-2.5 flex items-center gap-2">
            {/* Mode toggle */}
            <button
              onClick={() => setGuestMode(m => m === 'general' ? 'individual' : 'general')}
              className={cn(
                'flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
                guestMode === 'individual'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground',
              )}
            >
              <Users className="h-3 w-3" />
              {guestMode === 'individual' ? 'Individual' : 'General'}
            </button>

            {/* Individual mode: single compact target selector */}
            {guestMode === 'individual' && (
              <>
                <button
                  onClick={() => setGuestPickerOpen(true)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
                    activeGuest !== null ? guestColor(activeGuest) : 'border-border bg-accent text-foreground',
                  )}
                >
                  <span>→ {activeGuest !== null ? guestName(activeGuest) : 'Mesa'}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
                <button
                  onClick={() => setShowAddGuest(true)}
                  className="shrink-0 h-8 w-8 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          {/* ── Add guest inline (slides down) ── */}
          {guestMode === 'individual' && showAddGuest && (
            <div className="shrink-0 border-b border-border bg-background px-3 py-2 flex items-center gap-2">
              <input
                autoFocus
                placeholder="Nombre del comensal..."
                value={newGuestName}
                onChange={e => setNewGuestName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addGuest() }}
                className="flex-1 rounded-lg border border-border bg-accent/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button onClick={addGuest} disabled={!newGuestName.trim()}
                className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 shrink-0">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => { setShowAddGuest(false); setNewGuestName('') }}
                className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center text-muted-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Guest picker sheet (replaces inline chips) ── */}
          {guestPickerOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setGuestPickerOpen(false)} />
              <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border rounded-t-2xl p-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Agregar ítems a</p>
                <button
                  onClick={() => { setActiveGuest(null); setGuestPickerOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors',
                    activeGuest === null ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-accent',
                  )}
                >
                  <UtensilsCrossed className="h-4 w-4" /> Mesa general
                  {activeGuest === null && <Check className="h-4 w-4 ml-auto" />}
                </button>
                {guests.map(g => (
                  <button
                    key={g.number}
                    onClick={() => { setActiveGuest(g.number); setGuestPickerOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors',
                      activeGuest === g.number ? 'bg-primary text-primary-foreground border-primary' : `${guestColor(g.number)} border`,
                    )}
                  >
                    <span className={cn('h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border', guestColor(g.number))}>
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                    {g.name}
                    {activeGuest === g.number && <Check className="h-4 w-4 ml-auto" />}
                  </button>
                ))}
                <button
                  onClick={() => { setGuestPickerOpen(false); setShowAddGuest(true) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                >
                  <UserPlus className="h-4 w-4" /> Nuevo comensal
                </button>
              </div>
            </>
          )}

          {/* ── Search bar ── */}
          <div className="shrink-0 px-3 py-2 border-b border-border bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar producto..."
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-accent/50 pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50"
              />
              {menuSearch && (
                <button onClick={() => setMenuSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Category chips ── */}
          {!menuSearch && (
            <div className="shrink-0 flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide border-b border-border">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-accent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {cat === 'all' ? 'Todos' : cat}
                </button>
              ))}
            </div>
          )}

          {/* ── Product list ── */}
          <div className="flex-1 overflow-y-auto pb-28">
            {filteredMenu.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <Package className="h-10 w-10 opacity-20" />
                <p className="text-sm">Sin resultados</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredMenu.map(item => {
                  const isAdding   = addingItemId === item.id
                  const isBouncing = bouncingItemId === item.id
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-3 py-2" style={{ minHeight: 76 }}>

                      {/* Image — tappable to add */}
                      <button
                        onClick={() => addItem(item)}
                        disabled={isAdding}
                        className={cn(
                          'relative h-16 w-16 rounded-xl overflow-hidden shrink-0 transition-transform duration-150',
                          isBouncing ? 'scale-110' : 'scale-100',
                          'active:scale-95',
                        )}
                      >
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-accent/80 flex items-center justify-center">
                            <UtensilsCrossed className="h-6 w-6 text-muted-foreground opacity-30" />
                          </div>
                        )}
                        {/* Green flash overlay */}
                        <div className={cn(
                          'absolute inset-0 bg-green-500/40 rounded-xl transition-opacity duration-200',
                          isAdding ? 'opacity-100' : 'opacity-0',
                        )} />
                      </button>

                      {/* Name + price */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{item.name}</p>
                        <p className="text-base font-bold text-green-400 tabular-nums mt-0.5 leading-none">
                          {fmt(item.price ?? 0)}
                        </p>
                        {item.prepTimeMinutes && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                            <Clock className="h-2.5 w-2.5" /> {item.prepTimeMinutes} min
                          </p>
                        )}
                      </div>

                      {/* Add button */}
                      <button
                        onClick={() => addItem(item)}
                        disabled={isAdding}
                        className={cn(
                          'h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90',
                          isAdding
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-green-600 hover:bg-green-700 text-white',
                        )}
                      >
                        {isAdding ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ════ BOTTOM BAR ════ */}
          <div className="fixed bottom-0 left-0 right-0 z-10 safe-area-bottom">

            {/* ── Cart Sheet (expandable) ── */}
            {cartOpen && (
              <div className="bg-card border-t border-border max-h-[65vh] flex flex-col">
                {/* Sheet header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Pedido</span>
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {activeItems.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-amber-400">{fmt(cartTotal)}</span>
                    <button onClick={() => setCartOpen(false)}
                      className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Items list — split by status */}
                <div className="flex-1 overflow-y-auto">
                  {activeItems.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 opacity-20" />
                      <p className="text-sm">Agrega productos del menú</p>
                    </div>
                  ) : (
                    <>
                      {/* Pending items (por enviar) */}
                      {pendingItems.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Por enviar · {pendingItems.length}</span>
                            <div className="flex-1 h-px bg-amber-500/20" />
                          </div>
                          <div className="divide-y divide-border">
                            {pendingItems.map((item: any) => (
                      <div key={item.id} className="px-4 py-2.5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          {/* Status dot */}
                          <span className="text-base shrink-0">{ITEM_STATUS[item.status]?.icon ?? '•'}</span>

                          {/* Name + guest */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold leading-tight">{item.menuItemName}</p>
                              {item.guestNumber != null && (
                                <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-bold', guestColor(item.guestNumber))}>
                                  {guestName(item.guestNumber)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {fmt(item.unitPrice ?? 0)} × {item.quantity}
                              <span className="font-semibold text-foreground ml-1">= {fmt(item.subtotal ?? 0)}</span>
                            </p>
                          </div>

                          {/* Controls */}
                          {item.status === 'pendiente' ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => decreaseItem(item)}
                                className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                              <button onClick={() => increaseItem(item)}
                                className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => removeItem(item)}
                                className="h-8 w-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center ml-1">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-muted-foreground shrink-0">×{item.quantity}</span>
                          )}
                        </div>

                        {/* Notes */}
                        {editingNote === item.id ? (
                          <div className="space-y-1.5 pl-6">
                            <textarea
                              className="w-full rounded-lg border border-amber-500/30 bg-background px-2.5 py-1.5 text-xs resize-none focus:outline-none"
                              rows={2} placeholder="Ej: sin cebolla, término 3/4..."
                              value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus
                            />
                            <div className="flex gap-1.5">
                              <button onClick={() => setEditingNote(null)} className="text-xs text-muted-foreground px-2 py-1 rounded">Cancelar</button>
                              <button onClick={saveNote} disabled={savingNote}
                                className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg disabled:opacity-50">
                                {savingNote ? 'Guardando...' : 'Guardar'}
                              </button>
                            </div>
                          </div>
                        ) : item.itemNotes ? (
                          <div className="flex items-center gap-1.5 pl-6">
                            <FileText className="h-3 w-3 text-amber-400 shrink-0" />
                            <span className="text-xs text-amber-400 flex-1">{item.itemNotes}</span>
                            {item.status === 'pendiente' && (
                              <button onClick={() => { setEditingNote(item.id); setNoteText(item.itemNotes ?? '') }}>
                                <Edit2 className="h-3 w-3 text-amber-500" />
                              </button>
                            )}
                          </div>
                        ) : item.status === 'pendiente' ? (
                          <button
                            onClick={() => { setEditingNote(item.id); setNoteText('') }}
                            className="pl-6 text-[11px] text-muted-foreground hover:text-amber-400 flex items-center gap-1 transition-colors">
                            <FileText className="h-3 w-3" /> Nota
                          </button>
                        ) : null}

                        {/* Guest reassign — tappable badge only */}
                        {item.status === 'pendiente' && guests.length > 0 && (
                          <button
                            onClick={() => setReassigningItem(item)}
                            className={cn(
                              'ml-6 mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                              item.guestNumber != null ? guestColor(item.guestNumber) : 'border-border text-muted-foreground',
                            )}
                          >
                            <span>{item.guestNumber != null ? guestName(item.guestNumber) : 'Mesa'}</span>
                            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                          </button>
                        )}
                      </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* In-kitchen items (pendiente+sentToKitchenAt, en_preparacion, listo) */}
                      {(() => {
                        if (kitchenItems.length === 0) return null
                        return (
                          <>
                            <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">En cocina · {kitchenItems.length}</span>
                              <div className="flex-1 h-px bg-blue-500/20" />
                            </div>
                            <div className="divide-y divide-border/50 opacity-70">
                              {kitchenItems.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                                  <span className="text-base shrink-0">{ITEM_STATUS[item.status]?.icon ?? '•'}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-medium leading-tight truncate">{item.menuItemName}</p>
                                      {item.guestNumber != null && (
                                        <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-bold shrink-0', guestColor(item.guestNumber))}>
                                          {guestName(item.guestNumber)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{fmt(item.subtotal ?? 0)}</p>
                                  </div>
                                  <span className="text-xs text-muted-foreground shrink-0">×{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )
                      })()}
                    </>
                  )}
                </div>

                {/* Guest summary */}
                {guests.length > 0 && activeItems.length > 0 && (
                  <div className="border-t border-border px-4 py-2.5 flex flex-wrap gap-2 shrink-0">
                    {guests.map(g => {
                      const total = activeItems.filter((i: any) => i.guestNumber === g.number).reduce((a: number, i: any) => a + (i.subtotal ?? 0), 0)
                      return (
                        <div key={g.number} className={cn('flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold', guestColor(g.number))}>
                          <span>{g.name}</span>
                          <span className="opacity-70">{fmt(total)}</span>
                          <button onClick={() => removeGuest(g.number)}><X className="h-2.5 w-2.5" /></button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Send to kitchen button */}
                {pendingItems.length > 0 && (
                  <div className="p-3 shrink-0 border-t border-border">
                    <button
                      onClick={sendToKitchen}
                      className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                      <ChefHat className="h-5 w-5" />
                      Enviar {pendingItems.length} ítem{pendingItems.length !== 1 ? 's' : ''} a cocina
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Reassign item sheet ── */}
            {reassigningItem && (
              <>
                <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setReassigningItem(null)} />
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl p-4 space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                    Reasignar <span className="text-foreground">{reassigningItem.menuItemName}</span>
                  </p>
                  <button
                    onClick={() => {
                      api.updateRestbarOrderItem(order.id, reassigningItem.id, { guestNumber: null })
                        .then(() => onOrderUpdated(order.id))
                      setReassigningItem(null)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors',
                      reassigningItem.guestNumber == null ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-accent',
                    )}
                  >
                    <UtensilsCrossed className="h-4 w-4" /> Mesa general
                    {reassigningItem.guestNumber == null && <Check className="h-4 w-4 ml-auto" />}
                  </button>
                  {guests.map(g => (
                    <button
                      key={g.number}
                      onClick={() => {
                        api.updateRestbarOrderItem(order.id, reassigningItem.id, { guestNumber: g.number })
                          .then(() => onOrderUpdated(order.id))
                        setReassigningItem(null)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors',
                        reassigningItem.guestNumber === g.number ? 'bg-primary text-primary-foreground border-primary' : `${guestColor(g.number)} border`,
                      )}
                    >
                      <span className={cn('h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border', guestColor(g.number))}>
                        {g.name.charAt(0).toUpperCase()}
                      </span>
                      {g.name}
                      {reassigningItem.guestNumber === g.number && <Check className="h-4 w-4 ml-auto" />}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Bottom pill / cart bar ── */}
            <button
              onClick={() => setCartOpen(v => !v)}
              className="w-full bg-primary text-primary-foreground flex items-center px-5 py-4 gap-3"
            >
              <div className="relative shrink-0">
                <ShoppingCart className="h-5 w-5" />
                {activeItems.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center">
                    {activeItems.length}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-semibold">
                  {activeItems.length === 0 ? 'Sin ítems aún' : `${activeItems.length} ítem${activeItems.length !== 1 ? 's' : ''}`}
                </span>
              </div>
              <span className="text-lg font-bold">{fmt(cartTotal)}</span>
              {cartOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronUp className="h-4 w-4 shrink-0" />}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
