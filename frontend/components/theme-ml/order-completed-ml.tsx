'use client'

/**
 * OrderCompletedML — vista "Pedido Completado" estilo Mercado Libre.
 * Render alterno a ModalExito cuando el tema ML está activo. Mismos datos
 * (PedidoConfirmado). Tematizable vía `accentColor`.
 */
import { CheckCircle2, Mail, Package, ChevronRight } from 'lucide-react'
import { ensureAbsoluteUrl } from '@/utils/url'
import type { PedidoConfirmado } from '@/types'

const COP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0)

interface OrderCompletedMLProps {
  pedido: PedidoConfirmado
  onCerrar: () => void
  storeName?: string
  accentColor?: string
}

export function OrderCompletedML({ pedido, onCerrar, storeName = 'la tienda', accentColor = '#3483fa' }: OrderCompletedMLProps) {
  const accent = accentColor
  return (
    <div className="fixed inset-0 z-[200] bg-[#ededed] overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Cabecera de éxito */}
        <div className="bg-white rounded-lg border border-[#e6e6e6] overflow-hidden">
          <div className="p-6 text-center border-b border-[#eee]">
            <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: '#00a650' }} />
            <h1 className="mt-3 text-2xl font-light text-[#333]">¡Listo! Pedido completado</h1>
            <p className="mt-1 text-sm text-[#666]">
              Gracias por tu compra en <span className="font-medium">{storeName}</span>.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 bg-[#f5f5f5] rounded px-3 py-1.5 text-sm">
              <Package className="w-4 h-4" style={{ color: accent }} />
              <span className="text-[#666]">N.º de pedido:</span>
              <span className="font-semibold text-[#333]">{pedido.numeroPedido}</span>
            </div>
          </div>

          {/* Confirmación por email */}
          <div className="px-6 py-4 flex items-center gap-3 border-b border-[#eee]">
            <Mail className="w-5 h-5 shrink-0" style={{ color: accent }} />
            <p className="text-sm text-[#666]">
              Te enviamos la confirmación a <span className="font-medium text-[#333]">{pedido.email}</span>.
            </p>
          </div>

          {/* Vehículo asignado (si aplica) */}
          {pedido.vehiculoAsignado && (
            <div className="px-6 py-3 bg-[#eef7ff] text-sm text-[#333] border-b border-[#eee]">
              Envío asignado: <strong>{pedido.vehiculoAsignado.tipoVehiculo}</strong> · {pedido.vehiculoAsignado.pesoTotal} kg
            </div>
          )}

          {/* Productos */}
          <div className="px-6 py-4">
            <h2 className="text-sm font-semibold text-[#333] mb-3">Tu pedido</h2>
            <ul className="divide-y divide-[#f0f0f0]">
              {pedido.productos.map((p, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <div className="w-14 h-14 shrink-0 rounded border border-[#eee] bg-[#fafafa] overflow-hidden flex items-center justify-center">
                    {p.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ensureAbsoluteUrl(p.imagen)} alt={p.nombre} className="w-full h-full object-contain" />
                    ) : (
                      <Package className="w-5 h-5 text-[#ccc]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#333] truncate">{p.nombre}</p>
                    <p className="text-xs text-[#999]">Cantidad: {p.cantidad}</p>
                  </div>
                  <span className="text-sm text-[#333] shrink-0">{COP((p.precio || 0) * (p.cantidad || 1))}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Total */}
          <div className="px-6 py-4 border-t border-[#eee] flex items-center justify-between">
            <span className="text-[#666]">Total</span>
            <span className="text-xl font-semibold text-[#333]">{COP(pedido.total)}</span>
          </div>
        </div>

        {/* Acciones */}
        <button
          onClick={onCerrar}
          className="mt-4 w-full rounded-md py-3 text-sm font-medium text-white inline-flex items-center justify-center gap-1"
          style={{ backgroundColor: accent }}
        >
          Seguir comprando <ChevronRight className="w-4 h-4" />
        </button>
        <p className="mt-2 text-center text-xs text-[#999]">Fecha: {pedido.fecha}</p>
      </div>
    </div>
  )
}

export default OrderCompletedML
