'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { MainLayout } from '@/components/main-layout'
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
import { SuperadminHome } from '@/components/superadmin-home'
import { AuthForm } from '@/components/auth-form'
import { LandingPage } from '@/components/landing-page'
import { Tienda } from '@/components/tienda'
import { Pedidos } from '@/components/pedidos'
import { Cupones } from '@/components/cupones'
import { Recipes } from '@/components/recipes'
import { DriverPanel } from '@/components/driver-panel'
import { PurchaseInvoices } from '@/components/purchase-invoices'
import { ServicesManagement } from '@/components/services-management'
import { PrintersConfig } from '@/components/printers'
import { VendedoresPanel } from '@/components/vendedores-panel'
import { ReviewsPanel } from '@/components/reviews-panel'
import { RestBar } from '@/components/restbar'
import { Finances } from '@/components/finances'
import { MeseroPanel } from '@/components/mesero-panel'
import { BartenderPanel } from '@/components/bartender-panel'
import { CajeroPanel } from '@/components/cajero-panel'

export default function Home() {
  const { activeSection, setActiveSection } = useStore()
  const { isAuthenticated, checkAuth, user, isCheckingAuth } = useAuthStore()
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Force vendedor users to POS section
  useEffect(() => {
    if (isAuthenticated && user?.role === 'vendedor' && activeSection !== 'pos' && activeSection !== 'history' && activeSection !== 'cash-register') {
      setActiveSection('pos')
    }
  }, [isAuthenticated, user?.role, activeSection, setActiveSection])

  // Force auxiliar_bodega to inventory section
  useEffect(() => {
    if (isAuthenticated && user?.role === 'auxiliar_bodega' && activeSection !== 'inventory') {
      setActiveSection('inventory')
    }
  }, [isAuthenticated, user?.role, activeSection, setActiveSection])

  // Redirect superadmin to their panel on login
  useEffect(() => {
    if (isAuthenticated && user?.role === 'superadmin' && activeSection === 'dashboard') {
      setActiveSection('pagina-principal')
    }
  }, [isAuthenticated, user?.role, activeSection, setActiveSection])

  // Redirect repartidor to delivery panel
  useEffect(() => {
    if (isAuthenticated && user?.role === 'repartidor' && activeSection !== 'delivery') {
      setActiveSection('delivery')
    }
  }, [isAuthenticated, user?.role, activeSection, setActiveSection])

  // Redirect restaurant roles to restbar on login
  useEffect(() => {
    const restaurantRoles = ['mesero', 'cocinero', 'cajero', 'bartender', 'administrador_rb']
    if (isAuthenticated && restaurantRoles.includes(user?.role ?? '') && activeSection === 'dashboard') {
      setActiveSection('restbar')
    }
  }, [isAuthenticated, user?.role, activeSection, setActiveSection])

  // Prevent non-superadmin users from seeing superadmin section (stale localStorage)
  useEffect(() => {
    if (isAuthenticated && user?.role !== 'superadmin' && activeSection === 'superadmin') {
      setActiveSection('dashboard')
    }
  }, [isAuthenticated, user?.role, activeSection, setActiveSection])

  // Block render until token is verified — prevents blocked users from seeing the UI
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Repartidor gets their own full-screen panel (no sidebar)
  if (isAuthenticated && user?.role === 'repartidor') {
    return <DriverPanel />
  }

  // Mesero gets full-screen panel (no sidebar)
  if (isAuthenticated && user?.role === 'mesero') {
    return <MeseroPanel />
  }

  // Bartender gets full-screen panel (no sidebar)
  if (isAuthenticated && user?.role === 'bartender') {
    return <BartenderPanel />
  }

  // Cajero gets full-screen panel (no sidebar)
  if (isAuthenticated && user?.role === 'cajero') {
    return <CajeroPanel />
  }

  // Cliente gets LandingPage with active session
  if (isAuthenticated && user?.role === 'cliente') {
    return <LandingPage onGoToLogin={() => {}} />
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    if (!showLogin) {
      return <LandingPage onGoToLogin={() => setShowLogin(true)} />
    }
    return <AuthForm onGoBack={() => setShowLogin(false)} />
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'superadmin':
        return user?.role === 'superadmin' ? <TenantManagement /> : <Dashboard />
      case 'pagina-principal':
        return user?.role === 'superadmin' ? <SuperadminHome /> : <Dashboard />
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
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <Settings />
      case 'printers':
        return <PrintersConfig />
      case 'vendedores':
        return <VendedoresPanel />
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
        if (user?.role === 'cajero')    return <CajeroPanel />
        return <RestBar />
      case 'finances':
        return <Finances />
      default:
        return <Dashboard />
    }
  }

  return (
    <MainLayout>
      {renderSection()}
    </MainLayout>
  )
}
