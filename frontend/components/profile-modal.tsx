'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  User,
  Mail,
  Calendar,
  Building2,
  Crown,
  Check,
  Zap,
  Rocket,
  Loader2,
  ExternalLink,
  X,
  Users,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'
import type { TenantPlan } from '@/lib/types'

interface PlanDef {
  key: TenantPlan
  label: string
  icon: React.ReactNode
  gradient: string
  accentColor: string
  ringColor: string
  features: string[]
}

const PLANS: PlanDef[] = [
  {
    key: 'basico',
    label: 'Básico',
    icon: <Zap className="h-4 w-4" />,
    gradient: 'from-slate-600 to-slate-700',
    accentColor: 'text-slate-300',
    ringColor: 'ring-slate-500/30',
    features: [
      'Hasta 3 usuarios',
      'Hasta 100 productos',
      'POS y Facturación',
      'Gestión de inventario',
      'Soporte por email',
    ],
  },
  {
    key: 'profesional',
    label: 'Profesional',
    icon: <Rocket className="h-4 w-4" />,
    gradient: 'from-blue-500 to-blue-700',
    accentColor: 'text-blue-300',
    ringColor: 'ring-blue-500/40',
    features: [
      'Hasta 10 usuarios',
      'Hasta 1,000 productos',
      'Todo lo del plan Básico',
      'Chatbot IA integrado',
      'Análisis avanzado',
      'Tienda en línea',
      'Soporte prioritario',
    ],
  },
  {
    key: 'empresarial',
    label: 'Empresarial',
    icon: <Crown className="h-4 w-4" />,
    gradient: 'from-amber-500 to-orange-600',
    accentColor: 'text-amber-300',
    ringColor: 'ring-amber-500/40',
    features: [
      'Usuarios ilimitados',
      'Productos ilimitados',
      'Todo lo del plan Profesional',
      'Múltiples sedes',
      'Acceso a API',
      'Manager de cuenta',
    ],
  },
]

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  comerciante: 'Comerciante',
  vendedor: 'Vendedor',
  cliente: 'Cliente',
  repartidor: 'Repartidor',
  auxiliar_bodega: 'Auxiliar de Bodega',
}

