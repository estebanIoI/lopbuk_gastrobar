'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MiniMap } from '@/components/MiniMap'
import { OrdersMap, type OrderPoint } from '@/components/OrdersMap'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  ClipboardList,
  Search,
  RefreshCw,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Eye,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  DollarSign,
  AlertCircle,
  Receipt,
  FileText,
  TriangleAlert,
  Map,
  List,
  Navigation,
} from 'lucide-react'

interface OrderItem {
  id: number
  productId: string | null
  productName: string
  productImage: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  size: string | null
  color: string | null
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  customerCedula: string | null
  department: string | null
  municipality: string | null
  address: string | null
  neighborhood: string | null
  notes: string | null
  subtotal: number
  shippingCost: number
  discount: number
  total: number
  status: 'pendiente' | 'confirmado' | 'preparando' | 'enviado' | 'entregado' | 'cancelado'
  paymentMethod: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  deliveryDriverId?: string | null
  deliveryStatus?: string | null
  deliveryLatitude?: number | null
  deliveryLongitude?: number | null
  driverName?: string | null
}

interface OrderStats {
  totalOrders: number
  pending: number
  confirmed: number
  preparing: number
  shipped: number
  delivered: number
  cancelled: number
  totalRevenue: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
  preparando: { label: 'Preparando', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Package },
  enviado: { label: 'Enviado', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Truck },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
}

const STATUS_FLOW = ['pendiente', 'confirmado', 'preparando', 'enviado', 'entregado']

