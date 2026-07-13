'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { MainLayout } from '@/components/main-layout'
import { PanelComercianteShell } from '@/components/panel-comerciante-shell'
import { GuidedTour } from '@/components/guided-tour'
import { PanelAssistant } from '@/components/panel-assistant'
import { Dashboard } from '@/components/dashboard'
import { Analytics } from '@/components/analytics'
import { InventoryList } from '@/components/inventory-list'
import { PointOfSale } from '@/components/point-of-sale'
import { SalesHistory } from '@/components/sales-history'
import { Invoicing } from '@/components/invoicing'
import { Settings } from '@/components/settings'
import { Customers } from '@/components/customers'
import { Fiados } from '@/components/fiados'
import { CashRegister } from '@/components/cash-register'
import { TenantManagement } from '@/components/tenant-management'
import { SuperadminLayout } from '@/components/superadmin/SuperadminLayout'
import { Tienda } from '@/components/tienda'
import { Pedidos } from '@/components/pedidos'
import { Cupones } from '@/components/cupones'
import { Recipes } from '@/components/recipes'
import { DriverPanel } from '@/components/driver-panel'
import { PurchaseInvoices } from '@/components/purchase-invoices'
import { ServicesManagement } from '@/components/services-management'
import { CombosManager } from '@/components/combos-manager'
import { GymManagement } from '@/components/gym-management'
import { CartillaManagement } from '@/components/cartilla-management'
import { ProfileEditor } from '@/components/profile-theme3/profile-editor'
import { Theme4Editor } from '@/components/theme4/theme4-editor'
import { PlatformAssistant } from '@/components/platform-assistant'
import { PrintersConfig } from '@/components/printers'
import { VendedoresPanel } from '@/components/vendedores-panel'
import { OrgChart } from '@/components/org-chart'
import { QuotesPanel } from '@/components/quotes-panel'
import { PickingBoard } from '@/components/picking-board'
import { InventoryCountPanel } from '@/components/inventory-count-panel'
import { OpsTimelinePanel } from '@/components/ops-timeline-panel'
import { ExecutiveDashboard } from '@/components/executive-dashboard'
import { ReviewsPanel } from '@/components/reviews-panel'
import { RestBar } from '@/components/restbar'
import { Finances } from '@/components/finances'
import { MeseroPanel } from '@/components/mesero-panel'
import { BartenderPanel } from '@/components/bartender-panel'
import { CocineroPanel } from '@/components/cocinero-panel'
import { CajeroPanel } from '@/components/cajero-panel'
import { DeveloperRequests } from '@/components/developer-requests'
import { DispatchPanel } from '@/components/dispatch-panel'
import { FleetManagement } from '@/components/fleet-management'
import { RealEstate } from '@/components/realestate'
import { Tapiceria } from '@/components/tapiceria'
import { Merma } from '@/components/merma'
import { GastrobarOps } from '@/components/gastrobar-ops'
import { ContentHub } from '@/components/content-hub/ContentHub'
import { applyAdminAccent } from '@/lib/theme-vars'
import { applyPlatformAccentDefault } from '@/lib/platform-theme'

/**
 * Render del panel del comerciante para un usuario YA autenticado.
 * Cubre los paneles full-screen por rol (mesero, cocinero, etc.) y el
 * dashboard con sidebar (MainLayout) que muestra la sección activa.
 *
 * La sección a mostrar la lee de useStore().activeSection, que las rutas
 * /panel/[section] mantienen sincronizada con la URL.
 */
