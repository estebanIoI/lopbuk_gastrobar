'use client'

import { useEffect, useRef } from 'react'
import { Joyride, EventData, STATUS, Step, TooltipRenderProps } from 'react-joyride'
import { ChevronRight, ChevronLeft, X, CheckCircle2 } from 'lucide-react'
import { useStore } from '@/lib/store'

const STEPS: Step[] = [
  {
    target: '[data-tour="sidebar-logo"]',
    title: '¡Bienvenido a Lopbuk!',
    content: 'Tu sistema de gestión todo en uno. En 2 minutos te mostramos todo lo que puedes hacer.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="header-search"]',
    title: 'Búsqueda global',
    content: 'Busca productos, facturas y clientes desde aquí. Los resultados aparecen en tiempo real.',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="header-notifications"]',
    title: 'Notificaciones',
    content: 'Aquí ves alertas de stock bajo, productos agotados y pedidos pendientes de tu tienda online.',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar-dashboard"]',
    title: 'Dashboard',
    content: 'Tu pantalla principal. Ve las ventas del día, pedidos activos y alertas de inventario de un solo vistazo.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar-inventory"]',
    title: 'Inventario',
    content: 'Gestiona tus productos: crea nuevos, edita precios, controla el stock y organiza por categorías.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar-pos"]',
    title: 'Punto de Venta',
    content: 'Registra ventas presenciales rápidamente. Busca productos, selecciona el método de pago y genera la factura.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar-tienda"]',
    title: 'Tienda Online',
    content: 'Administra tu tienda online: personaliza colores y logo, gestiona pedidos, crea cupones y modera reseñas.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar-history"]',
    title: 'Historial de Ventas',
    content: 'Consulta todas las ventas registradas desde el POS y la tienda online. Filtra por fecha y descarga facturas.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar-settings"]',
    title: 'Configuración',
    content: 'Ajusta los datos de tu empresa, usuarios, integraciones (Cloudinary, WhatsApp) y preferencias generales.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="header-guide"]',
    title: '¡Siempre disponible!',
    content: 'Puedes volver a esta guía cuando quieras desde el botón "Guía" en el header. ¡Eso es todo!',
    placement: 'bottom',
    skipBeacon: true,
  },
]

const EMOJIS = ['👋', '🔍', '🔔', '📊', '📦', '🛒', '🏪', '📋', '⚙️', '📖']

function CustomTooltip({
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  isLastStep,
  size,
}: TooltipRenderProps) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)',
        overflow: 'hidden',
        width: 320,
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        padding: '14px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{EMOJIS[index]}</span>
          <p style={{ color: 'white', fontWeight: 700, fontSize: 15, margin: 0, lineHeight: 1.2 }}>
            {step.title as string}
          </p>
        </div>
        <button
          {...closeProps}
          style={{ color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.55, margin: 0 }}>
          {step.content as string}
        </p>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #f3f4f6' }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === index ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === index ? '#6366f1' : '#d1d5db',
                transition: 'width 0.2s, background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            {...skipProps}
            style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            Omitir
          </button>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {index > 0 && (
              <button
                {...backProps}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}
              >
                <ChevronLeft size={13} /> Atrás
              </button>
            )}
            {isLastStep ? (
              <button
                {...primaryProps}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'white', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700 }}
              >
                <CheckCircle2 size={13} /> ¡Listo!
              </button>
            ) : (
              <button
                {...primaryProps}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'white', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700 }}
              >
                Siguiente <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ProductTourProps {
  open: boolean
  onClose: () => void
}

export function ProductTour({ open, onClose }: ProductTourProps) {
  const setSidebarOpen = useStore(s => s.setSidebarOpen)
  const startedRef = useRef(false)

  useEffect(() => {
    if (open) {
      startedRef.current = true
      setSidebarOpen(true)
    } else {
      setSidebarOpen(false)
      startedRef.current = false
    }
  }, [open, setSidebarOpen])

  const handleCallback = (data: EventData) => {
    const { status } = data
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      onClose()
    }
  }

  return (
    <Joyride
      steps={STEPS}
      run={open}
      continuous
      onEvent={handleCallback}
      tooltipComponent={CustomTooltip}
      options={{
        primaryColor: '#6366f1',
        zIndex: 10000,
        arrowColor: 'white',
        overlayColor: 'rgba(0,0,0,0.58)',
        spotlightRadius: 10,
        spotlightPadding: 8,
        width: 320,
      }}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: '¡Listo!',
        next: 'Siguiente',
        open: 'Abrir',
        skip: 'Omitir',
      }}
    />
  )
}
