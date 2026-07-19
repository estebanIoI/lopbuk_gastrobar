'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { posCaps } from '@/lib/pos-permissions'
import { usePosFeedback } from '@/lib/use-pos-feedback'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { getRestbarSocket, disconnectRestbarSocket } from '@/lib/socket'
import { PosTopBar } from './PosTopBar'
import { PosToolRail } from './PosToolRail'
import { MenuGrid } from './MenuGrid'
import { CategoryTabs } from './CategoryTabs'
import { OrderTicket } from './OrderTicket'
import { PaymentModal } from './PaymentModal'
import { MealPassAssignDialog } from '@/components/meal-pass-assign-dialog'
import { MergeTablesDialog } from './MergeTablesDialog'
import { TableTabs } from './TableTabs'
import { QuickFilters, type QuickFilter } from './QuickFilters'
import { LobbyDashboard } from './LobbyDashboard'
import { CommandPalette } from './CommandPalette'
import { type PosNotification } from './NotificationCenter'
import { Users, X, LayoutGrid, LayoutList, RotateCcw, Trash2 } from 'lucide-react'

const FAVORITES_KEY = 'lopbuk_pos_favorites'
const POS_LAST_ORDER_KEY = 'lopbuk_pos_last_order' // recovery de sesión: última comanda abierta

export interface PosTable {
  id: string
  number: string
  capacity: number
  area: string | null
  status: string
  activeOrder?: { id: string; orderNumber: string; total: number; itemsCount: number; openedAt?: string | null } | null
}

export interface MenuItem {
  id: string; name: string; sku: string; price: number
  category: string; isMenuItem: boolean; availableInMenu: boolean
  preparationArea: string | null; prepTimeMinutes: number | null
  stock: number; description: string | null; imageUrl: string | null
}

export interface OrderItem {
  id: string; menuItemId: string; menuItemName: string
  preparationArea: string; quantity: number
  unitPrice: number; originalPrice: number | null
  subtotal: number; discount: number; status: string
  guestNumber: number | null; courseNumber: number | null
  itemNotes: string | null
  sentToKitchenAt: string | null; readyAt: string | null; deliveredAt: string | null
}

export interface Order {
  id: string; orderNumber: string; tableId: string
  tableNumber: string; waiterName: string
  guestsCount: number; status: string; notes: string | null
  subtotal: number; tax: number; discount: number; total: number
  openedAt: string; closedAt: string | null
  items: OrderItem[]
}

interface PosShellProps {
  initialTableId?: string | null
  onDone: () => void
}