export function MerchantPanel() {
  const { activeSection, setActiveSection } = useStore()
  const { user } = useAuthStore()
  const router = useRouter()

  // El rol comunidad_admin no usa el panel de comercio: va a su propio panel.
  useEffect(() => {
    if (user?.role === 'comunidad_admin') router.replace('/comunidad/admin')
  }, [user?.role, router])

  // ── Tema del panel (global, lo elige el superadmin) ──
  // 'classic' (Tema 1, sidebar) | 'comerciante' (Tema 2, navbar verde).
  // Se cachea en localStorage y se lee antes del primer paint para evitar el
  // parpadeo del tema clásico al recargar.
  const [panelTheme, setPanelTheme] = useState<'classic' | 'comerciante'>('classic')
  useLayoutEffect(() => {
    try {
      const cached = localStorage.getItem('panel_theme')
      if (cached === 'comerciante' || cached === 'classic') setPanelTheme(cached)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    let alive = true
    api.getPublicPlatformSettings().then(r => {
      if (!alive) return
      const t = (r?.data as any)?.panel_theme
      const next = t === 'comerciante' ? 'comerciante' : 'classic'
      setPanelTheme(next)
      try { localStorage.setItem('panel_theme', next) } catch { /* ignore */ }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  // ── Acento de marca en el panel ──
  // Jerarquía: acento propio del comercio > acento de plataforma (superadmin) > base.
  useEffect(() => {
    let alive = true
    // Superadmin: usa el acento de la plataforma (su propia marca).
    if (user?.role === 'superadmin') { void applyPlatformAccentDefault(); return }
    api.getStoreThemeColors().then(async r => {
      if (!alive) return
      const accent = (r?.data as any)?.colors?.admin_accent
      if (accent) applyAdminAccent(accent)
      else await applyPlatformAccentDefault() // sin paleta propia → acento de plataforma
    }).catch(() => { void applyPlatformAccentDefault() })
    return () => { alive = false }
  }, [user?.role])

  // Repartidor: panel full-screen propio (sin sidebar)
  if (user?.role === 'repartidor') return <DriverPanel />
  // Despachador
  if (user?.role === 'despachador') return <DispatchPanel />
  // Mesero
  if (user?.role === 'mesero') return <MeseroPanel />
  // Bartender
  if (user?.role === 'bartender') return <BartenderPanel />
  // Cocinero (kitchen display)
  if (user?.role === 'cocinero') return <CocineroPanel />
  // Cajero
  if (user?.role === 'cajero') return <CajeroPanel />

  // Guard: secciones de Tienda requieren plan empresarial
  const isEmpresarial = user?.tenantPlan === 'empresarial' || user?.role === 'superadmin'
  const TIENDA_SECTIONS = ['tienda', 'pedidos', 'cupones', 'reviews', 'services']

  const renderSection = () => {
    if (TIENDA_SECTIONS.includes(activeSection) && !isEmpresarial) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
          <div className="rounded-full bg-amber-400/10 p-5">
            <svg className="h-10 w-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Plan empresarial requerido</h2>
          <p className="text-muted-foreground max-w-sm">
            El módulo Tienda está disponible únicamente en el plan empresarial. Actualiza tu plan para publicar productos, gestionar pedidos, crear cupones y personalizar tu página.
          </p>
          <button
            onClick={() => setActiveSection('dashboard')}
            className="mt-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      )
    }

    switch (activeSection) {
      case 'superadmin':
        return user?.role === 'superadmin' ? <TenantManagement /> : <Dashboard />
      case 'pagina-principal':
        return user?.role === 'superadmin' ? <SuperadminLayout /> : <Dashboard />
      case 'dashboard':
        return <Dashboard />
      case 'inventory':
        return <InventoryList />
      case 'tienda':
        return <Tienda />
      case 'pedidos':
        return <Pedidos />
      case 'cupones':
        return <Cupones />
      case 'recipes':
        return <Recipes />
      case 'pos':
        return <PointOfSale />
      case 'cash-register':
        return <CashRegister />
      case 'history':
        return <SalesHistory />
      case 'invoices':
        return <Invoicing />
      case 'customers':
        return <Customers />
      case 'fiados':
        return <Fiados />
      case 'purchases':
        return <PurchaseInvoices />
      case 'services':
        return <ServicesManagement />
      case 'combos':
        return <CombosManager />
      case 'gym':
        return <GymManagement />
      case 'cartilla':
        return <CartillaManagement />
      case 'perfil':
        return <ProfileEditor />
      case 'servicios-pro':
        return <Theme4Editor />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <Settings />
      case 'printers':
        return <PrintersConfig />
      case 'vendedores':
        return <VendedoresPanel />
      case 'organigrama':
        return <OrgChart />
      case 'cotizaciones':
        return <QuotesPanel />
      case 'picking':
        return <PickingBoard />
      case 'conteo':
        return <InventoryCountPanel />
      case 'tiempos':
        return <OpsTimelinePanel />
      case 'gerencia':
        return <ExecutiveDashboard />
      case 'reviews':
        return (
          <div className="p-6 space-y-4">
            <div>
              <h1 className="text-2xl font-bold">Reseñas de productos</h1>
              <p className="text-gray-500 text-sm">Gestiona las reseñas que los clientes dejan en tu tienda</p>
            </div>
            <ReviewsPanel />
          </div>
        )
      case 'restbar':
        if (user?.role === 'mesero')    return <MeseroPanel />
        if (user?.role === 'bartender') return <BartenderPanel />
        if (user?.role === 'cocinero')  return <CocineroPanel />
        if (user?.role === 'cajero')    return <CajeroPanel />
        return <RestBar />
      case 'finances':
        return <Finances />
      case 'dev-requests':
        return <DeveloperRequests />
      case 'fleet':
        return (
          <div className="p-6 h-full">
            <FleetManagement />
          </div>
        )
      case 'realestate':
        return (
          <div className="h-full flex flex-col">
            <RealEstate />
          </div>
        )
      case 'workorders':
        return (
          <div className="h-full flex flex-col">
            <Tapiceria />
          </div>
        )
      case 'merma':
        return <Merma />
      case 'gastrobar-ops':
        return <GastrobarOps />
      case 'contenido':
        return <ContentHub />
      default:
        return <Dashboard />
    }
  }

  // ── Tema 2 (Panel Comerciante): navbar verde + guía interactiva + asistente ──
  // El superadmin siempre usa el tema clásico (su panel vive en el sidebar).
  const useComercianteTheme = panelTheme === 'comerciante' && user?.role !== 'superadmin'
  if (useComercianteTheme) {
    return (
      <>
        <PanelComercianteShell />
        <GuidedTour autoStart />
        <PanelAssistant />
      </>
    )
  }

  return (
    <MainLayout>
      {renderSection()}
      <PlatformAssistant />
    </MainLayout>
  )
}
