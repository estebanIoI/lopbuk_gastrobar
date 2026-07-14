'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, getStockStatus } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { useCashStore } from '@/lib/cash-store'
import { useTourStore } from '@/lib/tour-store'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { SectionRenderer } from '@/components/section-renderer'
import { NotificationsBell } from '@/components/notifications-bell'
import { SalesTrendChart } from '@/components/sales-trend-chart'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  Home, Package, ShoppingCart, Store, Users, TrendingUp, Settings,
  Search, Bell, LogOut, ChevronDown, AlertTriangle, ShoppingBag,
  FlaskConical, Truck, Receipt, History, CalendarDays, Ticket, Star,
  Scissors, CreditCard, UserCheck, Printer, ArrowRight, Boxes, PieChart,
  HelpCircle, UtensilsCrossed, Trash2, Wine, ClipboardList, Network, FileSpreadsheet, Gauge, Layers,
} from 'lucide-react'

// ──────────────────────────────────────────────────────────────
// Navegación del tema: cada item mapea a una sección real (activeSection)
// ──────────────────────────────────────────────────────────────
type NavLeaf = { id: string; label: string; icon?: React.ElementType; adminOnly?: boolean; warehouse?: boolean }
type NavGroup = { key: string; label: string; icon: React.ElementType; adminOnly?: boolean; warehouse?: boolean; id?: string; children?: NavLeaf[] }

const NAV: NavGroup[] = [
  { key: 'home', label: 'Inicio', icon: Home, id: 'dashboard', warehouse: true },
  {
    key: 'inventario', label: 'Inventario', icon: Package, adminOnly: true, warehouse: true, children: [
      { id: 'inventory', label: 'Inventario', icon: Boxes, adminOnly: true, warehouse: true },
      { id: 'recipes', label: 'Recetas BOM', icon: FlaskConical, adminOnly: true, warehouse: true },
      { id: 'purchases', label: 'Compras y proveedores', icon: Truck, adminOnly: true, warehouse: true },
      { id: 'picking', label: 'Picking bodega', icon: ClipboardList, warehouse: true },
      { id: 'conteo', label: 'Conteo de inventario', icon: ClipboardList, adminOnly: true, warehouse: true },
    ],
  },
  {
    key: 'ventas', label: 'Ventas', icon: ShoppingCart, children: [
      { id: 'pos', label: 'Punto de venta', icon: ShoppingCart },
      { id: 'cotizaciones', label: 'Cotizaciones', icon: FileSpreadsheet },
      { id: 'cash-register', label: 'Caja', icon: CreditCard },
      { id: 'invoices', label: 'Facturación', icon: Receipt, adminOnly: true },
      { id: 'history', label: 'Historial', icon: History },
    ],
  },
  {
    key: 'gastrobar', label: 'Gastrobar', icon: UtensilsCrossed, children: [
      { id: 'restbar', label: 'Salón y comandas', icon: Wine },
      { id: 'combos', label: 'Combos por día', icon: Layers, adminOnly: true },
      { id: 'gastrobar-ops', label: 'Operación', icon: ClipboardList, adminOnly: true },
      { id: 'merma', label: 'Merma', icon: Trash2, adminOnly: true, warehouse: true },
    ],
  },
  {
    key: 'tienda', label: 'Tienda', icon: Store, adminOnly: true, children: [
      { id: 'tienda', label: 'Mi tienda', icon: Store, adminOnly: true },
      { id: 'pedidos', label: 'Pedidos', icon: ShoppingBag, adminOnly: true },
      { id: 'cupones', label: 'Cupones', icon: Ticket, adminOnly: true },
      { id: 'reviews', label: 'Reseñas', icon: Star, adminOnly: true },
      { id: 'services', label: 'Servicios', icon: Scissors, adminOnly: true },
    ],
  },
  {
    key: 'clientes', label: 'Clientes', icon: Users, adminOnly: true, children: [
      { id: 'customers', label: 'Clientes', icon: Users, adminOnly: true },
      { id: 'fiados', label: 'Fiados', icon: CreditCard, adminOnly: true },
      { id: 'vendedores', label: 'Empleados', icon: UserCheck, adminOnly: true },
      { id: 'organigrama', label: 'Jerarquía', icon: Network, adminOnly: true },
    ],
  },
  {
    key: 'reportes', label: 'Reportes', icon: TrendingUp, adminOnly: true, children: [
      { id: 'gerencia', label: 'Gerencia', icon: PieChart, adminOnly: true },
      { id: 'analytics', label: 'Análisis y reportes', icon: TrendingUp, adminOnly: true },
      { id: 'tiempos', label: 'Tiempos de operación', icon: Gauge, adminOnly: true },
      { id: 'finances', label: 'Finanzas', icon: PieChart, adminOnly: true },
    ],
  },
  {
    key: 'config', label: 'Configuración', icon: Settings, adminOnly: true, children: [
      { id: 'printers', label: 'Impresoras', icon: Printer, adminOnly: true },
      { id: 'settings', label: 'Configuración', icon: Settings, adminOnly: true },
    ],
  },
]

// Accesos rápidos (acciones frecuentes del día a día) — NO repiten lo de "Más herramientas"
const QUICK = [
  { id: 'pos', label: 'Nueva venta', icon: ShoppingCart },
  { id: 'restbar', label: 'Salón', icon: Wine },
  { id: 'cash-register', label: 'Caja', icon: CreditCard },
  { id: 'history', label: 'Historial', icon: History },
  { id: 'inventory', label: 'Inventario', icon: Package, adminOnly: true },
  { id: 'invoices', label: 'Facturación', icon: Receipt, adminOnly: true },
  { id: 'pedidos', label: 'Pedidos', icon: ShoppingBag, adminOnly: true },
  { id: 'analytics', label: 'Reportes', icon: TrendingUp, adminOnly: true },
]

