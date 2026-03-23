'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Bell, ExternalLink, Menu, PackageX, Search, ShoppingBag, User, Package, Receipt, Users, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { SyncStatusBar } from '@/components/sync-status-bar'
import { ProfileModal } from '@/components/profile-modal'
import { PreferencesModal } from '@/components/preferences-modal'

const sectionTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  inventory: 'Gestión de Inventario',
  pos: 'Punto de Venta',
  'cash-register': 'Caja Registradora',
  invoices: 'Facturación',
  history: 'Historial de Ventas',
  analytics: 'Análisis y Reportes',
  settings: 'Configuración',
  superadmin: 'Panel Admin',
  'pagina-principal': 'Página Principal',
}

// ─── Global search component ──────────────────────────────────────────────────

function GlobalSearch() {
  const { products, navigateToInventory, setActiveSection } = useStore()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [salesResults, setSalesResults] = useState<any[]>([])
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter products locally (fast)
  const productResults = query.trim().length >= 2
    ? products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 5)
    : []

  // Debounced API search for sales + customers
  useEffect(() => {
    if (query.trim().length < 2) {
      setSalesResults([])
      setCustomerResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      const [salesRes, customersRes] = await Promise.all([
        api.getSales({ page: 1, limit: 5, search: query }),
        api.getCustomers({ page: 1, limit: 5, search: query }),
      ])
      if (salesRes.success) setSalesResults((salesRes as any).data ?? [])
      if (customersRes.success) setCustomerResults((customersRes as any).data ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasResults = productResults.length > 0 || salesResults.length > 0 || customerResults.length > 0
  const showDropdown = open && query.trim().length >= 2

  const clear = () => { setQuery(''); setOpen(false); inputRef.current?.focus() }

  const goProduct = (name: string) => {
    navigateToInventory(undefined, name)
    setQuery(''); setOpen(false)
  }

  const goSale = (invoiceNumber: string) => {
    setActiveSection('history')
    setQuery(''); setOpen(false)
    // Pass search via store would be ideal but history page has its own search —
    // we navigate there and the user can see it
  }

  const goCustomer = (name: string) => {
    setActiveSection('customers')
    setQuery(''); setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Buscar productos, facturas, clientes…"
        className="w-64 lg:w-80 xl:w-96 pl-9 pr-8 bg-secondary border-none h-10 lg:h-11"
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
      />
      {query && (
        <button onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute top-full mt-1.5 left-0 w-full min-w-[340px] rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
          {searching && !hasResults && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Buscando…</p>
          )}
          {!searching && !hasResults && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados para "{query}"</p>
          )}

          {/* Productos */}
          {productResults.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest bg-muted/30">
                Productos
              </p>
              {productResults.map(p => (
                <button key={p.id} onClick={() => goProduct(p.name)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left">
                  <Package className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">SKU: {p.sku} · Stock: {p.stock}</p>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${p.stock === 0 ? 'text-destructive' : p.stock <= p.reorderPoint ? 'text-amber-400' : 'text-green-400'}`}>
                    {p.stock === 0 ? 'Agotado' : p.stock <= p.reorderPoint ? 'Stock bajo' : 'En stock'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Facturas */}
          {salesResults.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest bg-muted/30">
                Facturas / Ventas
              </p>
              {salesResults.map((s: any) => (
                <button key={s.id} onClick={() => goSale(s.invoiceNumber)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left">
                  <Receipt className="h-4 w-4 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{s.invoiceNumber}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.customerName ?? 'Cliente general'} · {s.sellerName}</p>
                  </div>
                  <span className="text-xs font-semibold text-foreground shrink-0">
                    ${Number(s.total).toLocaleString('es-CO')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Clientes */}
          {customerResults.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest bg-muted/30">
                Clientes
              </p>
              {customerResults.map((c: any) => (
                <button key={c.id} onClick={() => goCustomer(c.name)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left">
                  <Users className="h-4 w-4 text-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{c.phone ?? ''} · CC: {c.cedula}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Ver todos en sección */}
          {hasResults && (
            <div className="border-t border-border px-4 py-2">
              <button onClick={() => { navigateToInventory(undefined, query); setOpen(false) }}
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <Search className="h-3 w-3" /> Ver todos los resultados en Inventario
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const { activeSection, products, toggleSidebar, navigateToInventory, pendingOrdersCount, fetchPendingOrdersCount, navigateToPedidos } = useStore()
  const { logout } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const lowStockProducts = products.filter(p => p.stock <= p.reorderPoint && p.stock > 0).sort((a, b) => a.stock - b.stock)
  const outOfStockProducts = products.filter(p => p.stock === 0)
  const lowStockCount = lowStockProducts.length
  const outOfStockCount = outOfStockProducts.length
  const alertCount = lowStockCount + outOfStockCount + Number(pendingOrdersCount)

  useEffect(() => {
    fetchPendingOrdersCount()
    const interval = setInterval(fetchPendingOrdersCount, 30_000)
    return () => clearInterval(interval)
  }, [fetchPendingOrdersCount])
  
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:h-16 lg:h-18 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground sm:text-xl lg:text-2xl">
          {sectionTitles[activeSection] || 'Dashboard'}
        </h1>
      </div>

      <div className="flex items-center gap-3 lg:gap-4">
        {/* Sync status (solo visible en instancias locales) */}
        <SyncStatusBar />

        {/* Search */}
        <GlobalSearch />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-10 w-10 lg:h-11 lg:w-11">
              <Bell className="h-5 w-5 lg:h-5.5 lg:w-5.5 text-muted-foreground" />
              {alertCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 lg:h-5.5 lg:w-5.5 items-center justify-center rounded-full bg-destructive text-[10px] lg:text-xs font-medium text-destructive-foreground">
                  {alertCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 lg:w-96 max-h-[70vh] overflow-y-auto">
            <DropdownMenuLabel className="text-sm lg:text-base">Notificaciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {outOfStockCount > 0 && (
              <>
                <DropdownMenuItem
                  className="flex items-center gap-2 py-2 cursor-pointer"
                  onClick={() => navigateToInventory('agotado')}
                >
                  <PackageX className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm font-medium text-destructive">Sin Stock ({outOfStockCount})</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                </DropdownMenuItem>
                {outOfStockProducts.slice(0, 4).map((product) => (
                  <DropdownMenuItem
                    key={product.id}
                    className="flex items-center gap-3 py-2 pl-6 cursor-pointer"
                    onClick={() => navigateToInventory('agotado', product.name)}
                  >
                    <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                    <span className="text-xs font-medium text-destructive shrink-0">0 uds</span>
                  </DropdownMenuItem>
                ))}
                {outOfStockCount > 4 && (
                  <DropdownMenuItem
                    className="py-1.5 pl-6 cursor-pointer"
                    onClick={() => navigateToInventory('agotado')}
                  >
                    <span className="text-xs text-muted-foreground">
                      +{outOfStockCount - 4} productos más...
                    </span>
                  </DropdownMenuItem>
                )}
              </>
            )}
            {lowStockCount > 0 && outOfStockCount > 0 && <DropdownMenuSeparator />}
            {lowStockCount > 0 && (
              <>
                <DropdownMenuItem
                  className="flex items-center gap-2 py-2 cursor-pointer"
                  onClick={() => navigateToInventory('bajo')}
                >
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-sm font-medium text-warning">Stock Bajo ({lowStockCount})</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                </DropdownMenuItem>
                {lowStockProducts.slice(0, 4).map((product) => (
                  <DropdownMenuItem
                    key={product.id}
                    className="flex items-center gap-3 py-2 pl-6 cursor-pointer"
                    onClick={() => navigateToInventory('bajo', product.name)}
                  >
                    <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                    <span className="text-xs font-medium text-warning shrink-0">
                      {product.stock}/{product.reorderPoint}
                    </span>
                  </DropdownMenuItem>
                ))}
                {lowStockCount > 4 && (
                  <DropdownMenuItem
                    className="py-1.5 pl-6 cursor-pointer"
                    onClick={() => navigateToInventory('bajo')}
                  >
                    <span className="text-xs text-muted-foreground">
                      +{lowStockCount - 4} productos más...
                    </span>
                  </DropdownMenuItem>
                )}
              </>
            )}
            {pendingOrdersCount > 0 && (lowStockCount > 0 || outOfStockCount > 0) && <DropdownMenuSeparator />}
            {pendingOrdersCount > 0 && (
              <DropdownMenuItem
                className="flex items-center gap-2 py-2 cursor-pointer"
                onClick={() => navigateToPedidos()}
              >
                <ShoppingBag className="h-4 w-4 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-blue-500">
                    Pedidos Pendientes ({pendingOrdersCount})
                  </span>
                  <p className="text-xs text-muted-foreground">Toca para ver los pedidos</p>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
              </DropdownMenuItem>
            )}
            {alertCount === 0 && (
              <DropdownMenuItem className="py-3 text-sm lg:text-base text-muted-foreground">
                No hay alertas pendientes
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 lg:h-11 lg:w-11">
              <div className="flex h-8 w-8 lg:h-9 lg:w-9 items-center justify-center rounded-full bg-primary">
                <User className="h-4 w-4 lg:h-5 lg:w-5 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 lg:w-56">
            <DropdownMenuLabel className="text-sm lg:text-base">Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm lg:text-base" onClick={() => setProfileOpen(true)}>Perfil</DropdownMenuItem>
            <DropdownMenuItem className="text-sm lg:text-base" onClick={() => setPreferencesOpen(true)}>Preferencias</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-sm lg:text-base">Cerrar Sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <PreferencesModal open={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
    </header>
  )
}
