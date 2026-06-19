'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Package, ShoppingCart, ClipboardList, Store,
  Paintbrush, Ticket, Star, History, Users, Receipt, Settings,
  TrendingUp, ChevronRight, ChevronLeft, X, BookOpen, Lightbulb,
  CheckCircle2, Map, Zap, Shield, CreditCard, FlaskConical,
  ShoppingBag, Vault, AlertTriangle, MousePointerClick,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'

const STORAGE_KEY = 'lopbuk_guide_seen_v1'

interface Feature { icon: React.ElementType; text: string }
interface GuideStep {
  id: string
  icon: React.ElementType
  color: string
  title: string
  subtitle: string
  description: string
  features: Feature[]
  tip?: string
  navigateTo?: string
}

const STEPS: GuideStep[] = [
  {
    id: 'welcome',
    icon: BookOpen,
    color: 'from-violet-500 to-indigo-600',
    title: '¡Bienvenido a Lopbuk!',
    subtitle: 'Tu sistema de gestión todo en uno',
    description:
      'Lopbuk te permite administrar tu negocio completo: inventario, ventas, tienda online, clientes y más — desde un solo lugar. Esta guía te explica cada módulo para que saques el máximo provecho.',
    features: [
      { icon: Zap,    text: 'Gestión de inventario en tiempo real' },
      { icon: Store,  text: 'Tienda online integrada con pedidos' },
      { icon: ShoppingCart, text: 'Punto de venta rápido' },
      { icon: Shield, text: 'Datos seguros y respaldados' },
    ],
    tip: 'Puedes volver a esta guía en cualquier momento presionando el botón ❓ en el menú lateral.',
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    color: 'from-blue-500 to-cyan-500',
    title: 'Dashboard',
    subtitle: 'Resumen general de tu negocio',
    description:
      'El Dashboard es tu pantalla principal. Muestra de un vistazo el estado de tu negocio: ventas del día, pedidos pendientes, productos con stock bajo y más.',
    features: [
      { icon: TrendingUp,    text: 'Estadísticas de ventas del día, semana y mes' },
      { icon: AlertTriangle, text: 'Alertas de productos con stock bajo' },
      { icon: ClipboardList, text: 'Pedidos recientes de tu tienda online' },
      { icon: CheckCircle2,  text: 'Acceso rápido a las secciones más usadas' },
    ],
    tip: 'Revisa el Dashboard cada mañana para saber cómo arrancó tu negocio.',
    navigateTo: 'dashboard',
  },
  {
    id: 'inventory',
    icon: Package,
    color: 'from-emerald-500 to-teal-600',
    title: 'Inventario',
    subtitle: 'Control total de tus productos',
    description:
      'Desde aquí administras todos tus productos: agrega nuevos, edita precios, controla el stock y organiza por categorías. Cada cambio se refleja automáticamente en tu tienda online y en el POS.',
    features: [
      { icon: Package,       text: 'Crear y editar productos con imágenes, precio y costo' },
      { icon: CheckCircle2,  text: 'Variantes: tallas, colores, presentaciones' },
      { icon: AlertTriangle, text: 'Stock mínimo — recibe alertas antes de quedarte sin inventario' },
      { icon: TrendingUp,    text: 'Categorías para organizar tu catálogo' },
    ],
    tip: 'Define un stock mínimo a cada producto para que el sistema te avise cuando hay que reponer.',
    navigateTo: 'inventory',
  },
  {
    id: 'recipes',
    icon: FlaskConical,
    color: 'from-orange-500 to-amber-500',
    title: 'Recetas BOM',
    subtitle: 'Composición de productos elaborados',
    description:
      'Si elaboras productos a partir de materias primas (restaurantes, panadería, tapicería, etc.), las Recetas BOM te permiten definir qué ingredientes usa cada producto. Al vender, el sistema descuenta las materias primas automáticamente.',
    features: [
      { icon: FlaskConical,  text: 'Define ingredientes y cantidades por producto' },
      { icon: Package,       text: 'Descuento automático de materia prima al vender' },
      { icon: TrendingUp,    text: 'Calcula el costo real de producción' },
      { icon: CheckCircle2,  text: 'Compatible con múltiples unidades de medida' },
    ],
    tip: 'Ideal para negocios como restaurantes, cafeterías, panaderías y talleres.',
    navigateTo: 'recipes',
  },
  {
    id: 'purchases',
    icon: ShoppingBag,
    color: 'from-sky-500 to-blue-600',
    title: 'Compras',
    subtitle: 'Registro de entradas de mercancía',
    description:
      'Registra las compras que haces a tus proveedores. Al confirmar una compra, el stock se actualiza automáticamente y puedes rastrear tus costos de adquisición.',
    features: [
      { icon: ShoppingBag,  text: 'Crear órdenes de compra por proveedor' },
      { icon: Package,      text: 'Actualización automática de inventario al confirmar' },
      { icon: Receipt,      text: 'Historial de compras y proveedores' },
      { icon: TrendingUp,   text: 'Control de costos de adquisición' },
    ],
    navigateTo: 'purchases',
  },
  {
    id: 'pos',
    icon: ShoppingCart,
    color: 'from-violet-500 to-purple-600',
    title: 'Punto de Venta (POS)',
    subtitle: 'Registra ventas en caja rápidamente',
    description:
      'El POS es tu caja registradora digital. Busca productos, agrégalos al carrito, selecciona el método de pago y genera la factura. Ideal para ventas presenciales rápidas.',
    features: [
      { icon: MousePointerClick, text: 'Búsqueda rápida de productos por nombre o código' },
      { icon: Users,             text: 'Asignar venta a un cliente del sistema' },
      { icon: CreditCard,        text: 'Múltiples métodos de pago: efectivo, transferencia, tarjeta' },
      { icon: Receipt,           text: 'Generación automática de factura y descuento de inventario' },
    ],
    tip: 'Usa el atajo de teclado para agilizar las ventas en hora pico.',
    navigateTo: 'pos',
  },
  {
    id: 'tienda',
    icon: Paintbrush,
    color: 'from-pink-500 to-rose-600',
    title: 'Mi Tienda',
    subtitle: 'Personaliza tu tienda online',
    description:
      'Configura la apariencia y la información de tu tienda online pública. Cambia colores, logo, banner, datos de contacto, redes sociales y activa integraciones como Meta Pixel.',
    features: [
      { icon: Paintbrush,   text: 'Colores, logo, banner y tipografía personalizables' },
      { icon: Store,        text: 'Info del negocio: dirección, teléfono, horarios' },
      { icon: Zap,          text: 'Meta Pixel para rastrear conversiones de Facebook Ads' },
      { icon: CheckCircle2, text: 'Activa/desactiva módulos: reseñas, servicios, contacto' },
    ],
    tip: 'Los cambios se reflejan al instante en tu tienda sin necesidad de recargar.',
    navigateTo: 'tienda',
  },
  {
    id: 'pedidos',
    icon: ClipboardList,
    color: 'from-indigo-500 to-blue-600',
    title: 'Pedidos',
    subtitle: 'Gestiona los pedidos de tu tienda online',
    description:
      'Aquí llegan todos los pedidos realizados desde tu tienda online. Puedes ver el detalle de cada uno, cambiar su estado y, al marcarlo como "Entregado", se genera automáticamente una factura y se descuenta el inventario.',
    features: [
      { icon: ClipboardList, text: 'Flujo de estados: Pendiente → Confirmado → Preparando → Enviado → Entregado' },
      { icon: Map,           text: 'Vista Mapa: ve todos tus pedidos georeferenciados con rutas reales' },
      { icon: Receipt,       text: 'Al marcar "Entregado" se genera la factura automáticamente' },
      { icon: CheckCircle2,  text: 'Filtros por estado, búsqueda por nombre o # de pedido' },
    ],
    tip: 'Activa "Ubicar mi tienda" en la vista mapa para calcular distancias y tiempos de entrega a cada pedido.',
    navigateTo: 'pedidos',
  },
  {
    id: 'cupones',
    icon: Ticket,
    color: 'from-yellow-500 to-orange-500',
    title: 'Cupones',
    subtitle: 'Crea descuentos para tu tienda online',
    description:
      'Genera códigos de descuento que tus clientes pueden aplicar al hacer un pedido en tu tienda online. Controla el porcentaje o valor fijo, las fechas de validez y el número máximo de usos.',
    features: [
      { icon: Ticket,       text: 'Descuento por porcentaje o valor fijo en pesos' },
      { icon: CheckCircle2, text: 'Fechas de inicio y expiración configurables' },
      { icon: Shield,       text: 'Límite de usos por cupón y por cliente' },
      { icon: Zap,          text: 'Activar / desactivar cupón con un clic' },
    ],
    navigateTo: 'cupones',
  },
  {
    id: 'reviews',
    icon: Star,
    color: 'from-amber-400 to-yellow-500',
    title: 'Reseñas',
    subtitle: 'Gestiona las opiniones de tus clientes',
    description:
      'Visualiza y modera las reseñas que tus clientes dejan en tu tienda online. Puedes responder, aprobar o rechazar reseñas para mantener la confianza de nuevos compradores.',
    features: [
      { icon: Star,         text: 'Ver calificación promedio y distribución de estrellas' },
      { icon: CheckCircle2, text: 'Aprobar o rechazar reseñas antes de publicarlas' },
      { icon: Users,        text: 'Responder directamente a la reseña del cliente' },
      { icon: TrendingUp,   text: 'Reseñas verificadas mejoran la conversión de tu tienda' },
    ],
    navigateTo: 'reviews',
  },
  {
    id: 'history',
    icon: History,
    color: 'from-slate-500 to-gray-600',
    title: 'Historial de Ventas',
    subtitle: 'Registro completo de todas tus ventas',
    description:
      'El Historial consolida todas las ventas registradas: desde el POS, pedidos online entregados y ventas manuales. Filtra por fecha, busca facturas y exporta reportes.',
    features: [
      { icon: History,      text: 'Todas las ventas en un solo lugar: POS, tienda, manual' },
      { icon: Receipt,      text: 'Ver el detalle de cada factura generada' },
      { icon: TrendingUp,   text: 'Filtrar por rango de fechas y método de pago' },
      { icon: CheckCircle2, text: 'Totales y estadísticas del período seleccionado' },
    ],
    navigateTo: 'history',
  },
  {
    id: 'customers',
    icon: Users,
    color: 'from-teal-500 to-emerald-600',
    title: 'Clientes',
    subtitle: 'Tu base de clientes centralizada',
    description:
      'Administra todos tus clientes: información de contacto, historial de compras y saldo de fiados (crédito). Puedes buscar un cliente rápidamente desde el POS al momento de vender.',
    features: [
      { icon: Users,        text: 'Crear y editar perfiles de clientes' },
      { icon: History,      text: 'Ver el historial de compras de cada cliente' },
      { icon: CreditCard,   text: 'Gestionar fiados (ventas a crédito) con saldo pendiente' },
      { icon: CheckCircle2, text: 'Clientes disponibles en el POS para asignar ventas' },
    ],
    navigateTo: 'customers',
  },
  {
    id: 'settings',
    icon: Settings,
    color: 'from-gray-500 to-slate-700',
    title: 'Configuración',
    subtitle: 'Ajusta tu cuenta y la plataforma',
    description:
      'Configura los datos de tu empresa, usuarios y contraseñas, integraciones externas (Cloudinary para imágenes, WhatsApp) y las opciones generales de la plataforma.',
    features: [
      { icon: Settings,     text: 'Datos del negocio: nombre, NIT, dirección, logo' },
      { icon: Shield,       text: 'Gestión de usuarios y roles (vendedor, admin)' },
      { icon: Zap,          text: 'Integraciones: Cloudinary (imágenes), WhatsApp notificaciones' },
      { icon: CheckCircle2, text: 'Preferencias de moneda, IVA y facturación' },
    ],
    navigateTo: 'settings',
  },
]

