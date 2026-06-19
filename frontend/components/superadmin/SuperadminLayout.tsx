'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Briefcase, CreditCard, LayoutTemplate, MessageSquarePlus,
  Plug, Star, Store, TrendingUp, ShoppingBag, Sparkles,
} from 'lucide-react'
import { RefreshCw } from 'lucide-react'

// ── Lazy loading: cada tab se carga solo cuando se selecciona ─────────────────

const LandingConfigTab  = dynamic(() => import('./tabs/LandingConfigTab').then(m => ({ default: m.LandingConfigTab })), { loading: () => <TabLoader /> })
const CommercesTab      = dynamic(() => import('./tabs/CommercesTab').then(m => ({ default: m.CommercesTab })), { loading: () => <TabLoader /> })
const AnalyticsTab      = dynamic(() => import('./tabs/AnalyticsTab').then(m => ({ default: m.AnalyticsTab })), { loading: () => <TabLoader /> })
const FeaturedTab       = dynamic(() => import('./tabs/FeaturedProductsTab').then(m => ({ default: m.FeaturedProductsTab })), { loading: () => <TabLoader /> })
const IntegrationsTab   = dynamic(() => import('./tabs/IntegrationsTab').then(m => ({ default: m.IntegrationsTab })), { loading: () => <TabLoader /> })
const SubscriptionsTab  = dynamic(() => import('./tabs/SubscriptionsTab').then(m => ({ default: m.SubscriptionsTab })), { loading: () => <TabLoader /> })
const PortfolioTab      = dynamic(() => import('./tabs/PortfolioTab').then(m => ({ default: m.PortfolioTab })), { loading: () => <TabLoader /> })
const DevRequestsTab    = dynamic(() => import('./tabs/DevRequestsTab').then(m => ({ default: m.DevRequestsTab })), { loading: () => <TabLoader /> })
const OrdersCenterTab   = dynamic(() => import('./tabs/OrdersCenterTab').then(m => ({ default: m.OrdersCenterTab })), { loading: () => <TabLoader /> })
const CommunityTab      = dynamic(() => import('./tabs/CommunityTab').then(m => ({ default: m.CommunityTab })), { loading: () => <TabLoader /> })

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabId = 'pedidos' | 'pagina' | 'comercios' | 'timeline' | 'destacados' | 'integraciones' | 'pagos' | 'portafolio' | 'solicitudes' | 'comunidad'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'pedidos',       label: 'Pedidos',          icon: ShoppingBag },
  { id: 'comercios',     label: 'Comercios',        icon: Store },
  { id: 'pagina',        label: 'Página',           icon: LayoutTemplate },
  { id: 'timeline',      label: 'Ventas',           icon: TrendingUp },
  { id: 'destacados',    label: 'Destacados',       icon: Star },
  { id: 'integraciones', label: 'Integraciones',    icon: Plug },
  { id: 'pagos',         label: 'Suscripciones',    icon: CreditCard },
  { id: 'portafolio',    label: 'Portafolio',       icon: Briefcase },
  { id: 'comunidad',     label: 'Comunidad',        icon: Sparkles },
  { id: 'solicitudes',   label: 'Dev',              icon: MessageSquarePlus },
]

// ── Loader de tab ─────────────────────────────────────────────────────────────

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

// ── Layout principal ──────────────────────────────────────────────────────────

export function SuperadminLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('pedidos')

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
          <LayoutTemplate className="h-6 w-6 text-primary" />
          Panel Superadmin
        </h2>
        <p className="text-sm text-muted-foreground">
          Gestiona la plataforma, analiza rendimiento y configura la página principal
        </p>
      </div>

      {/* Tabs nav */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon as React.ComponentType<{ className?: string }>
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content — los componentes se montan solo cuando el tab está activo */}
      {activeTab === 'pedidos'       && <OrdersCenterTab />}
      {activeTab === 'pagina'        && <LandingConfigTab />}
      {activeTab === 'comercios'     && <CommercesTab />}
      {activeTab === 'timeline'      && <AnalyticsTab />}
      {activeTab === 'destacados'    && <FeaturedTab />}
      {activeTab === 'integraciones' && <IntegrationsTab />}
      {activeTab === 'pagos'         && <SubscriptionsTab />}
      {activeTab === 'portafolio'    && <PortfolioTab />}
      {activeTab === 'comunidad'     && <CommunityTab />}
      {activeTab === 'solicitudes'   && <DevRequestsTab />}
    </div>
  )
}