export function PosShell({ initialTableId, onDone }: PosShellProps) {
  const { user } = useAuthStore()
  const caps = posCaps(user?.role) // perfil por rol: qué herramientas ve/usa este usuario
  const feedback = usePosFeedback() // sonidos + vibración (configurable)
  const [tables, setTables] = useState<PosTable[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSeat, setActiveSeat] = useState(1)
  const [activeCourse, setActiveCourse] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [openingTable, setOpeningTable] = useState(false)
  const [sentFlash, setSentFlash] = useState<{ area: 'cocina' | 'bar'; ts: number } | null>(null) // feedback "enviado"
  const [showMealPass, setShowMealPass] = useState(false) // Tiquetera (Fase 5)
  const [showMergeTables, setShowMergeTables] = useState(false) // Unir mesas (Fase 6)
  const [recoverOrder, setRecoverOrder] = useState<{ id: string; tableNumber: string } | null>(null) // comanda recuperable tras recarga
  const [showCancelConfirm, setShowCancelConfirm] = useState(false) // modal de "Cerrar mesa"
  const [cancelling, setCancelling] = useState(false)
  const recoveryChecked = useRef(false)
  const prevReadyCount = useRef(0)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [pendingQuantity, setPendingQuantity] = useState<number | null>(null)
  const [pendingPrice, setPendingPrice] = useState<number | null>(null)
  const [sentItemIds, setSentItemIds] = useState<Set<string>>(new Set())
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(FAVORITES_KEY) : null
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })
  const [recentItemIds, setRecentItemIds] = useState<string[]>([])
  const [quickModifyItem, setQuickModifyItem] = useState<MenuItem | null>(null)
  const [quickModifyNotes, setQuickModifyNotes] = useState('')
  const [quickModifyQty, setQuickModifyQty] = useState(1)
  const [showMoveTablePicker, setShowMoveTablePicker] = useState(false)
  const [movingItemId, setMovingItemId] = useState<string | null>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [gridCols, setGridCols] = useState<4 | 5 | 6>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('lopbuk_pos_layout') : null
      if (stored === '5') return 5
      if (stored === '6') return 6
    } catch {}
    return 4
  })
  const [notifications, setNotifications] = useState<PosNotification[]>([])

  // ─── Socket.io — multi-waiter real-time sync ───────────────────────────────
  useEffect(() => {
    const socket = getRestbarSocket()

    const onOrderChanged = ({ orderId }: { orderId: string }) => {
      if (selectedOrder?.id === orderId) {
        loadOrder(orderId)
      }
    }

    socket.on('order-changed', onOrderChanged)

    return () => {
      socket.off('order-changed', onOrderChanged)
    }
  }, [selectedOrder?.id])

  // Join/leave order room when selectedOrder changes
  useEffect(() => {
    const socket = getRestbarSocket()
    if (selectedOrder) {
      socket.emit('join-table', selectedOrder.id)
    }
    return () => {
      if (selectedOrder) {
        socket.emit('leave-table', selectedOrder.id)
      }
    }
  }, [selectedOrder?.id])

  // ─── Polling fallback — refresco periódico de la comanda activa ───────────
  useEffect(() => {
    if (!selectedOrder) return
    const timer = setInterval(async () => {
      await loadOrder(selectedOrder.id)
    }, 10000)
    return () => clearInterval(timer)
  }, [selectedOrder?.id])

  // ─── Socket cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      disconnectRestbarSocket()
    }
  }, [])

  const loadData = useCallback(async () => {
    const [tabR, menR] = await Promise.all([
      api.getRestbarTables(),
      api.getRestbarMenu(),
    ])
    if (tabR.success) setTables(tabR.data ?? [])
    if (menR.success) setMenu((menR.data ?? []).filter((m: any) => m.availableInMenu))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── Recovery de sesión ───────────────────────────────────────────────────
  // Persiste la comanda abierta; si el navegador se recarga/cae, la ofrece de vuelta.
  useEffect(() => {
    try {
      if (selectedOrder) localStorage.setItem(POS_LAST_ORDER_KEY, selectedOrder.id)
    } catch {}
  }, [selectedOrder?.id])

  useEffect(() => {
    if (recoveryChecked.current) return
    recoveryChecked.current = true
    if (initialTableId) return // deep-link explícito: no interferir
    let stored: string | null = null
    try { stored = localStorage.getItem(POS_LAST_ORDER_KEY) } catch {}
    if (!stored) return
    ;(async () => {
      const r = await api.getRestbarOrder(stored!)
      if (r.success && r.data && ['abierta', 'en_proceso'].includes(r.data.status)) {
        setRecoverOrder({ id: r.data.id, tableNumber: r.data.tableNumber })
      } else {
        try { localStorage.removeItem(POS_LAST_ORDER_KEY) } catch {} // ya cerrada/inexistente
      }
    })()
  }, [initialTableId])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteIds]))
    }
  }, [favoriteIds])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(v => !v)
        return
      }
      // F1=Buscar, F2=Mesas, F3=Cobrar, F4=Imprimir, ESC=Volver
      if (e.key === 'F1') { e.preventDefault(); setShowCommandPalette(true) }
      if (e.key === 'F2') { e.preventDefault(); if (selectedOrder) setSelectedOrder(null) }
      if (e.key === 'F3' && selectedOrder && caps.canPay) { e.preventDefault(); setShowPayment(true) }
      if (e.key === 'F4' && selectedOrder) { e.preventDefault(); handlePrintBill() }
      if (e.key === 'Escape') {
        if (showCommandPalette) { setShowCommandPalette(false); return }
        if (showPayment) { setShowPayment(false); return }
        if (quickModifyItem) { setQuickModifyItem(null); return }
        if (selectedOrder) { setSelectedOrder(null); return }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedOrder, showCommandPalette, showPayment, quickModifyItem])

  useEffect(() => {
    if (initialTableId && tables.length > 0) {
      const table = tables.find(t => t.id === initialTableId || (t.activeOrder && t.activeOrder.id === initialTableId))
      if (table?.activeOrder) {
        loadOrder(table.activeOrder.id)
      }
    }
  }, [initialTableId, tables])

  const loadOrder = async (orderId: string) => {
    const r = await api.getRestbarOrder(orderId)
    if (r.success) {
      const order = r.data as Order
      setSelectedOrder(order)
      setSelectedItems(new Set())
      setSentItemIds(new Set())
      if (order.items.length > 0) {
        const maxSeat = Math.max(...order.items.filter((i: OrderItem) => i.guestNumber).map((i: OrderItem) => i.guestNumber!), 1)
        setActiveSeat(maxSeat)
      }
    }
  }

  const openTable = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    setOpeningTable(true)
    try {
      // Mesa con comanda abierta → la cargamos; mesa libre → creamos la comanda.
      if (table.activeOrder?.id) {
        await loadOrder(table.activeOrder.id)
        toast.success(`Comanda de Mesa ${table.number} cargada`)
        return
      }
      const r = await api.createRestbarOrder({ tableId, guestsCount: table.capacity })
      if (r.success) {
        await loadOrder(r.data.id)
        await loadData()
        toast.success(`Comanda abierta · Mesa ${table.number}`)
      } else {
        toast.error(r.error ?? 'No se pudo abrir la mesa')
      }
    } finally {
      setOpeningTable(false)
    }
  }

  const handleAddItem = async (menuItem: MenuItem) => {
    if (!selectedOrder) return doAddItem(menuItem)
    await doAddItem(menuItem)
    setRecentItemIds(prev => {
      const next = [menuItem.id, ...prev.filter(id => id !== menuItem.id)]
      return next.slice(0, 20)
    })
  }

  const doAddItem = async (menuItem: MenuItem, qtyOverride?: number, notesOverride?: string) => {
    if (!selectedOrder) return
    const qty = qtyOverride ?? pendingQuantity ?? 1
    const notes = notesOverride ?? ''
    const r = await api.addRestbarOrderItem(selectedOrder.id, {
      menuItemId: menuItem.id,
      quantity: qty,
      guestNumber: activeSeat,
      courseNumber: activeCourse,
      itemNotes: notes,
      unitPrice: pendingPrice ?? undefined,
    })
    if (r.success) {
      await loadOrder(selectedOrder.id)
      setPendingQuantity(null)
      setPendingPrice(null)
      toast.success(`${menuItem.name} agregado`)
      feedback.play('add')
    } else {
      toast.error(r.error ?? 'Error al agregar')
      feedback.play('error')
    }
  }

  const handleDoubleClickAdd = async (menuItem: MenuItem) => {
    if (!selectedOrder) return
    await doAddItem(menuItem, 2)
    setRecentItemIds(prev => {
      const next = [menuItem.id, ...prev.filter(id => id !== menuItem.id)]
      return next.slice(0, 20)
    })
  }

  const handleLongPressModify = (menuItem: MenuItem) => {
    setQuickModifyItem(menuItem)
    setQuickModifyNotes('')
    setQuickModifyQty(pendingQuantity ?? 1)
  }

  const handleQuickModifySubmit = async () => {
    if (!quickModifyItem) return
    await doAddItem(quickModifyItem, quickModifyQty, quickModifyNotes || undefined)
    setRecentItemIds(prev => {
      const next = [quickModifyItem.id, ...prev.filter(id => id !== quickModifyItem.id)]
      return next.slice(0, 20)
    })
    setQuickModifyItem(null)
  }

  const toggleFavorite = (itemId: string) => {
    setFavoriteIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) { next.delete(itemId) } else { next.add(itemId) }
      return next
    })
  }

  const handleUpdateItemQty = async (itemId: string, qty: number) => {
    if (!selectedOrder || qty < 1) return
    await api.updateRestbarOrderItem(selectedOrder.id, itemId, { quantity: qty })
    await loadOrder(selectedOrder.id)
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedOrder) return
    await api.removeRestbarOrderItem(selectedOrder.id, itemId)
    await loadOrder(selectedOrder.id)
  }

  const handleSendSelected = async (itemIds?: string[]) => {
    if (!selectedOrder) return
    const ids = itemIds ?? [...selectedItems]
    await api.sendRestbarOrderToKitchen(selectedOrder.id, ids)
    await loadOrder(selectedOrder.id)
    toast.success('Enviado a cocina/bar')
    feedback.play('sent')
  }

  const handleSendArea = async (area: 'cocina' | 'bar') => {
    if (!selectedOrder) return
    const itemsToSend = (selectedOrder.items || [])
      .filter((i: OrderItem) => i.status === 'pendiente' && !i.sentToKitchenAt)
      .filter((i: OrderItem) => {
        const a = (i.preparationArea || '').trim()
        // Cocina también toma los ítems sin área definida (default), para no descartarlos.
        return a === area || a === 'ambos' || (area === 'cocina' && a === '')
      })
    if (itemsToSend.length === 0) {
      toast.error(`No hay ítems pendientes para ${area}`)
      return
    }
    await api.sendRestbarOrderToKitchen(selectedOrder.id, itemsToSend.map((i: OrderItem) => i.id))
    await loadOrder(selectedOrder.id)
    toast.success(`Enviado a ${area}`)
    setSentFlash({ area, ts: Date.now() }) // dispara la animación "✓ Enviado" en el botón
    feedback.play('sent')
  }

  const handlePrintBill = async () => {
    if (!selectedOrder) return
    const r = await api.printRestbarBill(selectedOrder.id)
    if (r.success) toast.success('Pre-cuenta impresa')
    else toast.error(r.error ?? 'Error al imprimir')
  }

  // Cancelar la comanda y liberar la mesa (útil si se abrió por error).
  // Abre un modal de confirmación; una comanda con productos solo la cancela un admin.
  const handleCancelOrder = () => {
    if (!selectedOrder) return
    const activeItems = (selectedOrder.items ?? []).filter((i: OrderItem) => i.status !== 'cancelado')
    if (activeItems.length > 0 && !caps.canManageTables) {
      toast.error('La comanda tiene productos. Solo un administrador puede cancelarla.')
      return
    }
    setShowCancelConfirm(true)
  }

  const confirmCancelOrder = async () => {
    if (!selectedOrder) { setShowCancelConfirm(false); return }
    setCancelling(true)
    const r = await api.cancelRestbarOrder(selectedOrder.id)
    setCancelling(false)
    if (r.success) {
      toast.success(`Mesa ${selectedOrder.tableNumber} liberada`)
      try { localStorage.removeItem(POS_LAST_ORDER_KEY) } catch {}
      setShowCancelConfirm(false)
      setSelectedOrder(null)
      await loadData()
    } else {
      toast.error(r.error ?? 'No se pudo cancelar la comanda')
      feedback.play('error')
    }
  }

  const handleDuplicate = async (itemId: string) => {
    if (!selectedOrder) return
    await api.duplicateRestbarOrderItem(selectedOrder.id, itemId)
    await loadOrder(selectedOrder.id)
  }

  const handleRepeatLastOrder = async () => {
    if (!selectedOrder) return
    const r = await api.repeatRestbarLastOrder(selectedOrder.id)
    if (r.success) {
      await loadOrder(selectedOrder.id)
      toast.success('Última orden repetida')
    } else {
      toast.error(r.error ?? 'Error al repetir')
    }
  }

  const handleMoveItemToTable = (itemId: string) => {
    setMovingItemId(itemId)
    setShowMoveTablePicker(true)
  }

  const confirmMoveItem = async (targetTableId: string) => {
    if (!selectedOrder || !movingItemId) return
    const targetTable = tables.find(t => t.id === targetTableId)
    if (!targetTable?.activeOrder?.id) {
      toast.error('La mesa destino no tiene comanda activa')
      return
    }
    const r = await api.moveRestbarItemToOrder(selectedOrder.id, movingItemId, targetTable.activeOrder.id)
    if (r.success) {
      await loadOrder(selectedOrder.id)
      await loadData()
      toast.success(`Ítem movido a Mesa ${targetTable.number}`)
      setSelectedItems(new Set())
    } else {
      toast.error(r.error ?? 'Error al mover ítem')
    }
    setShowMoveTablePicker(false)
    setMovingItemId(null)
  }

  const handleSendSolo = async (itemId: string) => {
    if (!selectedOrder) return
    await api.sendRestbarOrderToKitchen(selectedOrder.id, [itemId])
    await loadOrder(selectedOrder.id)
    toast.success('Ítem enviado a cocina/bar')
  }

  const handleCancelItem = async (itemId: string) => {
    if (!selectedOrder) return
    await api.updateRestbarItemStatus(itemId, 'cancelado')
    await loadOrder(selectedOrder.id)
    toast.success('Ítem cancelado')
  }

  const handleDiscountItem = async (itemId: string) => {
    if (!selectedOrder) return
    const item = selectedOrder.items.find(i => i.id === itemId)
    if (!item) return
    const input = prompt('Nuevo precio (actual: ' + formatCOP(item.unitPrice) + '):')
    if (!input) return
    const newPrice = parseFloat(input)
    if (isNaN(newPrice) || newPrice < 0) return
    await api.updateRestbarOrderItem(selectedOrder.id, itemId, { unitPrice: newPrice })
    await loadOrder(selectedOrder.id)
    toast.success(`Precio actualizado: ${formatCOP(newPrice)}`)
  }

  const handleMoveCourse = async (itemId: string, course: number) => {
    if (!selectedOrder) return
    await api.updateRestbarOrderItem(selectedOrder.id, itemId, { courseNumber: course })
    await loadOrder(selectedOrder.id)
    toast.success(`Movido a Curso ${course}`)
  }

  const addNotification = (type: PosNotification['type'], message: string, tableInfo?: string) => {
    const n: PosNotification = {
      id: Date.now().toString(),
      type,
      message,
      tableInfo,
      time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    }
    setNotifications(prev => [n, ...prev].slice(0, 50))
  }

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  const handleMoveSeat = async (itemId: string, toSeat: number) => {
    if (!selectedOrder) return
    await api.updateRestbarOrderItem(selectedOrder.id, itemId, { guestNumber: toSeat })
    await loadOrder(selectedOrder.id)
    toast.success(`Movido a Seat ${toSeat}`)
  }

  const handleDeleteSelected = async () => {
    if (!selectedOrder || selectedItems.size === 0) return
    for (const id of selectedItems) {
      await api.removeRestbarOrderItem(selectedOrder.id, id)
    }
    setSelectedItems(new Set())
    await loadOrder(selectedOrder.id)
    toast.success(`${selectedItems.size} ítems eliminados`)
  }

  const selectedItem: OrderItem | null = selectedOrder && selectedItems.size === 1
    ? (selectedOrder.items.find(i => selectedItems.has(i.id)) ?? null)
    : null

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) { next.delete(itemId) } else { next.add(itemId) }
      return next
    })
  }

  const handlePay = async (data: { paymentMethod: string; amountPaid: number; guestNumber?: number | null }) => {
    if (!selectedOrder) return
    if (!caps.canPay) { toast.error('Tu perfil no puede cobrar. Pide a un cajero o administrador.'); return }
    const r = await api.payRestbarOrder(selectedOrder.id, data)
    if (r.success) {
      toast.success('Pago procesado')
      feedback.play('paid')
      await loadOrder(selectedOrder.id)
      await loadData()
      if (r.data.closed) {
        toast.success('Comanda cerrada')
        try { localStorage.removeItem(POS_LAST_ORDER_KEY) } catch {} // comanda cerrada → nada que recuperar
        setSelectedOrder(null)
      }
    } else {
      toast.error(r.error ?? 'Error al procesar pago')
      feedback.play('error')
    }
  }

  // Popularidad por ítem (a partir de los recientes) — debe declararse ANTES de
  // filteredMenu/quickFilterCounts porque ambos la usan (evita TDZ).
  const itemPopularity: Record<string, number> = {}
  recentItemIds.forEach(id => { itemPopularity[id] = (itemPopularity[id] || 0) + 1 })

  const filteredMenu = menu.filter(item => {
    if (selectedCategory && item.category !== selectedCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const name = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const sku = (item.sku ?? '').toLowerCase()
      if (!(name.includes(q) || sku.includes(q) || item.name.toLowerCase().includes(searchQuery.toLowerCase()))) return false
    }
    switch (quickFilter) {
      case 'favorites': return favoriteIds.has(item.id)
      case 'recent': return recentItemIds.includes(item.id)
      case 'lowstock': return item.stock > 0 && item.stock <= 5
      case 'outofstock': return item.stock <= 0
      case 'bestsellers': return itemPopularity[item.id] >= 2
      case 'promos': return true // placeholder — requiere backend
      default: return true
    }
  })

  const quickFilterCounts: Record<QuickFilter, number> = {
    all: menu.length,
    favorites: favoriteIds.size,
    bestsellers: Object.values(itemPopularity).filter(n => n >= 2).length,
    recent: recentItemIds.length,
    promos: 0,
    lowstock: menu.filter(m => m.stock > 0 && m.stock <= 5).length,
    outofstock: menu.filter(m => m.stock <= 0).length,
  }

  const categories = Array.from(new Set(menu.map(m => m.category).filter(Boolean)))
  const categoryCounts: Record<string, number> = {}
  menu.forEach(m => { if (m.category) categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1 })

  // Top bar counts
  const pendingKitchenCount = selectedOrder?.items.filter(i => i.status === 'pendiente' && (i.preparationArea === 'cocina' || i.preparationArea === 'ambos') && !i.sentToKitchenAt).length ?? 0
  const pendingBarCount = selectedOrder?.items.filter(i => i.status === 'pendiente' && (i.preparationArea === 'bar' || i.preparationArea === 'ambos') && !i.sentToKitchenAt).length ?? 0
  const preparingCount = selectedOrder?.items.filter(i => i.status === 'en_preparacion').length ?? 0
  const readyCount = selectedOrder?.items.filter(i => i.status === 'listo').length ?? 0
  const alertCount = notifications.filter(n => !n.read).length

  // Campanita 🔔 cuando cocina/bar marca más ítems como "listo".
  useEffect(() => {
    if (readyCount > prevReadyCount.current) feedback.play('ready')
    prevReadyCount.current = readyCount
  }, [readyCount])

  const sortedMenu = quickFilter === 'bestsellers'
    ? [...filteredMenu].sort((a, b) => (itemPopularity[b.id] || 0) - (itemPopularity[a.id] || 0))
    : filteredMenu

  return (
    <div className="fixed inset-0 z-[200] bg-zinc-950 text-zinc-100 flex flex-col select-none overflow-hidden"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PosTopBar
        onDone={onDone}
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        onSendKitchen={() => handleSendArea('cocina')}
        onSendBar={() => handleSendArea('bar')}
        onPrintBill={handlePrintBill}
        onOpenPayment={() => setShowPayment(true)}
        selectedOrder={selectedOrder}
        selectedCount={selectedItems.size}
        onSendSelected={() => handleSendSelected()}
        notifications={notifications}
        onMarkNotificationRead={markNotificationRead}
        onClearNotifications={clearNotifications}
        pendingKitchen={pendingKitchenCount}
        pendingBar={pendingBarCount}
        preparingCount={preparingCount}
        readyCount={readyCount}
        alertCount={alertCount}
        caps={caps}
        sentFlash={sentFlash}
        soundEnabled={feedback.soundEnabled}
        vibrationEnabled={feedback.vibrationEnabled}
        onToggleSound={feedback.toggleSound}
        onToggleVibration={feedback.toggleVibration}
      />
      <div className="flex-1 flex min-h-0">
        <PosToolRail
          hasOrder={!!selectedOrder}
          selectedCount={selectedItems.size}
          selectedItem={selectedItem}
          pendingQuantity={pendingQuantity}
          onSetQuantity={(q) => { setPendingQuantity(q); setPendingPrice(null) }}
          onSetPrice={(p) => setPendingPrice(p)}
          activeSeat={activeSeat}
          onSetSeat={setActiveSeat}
          activeCourse={activeCourse}
          onSetCourse={setActiveCourse}
          onPrintBill={handlePrintBill}
          onRepeatLast={handleRepeatLastOrder}
          onMoveSeat={handleMoveSeat}
          onDuplicate={handleDuplicate}
          onRemoveItem={handleRemoveItem}
          onMoveToTable={handleMoveItemToTable}
          onSendSelected={() => handleSendSelected()}
          onDeleteSelected={handleDeleteSelected}
          onAssignMealPass={() => setShowMealPass(true)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          {selectedOrder ? (
            <>
              {/* Comanda abierta → barra de contexto + productos para agregar */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >← Mesas</button>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span className="inline-flex items-center rounded-md border border-amber-500/50 bg-amber-500/20 px-2.5 py-1 text-base font-extrabold text-amber-300 shadow-sm shadow-amber-900/20">
                    Mesa {selectedOrder.tableNumber}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />{selectedOrder.guestsCount}
                  </span>
                  <span>{selectedOrder.waiterName}</span>
                  {selectedOrder.openedAt && (
                    <span className="text-zinc-500">
                      {elapsedTime(new Date(selectedOrder.openedAt))}
                    </span>
                  )}
                </div>
                <span className="flex-1" />
                <button
                  onClick={handleCancelOrder}
                  title="Cancelar la comanda y liberar la mesa (si la abriste por error)"
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-red-400 hover:text-white hover:bg-red-600/80 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Cerrar mesa
                </button>
                <span className="text-[10px] text-zinc-600 mr-2">Ctrl+K</span>
                <div className="flex items-center gap-0.5">
                  {([4, 5, 6] as const).map(n => (
                    <button key={n} onClick={() => { setGridCols(n); localStorage.setItem('lopbuk_pos_layout', String(n)) }}
                      className={`h-6 px-1.5 rounded text-[10px] font-semibold transition-colors
                        ${gridCols === n ? 'bg-zinc-600 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}>
                      {n === 4 ? 'M' : n === 5 ? 'L' : 'XL'}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-zinc-500">Toca un producto para agregarlo</span>
              </div>
              <TableTabs
                tables={tables}
                activeTableId={selectedOrder.tableId}
                onSelect={openTable}
                onMergeTables={() => setShowMergeTables(true)}
              />
              <QuickFilters
                active={quickFilter}
                onSelect={(f) => { setQuickFilter(f); setSelectedCategory(null) }}
                counts={quickFilterCounts}
              />
              <MenuGrid
                items={sortedMenu}
                onItemClick={handleAddItem}
                onItemDoubleClick={handleDoubleClickAdd}
                onItemLongPress={handleLongPressModify}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                itemPopularity={itemPopularity}
                cols={gridCols}
                seat={activeSeat}
                course={activeCourse}
              />
            </>
          ) : (
            /* Sin comanda → el área principal muestra el LOBBY (paso inicial claro) */
            <div className="flex-1 flex flex-col min-h-0">
              {recoverOrder && (
                <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                  <RotateCcw className="h-5 w-5 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-300">Sesión anterior detectada</p>
                    <p className="text-xs text-amber-200/70">Tenías la comanda de Mesa {recoverOrder.tableNumber} abierta. ¿Retomarla?</p>
                  </div>
                  <button
                    onClick={() => { const id = recoverOrder.id; setRecoverOrder(null); loadOrder(id) }}
                    className="h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors">
                    Recuperar
                  </button>
                  <button
                    onClick={() => { try { localStorage.removeItem(POS_LAST_ORDER_KEY) } catch {}; setRecoverOrder(null) }}
                    className="h-9 px-3 rounded-lg text-amber-200/70 hover:text-white text-sm transition-colors">
                    Descartar
                  </button>
                </div>
              )}
              <LobbyDashboard
                tables={tables}
                openingTable={openingTable}
                loading={loading}
                onSelect={openTable}
              />
            </div>
          )}
        </div>
        <OrderTicket
          order={selectedOrder}
          selectedItems={selectedItems}
          onToggleItem={toggleItemSelection}
          onUpdateQty={handleUpdateItemQty}
          onRemoveItem={handleRemoveItem}
          onDuplicate={handleDuplicate}
          sentItems={sentItemIds}
          onOpenPayment={() => setShowPayment(true)}
          onSendSolo={handleSendSolo}
          onCancelItem={handleCancelItem}
          onDiscountItem={handleDiscountItem}
          onMoveSeat={handleMoveSeat}
          onMoveCourse={handleMoveCourse}
          canPay={caps.canPay}
        />
      </div>
      {selectedOrder && (
        <CategoryTabs
          categories={categories}
          categoryCounts={categoryCounts}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      )}
      {showPayment && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          onPay={handlePay}
          onClose={() => setShowPayment(false)}
        />
      )}

      {/* Tiquetera (Fase 5): con ítems seleccionados vienen premarcados; sin
          selección, el diálogo permite elegir o cargar toda la mesa. */}
      {showMealPass && selectedOrder && (
        <MealPassAssignDialog
          orderId={selectedOrder.id}
          items={(selectedOrder.items ?? []) as any}
          preselectedIds={selectedItems.size > 0 ? [...selectedItems] : undefined}
          onClose={() => setShowMealPass(false)}
          onAssigned={async () => { setShowMealPass(false); setSelectedItems(new Set()); await loadOrder(selectedOrder.id) }}
        />
      )}

      {/* Unir / separar mesas (Fase 6) */}
      {showMergeTables && (
        <MergeTablesDialog
          tables={tables}
          currentTableId={selectedOrder?.tableId ?? null}
          onClose={() => setShowMergeTables(false)}
          onDone={async () => { setShowMergeTables(false); await loadData() }}
        />
      )}
      {showCancelConfirm && selectedOrder && (() => {
        const activeItems = (selectedOrder.items ?? []).filter((i: OrderItem) => i.status !== 'cancelado')
        const hasItems = activeItems.length > 0
        return (
          <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4"
            onClick={() => !cancelling && setShowCancelConfirm(false)}>
            <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${hasItems ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-100">Cerrar Mesa {selectedOrder.tableNumber}</h2>
                  <p className="text-xs text-zinc-500">Se liberará la mesa</p>
                </div>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed mb-5">
                {hasItems
                  ? <>La comanda tiene <span className="font-bold text-red-400">{activeItems.length} producto(s)</span>. Al cancelarla se descartarán y la mesa quedará libre. <span className="font-semibold">Esta acción no se puede deshacer.</span></>
                  : <>¿Cerrar la comanda vacía y dejar la <span className="font-semibold text-amber-300">Mesa {selectedOrder.tableNumber}</span> libre?</>}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowCancelConfirm(false)} disabled={cancelling}
                  className="flex-1 h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold transition-colors disabled:opacity-50">
                  Volver
                </button>
                <button onClick={confirmCancelOrder} disabled={cancelling}
                  className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                  {cancelling ? 'Cerrando…' : 'Sí, cerrar mesa'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {quickModifyItem && (
        <QuickModifyModal
          item={quickModifyItem}
          notes={quickModifyNotes}
          onNotesChange={setQuickModifyNotes}
          qty={quickModifyQty}
          onQtyChange={setQuickModifyQty}
          seat={activeSeat}
          course={activeCourse}
          onSubmit={handleQuickModifySubmit}
          onClose={() => setQuickModifyItem(null)}
        />
      )}
      {showMoveTablePicker && (
        <MoveTablePicker
          tables={tables.filter(t => t.id !== selectedOrder?.tableId && t.status === 'ocupada' && t.activeOrder)}
          selectedOrder={selectedOrder}
          onSelect={confirmMoveItem}
          onClose={() => { setShowMoveTablePicker(false); setMovingItemId(null) }}
        />
      )}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        tables={tables}
        menu={menu}
        selectedOrder={selectedOrder}
        onOpenTable={openTable}
        onOpenPayment={() => setShowPayment(true)}
        onPrintBill={handlePrintBill}
        onRepeatLast={handleRepeatLastOrder}
        onSearchProduct={(sku) => { setSearchQuery(sku); setSelectedCategory(null) }}
      />
    </div>
  )
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

function elapsedTime(date: Date): string {
  const ms = Date.now() - date.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function QuickModifyModal({
  item, notes, onNotesChange, qty, onQtyChange, seat, course,
  onSubmit, onClose,
}: {
  item: MenuItem
  notes: string; onNotesChange: (v: string) => void
  qty: number; onQtyChange: (v: number) => void
  seat: number; course: number
  onSubmit: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[350] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-800 border border-zinc-600 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-zinc-100">{item.name}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 text-xl leading-none">&times;</button>
        </div>

        {/* Quantity */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-zinc-400 mb-1 block">Cantidad</label>
          <div className="flex items-center gap-2">
            <button onClick={() => onQtyChange(Math.max(1, qty - 1))}
              className="h-9 w-9 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-lg font-bold">−</button>
            <span className="text-lg font-bold text-zinc-100 w-8 text-center">{qty}</span>
            <button onClick={() => onQtyChange(qty + 1)}
              className="h-9 w-9 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-lg font-bold">+</button>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="text-[11px] font-semibold text-zinc-400 mb-1 block">
            Notas <span className="text-zinc-600">(sin cebolla, término medio…)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Ej: sin cebolla, término medio"
            className="w-full h-9 px-3 bg-zinc-700 border border-zinc-600 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
            autoFocus
          />
        </div>

        {/* Context info */}
        <div className="flex gap-3 mb-4 text-[11px] text-zinc-500">
          <span>Seat {seat}</span>
          <span>·</span>
          <span>Curso {course}</span>
          <span>·</span>
          <span>{formatCOP(item.price * qty)}</span>
        </div>

        <button
          onClick={onSubmit}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl text-sm font-extrabold transition-all"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

function MoveTablePicker({
  tables, selectedOrder, onSelect, onClose,
}: {
  tables: PosTable[]
  selectedOrder: Order | null
  onSelect: (tableId: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[350] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-800 border border-zinc-600 rounded-2xl p-5 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-zinc-100">Mover a mesa</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 text-xl leading-none">&times;</button>
        </div>
        {tables.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No hay otras mesas con comandas activas</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-auto">
            {tables.map(t => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="w-full p-3 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold text-zinc-100">Mesa {t.number}</div>
                  <div className="text-[11px] text-zinc-400">{t.activeOrder?.orderNumber}</div>
                </div>
                <span className="text-xs font-bold text-zinc-300">
                  {t.activeOrder ? formatCOP(t.activeOrder.total) : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
