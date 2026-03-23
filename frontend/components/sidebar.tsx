'use client'

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
  LayoutTemplate,
  Printer,
  Star,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navigation = [
  // superadmin-only
  { id: 'superadmin', name: 'Panel Admin', icon: Crown, adminOnly: true, superadminOnly: true, merchantOnly: false, group: 'admin' },
  { id: 'pagina-principal', name: 'Página Principal', icon: LayoutTemplate, adminOnly: true, superadminOnly: true, merchantOnly: false, group: 'admin' },
  // core (merchant/vendedor only)
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'inventory', name: 'Inventario', icon: Package, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'tienda', name: 'Tienda', icon: Store, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'reviews', name: 'Reseñas', icon: Star, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'pedidos', name: 'Pedidos', icon: ClipboardList, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'cupones', name: 'Cupones', icon: Ticket, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'recipes', name: 'Recetas BOM', icon: FlaskConical, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'purchases', name: 'Compras', icon: ShoppingBag, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  { id: 'services', name: 'Servicios', icon: Scissors, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'core' },
  // operations (merchant/vendedor only)
  { id: 'restbar', name: 'RestBar', icon: UtensilsCrossed, adminOnly: false, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'pos', name: 'Punto de Venta', icon: ShoppingCart, adminOnly: false, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'cash-register', name: 'Caja', icon: Vault, adminOnly: false, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'invoices', name: 'Facturación', icon: Receipt, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'customers', name: 'Clientes', icon: Users, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'fiados', name: 'Fiados', icon: CreditCard, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'ops' },
  { id: 'vendedores', name: 'Empleados', icon: UserCheck, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'ops' },
  // reports (merchant/vendedor only)
  { id: 'history', name: 'Historial', icon: History, adminOnly: false, superadminOnly: false, merchantOnly: true, group: 'reports' },
  { id: 'analytics', name: 'Análisis', icon: TrendingUp, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'reports' },
  { id: 'finances', name: 'Finanzas', icon: Wallet, adminOnly: true, superadminOnly: false, merchantOnly: true, group: 'reports' },
  // config (merchant only)
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

export function Sidebar() {
  const { activeSection, setActiveSection, sidebarOpen, setSidebarOpen } = useStore()
  const { user, logout } = useAuthStore()
  const isSuperadmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'comerciante' || isSuperadmin

  const filteredNavigation = navigation.filter(item => {
    if (item.superadminOnly && !isSuperadmin) return false
    if (item.merchantOnly && isSuperadmin) return false
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  const roleLabel = isSuperadmin ? 'Super Admin' : isAdmin ? 'Comerciante' : 'Vendedor'
  const roleColor = isSuperadmin
    ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    : isAdmin
    ? 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    : 'text-green-400 bg-green-400/10 border-green-400/20'

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
        "fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-in-out",
        "md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>

        {/* ── Logo ── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/image/lopbukicon.png" alt="Lopbuk" width={32} height={32} className="rounded-md" />
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold text-sidebar-foreground tracking-tight">Lopbuk</span>
              <span className="text-[10px] text-muted-foreground">Gestión de Inventario</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent">
          {groups.map(group => {
            const items = filteredNavigation.filter(i => i.group === group.key)
            if (items.length === 0) return null
            return (
              <div key={group.key} className="mb-1">
                {group.label && (
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                    {group.label}
                  </p>
                )}
                {items.map(item => {
                  const isActive = activeSection === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveSection(item.id); setSidebarOpen(false) }}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                      )}
                      <item.icon className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-sidebar-foreground"
                      )} />
                      <span className="truncate">{item.name}</span>
                      {isActive && <ChevronRight className="ml-auto h-3 w-3 text-primary/60" />}
                    </button>
                  )
                })}
                {group.key !== 'config' && items.length > 0 && (
                  <div className="mx-3 mt-2 mb-1 border-t border-sidebar-border/40" />
                )}
              </div>
            )
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-sidebar-border p-3 space-y-2">
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
        </div>
      </aside>
    </>
  )
}