export function Pedidos() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [drivers, setDrivers] = useState<{ id: string; name: string; email: string }[]>([])
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null)

  // Custom modal state (replaces window.confirm / window.alert)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; type: 'entregado' | 'cancelado'; orderId: string
  }>({ open: false, type: 'entregado', orderId: '' })
  const [successModal, setSuccessModal] = useState<{
    open: boolean; invoiceNumber: string
  }>({ open: false, invoiceNumber: '' })

  // Fetch drivers list
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const result = await api.getDriversList()
        if (result.success && result.data) {
          setDrivers(result.data)
        }
      } catch (e) {
        console.error('Error fetching drivers:', e)
      }
    }
    fetchDrivers()
  }, [])

  const assignDriverToOrder = async (orderId: string, driverId: string) => {
    setAssigningOrderId(orderId)
    try {
      const result = await api.assignDriver(orderId, driverId)
      if (result.success) {
        const driver = drivers.find(d => d.id === driverId)
        setOrders(prev =>
          prev.map(o => o.id === orderId ? {
            ...o,
            deliveryDriverId: driverId,
            deliveryStatus: 'asignado',
            driverName: driver?.name || null,
          } : o)
        )
      }
    } catch (e) {
      console.error('Error assigning driver:', e)
    } finally {
      setAssigningOrderId(null)
    }
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, limit: 20 }
      if (statusFilter !== 'all') params.status = statusFilter
      if (searchQuery) params.search = searchQuery

      const [ordersResult, statsResult] = await Promise.all([
        api.getOrders(params),
        api.getOrderStats(),
      ])

      if (ordersResult.success && ordersResult.data) {
        setOrders(ordersResult.data.orders || [])
        setTotalPages(ordersResult.data.pagination?.pages || 1)
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchQuery])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const doUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId)
    try {
      const result = await api.updateOrderStatus(orderId, newStatus)
      if (result.success) {
        const invoiceNumber = result.data?.invoiceNumber
        setOrders(prev =>
          prev.map(o => (o.id === orderId ? {
            ...o,
            status: newStatus as Order['status'],
            paymentMethod: invoiceNumber ? `Factura: ${invoiceNumber}` : o.paymentMethod
          } : o))
        )
        const statsResult = await api.getOrderStats()
        if (statsResult.success && statsResult.data) setStats(statsResult.data)
        if (invoiceNumber) {
          setSuccessModal({ open: true, invoiceNumber })
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const updateStatus = (orderId: string, newStatus: string) => {
    if (newStatus === 'entregado' || newStatus === 'cancelado') {
      setConfirmModal({ open: true, type: newStatus as 'entregado' | 'cancelado', orderId })
      return
    }
    doUpdateStatus(orderId, newStatus)
  }

  const mapPoints = useMemo<OrderPoint[]>(() =>
    orders
      .filter(o => o.deliveryLatitude != null && o.deliveryLongitude != null)
      .map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        address: o.address || '',
        municipality: o.municipality || '',
        neighborhood: o.neighborhood || null,
        status: o.status,
        total: o.total,
        latitude: Number(o.deliveryLatitude),
        longitude: Number(o.deliveryLongitude),
      })),
    [orders]
  )

  const getNextStatus = (current: string): string | null => {
    const idx = STATUS_FLOW.indexOf(current)
    if (idx >= 0 && idx < STATUS_FLOW.length - 1) return STATUS_FLOW[idx + 1]
    return null
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

  // Mensaje de confirmación al cliente por WhatsApp, según el estado del pedido.
  const confirmWhatsApp = (order: Order) => {
    // Normaliza a formato internacional para que wa.me resuelva el chat correcto.
    // Colombia: si llega un móvil de 10 dígitos sin indicativo (empieza por 3), antepone 57.
    let phone = order.customerPhone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = phone.replace(/^0+/, '')
    if (phone.length === 10 && phone.startsWith('3')) phone = '57' + phone
    const statusLine: Record<string, string> = {
      pendiente: 'Recibimos tu pedido y lo estamos confirmando. ✅',
      confirmado: '¡Tu pedido fue confirmado! Ya lo estamos preparando. 👨‍🍳',
      preparando: 'Tu pedido se está preparando. 👨‍🍳',
      enviado: '¡Tu pedido va en camino! 🛵',
      entregado: '¡Tu pedido fue entregado! Gracias por tu compra. 🙌',
      cancelado: 'Lamentamos informarte que tu pedido fue cancelado. Escríbenos si tienes dudas.',
    }
    const lines = [
      `¡Hola ${order.customerName}! 👋`,
      statusLine[order.status] || 'Te escribimos sobre tu pedido.',
      '',
      `*Pedido #${order.orderNumber}*`,
      ...order.items.map(it => `• ${it.quantity}× ${it.productName} — ${formatCurrency(it.totalPrice)}`),
      '',
      `*Total: ${formatCurrency(order.total)}*`,
      order.address ? `Entrega: ${order.address}` : '',
      order.paymentMethod ? `Pago: ${order.paymentMethod}` : '',
    ].filter(Boolean)
    const text = encodeURIComponent(lines.join('\n'))
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank')
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    // Hora de Colombia explícita (la fecha viene en UTC desde el backend).
    return d.toLocaleDateString('es-CO', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Bogota',
    })
  }

  function printOrderTicket(order: Order) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Factura Pedido #${order.orderNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; }
        .header { font-size: 1.3em; font-weight: bold; margin-bottom: 8px; }
        .subheader { font-size: 1em; margin-bottom: 8px; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .table th, .table td { border: 1px solid #ccc; padding: 6px 8px; font-size: 0.95em; }
        .table th { background: #f5f5f5; }
        .totals { margin-top: 12px; }
        .totals td { font-weight: bold; }
        .footer { margin-top: 24px; font-size: 0.9em; color: #888; }
      </style>
      </head><body>
        <div class='header'>PERFUM MUA - Factura Pedido #${order.orderNumber}</div>
        <div class='subheader'>Fecha: ${new Date(order.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>
        <div class='subheader'>Cliente: ${order.customerName} (${order.customerPhone})</div>
        <div class='subheader'>Dirección: ${order.address || ''} ${order.department || ''} ${order.municipality || ''} ${order.neighborhood ? 'Barrio: ' + order.neighborhood : ''}</div>
        <table class='table'>
          <tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr>
          ${order.items.map(item => `<tr>
            <td>${item.productName}${item.size ? ' / ' + item.size : ''}${item.color ? ' / ' + item.color : ''}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(item.totalPrice)}</td>
          </tr>`).join('')}
        </table>
        <table class='totals'>
          <tr><td>Subtotal:</td><td>${formatCurrency(order.subtotal)}</td></tr>
          ${order.shippingCost > 0 ? `<tr><td>Envío:</td><td>${formatCurrency(order.shippingCost)}</td></tr>` : ''}
          ${order.discount > 0 ? `<tr><td>Descuento:</td><td>- ${formatCurrency(order.discount)}</td></tr>` : ''}
          <tr><td>Total:</td><td>${formatCurrency(order.total)}</td></tr>
        </table>
        ${order.notes ? `<div class='footer'>Notas: ${order.notes}</div>` : ''}
        <div class='footer'>Gracias por tu compra. <br/>PERFUM MUA</div>
        <script>window.print();</script>
      </body></html>
    `)
  }

  function printAllOrderTickets(orders: Order[]) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write('<html><head><title>Facturas Pedidos</title><style>body{font-family:Arial,sans-serif;margin:24px;} .header{font-size:1.3em;font-weight:bold;margin-bottom:8px;} .subheader{font-size:1em;margin-bottom:8px;} .table{width:100%;border-collapse:collapse;margin-bottom:16px;} .table th,.table td{border:1px solid #ccc;padding:6px 8px;font-size:0.95em;} .table th{background:#f5f5f5;} .totals{margin-top:12px;} .totals td{font-weight:bold;} .footer{margin-top:24px;font-size:0.9em;color:#888;} .pagebreak{page-break-after:always;}</style></head><body>')
    orders.forEach((order, idx) => {
      win.document.write(`
        <div class='header'>PERFUM MUA - Factura Pedido #${order.orderNumber}</div>
        <div class='subheader'>Fecha: ${new Date(order.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>
        <div class='subheader'>Cliente: ${order.customerName} (${order.customerPhone})</div>
        <div class='subheader'>Dirección: ${order.address || ''} ${order.department || ''} ${order.municipality || ''} ${order.neighborhood ? 'Barrio: ' + order.neighborhood : ''}</div>
        <table class='table'>
          <tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr>
          ${order.items.map(item => `<tr>
            <td>${item.productName}${item.size ? ' / ' + item.size : ''}${item.color ? ' / ' + item.color : ''}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(item.totalPrice)}</td>
          </tr>`).join('')}
        </table>
        <table class='totals'>
          <tr><td>Subtotal:</td><td>${formatCurrency(order.subtotal)}</td></tr>
          ${order.shippingCost > 0 ? `<tr><td>Envío:</td><td>${formatCurrency(order.shippingCost)}</td></tr>` : ''}
          ${order.discount > 0 ? `<tr><td>Descuento:</td><td>- ${formatCurrency(order.discount)}</td></tr>` : ''}
          <tr><td>Total:</td><td>${formatCurrency(order.total)}</td></tr>
        </table>
        ${order.notes ? `<div class='footer'>Notas: ${order.notes}</div>` : ''}
        <div class='footer'>Gracias por tu compra. <br/>PERFUM MUA</div>
        <div class='pagebreak'></div>
      `)
    })
    win.document.write('<script>window.print();</script></body></html>')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Pedidos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona los pedidos recibidos desde tu tienda online
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'map'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Map className="h-3.5 w-3.5" /> Mapa
              {mapPoints.length > 0 && (
                <span className="ml-0.5 bg-primary/15 text-primary rounded-full px-1.5 text-[10px] font-bold">
                  {mapPoints.length}
                </span>
              )}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Pendientes', value: stats.pending, color: 'text-yellow-600' },
            { label: 'Confirmados', value: stats.confirmed, color: 'text-blue-600' },
            { label: 'Preparando', value: stats.preparing, color: 'text-purple-600' },
            { label: 'Enviados', value: stats.shipped, color: 'text-indigo-600' },
            { label: 'Entregados', value: stats.delivered, color: 'text-green-600' },
            { label: 'Cancelados', value: stats.cancelled, color: 'text-red-600' },
            { label: 'Ingresos', value: formatCurrency(stats.totalRevenue || 0), color: 'text-primary', isRevenue: true },
          ].map((s, i) => (
            <Card key={i} className={(s as any).isRevenue ? 'col-span-2 sm:col-span-4 lg:col-span-1' : ''}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`font-bold truncate ${(s as any).isRevenue ? 'text-sm' : 'text-lg'} ${s.color}`}>
                  {s.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, teléfono o # pedido..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full sm:w-auto"
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="preparando">Preparando</option>
              <option value="enviado">Enviado</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Print Button */}
      {orders.length > 0 && viewMode === 'list' && (
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="default" onClick={() => printAllOrderTickets(orders)}>
            <FileText className="h-4 w-4 mr-2" /> Imprimir todos los tickets
          </Button>
        </div>
      )}

      {/* ── MAP VIEW ── */}
      {viewMode === 'map' && (
        <div className="space-y-4">
          <OrdersMap
            orders={mapPoints}
            height={520}
            focusOrderId={focusOrderId}
          />

          {/* Orders without coordinates */}
          {orders.filter(o => !o.deliveryLatitude).length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Sin ubicación exacta ({orders.filter(o => !o.deliveryLatitude).length})
                  <span className="text-xs font-normal">— pedidos sin coordenadas GPS</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="space-y-2">
                  {orders.filter(o => !o.deliveryLatitude).map(order => {
                    const statusConfig = STATUS_CONFIG[order.status]
                    return (
                      <div key={order.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/40 text-sm">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusConfig?.color}`}>
                          {statusConfig?.label}
                        </span>
                        <span className="font-medium shrink-0">{order.orderNumber}</span>
                        <span className="text-muted-foreground truncate">{order.customerName}</span>
                        {order.address && (
                          <span className="text-muted-foreground/60 text-xs truncate hidden sm:block">
                            {order.address}, {order.municipality}
                          </span>
                        )}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address || ''} ${order.municipality || ''}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto shrink-0"
                        >
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            <Navigation className="h-3 w-3 mr-1" /> Buscar
                          </Button>
                        </a>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No hay pedidos</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Los pedidos de tu tienda online aparecerán aquí
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const isExpanded = expandedOrderId === order.id
            const statusConfig = STATUS_CONFIG[order.status]
            const StatusIcon = statusConfig?.icon || Clock
            const nextStatus = getNextStatus(order.status)
            const isUpdating = updatingOrderId === order.id

            return (
              <Card key={order.id} className="overflow-hidden">
                {/* Order Header */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{order.orderNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig?.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig?.label}
                      </span>
                      {order.deliveryStatus && order.deliveryStatus !== 'sin_asignar' && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.deliveryStatus === 'entregado' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          order.deliveryStatus === 'en_camino' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' :
                          order.deliveryStatus === 'recogido' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                          'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}>
                          <Truck className="h-3 w-3" />
                          {order.deliveryStatus === 'asignado' ? 'Asignado' : order.deliveryStatus === 'recogido' ? 'Recogido' : order.deliveryStatus === 'en_camino' ? 'En camino' : 'Entregado'}
                          {order.driverName && ` — ${order.driverName}`}
                        </span>
                      )}
                      {order.status === 'entregado' && order.paymentMethod?.startsWith('Factura:') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          <Receipt className="h-3 w-3" />
                          {order.paymentMethod}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 min-w-0">
                        <User className="h-3 w-3 flex-shrink-0" /> <span className="truncate max-w-[120px] sm:max-w-none">{order.customerName}</span>
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Phone className="h-3 w-3" /> {order.customerPhone}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 max-w-[100px] sm:max-w-none">
                    <p className="font-bold text-primary text-sm sm:text-base">{formatCurrency(order.total)}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{formatDate(order.createdAt)}</p>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t p-4 space-y-4 bg-muted/30">
                    {/* Customer Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-1">
                          <User className="h-4 w-4" /> Datos del Cliente
                        </h4>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">Nombre:</span> {order.customerName}</p>
                          <p className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" /> {order.customerPhone}
                          </p>
                          {order.customerEmail && (
                            <p className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" /> {order.customerEmail}
                            </p>
                          )}
                          {order.customerCedula && (
                            <p><span className="text-muted-foreground">Cédula:</span> {order.customerCedula}</p>
                          )}
                        </div>
                      </div>

                      {(order.department || order.address) && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-1">
                            <MapPin className="h-4 w-4" /> Dirección de Envío
                          </h4>
                          <div className="text-sm space-y-1">
                            {order.department && (
                              <p>{order.department}{order.municipality ? `, ${order.municipality}` : ''}</p>
                            )}
                            {order.address && <p>{order.address}</p>}
                            {order.neighborhood && <p>Barrio: {order.neighborhood}</p>}
                          </div>
                          {order.deliveryLatitude && order.deliveryLongitude ? (
                            <div className="space-y-2 mt-2">
                              <MiniMap
                                latitude={order.deliveryLatitude}
                                longitude={order.deliveryLongitude}
                                height={160}
                              />
                              <div className="flex gap-2">
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1"
                                >
                                  <Button size="sm" variant="outline" className="w-full text-xs">
                                    <Navigation className="h-3.5 w-3.5 mr-1.5" /> Ver ruta en Google Maps
                                  </Button>
                                </a>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs"
                                  onClick={() => {
                                    setViewMode('map')
                                    setFocusOrderId(order.id)
                                  }}
                                >
                                  <Map className="h-3.5 w-3.5 mr-1.5" /> Ver en mapa general
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address || ''} ${order.municipality || ''}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline" className="w-full text-xs mt-1">
                                <Navigation className="h-3.5 w-3.5 mr-1.5" /> Buscar dirección en Google Maps
                              </Button>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Driver Assignment */}
                    {order.status !== 'cancelado' && order.status !== 'entregado' && drivers.length > 0 && (
                      <div className="rounded-lg border p-3 bg-muted/20">
                        <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                          <Truck className="h-4 w-4" /> Repartidor
                        </h4>
                        {order.deliveryDriverId && order.driverName ? (
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{order.driverName}</span>
                            <select
                              className="text-xs border rounded px-2 py-1 bg-background"
                              value={order.deliveryDriverId}
                              onChange={e => assignDriverToOrder(order.id, e.target.value)}
                              disabled={assigningOrderId === order.id}
                            >
                              {drivers.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              className="text-sm border rounded px-2 py-1.5 bg-background flex-1"
                              defaultValue=""
                              onChange={e => { if (e.target.value) assignDriverToOrder(order.id, e.target.value) }}
                              disabled={assigningOrderId === order.id}
                            >
                              <option value="" disabled>Asignar repartidor...</option>
                              {drivers.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            {assigningOrderId === order.id && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Order Items */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                        <Package className="h-4 w-4" /> Productos ({order.items?.length || 0})
                      </h4>
                      <div className="space-y-2">
                        {order.items?.map(item => (
                          <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                            {item.productImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.productImage}
                                alt={item.productName}
                                className="h-12 w-12 rounded object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.productName}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatCurrency(item.unitPrice)} × {item.quantity}</span>
                                {item.size && <Badge variant="outline" className="text-[10px] px-1">{item.size}</Badge>}
                                {item.color && <Badge variant="outline" className="text-[10px] px-1">{item.color}</Badge>}
                              </div>
                            </div>
                            <span className="font-medium text-sm">{formatCurrency(item.totalPrice)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="w-full sm:w-64 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatCurrency(order.subtotal)}</span>
                        </div>
                        {order.shippingCost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Envío</span>
                            <span>{formatCurrency(order.shippingCost)}</span>
                          </div>
                        )}
                        {order.discount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Descuento</span>
                            <span>-{formatCurrency(order.discount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t pt-1">
                          <span>Total</span>
                          <span className="text-primary">{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="rounded-lg border p-3 bg-yellow-50 dark:bg-yellow-900/10">
                        <p className="text-sm flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span><span className="font-medium">Notas:</span> {order.notes}</span>
                        </p>
                      </div>
                    )}

                    {/* Invoice info for delivered orders */}
                    {order.status === 'entregado' && order.paymentMethod?.startsWith('Factura:') && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 p-3">
                        <p className="text-sm flex items-start gap-2">
                          <FileText className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span>
                            <span className="font-medium">Venta registrada:</span> {order.paymentMethod} — Esta venta aparece en tu historial de ventas y el stock fue descontado del inventario.
                          </span>
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                      {/* Print Ticket Button */}
                      <Button size="sm" variant="outline" onClick={() => printOrderTicket(order)}>
                        <FileText className="h-4 w-4 mr-2" /> Generar Ticket
                      </Button>
                      {nextStatus && order.status !== 'cancelado' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(order.id, nextStatus)}
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Marcar como {STATUS_CONFIG[nextStatus]?.label}
                        </Button>
                      )}
                      {order.status !== 'cancelado' && order.status !== 'entregado' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateStatus(order.id, 'cancelado')}
                          disabled={isUpdating}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar pedido
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => confirmWhatsApp(order)}>
                        <Phone className="h-4 w-4 mr-2" />
                        Confirmar por WhatsApp
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      ))}

      {/* Modal confirmación: Entregado / Cancelado */}
      <Dialog open={confirmModal.open} onOpenChange={open => !open && setConfirmModal(m => ({ ...m, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className={`h-5 w-5 ${confirmModal.type === 'cancelado' ? 'text-destructive' : 'text-amber-500'}`} />
              {confirmModal.type === 'entregado' ? 'Confirmar entrega' : 'Cancelar pedido'}
            </DialogTitle>
            <DialogDescription asChild>
              {confirmModal.type === 'entregado' ? (
                <div className="space-y-3 pt-1">
                  <p className="text-sm text-muted-foreground">Al marcar como <strong>ENTREGADO</strong> se generará automáticamente:</p>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary shrink-0" /> Una factura de venta en el sistema</li>
                    <li className="flex items-center gap-2"><Package className="h-4 w-4 text-primary shrink-0" /> Se descontará el stock del inventario</li>
                    <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary shrink-0" /> Se registrará en el historial de ventas</li>
                  </ul>
                  <p className="text-sm font-medium">¿Deseas continuar?</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground pt-1">¿Estás seguro de cancelar este pedido? Esta acción no se puede deshacer.</p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmModal(m => ({ ...m, open: false }))}>
              Cancelar
            </Button>
            <Button
              variant={confirmModal.type === 'cancelado' ? 'destructive' : 'default'}
              onClick={() => {
                const { orderId, type } = confirmModal
                setConfirmModal(m => ({ ...m, open: false }))
                doUpdateStatus(orderId, type)
              }}
            >
              {confirmModal.type === 'entregado' ? 'Sí, marcar como entregado' : 'Sí, cancelar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal éxito: factura generada */}
      <Dialog open={successModal.open} onOpenChange={open => !open && setSuccessModal(m => ({ ...m, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Pedido entregado exitosamente
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-sm">
                  <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Factura generada: <strong>{successModal.invoiceNumber}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Stock descontado del inventario</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">Puedes ver esta venta en el módulo de Historial.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSuccessModal(m => ({ ...m, open: false }))}>
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