interface AppGuideProps {
  open: boolean
  onClose: () => void
}

export function AppGuide({ open, onClose }: AppGuideProps) {
  const [step, setStep]           = useState(0)
  const [animDir, setAnimDir]     = useState<'next' | 'prev'>('next')
  const { setActiveSection }      = useStore()

  const total = STEPS.length

  const go = useCallback((idx: number, dir: 'next' | 'prev') => {
    setAnimDir(dir)
    setStep(Math.max(0, Math.min(idx, total - 1)))
  }, [total])

  const handleNavigate = () => {
    const target = STEPS[step].navigateTo
    if (target) setActiveSection(target)
    onClose()
  }

  // Reset to welcome when reopened
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  // Close with Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const current = STEPS[step]
  const Icon = current.icon as React.ComponentType<{ className?: string }>
  const isFirst = step === 0
  const isLast  = step === total - 1

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ isolation: 'isolate' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-background rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className={`bg-gradient-to-r ${current.color} p-6 shrink-0`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-0.5">
                  {isFirst ? 'Guía de uso' : `Módulo ${step} de ${total - 1}`}
                </p>
                <h2 className="text-white text-xl font-bold leading-tight">{current.title}</h2>
                <p className="text-white/80 text-sm mt-0.5">{current.subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress bar */}
          {!isFirst && (
            <div className="mt-4 flex gap-1">
              {STEPS.slice(1).map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i + 1, i + 1 > step ? 'next' : 'prev')}
                  className={`h-1 rounded-full flex-1 transition-all ${
                    i + 1 <= step ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left nav — module list */}
          <div className="w-52 shrink-0 border-r border-border/50 overflow-y-auto bg-muted/30 hidden sm:block">
            {STEPS.map((s, i) => {
              const SIcon = s.icon as React.ComponentType<{ className?: string }>
              const isActive = step === i
              return (
                <button
                  key={s.id}
                  onClick={() => go(i, i > step ? 'next' : 'prev')}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors text-sm ${
                    isActive
                      ? 'bg-background border-r-2 border-primary font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                  }`}
                >
                  <SIcon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                  <span className="truncate">{s.title}</span>
                  {isActive && <ChevronRight className="h-3 w-3 ml-auto text-primary shrink-0" />}
                </button>
              )
            })}
          </div>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Description */}
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">
              {current.description}
            </p>

            {/* Features */}
            <div className="space-y-3 mb-5">
              {current.features.map((f, i) => {
                const FIcon = f.icon as React.ComponentType<{ className?: string }>
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${current.color} flex items-center justify-center shrink-0`}>
                      <FIcon className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm text-foreground/80 leading-snug mt-1">{f.text}</p>
                  </div>
                )
              })}
            </div>

            {/* Tip */}
            {current.tip && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10">
                <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug">{current.tip}</p>
              </div>
            )}

            {/* Navigate to module button */}
            {current.navigateTo && (
              <button
                onClick={handleNavigate}
                className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r ${current.color} text-white text-sm font-semibold hover:opacity-90 transition-opacity`}
              >
                <MousePointerClick className="h-4 w-4" />
                Ir al módulo {current.title}
              </button>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-border/50 px-6 py-4 flex items-center justify-between bg-muted/20">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Omitir guía
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => go(step - 1, 'prev')}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}

            {isFirst ? (
              <Button size="sm" onClick={() => go(1, 'next')} className="gap-1.5">
                Comenzar tour <ChevronRight className="h-4 w-4" />
              </Button>
            ) : isLast ? (
              <Button size="sm" onClick={onClose} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Finalizar
              </Button>
            ) : (
              <Button size="sm" onClick={() => go(step + 1, 'next')} className="gap-1.5">
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar trigger button (sin auto-show, el header lo maneja) ────────────
export function GuideButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Guía de uso"
        className="flex items-center justify-center h-7 w-7 rounded-xl text-gray-400 hover:bg-black/[0.06] hover:text-primary transition-colors"
      >
        <BookOpen className="h-3.5 w-3.5" />
      </button>
      <AppGuide open={open} onClose={() => setOpen(false)} />
    </>
  )
}
