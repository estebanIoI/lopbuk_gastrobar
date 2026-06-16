'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { AuthForm } from '@/components/auth-form'
import { LandingPage } from '@/components/landing-page'
import { MerchantPanel } from '@/components/merchant-panel'
import { FullPageLoader } from '@/components/box-loader'

export default function Home() {
  const { activeSection, setActiveSection } = useStore()
  const { isAuthenticated, checkAuth, user, isCheckingAuth } = useAuthStore()
  const [showLogin, setShowLogin] = useState(false)
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

  // Cliente: LandingPage con sesión activa
  if (isAuthenticated && user?.role === 'cliente') {
    return <LandingPage onGoToLogin={() => {}} />
  }

  // Sin sesión: landing pública y, al pulsar acceder, el formulario de login
  if (!isAuthenticated) {
    if (!showLogin) {
      return <LandingPage onGoToLogin={() => setShowLogin(true)} />
    }
    return <AuthForm onGoBack={() => setShowLogin(false)} />
  }

  // Autenticado (comerciante, vendedor, staff de restaurante, etc.):
  // el panel del comerciante decide qué mostrar según el rol y la sección activa.
  return <MerchantPanel />
}
