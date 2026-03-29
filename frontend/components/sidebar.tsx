'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  History,
  TrendingUp,
  Settings,
  X,
  Users,
  UserCheck,
  CreditCard,
  Vault,
  Crown,
  Store,
  ClipboardList,
  Ticket,
  FlaskConical,
  ShoppingBag,
  Scissors,
  LogOut,
  ChevronRight,
  ChevronDown,
  LayoutTemplate,
  Printer,
  Star,
  UtensilsCrossed,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Paintbrush,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NavChild {
  id: string
  name: string
  icon: React.ElementType
  adminOnly: boolean
  superadminOnly: boolean
  merchantOnly: boolean
}

interface NavItem {
  id: string
  name: string
  icon: React.ElementType
  adminOnly: boolean
  superadminOnly: boolean
  merchantOnly: boolean
  group: string
  children?: NavChild[]
}

const navigation: NavItem[] = [
  // superadmin-only
  { id: 'superadmin', name: 'Panel Admin', icon: Crown, adminOnly: true, superadminOnly: true, merchantOnly: false, group: 'admin' },
  { id: 'pagina-principal', name: 'Página Principal', icon: LayoutTemplate, adminOnly: true, superadminOnly: true, merchantOnly: false, group: 'admin' },
  // core
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'inventory', name: 'Inventario', icon: Package, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'recipes', name: 'Recetas BOM', icon: FlaskConical, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'purchases', name: 'Compras', icon: ShoppingBag, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  // Tienda — módulo inteligente con submenu
  {
    id: 'tienda',
    name: 'Tienda',
    icon: Store,
    adminOnly: true,
    superadminOnly: false,
    merchantOnly: true,
    group: 'core',
    children: [
      { id: 'tienda', name: 'Mi Tienda', icon: Paintbrush, adminOnly: true, superadminOnly: false, merchantOnly: true },
      { id: 'pedidos', name: 'Pedidos', icon: ClipboardList, adminOnly: true, superadminOnly: false, merchantOnly: true },
      { id: 'cupones', name: 'Cupones', icon: Ticket, adminOnly: true, superadminOnly: false, merchantOnly: true },
      { id: 'reviews', name: 'Reseñas', icon: Star, adminOnly: true, superadminOnly: false, merchantOnly: true },
      { id: 'services', name: 'Servicios', icon: Scissors, adminOnly: true, superadminOnly: false, merchantOnly: true },
    ],
  },
  // operations
  { id: 'restbar', name: 'RestBar', icon: UtensilsCrossed, adminOnly: false, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'pos', name: 'Punto de Venta', icon: ShoppingCart, adminOnly: false, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'cash-register', name: 'Caja', icon: Vault, adminOnly: false, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'invoices', name: 'Facturación', icon: Receipt, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'customers', name: 'Clientes', icon: Users, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'fiados', name: 'Fiados', icon: CreditCard, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'vendedores', name: 'Empleados', icon: UserCheck, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'ops' },
  // reports
  { id: 'history', name: 'Historial', icon: History, adminOnly: false, superadminOnly: false, merchantOnly: true, group: 'reports' },
  { id: 'analytics', name: 'Análisis', icon: TrendingUp, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'reports' },
  { id: 'finances', name: 'Finanzas', icon: Wallet, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'reports' },
  // config
  { id: 'printers', name: 'Impresoras', icon: Printer, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'config' },
  { id: 'settings', name: 'Configuración', icon: Settings, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'config' },
]

const groups = [
  { key: 'admin',   label: null },
  { key: 'core',    label: 'Gestión' },
  { key: 'ops',     label: 'Operaciones' },
  { key: 'reports', label: 'Reportes' },
  { key: 'config',  label: null },
]

// IDs that belong to the Tienda submenu (to detect active state for parent)
const TIENDA_CHILD_IDS = ['tienda', 'pedidos', 'cupones', 'reviews', 'services']

