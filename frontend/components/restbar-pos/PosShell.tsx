'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { getRestbarSocket, disconnectRestbarSocket } from '@/lib/socket'
import { PosTopBar } from './PosTopBar'
import { PosToolRail } from './PosToolRail'
import { MenuGrid } from './MenuGrid'
import { CategoryTabs } from './CategoryTabs'
import { OrderTicket } from './OrderTicket'
import { PaymentModal } from './PaymentModal'

export interface PosTable {
  id: string
  number: string
  capacity: number
  area: string | null
  status: string
  activeOrder?: { id: string; orderNumber: string; total: number; itemsCount: number } | null
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
  const [tables, setTables] = useState<PosTable[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSeat, setActiveSeat] = useState(1)
  const [activeCourse, setActiveCourse] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [showTableMap, setShowTableMap] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [pendingQuantity, setPendingQuantity] = useState<number | null>(null)
  const [pendingPrice, setPendingPrice] = useState<number | null>(null)
  const [sentItemIds, setSentItemIds] = useState<Set<string>>(new Set())

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
    if (table.activeOrder?.id) {
      await loadOrder(table.activeOrder.id)
      return
    }
    const r = await api.createRestbarOrder({ tableId, guestsCount: table.capacity })
    if (r.success) {
      await loadOrder(r.data.id)
      await loadData()
    } else {
      toast.error(r.error ?? 'No se pudo abrir la mesa')
    }
  }

  const handleAddItem = async (menuItem: MenuItem) => {
    if (!selectedOrder) return
    const qty = pendingQuantity ?? 1
    const notes = ''
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
    } else {
      toast.error(r.error ?? 'Error al agregar')
    }
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
  }

  const handleSendArea = async (area: 'cocina' | 'bar') => {
    if (!selectedOrder) return
    const itemsToSend = (selectedOrder.items || [])
      .filter((i: OrderItem) => i.status === 'pendiente' && !i.sentToKitchenAt)
      .filter((i: OrderItem) => i.preparationArea === area || i.preparationArea === 'ambos')
    if (itemsToSend.length === 0) {
      toast.error(`No hay ítems pendientes para ${area}`)
      return
    }
    await api.sendRestbarOrderToKitchen(selectedOrder.id, itemsToSend.map((i: OrderItem) => i.id))
    await loadOrder(selectedOrder.id)
    toast.success(`Enviado a ${area}`)
  }

  const handlePrintBill = async () => {
    if (!selectedOrder) return
    const r = await api.printRestbarBill(selectedOrder.id)
    if (r.success) toast.success('Pre-cuenta impresa')
    else toast.error(r.error ?? 'Error al imprimir')
  }

  const handleDuplicate = async (itemId: string) => {
    if (!selectedOrder) return
    await api.duplicateRestbarOrderItem(selectedOrder.id, itemId)
    await loadOrder(selectedOrder.id)
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) { next.delete(itemId) } else { next.add(itemId) }
      return next
    })
  }

  const handlePay = async (data: { paymentMethod: string; amountPaid: number; guestNumber?: number | null }) => {
    if (!selectedOrder) return
    const r = await api.payRestbarOrder(selectedOrder.id, data)
    if (r.success) {
      toast.success('Pago procesado')
      await loadOrder(selectedOrder.id)
      await loadData()
      if (r.data.closed) {
        toast.success('Comanda cerrada')
        setSelectedOrder(null)
      }
    } else {
      toast.error(r.error ?? 'Error al procesar pago')
    }
  }

  const filteredMenu = menu.filter(item => {
    if (selectedCategory && item.category !== selectedCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const name = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const sku = (item.sku ?? '').toLowerCase()
      return name.includes(q) || sku.includes(q) || item.name.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  const categories = Array.from(new Set(menu.map(m => m.category).filter(Boolean)))
  const categoryCounts: Record<string, number> = {}
  menu.forEach(m => { if (m.category) categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1 })

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
        onOpenTableMap={() => setShowTableMap(true)}
        selectedOrder={selectedOrder}
        selectedCount={selectedItems.size}
        onSendSelected={() => handleSendSelected()}
      />
      <div className="flex-1 flex min-h-0">
        <PosToolRail
          pendingQuantity={pendingQuantity}
          onSetQuantity={(q) => { setPendingQuantity(q); setPendingPrice(null) }}
          onSetPrice={(p) => setPendingPrice(p)}
          activeSeat={activeSeat}
          onSetSeat={setActiveSeat}
          activeCourse={activeCourse}
          onSetCourse={setActiveCourse}
          onClearPending={() => { setPendingQuantity(null); setPendingPrice(null) }}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <MenuGrid
            items={filteredMenu}
            onItemClick={handleAddItem}
            seat={activeSeat}
            course={activeCourse}
          />
        </div>
        <OrderTicket
          order={selectedOrder}
          selectedItems={selectedItems}
          onToggleItem={toggleItemSelection}
          onUpdateQty={handleUpdateItemQty}
          onRemoveItem={handleRemoveItem}
          onDuplicate={handleDuplicate}
          sentItems={sentItemIds}
        />
      </div>
      <CategoryTabs
        categories={categories}
        categoryCounts={categoryCounts}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
      {showPayment && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          onPay={handlePay}
          onClose={() => setShowPayment(false)}
        />
      )}
      {showTableMap && (
        <TableMapModal tables={tables} onSelect={openTable} onClose={() => setShowTableMap(false)} />
      )}
    </div>
  )
}

function TableMapModal({ tables, onSelect, onClose }: { tables: PosTable[]; onSelect: (id: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[250] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Mesas</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 text-2xl leading-none">&times;</button>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
          {tables.filter(t => t.status !== 'inactiva').map(t => {
            const colorMap: Record<string, string> = {
              libre: 'border-green-500/40 bg-green-500/10 text-green-400',
              ocupada: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
              reservada: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
            }
            return (
              <button key={t.id}
                onClick={() => onSelect(t.id)}
                className={`p-3 rounded-xl border text-center text-sm font-medium transition-all
                  ${colorMap[t.status] || 'border-zinc-700 bg-zinc-800 text-zinc-400'}
                  hover:scale-105 hover:brightness-125`}
              >
                <div className="text-xs opacity-70">{t.area || 'Mesa'}</div>
                <div className="text-lg font-bold">{t.number}</div>
                <div className="text-xs opacity-70">{t.capacity}p</div>
                {t.activeOrder && (
                  <div className="mt-1 text-[10px] bg-black/30 rounded px-1 py-0.5">
                    {formatCOP(t.activeOrder.total)}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