const PLAN_LABELS: Record<TenantPlan, string> = {
  basico: 'Básico',
  profesional: 'Profesional',
  empresarial: 'Empresarial',
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ProfileModal({ open, onClose }: Props) {
  const { user } = useAuthStore()
  const [planPrices, setPlanPrices] = useState<Record<string, string>>({})
  const [stripeConfigured, setStripeConfigured] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<TenantPlan | null>(null)

  useEffect(() => {
    if (!open) return
    Promise.all([
      api.getPlatformSettings(),
      api.getSubscriptionConfig(),
    ]).then(([settingsRes, subRes]) => {
      if (settingsRes.success && settingsRes.data) {
        setPlanPrices({
          basico: settingsRes.data.plan_price_basico || '',
          profesional: settingsRes.data.plan_price_profesional || '',
          empresarial: settingsRes.data.plan_price_empresarial || '',
        })
      }
      if (subRes.success && subRes.data?.configured) {
        setStripeConfigured(true)
      }
    })
  }, [open])

  const handleUpgrade = async (plan: TenantPlan) => {
    if (!stripeConfigured) {
      toast.error('El sistema de pagos aún no está configurado. Contacta al administrador.')
      return
    }
    setLoadingPlan(plan)
    try {
      const result = await api.createMPSubscription(plan)
      if (result.success && result.data?.url) {
        window.location.href = result.data.url
      } else {
        toast.error(result.error || 'Error al crear la sesión de pago')
      }
    } catch {
      toast.error('Error al conectar con el sistema de pagos')
    } finally {
      setLoadingPlan(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    } catch { return dateStr }
  }

  const currentPlan = user?.tenantPlan as TenantPlan | undefined
  const isCommerciante = user?.role === 'comerciante'
  const showPlans = isCommerciante || user?.role === 'superadmin'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="!w-screen !h-screen !max-w-none !rounded-none !border-0 !p-0 !gap-0 !translate-x-[-50%] !translate-y-[-50%] !top-[50%] !left-[50%] overflow-hidden bg-background"
      >
        {/* Hidden title/description for screen readers */}
        <DialogTitle className="sr-only">Mi Perfil</DialogTitle>
        <DialogDescription className="sr-only">Información de tu cuenta y planes disponibles</DialogDescription>

        {/* Close button */}
        <DialogClose className="absolute top-5 right-5 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </DialogClose>

        <div className="flex h-full w-full">

          {/* ── LEFT PANEL: User info ── */}
          <div className="relative flex w-[300px] shrink-0 flex-col bg-card border-r border-border">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />

            <div className="flex flex-col flex-1 px-8 py-10 gap-8">

              {/* Avatar + name */}
              <div className="flex flex-col items-center text-center gap-3">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary ring-4 ring-primary/20">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.name} className="h-20 w-20 rounded-full object-cover" />
                    ) : (
                      <User className="h-9 w-9 text-primary-foreground" />
                    )}
                  </div>
                  {/* Role badge */}
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                  </span>
                </div>
                <div className="mt-2">
                  <h2 className="text-lg font-bold text-foreground leading-tight">{user?.name}</h2>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Contact info */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Email</p>
                    <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
                  </div>
                </div>

                {user?.tenantName && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Empresa</p>
                      <p className="text-xs font-medium text-foreground truncate">{user.tenantName}</p>
                    </div>
                  </div>
                )}

                {user?.createdAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Miembro desde</p>
                      <p className="text-xs font-medium text-foreground">{formatDate(user.createdAt)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              {isCommerciante && currentPlan && <div className="h-px bg-border" />}

              {/* Current plan summary */}
              {isCommerciante && currentPlan && (
                <div className="rounded-xl bg-primary/8 border border-primary/15 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Crown className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Plan actual</span>
                  </div>
                  <span className="text-base font-bold text-primary">{PLAN_LABELS[currentPlan]}</span>
                  <div className="flex flex-col gap-1.5">
                    {user?.tenantMaxUsers && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {user.tenantMaxUsers >= 9999 ? 'Usuarios ilimitados' : `Hasta ${user.tenantMaxUsers} usuarios`}
                      </div>
                    )}
                    {user?.tenantMaxProducts && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Package className="h-3 w-3" />
                        {user.tenantMaxProducts >= 9999 ? 'Productos ilimitados' : `Hasta ${user.tenantMaxProducts} productos`}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL: Plans ── */}
          <div className="flex flex-1 flex-col px-10 py-10 overflow-hidden">
            {showPlans ? (
              <>
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-foreground">Planes disponibles</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isCommerciante
                      ? 'Escoge el plan que mejor se adapte a tu negocio'
                      : 'Planes disponibles en la plataforma'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-5 flex-1">
                  {PLANS.map((plan) => {
                    const isCurrent = currentPlan === plan.key
                    const price = planPrices[plan.key]
                    return (
                      <div
                        key={plan.key}
                        className={`relative flex flex-col rounded-2xl border transition-all duration-200
                          ${isCurrent
                            ? `bg-card ring-2 ${plan.ringColor} border-transparent shadow-lg shadow-primary/5`
                            : 'bg-card border-border hover:border-muted-foreground/30 hover:shadow-md'
                          }`}
                      >
                        {/* Current badge */}
                        {isCurrent && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                            <span className={`text-[10px] font-bold bg-gradient-to-r ${plan.gradient} text-white px-3 py-1 rounded-full shadow`}>
                              Plan Actual
                            </span>
                          </div>
                        )}

                        {/* Card top bar */}
                        <div className={`h-1 w-full rounded-t-2xl bg-gradient-to-r ${plan.gradient}`} />

                        <div className="flex flex-col flex-1 p-5 gap-4">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${plan.gradient} text-white`}>
                                {plan.icon}
                              </span>
                              <span className="font-bold text-foreground">{plan.label}</span>
                            </div>
                            {price && (
                              <div className="text-right">
                                <p className="text-sm font-bold text-foreground">
                                  ${Number(price).toLocaleString('es-CO')}
                                </p>
                                <p className="text-[10px] text-muted-foreground">/mes</p>
                              </div>
                            )}
                          </div>

                          {/* Divider */}
                          <div className="h-px bg-border" />

                          {/* Features */}
                          <ul className="flex flex-col gap-2 flex-1">
                            {plan.features.map((f) => (
                              <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Action */}
                          {isCommerciante && (
                            isCurrent ? (
                              <button
                                disabled
                                className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground cursor-default"
                              >
                                <Check className="h-3.5 w-3.5" /> Plan activo
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpgrade(plan.key)}
                                disabled={loadingPlan !== null || !stripeConfigured}
                                className={`flex items-center justify-center gap-1.5 w-full rounded-lg py-2 text-xs font-semibold text-white transition-opacity
                                  bg-gradient-to-r ${plan.gradient} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {loadingPlan === plan.key ? (
                                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando…</>
                                ) : (
                                  <><ExternalLink className="h-3.5 w-3.5" /> Actualizar plan</>
                                )}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {!stripeConfigured && isCommerciante && (
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    El sistema de pagos aún no está habilitado. Contacta al administrador.
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">No hay planes disponibles para tu rol.</p>
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