// Accesos rápidos para el rol de bodega (auxiliar_bodega) — enfocados en stock
const QUICK_WAREHOUSE = [
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'purchases', label: 'Compras', icon: Truck },
  { id: 'recipes', label: 'Recetas (BOM)', icon: FlaskConical },
  { id: 'merma', label: 'Merma', icon: Trash2 },
]

// Más herramientas (funciones secundarias) — tarjeta lateral; no se repiten con los accesos rápidos
const MORE_TOOLS = [
  { id: 'purchases', label: 'Compras y proveedores', icon: Truck, adminOnly: true },
  { id: 'fiados', label: 'Fiados', icon: CreditCard, adminOnly: true },
  { id: 'tienda', label: 'Mi tienda online', icon: Store, adminOnly: true },
  { id: 'cupones', label: 'Cupones', icon: Ticket, adminOnly: true },
  { id: 'vendedores', label: 'Empleados', icon: UserCheck, adminOnly: true },
  { id: 'organigrama', label: 'Jerarquía', icon: Network, adminOnly: true },
  { id: 'gastrobar-ops', label: 'Operación gastrobar', icon: ClipboardList, adminOnly: true },
  { id: 'recipes', label: 'Recetas (BOM)', icon: FlaskConical, adminOnly: true },
  { id: 'settings', label: 'Configuración', icon: Settings, adminOnly: true },
]

