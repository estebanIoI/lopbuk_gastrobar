'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { AuthForm } from '@/components/auth-form'
import { LandingPage } from '@/components/landing-page'
import { MerchantPanel } from '@/components/merchant-panel'
import ConsumerOS from '@/components/consumer/ConsumerOS'
import { WorkspaceSelector } from '@/components/workspace-selector'
import { FullPageLoader } from '@/components/box-loader'

export default function Home() {
  const { activeSection, setActiveSection } = useStore()
  const { isAuthenticated, checkAuth, user, isCheckingAuth } = useAuthStore()
  const [showLogin, setShowLogin] = useState(false)
  // Espacio elegido por cuentas con doble acceso (comerciante + OS): 'merchant' | 'os'.
  const [workspace, setWorkspace] = useState<string | null>(null)
  useEffect(() => { try { setWorkspace(localStorage.getItem('dz_workspace')) } catch { /* noop */ } }, [])
  const chooseWorkspace = (w: 'merchant' | 'os') => { try { localStorage.setItem('dz_workspace', w) } catch { /* noop */ } ; setWorkspace(w) }
  const clearWorkspace = () => { try { localStorage.removeItem('dz_workspace') } catch { /* noop */ } ; setWorkspace(null) }
  // Detecta si la URL pide la vista pública de la tienda (?store=slug),
  // p.ej. el iframe de preview del Editor Visual. En ese caso renderizamos
  // siempre la tienda pública aunque el admin esté autenticado.
  const [isStorePreview, setIsStorePreview] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    setIsStorePreview(new URLSearchParams(window.location.search).has('store'))
  }, [])

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

  // Espera a saber si es preview de tienda (evita parpadeo del dashboard en el iframe)
  // y bloquea el render hasta verificar el token.
  if (isStorePreview === undefined || isCheckingAuth) {
    return (
      <FullPageLoader />
    )
  }

  // Vista pública de la tienda (?store=slug): se renderiza siempre, incluso si el
  // admin está autenticado. Esto hace que el preview del Editor Visual muestre la
  // página real de la tienda y no el dashboard.
  if (isStorePreview) {
    return <LandingPage onGoToLogin={() => setShowLogin(true)} />
  }

  // Cliente: Consumer OS (el panel ES el producto; el marketplace es "Explore" dentro).
  // El preview de tienda (?store=) ya se manejó arriba, así que los deep-links siguen vivos.
  if (isAuthenticated && user?.role === 'cliente') {
    return <ConsumerOS />
  }

  // Sin sesión: landing pública y, al pulsar acceder, el formulario de login
  if (!isAuthenticated) {
    if (!showLogin) {
      return <LandingPage onGoToLogin={() => setShowLogin(true)} />
    }
    return <AuthForm onGoBack={() => setShowLogin(false)} />
  }

  // Comerciante: tiene DOBLE espacio (su panel + el OS personal). Si no ha elegido,
  // mostramos el selector split-screen; recordamos su elección y dejamos cambiar.
  // (El acceso real al OS LEGEND se gobernará por el plan empresarial / entitlement.)
  if (user?.role === 'comerciante') {
    if (workspace === 'os') {
      return (
        <>
          <ConsumerOS />
          <SwitchSpaceButton onClick={clearWorkspace} />
        </>
      )
    }
    if (workspace === 'merchant') {
      return (
        <>
          <MerchantPanel />
          <SwitchSpaceButton onClick={clearWorkspace} />
        </>
      )
    }
    return (
      <WorkspaceSelector
        userName={user?.name}
        onSelectMerchant={() => chooseWorkspace('merchant')}
        onSelectOS={() => chooseWorkspace('os')}
      />
    )
  }

  // Autenticado (vendedor, staff de restaurante, etc.):
  // el panel del comerciante decide qué mostrar según el rol y la sección activa.
  return <MerchantPanel />
}

// Botón discreto para volver al selector de espacio (solo cuentas con doble acceso).
function SwitchSpaceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Cambiar de espacio"
      className="fixed bottom-4 left-4 z-[60] flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur border border-white/15 text-white text-xs font-medium px-3 py-2 shadow-lg hover:bg-black/85 transition-colors"
    >
      ⇄ Cambiar espacio
    </button>
  )
}