export function Sidebar() {
  const {
    activeSection, setActiveSection,
    sidebarOpen, setSidebarOpen,
    sidebarCollapsed, toggleSidebarCollapsed,
  } = useStore()
  const { user, logout } = useAuthStore()

  const isSuperadmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'comerciante' || isSuperadmin

  // Tienda submenu open/closed — auto-opens when a child is active
  const isTiendaActive = TIENDA_CHILD_IDS.includes(activeSection)
  const [tiendaOpen, setTiendaOpen] = useState(isTiendaActive)

  const filterItem = (item: { adminOnly: boolean; superadminOnly: boolean; merchantOnly: boolean }) => {
    if (item.superadminOnly && !isSuperadmin) return false
    if (item.merchantOnly && isSuperadmin) return false
    if (item.adminOnly && !isAdmin) return false
    return true
  }

  const filteredNavigation = navigation.filter(filterItem)

  const roleLabel = isSuperadmin ? 'Super Admin' : isAdmin ? 'Comerciante' : 'Vendedor'
  const roleColor = isSuperadmin
    ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    : isAdmin
    ? 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    : 'text-green-400 bg-green-400/10 border-green-400/20'

  const navigate = (id: string) => {
    setActiveSection(id)
    setSidebarOpen(false)
  }

  const handleTiendaClick = () => {
    if (sidebarCollapsed) {
      // Expand sidebar first so user can see submenu
      toggleSidebarCollapsed()
      setTiendaOpen(true)
    } else {
      setTiendaOpen(prev => !prev)
    }
  }

  return (
    <>
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-16" : "w-60",
        "md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>

        {/* ── Logo + collapse toggle ── */}
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-3">
          <div className={cn("flex items-center gap-2.5 min-w-0", sidebarCollapsed && "justify-center w-full")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/image/lopbukicon.png" alt="Lopbuk" width={30} height={30} className="rounded-md shrink-0" />
            {!sidebarCollapsed && (
              <div className="flex flex-col leading-none min-w-0">
                <span className="text-sm font-bold text-sidebar-foreground tracking-tight">Lopbuk</span>
                <span className="text-[10px] text-muted-foreground">Gestión de Inventario</span>
              </div>
            )}
          </div>

          {/* Close on mobile */}
          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden ml-auto h-7 w-7 text-muted-foreground hover:text-sidebar-foreground shrink-0"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {/* Collapse toggle — desktop only */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "hidden md:flex h-7 w-7 text-muted-foreground hover:text-sidebar-foreground shrink-0",
              sidebarCollapsed ? "mx-auto" : "ml-auto"
            )}
            onClick={toggleSidebarCollapsed}
            title={sidebarCollapsed ? "Expandir barra" : "Colapsar barra"}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />
            }
          </Button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent">
          {groups.map(group => {
            const items = filteredNavigation.filter(i => i.group === group.key)
            if (items.length === 0) return null
            return (
              <div key={group.key} className="mb-1">
                {group.label && !sidebarCollapsed && (
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                    {group.label}
                  </p>
                )}
                {group.label && sidebarCollapsed && (
                  <div className="mx-3 my-1 border-t border-sidebar-border/40" />
                )}

                {items.map(item => {
                  // Special handling for Tienda (has children)
                  if (item.children) {
                    const visibleChildren = item.children.filter(filterItem)
                    if (visibleChildren.length === 0) return null
                    const isParentActive = isTiendaActive

                    return (
                      <div key={item.id}>
                        {/* Parent button */}
                        <div className="relative group/tip">
                          <button
                            onClick={handleTiendaClick}
                            className={cn(
                              "group relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                              isParentActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                              sidebarCollapsed && "justify-center px-0"
                            )}
                          >
                            {isParentActive && !sidebarCollapsed && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                            )}
                            <item.icon className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              isParentActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-sidebar-foreground"
                            )} />
                            {!sidebarCollapsed && (
                              <>
                                <span className="truncate flex-1 text-left">{item.name}</span>
                                {tiendaOpen
                                  ? <ChevronDown className="ml-auto h-3 w-3 opacity-60" />
                                  : <ChevronRight className="ml-auto h-3 w-3 opacity-60" />
                                }
                              </>
                            )}
                          </button>
                          {/* Tooltip when collapsed */}
                          {sidebarCollapsed && (
                            <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[60] px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md border border-border shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                              {item.name}
                            </span>
                          )}
                        </div>

                        {/* Children submenu — only when expanded */}
                        {!sidebarCollapsed && tiendaOpen && (
                          <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border/50 space-y-0.5">
                            {visibleChildren.map(child => {
                              const isChildActive = activeSection === child.id
                              return (
                                <div key={child.id} className="relative group/tip">
                                  <button
                                    onClick={() => navigate(child.id)}
                                    className={cn(
                                      "group relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all duration-150",
                                      isChildActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                    )}
                                  >
                                    {isChildActive && (
                                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r-full" />
                                    )}
                                    <child.icon className={cn(
                                      "h-3.5 w-3.5 shrink-0",
                                      isChildActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-sidebar-foreground"
                                    )} />
                                    <span className="truncate">{child.name}</span>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }

                  // Regular item
                  const isActive = activeSection === item.id
                  return (
                    <div key={item.id} className="relative group/tip">
                      <button
                        onClick={() => navigate(item.id)}
                        className={cn(
                          "group relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-primary/10 text-primary shadow-sm"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                          sidebarCollapsed && "justify-center px-0"
                        )}
                      >
                        {isActive && !sidebarCollapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                        )}
                        <item.icon className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-sidebar-foreground"
                        )} />
                        {!sidebarCollapsed && (
                          <>
                            <span className="truncate">{item.name}</span>
                            {isActive && <ChevronRight className="ml-auto h-3 w-3 text-primary/60" />}
                          </>
                        )}
                      </button>
                      {/* Tooltip when collapsed */}
                      {sidebarCollapsed && (
                        <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[60] px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md border border-border shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {item.name}
                        </span>
                      )}
                    </div>
                  )
                })}

                {group.key !== 'config' && items.length > 0 && !sidebarCollapsed && (
                  <div className="mx-3 mt-2 mb-1 border-t border-sidebar-border/40" />
                )}
              </div>
            )
          })}
        </nav>

        {/* ── Footer ── */}
        <div className={cn("shrink-0 border-t border-sidebar-border p-3 space-y-2", sidebarCollapsed && "px-2")}>
          {!sidebarCollapsed ? (
            <>
              {/* User info */}
              <div className="flex items-center gap-2.5 px-1">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                  {user?.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email ?? ''}</p>
                </div>
              </div>
              {/* Role badge */}
              <div className={cn('mx-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-center', roleColor)}>
                {roleLabel}
              </div>
              {/* Logout */}
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-red-400 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Cerrar sesión
              </button>
            </>
          ) : (
            /* Collapsed footer — just avatar + logout icon */
            <div className="flex flex-col items-center gap-2">
              <div className="relative group/tip">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold cursor-default">
                  {user?.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[60] px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md border border-border shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {user?.name ?? '—'}
                </span>
              </div>
              <div className="relative group/tip">
                <button
                  onClick={logout}
                  className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-red-400 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
                <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[60] px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md border border-border shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Cerrar sesión
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