export function PanelComercianteShell() {
  const {
    activeSection, setActiveSection, products, fetchProducts,
    pendingOrdersCount, fetchPendingOrdersCount, navigateToInventory, navigateToPedidos,
    storeInfo,
  } = useStore()
  const { user, logout } = useAuthStore()
  const { activeSession, fetchActiveSession } = useCashStore()
  const startTour = useTourStore(s => s.start)

  const isSuperadmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'comerciante' || user?.role === 'administrador_rb' || isSuperadmin
  const isWarehouse = user?.role === 'auxiliar_bodega'
  const role: 'admin' | 'warehouse' | 'sales' = isAdmin ? 'admin' : isWarehouse ? 'warehouse' : 'sales'

  const [metrics, setMetrics] = useState<any>(null)
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(0)
  const [receivable, setReceivable] = useState<number>(0)
  const [pendingReviews, setPendingReviews] = useState<number>(0)
  const [staleCashDate, setStaleCashDate] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifs, setShowNotifs] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  const isHome = activeSection === 'dashboard'

  // ── Datos reales ──
  // Productos siempre (stock + POS). Métricas y pedidos solo admin (datos de negocio);
  // bodega/vendedor derivan el stock desde los productos.
  useEffect(() => {
    fetchProducts()
    if (!isAdmin) return
    fetchPendingOrdersCount()
    api.getDashboardMetrics().then(r => {
      if (r.success && r.data) {
        setMetrics(r.data)
        setMonthlyRevenue(Number((r.data as any).monthlySales) || 0)
      }
    }).catch(() => {})
    api.getCreditsSummary().then(r => {
      if (r.success && r.data) setReceivable(Number((r.data as any).totalPending) || 0)
    }).catch(() => {})
    // Reseñas pendientes de revisar
    api.getReviews({ status: 'pendiente' }).then(r => {
      if (r.success && Array.isArray(r.data)) setPendingReviews(r.data.length)
    }).catch(() => {})
    // Caja sin cerrar: hay una sesión activa abierta en un día anterior a hoy
    fetchActiveSession().then(() => {})
    const t = setInterval(fetchPendingOrdersCount, 30_000)
    return () => clearInterval(t)
  }, [fetchProducts, fetchPendingOrdersCount, fetchActiveSession, isAdmin])

  useEffect(() => {
    if (!activeSession) { setStaleCashDate(null); return }
    const openedRaw = activeSession.openedAt
    if (openedRaw) {
      const d = new Date(openedRaw)
      if (!isNaN(d.getTime()) && d.toDateString() !== new Date().toDateString()) {
        setStaleCashDate(d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }))
        return
      }
    }
    setStaleCashDate(null)
  }, [activeSession])

  // ── Cerrar menús al hacer click fuera ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const lowStock = useMemo(() => products.filter(p => getStockStatus(p) === 'bajo').sort((a, b) => a.stock - b.stock), [products])
  const outOfStock = useMemo(() => products.filter(p => getStockStatus(p) === 'agotado'), [products])
  // "Requiere tu atención": agotados primero (más urgente), luego stock bajo.
  const attention = useMemo(() => [...outOfStock, ...lowStock].slice(0, 12), [outOfStock, lowStock])
  // Productos próximos a vencer (≤30 días, aún no vencidos y con stock)
  const expiring = useMemo(() => {
    const now = Date.now(), soon = now + 30 * 24 * 3600 * 1000
    return products.filter(p => {
      if (!(p as any).expiryDate || (p.stock ?? 0) <= 0) return false
      const t = new Date((p as any).expiryDate).getTime()
      return !isNaN(t) && t >= now && t <= soon
    })
  }, [products])
  const totalProducts = metrics?.totalProducts ?? products.length
  const lowStockCount = metrics?.lowStockProducts ?? lowStock.length
  const outOfStockCount = metrics?.outOfStockProducts ?? outOfStock.length
  // Los pedidos pendientes son tema de admin (ventas); bodega/vendedor solo ven stock.
  const alertCount = lowStockCount + outOfStockCount + (isAdmin ? Number(pendingOrdersCount || 0) : 0)

  // ── Filtrado por rol ──
  // admin: ve todo · bodega: solo lo marcado como warehouse · ventas: solo lo no-admin
  const canSee = (it?: { adminOnly?: boolean; warehouse?: boolean }) => {
    if (isAdmin) return true
    if (isWarehouse) return !!it?.warehouse
    return !it?.adminOnly
  }
  const visibleNav = NAV
    .filter(g => canSee(g))
    .map(g => ({ ...g, children: g.children?.filter(c => canSee(c)) }))
    .filter(g => g.id || (g.children && g.children.length > 0))
  const visibleQuick = isWarehouse ? QUICK_WAREHOUSE : QUICK.filter(q => canSee(q))
  const visibleMore = MORE_TOOLS.filter(m => canSee(m))

  const go = (id: string) => {
    setActiveSection(id)
    setOpenMenu(null)
    setShowNotifs(false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Alertas de "Requiere tu atención" agregando todos los servicios (según rol).
  // El stock (agotados/bajos) se muestra aparte como tarjetas.
  type AttnAlert = { key: string; icon: React.ElementType; label: string; tone: 'blue' | 'amber' | 'red' | 'green'; onClick: () => void }
  const alerts: AttnAlert[] = []
  if (isAdmin && Number(pendingOrdersCount) > 0) {
    alerts.push({ key: 'pedidos', icon: ShoppingBag, label: `${pendingOrdersCount} pedido(s) pendiente(s) por despachar`, tone: 'blue', onClick: () => navigateToPedidos() })
  }
  if (isAdmin && receivable > 0) {
    alerts.push({ key: 'fiados', icon: CreditCard, label: `Fiados por cobrar: ${formatCOP(receivable)}`, tone: 'amber', onClick: () => go('fiados') })
  }
  if ((isAdmin || isWarehouse) && expiring.length > 0) {
    alerts.push({ key: 'vence', icon: CalendarDays, label: `${expiring.length} producto(s) próximos a vencer`, tone: 'red', onClick: () => navigateToInventory(undefined, expiring[0]?.name) })
  }
  if (isAdmin && staleCashDate) {
    alerts.push({ key: 'caja', icon: AlertTriangle, label: `Caja sin cerrar desde el ${staleCashDate}`, tone: 'red', onClick: () => go('cash-register') })
  }
  if (isAdmin && pendingReviews > 0) {
    alerts.push({ key: 'reviews', icon: Star, label: `${pendingReviews} reseña(s) por revisar`, tone: 'green', onClick: () => go('reviews') })
  }

  const handleSearch = () => {
    if (searchQuery.trim()) navigateToInventory(undefined, searchQuery.trim())
  }

  // ¿Está activo un grupo? (cualquiera de sus hijos o su id)
  const groupActive = (g: NavGroup) =>
    g.id === activeSection || (g.children?.some(c => c.id === activeSection) ?? false)

  return (
    <div className="pc-theme">
      <style>{PC_STYLES}</style>

      {/* ── HEADER ── */}
      <header className="pc-header">
        <div className="pc-brand" onClick={() => go('dashboard')}>
          <div className="pc-logo-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/daimuz-icon.png" alt="Logo" onError={(e) => { (e.currentTarget.style.display = 'none') }} />
            <span className="pc-logo-fallback">{(storeInfo?.name || 'L').charAt(0).toUpperCase()}</span>
          </div>
          <div className="pc-brand-text">
            <div className="pc-brand-name">{storeInfo?.name || 'Lopbuk'}</div>
            <div className="pc-brand-sub">Panel del comerciante</div>
          </div>
        </div>

        <div className="pc-header-right">
          <div className="pc-search" data-tour="search">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Buscar productos en inventario…"
              aria-label="Buscar"
            />
            <button className="pc-search-btn" onClick={handleSearch} aria-label="Buscar"><Search size={16} /></button>
          </div>

          {/* Cambiar tema claro/oscuro — mismo switch animado del Tema 1 */}
          <ThemeSwitch size={18} />

          {/* Guía interactiva */}
          <button className="pc-guide-btn" data-tour="tour-guide-btn" onClick={() => startTour()} title="Ver guía de uso">
            <HelpCircle size={16} />
            <span>Guía</span>
          </button>

          {/* Notificaciones del comercio (comunidad, etc.) */}
          <NotificationsBell />

          {/* Alertas de stock */}
          <div className="pc-notif-wrap">
            <button className="pc-icon-btn" data-tour="notifications" onClick={() => setShowNotifs(v => !v)} aria-label="Alertas">
              <Bell size={18} />
              {alertCount > 0 && <span className="pc-badge">{alertCount}</span>}
            </button>
            {showNotifs && (
              <div className="pc-notif-panel">
                <div className="pc-notif-title">Notificaciones</div>
                {outOfStockCount > 0 && (
                  <button className="pc-notif-item" onClick={() => { navigateToInventory('agotado'); setShowNotifs(false) }}>
                    <span className="pc-dot pc-dot-red" /> {outOfStockCount} producto(s) agotado(s)
                  </button>
                )}
                {lowStockCount > 0 && (
                  <button className="pc-notif-item" onClick={() => { navigateToInventory('bajo'); setShowNotifs(false) }}>
                    <span className="pc-dot pc-dot-amber" /> {lowStockCount} con stock bajo
                  </button>
                )}
                {isAdmin && pendingOrdersCount > 0 && (
                  <button className="pc-notif-item" onClick={() => { navigateToPedidos(); setShowNotifs(false) }}>
                    <span className="pc-dot pc-dot-blue" /> {pendingOrdersCount} pedido(s) pendiente(s)
                  </button>
                )}
                {alertCount === 0 && <div className="pc-notif-empty">No hay alertas pendientes</div>}
              </div>
            )}
          </div>

          {/* Usuario */}
          <div className="pc-user">
            <div className="pc-avatar">{user?.name?.charAt(0).toUpperCase() ?? '?'}</div>
            <div className="pc-user-text">
              <div className="pc-user-name">{user?.name ?? '—'}</div>
              <div className="pc-user-role">{isSuperadmin ? 'Super Admin' : isAdmin ? 'Comerciante' : isWarehouse ? 'Bodega' : 'Vendedor'}</div>
            </div>
            <button className="pc-icon-btn pc-logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ── NAVBAR ── */}
      <nav className="pc-navbar" ref={navRef}>
        <div className="pc-navbar-inner">
          {visibleNav.map(g => {
            const GIcon = g.icon as React.ComponentType<{ className?: string; size?: number }>
            const active = groupActive(g)
            const hasChildren = g.children && g.children.length > 0
            return (
              <div
                key={g.key}
                className="pc-nav-cell"
                onMouseEnter={() => hasChildren && setOpenMenu(g.key)}
                onMouseLeave={() => hasChildren && setOpenMenu(prev => (prev === g.key ? null : prev))}
              >
                <button
                  className={`pc-nav-item ${active ? 'active' : ''}`}
                  data-tour={`navg-${g.key}`}
                  onClick={() => {
                    if (g.id) go(g.id)
                    else setOpenMenu(prev => (prev === g.key ? null : g.key))
                  }}
                >
                  <GIcon size={15} />
                  <span>{g.label}</span>
                  {hasChildren && <ChevronDown size={12} className="pc-chev" />}
                </button>
                {hasChildren && openMenu === g.key && (
                  <div className="pc-mega">
                    {g.children!.map(c => {
                      const CIcon = c.icon as React.ComponentType<{ className?: string; size?: number }> | undefined
                      return (
                        <button
                          key={c.id}
                          className={`pc-mega-item ${activeSection === c.id ? 'active' : ''}`}
                          onClick={() => go(c.id)}
                        >
                          {CIcon && <CIcon size={15} />}
                        <span>{c.label}</span>
                      </button>
                    )})}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* ── BANNER DE ALERTA (stock) ── */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="pc-alert" onClick={() => navigateToInventory(outOfStockCount > 0 ? 'agotado' : 'bajo')}>
          <AlertTriangle size={16} className="pc-alert-icon" />
          <span>
            <strong>Atención de inventario:</strong>{' '}
            {outOfStockCount > 0 && `${outOfStockCount} producto(s) agotado(s)`}
            {outOfStockCount > 0 && lowStockCount > 0 && ' · '}
            {lowStockCount > 0 && `${lowStockCount} con stock bajo`}.{' '}
            <span className="pc-alert-link">Revisar inventario →</span>
          </span>
        </div>
      )}

      {/* ── CONTENIDO ── */}
      {isHome ? (
        <HomeView
          go={go}
          quick={visibleQuick}
          more={visibleMore}
          role={role}
          stats={{ totalProducts, lowStockCount, outOfStockCount, pending: Number(pendingOrdersCount || 0), monthlyRevenue }}
          attention={attention}
          alerts={alerts}
          navigateToInventory={navigateToInventory}
        />
      ) : (
        <main className="pc-section">
          <SectionRenderer />
        </main>
      )}

      {/* ── FOOTER ── */}
      <footer className="pc-footer">
        <div className="pc-footer-grid">
          <div>
            <div className="pc-footer-brand">{storeInfo?.name || 'Lopbuk'}</div>
            <div className="pc-footer-addr">
              {storeInfo?.address || 'Plataforma de gestión empresarial'}<br />
              {storeInfo?.phone && <>Tel: {storeInfo.phone}<br /></>}
              {storeInfo?.email && <>{storeInfo.email}</>}
            </div>
          </div>
          <div>
            <div className="pc-footer-col-title">Gestión</div>
            {isAdmin && <button className="pc-footer-link" onClick={() => go('inventory')}>Inventario</button>}
            {isAdmin && <button className="pc-footer-link" onClick={() => go('purchases')}>Compras</button>}
            <button className="pc-footer-link" onClick={() => go('pos')}>Punto de venta</button>
            {isAdmin && <button className="pc-footer-link" onClick={() => go('analytics')}>Reportes</button>}
          </div>
          <div>
            <div className="pc-footer-col-title">Gastrobar</div>
            <button className="pc-footer-link" onClick={() => go('restbar')}>Salón y comandas</button>
            {isAdmin && <button className="pc-footer-link" onClick={() => go('gastrobar-ops')}>Operación</button>}
            {isAdmin && <button className="pc-footer-link" onClick={() => go('merma')}>Merma</button>}
            {isAdmin && <button className="pc-footer-link" onClick={() => go('tienda')}>Mi tienda</button>}
          </div>
          <div>
            <div className="pc-footer-col-title">Cuenta</div>
            {isAdmin && <button className="pc-footer-link" onClick={() => go('settings')}>Configuración</button>}
            <button className="pc-footer-link" onClick={logout}>Cerrar sesión</button>
          </div>
        </div>
        <div className="pc-footer-bottom">
          © {new Date().getFullYear()} {storeInfo?.name || 'Lopbuk'}. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Vista HOME (hero + accesos + stats + stock bajo)
// ──────────────────────────────────────────────────────────────
function HomeView({ go, quick, more, stats, attention, alerts, navigateToInventory, role }: {
  go: (id: string) => void
  quick: { id: string; label: string; icon: React.ElementType }[]
  more: { id: string; label: string; icon: React.ElementType }[]
  stats: { totalProducts: number; lowStockCount: number; outOfStockCount: number; pending: number; monthlyRevenue: number }
  attention: any[]
  alerts: { key: string; icon: React.ElementType; label: string; tone: 'blue' | 'amber' | 'red' | 'green'; onClick: () => void }[]
  navigateToInventory: (filter?: string, q?: string) => void
  role: 'admin' | 'warehouse' | 'sales'
}) {
  const isAdmin = role === 'admin'
  const isWarehouse = role === 'warehouse'
  return (
    <>
      {/* Encabezado según rol */}
      {isAdmin ? (
        <div className="pc-chart-wrap">
          <SalesTrendChart />
        </div>
      ) : isWarehouse ? (
        <div className="pc-welcome">
          <Boxes size={20} />
          <span>Tu inventario de un vistazo — revisa lo que necesita reabastecerse abajo.</span>
        </div>
      ) : (
        <div className="pc-welcome">
          <ShoppingCart size={20} />
          <span>¡Listo para vender! Usa los accesos rápidos de abajo para empezar.</span>
        </div>
      )}

      {/* ACCESOS RÁPIDOS */}
      <div className="pc-quick-head">Accesos rápidos</div>
      <div className="pc-quick">
        {quick.map(q => {
          const QIcon = q.icon as React.ComponentType<{ className?: string; size?: number }>
          return (
            <button key={q.id} className="pc-quick-item" onClick={() => go(q.id)}>
              <span className="pc-quick-icon"><QIcon size={18} /></span>
            <span className="pc-quick-label">{q.label}</span>
          </button>
        )})}
      </div>

      {/* MAIN GRID */}
      <div className={`pc-main ${role === 'sales' ? 'pc-main-solo' : ''}`}>
        {/* Columna izquierda: stock que requiere atención */}
        <div>
          <div className="pc-section-label">Requiere tu atención</div>

          {/* Alertas de servicios (pedidos, fiados, vencimientos…) */}
          {alerts.length > 0 && (
            <div className="pc-alerts">
              {alerts.map(a => {
                const AIcon = a.icon as React.ComponentType<{ className?: string; size?: number }>
                return (
                  <button key={a.key} className={`pc-alert-row ${a.tone}`} onClick={a.onClick}>
                    <AIcon size={16} className="pc-alert-ic" />
                  <span>{a.label}</span>
                  <ArrowRight size={14} className="pc-alert-go" />
                </button>
              )})}
            </div>
          )}

          {alerts.length === 0 && attention.length === 0 ? (
            <div className="pc-empty">
              <Package size={26} />
              <p>Todo en orden: sin agotados, stock bajo ni pendientes.</p>
            </div>
          ) : attention.length > 0 ? (
            <div className="pc-cards">
              {attention.slice(0, 6).map((p: any) => {
                const agotado = (p.stock ?? 0) <= 0
                return (
                  <button key={p.id} className="pc-card" onClick={() => navigateToInventory(agotado ? 'agotado' : 'bajo', p.name)}>
                    <div className={`pc-card-img ${agotado ? 'agotado' : ''}`}>
                      <Package size={22} />
                      <span className={`pc-card-badge ${agotado ? 'agotado' : ''}`}>{agotado ? 'Agotado' : `${p.stock} uds`}</span>
                    </div>
                    <div className="pc-card-body">
                      <div className={`pc-card-cat ${agotado ? 'agotado' : ''}`}>{agotado ? 'Agotado' : 'Stock bajo'}</div>
                      <div className="pc-card-title">{p.name}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
          {role === 'sales'
            ? <button className="pc-more-btn" onClick={() => go('pos')}>Ir al Punto de Venta →</button>
            : <button className="pc-more-btn" onClick={() => go('inventory')}>Ver todo el inventario →</button>}
        </div>

        {/* Sidebar derecha — admin (negocio) o bodega (stock). Ventas no tiene sidebar. */}
        {(isAdmin || isWarehouse) && (
          <aside className="pc-side">
            <div className="pc-side-card">
              <div className="pc-side-head"><PieChart size={14} /> {isWarehouse ? 'Resumen de stock' : 'Resumen del mes'}</div>
              <div className="pc-side-body">
                <div className="pc-stats">
                  <div className="pc-stat"><div className="pc-stat-num">{Number(stats.totalProducts).toLocaleString('es-CO')}</div><div className="pc-stat-lbl">Productos</div></div>
                  {isAdmin && <div className="pc-stat"><div className="pc-stat-num">{stats.pending}</div><div className="pc-stat-lbl">Pedidos pend.</div></div>}
                  <div className="pc-stat"><div className="pc-stat-num">{stats.lowStockCount}</div><div className="pc-stat-lbl">Stock bajo</div></div>
                  <div className="pc-stat"><div className="pc-stat-num">{stats.outOfStockCount}</div><div className="pc-stat-lbl">Agotados</div></div>
                </div>
                {isAdmin && (
                  <div className="pc-revenue">
                    <div className="pc-revenue-lbl">Ventas del mes</div>
                    <div className="pc-revenue-num">{formatCOP(stats.monthlyRevenue)}</div>
                  </div>
                )}
              </div>
            </div>

            {isAdmin && more.length > 0 && (
              <div className="pc-side-card">
                <div className="pc-side-head"><ArrowRight size={14} /> Más herramientas</div>
                <div className="pc-side-body pc-side-links">
                  {more.map(m => {
                    const MIcon = m.icon as React.ComponentType<{ className?: string; size?: number }>
                    return (
                      <button key={m.id} className="pc-side-link" onClick={() => go(m.id)}>
                        <MIcon size={14} /> {m.label}
                    </button>
                  )})}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </>
  )
}

// ──────────────────────────────────────────────────────────────
// Estilos del tema (verde #00833E + amarillo #F0A500), sin GOV.CO
// ──────────────────────────────────────────────────────────────
const PC_STYLES = `
.pc-theme {
  --pc-green:#00833E; --pc-green-dark:#005C2A; --pc-green-bright:#3FB877; --pc-green-light:rgba(0,131,62,0.10);
  --pc-yellow:#F0A500; --pc-border:rgba(255,255,255,0.62);
  --pc-text:#153327; --pc-muted:#5E7468;
  --pc-brand-text:#0E3B2E; --pc-fill:#00833E; --pc-revenue-bg:#005C2A;
  --pc-glass:rgba(255,255,255,0.55);
  --pc-glass-soft:rgba(255,255,255,0.42);
  --pc-glass-strong:rgba(255,255,255,0.72);
  --pc-content:#F4F7F2;
  --pc-footer-bg:rgba(14,59,46,0.80);
  --pc-shadow:0 22px 60px rgba(18,54,40,0.14);
  --pc-shadow-sm:0 6px 20px rgba(18,54,40,0.10);
  --pc-blur:blur(22px);
  font-family:'Segoe UI',system-ui,sans-serif; color:var(--pc-text);
  min-height:100vh; font-size:14px;
  background:
    radial-gradient(1100px 620px at 8% -8%, rgba(63,183,122,0.28), transparent 60%),
    radial-gradient(900px 560px at 100% 6%, rgba(240,165,0,0.16), transparent 55%),
    radial-gradient(1000px 780px at 60% 120%, rgba(0,131,62,0.20), transparent 60%),
    linear-gradient(150deg,#E9F1E5,#DCE9DC 55%,#EBE6D6);
  background-attachment:fixed;
}
.pc-theme *{box-sizing:border-box;}
.pc-theme button{font-family:inherit;cursor:pointer;}

/* HEADER — barra de vidrio flotante */
.pc-header{background:var(--pc-glass-strong);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);margin:16px 18px 0;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--pc-border);border-radius:22px;box-shadow:var(--pc-shadow-sm);flex-wrap:wrap;}
.pc-brand{display:flex;align-items:center;gap:12px;cursor:pointer;}
.pc-logo-mark{position:relative;width:44px;height:44px;background:linear-gradient(150deg,var(--pc-green),var(--pc-green-dark));border-radius:13px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;box-shadow:var(--pc-shadow-sm);}
.pc-logo-mark img{width:100%;height:100%;object-fit:cover;position:relative;z-index:1;}
.pc-logo-fallback{position:absolute;color:#fff;font-size:18px;font-weight:700;}
.pc-brand-name{font-size:15px;font-weight:700;color:var(--pc-brand-text);line-height:1.2;letter-spacing:-.2px;}
.pc-brand-sub{font-size:11px;color:var(--pc-muted);}
.pc-header-right{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.pc-search{display:flex;align-items:center;border:1px solid var(--pc-border);border-radius:14px;overflow:hidden;background:var(--pc-glass-soft);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
.pc-search input{border:none;background:transparent;padding:9px 14px;font-size:13px;width:230px;max-width:48vw;outline:none;color:var(--pc-text);}
.pc-search input::placeholder{color:var(--pc-muted);opacity:.8;}
.pc-search-btn{background:var(--pc-fill);border:none;padding:9px 14px;color:#fff;display:flex;align-items:center;}
.pc-search-btn:hover{background:var(--pc-green-dark);}
.pc-icon-btn{position:relative;background:var(--pc-glass-soft);border:1px solid var(--pc-border);color:var(--pc-muted);width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;transition:.16s;}
.pc-icon-btn:hover{color:var(--pc-brand-text);transform:translateY(-1px);}
.pc-guide-btn{display:flex;align-items:center;gap:6px;background:var(--pc-green-light);border:1px solid var(--pc-green);color:var(--pc-brand-text);font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:12px;}
.pc-guide-btn:hover{background:var(--pc-green);color:#fff;}
.pc-badge{position:absolute;top:-3px;right:-3px;background:#DC2626;color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 3px;}
.pc-notif-wrap{position:relative;}
.pc-notif-panel{position:absolute;right:0;top:calc(100% + 8px);width:260px;background:var(--pc-glass-strong);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);border:1px solid var(--pc-border);border-radius:16px;box-shadow:var(--pc-shadow);z-index:60;overflow:hidden;}
.pc-notif-title{font-size:12px;font-weight:700;padding:10px 14px;border-bottom:1px solid var(--pc-border);color:var(--pc-text);}
.pc-notif-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:10px 14px;border:none;background:none;font-size:12.5px;color:var(--pc-text);}
.pc-notif-item:hover{background:var(--pc-green-light);}
.pc-notif-empty{padding:14px;font-size:12px;color:var(--pc-muted);}
.pc-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.pc-dot-red{background:#DC2626;} .pc-dot-amber{background:var(--pc-yellow);} .pc-dot-blue{background:#2563EB;}
.pc-user{display:flex;align-items:center;gap:9px;padding:4px 6px 4px 4px;border-radius:14px;background:var(--pc-glass-soft);border:1px solid var(--pc-border);}
.pc-avatar{width:34px;height:34px;border-radius:11px;background:linear-gradient(150deg,var(--pc-yellow),#C98526);color:#3a2a06;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:14px;}
.pc-user-name{font-size:12.5px;font-weight:600;line-height:1.2;}
.pc-user-role{font-size:10.5px;color:var(--pc-muted);}
.pc-logout{background:transparent;border:none;}
.pc-logout:hover{background:#FEE2E2;color:#DC2626;}

/* NAVBAR — franja de vidrio flotante con píldoras */
.pc-navbar{background:var(--pc-glass-strong);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);position:sticky;top:12px;z-index:50;margin:13px 18px 0;border:1px solid var(--pc-border);border-radius:20px;box-shadow:var(--pc-shadow-sm);}
.pc-navbar-inner{display:flex;align-items:center;flex-wrap:wrap;gap:3px;padding:7px 9px;}
.pc-nav-cell{position:relative;}
.pc-nav-item{display:flex;align-items:center;gap:7px;color:var(--pc-muted);font-size:12.8px;font-weight:600;padding:10px 15px;background:transparent;border:none;border-radius:14px;white-space:nowrap;transition:background .16s,color .16s,transform .16s;}
.pc-nav-item:hover{background:var(--pc-glass-soft);color:var(--pc-text);transform:translateY(-1px);}
.pc-nav-item.active{background:linear-gradient(150deg,var(--pc-green),var(--pc-green-dark));color:#fff;box-shadow:var(--pc-shadow-sm);}
.pc-chev{opacity:.55;}
.pc-mega{position:absolute;left:0;top:calc(100% + 7px);min-width:214px;background:var(--pc-glass-strong);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);border:1px solid var(--pc-border);border-radius:16px;box-shadow:var(--pc-shadow);z-index:70;padding:7px;}
.pc-mega-item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:9px 11px;border:none;background:none;font-size:12.5px;color:var(--pc-text);border-radius:11px;}
.pc-mega-item:hover{background:var(--pc-green-light);color:var(--pc-brand-text);}
.pc-mega-item.active{background:var(--pc-green-light);color:var(--pc-brand-text);font-weight:600;}
.pc-mega-item svg{color:var(--pc-green);}

/* ALERT */
.pc-alert{background:rgba(240,165,0,0.12);border-left:4px solid var(--pc-yellow);padding:10px 18px;display:flex;align-items:center;gap:10px;font-size:12.5px;color:#7A4F00;cursor:pointer;}
.pc-alert-icon{flex-shrink:0;color:#B8860B;}
.pc-alert-link{color:var(--pc-brand-text);font-weight:700;}

/* GRÁFICA DE VENTAS (contenedor) */
.pc-chart-wrap{padding:18px 20px 0;max-width:1400px;margin:0 auto;width:100%;}

/* QUICK ACCESS — franja de vidrio flotante */
.pc-quick-head{padding:16px 22px 8px;font-size:11px;font-weight:700;color:var(--pc-brand-text);text-transform:uppercase;letter-spacing:1px;}
.pc-quick{background:var(--pc-glass-soft);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);border:1px solid var(--pc-border);border-radius:20px;box-shadow:var(--pc-shadow-sm);margin:0 18px;padding:8px 10px;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;}
.pc-quick::-webkit-scrollbar{display:none;}
.pc-quick-item{display:flex;flex-direction:column;align-items:center;gap:7px;padding:12px 16px;background:transparent;border:none;border-radius:16px;flex-shrink:0;transition:background .16s,transform .16s;}
.pc-quick-item:hover{background:var(--pc-glass);transform:translateY(-2px);}
.pc-quick-icon{width:40px;height:40px;background:linear-gradient(150deg,rgba(63,183,122,.28),rgba(0,131,62,.14));border-radius:13px;display:flex;align-items:center;justify-content:center;color:var(--pc-green);}
.pc-quick-label{font-size:10.5px;color:var(--pc-muted);text-align:center;max-width:74px;line-height:1.2;font-weight:600;}

/* MAIN */
.pc-main{padding:18px;display:grid;grid-template-columns:1fr 290px;gap:16px;max-width:1400px;margin:0 auto;}
.pc-main.pc-main-solo{grid-template-columns:1fr;}
.pc-welcome{display:flex;align-items:center;gap:10px;background:var(--pc-glass);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);border:1px solid var(--pc-border);border-radius:18px;color:var(--pc-brand-text);padding:15px 22px;font-size:14px;font-weight:600;max-width:1364px;margin:14px auto 0;width:calc(100% - 36px);box-shadow:var(--pc-shadow-sm);}
@media (max-width:900px){.pc-main{grid-template-columns:1fr;}}
.pc-section-label{font-size:11px;font-weight:700;color:var(--pc-brand-text);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.pc-section-label::after{content:'';flex:1;height:2px;background:var(--pc-green);opacity:.18;}
.pc-alerts{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
.pc-alert-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--pc-glass-soft);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);border:1px solid var(--pc-border);border-left:4px solid var(--pc-green);border-radius:14px;padding:11px 14px;font-size:13px;font-weight:600;color:var(--pc-text);cursor:pointer;transition:transform .15s,box-shadow .15s;}
.pc-alert-row:hover{transform:translateY(-1px);box-shadow:var(--pc-shadow);}
.pc-alert-row .pc-alert-go{margin-left:auto;opacity:.45;}
.pc-alert-row.blue{border-left-color:#2563EB;} .pc-alert-row.blue .pc-alert-ic{color:#2563EB;}
.pc-alert-row.amber{border-left-color:#D97706;} .pc-alert-row.amber .pc-alert-ic{color:#D97706;}
.pc-alert-row.red{border-left-color:#DC2626;} .pc-alert-row.red .pc-alert-ic{color:#DC2626;}
.pc-alert-row.green{border-left-color:var(--pc-green);} .pc-alert-row.green .pc-alert-ic{color:var(--pc-green);}
.pc-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
@media (max-width:560px){.pc-cards{grid-template-columns:1fr;}}
.pc-card{background:var(--pc-glass-soft);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);border:1px solid var(--pc-border);border-radius:16px;overflow:hidden;text-align:left;padding:0;transition:transform .15s,box-shadow .15s;}
.pc-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,131,62,.12);}
.pc-card-img{height:64px;background:rgba(240,165,0,0.14);display:flex;align-items:center;justify-content:center;position:relative;color:#B8860B;}
.pc-card-img.agotado{background:rgba(220,38,38,0.12);color:#DC2626;}
.pc-card-badge{position:absolute;top:8px;left:8px;background:var(--pc-yellow);color:#1A1A1A;font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;}
.pc-card-badge.agotado{background:#DC2626;color:#fff;}
.pc-card-cat.agotado{color:#DC2626;}
.pc-card-body{padding:10px;}
.pc-card-cat{font-size:10px;color:#B8860B;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;}
.pc-card-title{font-size:12.5px;font-weight:600;color:var(--pc-text);line-height:1.35;}
.pc-empty{background:var(--pc-glass-soft);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);border:1px dashed var(--pc-border);border-radius:16px;padding:30px;text-align:center;color:var(--pc-muted);display:flex;flex-direction:column;align-items:center;gap:8px;}
.pc-empty p{font-size:12.5px;}
.pc-more-btn{background:transparent;border:1.5px solid var(--pc-green);color:var(--pc-brand-text);font-size:12.5px;font-weight:600;padding:9px 20px;border-radius:12px;margin-top:14px;display:block;width:100%;}
.pc-more-btn:hover{background:var(--pc-green);color:#fff;}

/* SIDEBAR — glass */
.pc-side{display:flex;flex-direction:column;gap:14px;}
.pc-side-card{background:var(--pc-glass);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);border:1px solid var(--pc-border);border-radius:18px;overflow:hidden;box-shadow:var(--pc-shadow-sm);}
.pc-side-head{background:var(--pc-fill);color:#fff;font-size:12px;font-weight:600;padding:9px 14px;display:flex;align-items:center;gap:7px;}
.pc-side-body{padding:12px 14px;}
.pc-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.pc-stat{background:var(--pc-green-light);border-radius:6px;padding:9px 10px;text-align:center;}
.pc-stat-num{font-size:18px;font-weight:700;color:var(--pc-brand-text);line-height:1;}
.pc-stat-lbl{font-size:9.5px;color:var(--pc-green);margin-top:3px;font-weight:500;}
.pc-revenue{margin-top:10px;background:var(--pc-revenue-bg);border-radius:6px;padding:10px 12px;color:#fff;}
.pc-revenue-lbl{font-size:10px;opacity:.85;text-transform:uppercase;letter-spacing:.6px;}
.pc-revenue-num{font-size:18px;font-weight:700;margin-top:2px;}
.pc-side-links{display:flex;flex-direction:column;gap:2px;}
.pc-side-link{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:9px 8px;border:none;background:none;font-size:12.5px;color:var(--pc-text);border-radius:6px;}
.pc-side-link:hover{background:var(--pc-green-light);color:var(--pc-brand-text);}
.pc-side-link svg{color:var(--pc-green);}

/* SECTION (no-home) — slab flotante, contenido sólido muy claro (legibilidad + rendimiento) */
.pc-section{max-width:1400px;margin:16px auto;padding:20px;background:var(--pc-content);border:1px solid var(--pc-border);border-radius:22px;box-shadow:var(--pc-shadow-sm);min-height:60vh;width:calc(100% - 36px);}

/* FOOTER — glass tintado */
.pc-footer{background:var(--pc-footer-bg);backdrop-filter:var(--pc-blur);-webkit-backdrop-filter:var(--pc-blur);border-top:1px solid var(--pc-border);color:#C8D9CC;padding:22px 20px;}
.pc-footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:14px;}
@media (max-width:760px){.pc-footer-grid{grid-template-columns:1fr 1fr;}}
.pc-footer-brand{color:#fff;font-size:14px;font-weight:600;margin-bottom:6px;}
.pc-footer-addr{font-size:11px;line-height:1.7;color:#8FAD95;}
.pc-footer-col-title{color:#fff;font-size:12px;font-weight:600;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--pc-green);display:inline-block;}
.pc-footer-link{display:block;font-size:11.5px;color:#8FAD95;margin-bottom:6px;background:none;border:none;padding:0;text-align:left;}
.pc-footer-link:hover{color:var(--pc-yellow);}
.pc-footer-bottom{font-size:10.5px;color:#6B8570;}

/* ── MODO OSCURO — glass en ambos (next-themes usa la clase .dark; redefine solo tokens) ── */
.dark .pc-theme {
  --pc-green-bright:#5FD394; --pc-green-light:rgba(74,222,128,0.14);
  --pc-border:rgba(255,255,255,0.09);
  --pc-text:#E8F2EB; --pc-muted:#94AEA1;
  --pc-brand-text:#4ADE80; --pc-fill:#047857; --pc-revenue-bg:#065F46;
  --pc-glass:rgba(18,38,30,0.56);
  --pc-glass-soft:rgba(14,32,25,0.44);
  --pc-glass-strong:rgba(20,44,34,0.68);
  --pc-content:#0F1A15;
  --pc-footer-bg:rgba(6,20,12,0.78);
  --pc-shadow:0 22px 60px rgba(0,0,0,0.50);
  --pc-shadow-sm:0 6px 20px rgba(0,0,0,0.38);
  background:
    radial-gradient(1100px 620px at 8% -8%, rgba(63,183,122,0.14), transparent 60%),
    radial-gradient(900px 560px at 100% 6%, rgba(240,165,0,0.08), transparent 55%),
    radial-gradient(1000px 780px at 60% 120%, rgba(4,120,87,0.18), transparent 60%),
    linear-gradient(150deg,#0C1A14,#0A1610 55%,#101510);
}
.dark .pc-theme .pc-quick-icon{background:linear-gradient(150deg,rgba(63,183,122,.22),rgba(4,120,87,.14));}
.dark .pc-theme .pc-alert{background:rgba(240,165,0,0.10);color:#F5C97A;}
.dark .pc-theme .pc-card-img{background:rgba(240,165,0,0.10);}
.dark .pc-theme .pc-card-img.agotado{background:rgba(220,38,38,0.14);}
`
