"use client";

import { CheckCircle, Mail, ShoppingBag, Truck } from 'lucide-react';

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
import { ensureAbsoluteUrl } from '@/utils/url';
import type { PedidoConfirmado } from '@/types';

interface ModalExitoProps {
  pedido: PedidoConfirmado;
  onCerrar: () => void;
}

export function ModalExito({ pedido, onCerrar }: ModalExitoProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header con icono de éxito */}
        <div className="bg-green-50 p-8 text-center border-b border-green-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-light text-gray-900 tracking-wide mb-2">
            ¡Pedido Registrado con Éxito!
          </h2>
          <p className="text-gray-600 font-light text-sm">
            Tu pedido ha sido procesado correctamente
          </p>
        </div>

        {/* Detalles del pedido */}
        <div className="p-6 space-y-6">
          {/* Número de pedido */}
          <div className="bg-gray-50 p-4 text-center">
            <div className="text-xs text-gray-500 font-light tracking-wide mb-1">NÚMERO DE PEDIDO</div>
            <div className="text-xl font-light text-gray-900 tracking-wider">{pedido.numeroPedido}</div>
          </div>

          {/* Información del correo */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100">
            <Mail size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-light text-gray-900 mb-1">
                Confirmación enviada por correo
              </div>
              <div className="text-xs text-gray-600">
                Hemos enviado los detalles de tu pedido a <strong>{pedido.email}</strong>
              </div>
            </div>
          </div>

          {/* Resumen de productos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag size={16} className="text-gray-500" />
              <span className="text-sm font-light text-gray-700">Productos ({pedido.productos.length})</span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {pedido.productos.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50">
                  {item.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ensureAbsoluteUrl(item.imagen)}
                      alt={item.nombre}
                      className="w-10 h-10 object-cover bg-gray-100"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 flex items-center justify-center">
                      <ShoppingBag size={16} className="text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-light text-gray-900 truncate">{item.nombre}</div>
                    <div className="text-xs text-gray-500">Cantidad: {item.cantidad}</div>
                  </div>
                  <div className="text-right">
                    {item.descuentoPorcentaje && item.descuentoPorcentaje > 0 && (
                      <div className="text-[9px] text-green-600">-{item.descuentoPorcentaje}%</div>
                    )}
                    <div className="text-xs font-light text-gray-900">
                      {formatCOP(item.precio * item.cantidad)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vehículo asignado (ferretería) */}
          {pedido.vehiculoAsignado && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-100">
              <Truck size={20} className="text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-light text-gray-900 mb-1">
                  Vehículo de despacho asignado
                </div>
                <div className="text-xs text-gray-600">
                  <strong>{pedido.vehiculoAsignado.tipoVehiculo}</strong> — Peso del pedido:{' '}
                  <strong>{pedido.vehiculoAsignado.pesoTotal.toFixed(2)} kg</strong>
                </div>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <span className="text-sm font-light text-gray-600">Pedido Contra Entrega</span>
            <span className="text-sm font-light text-gray-600">Total a Pagar: </span>
            <span className="text-xl font-light text-gray-900">
              {formatCOP(pedido.total)}
            </span>
          </div>

          {/* Fecha */}
          <div className="text-center text-xs text-gray-500 font-light">
            Pedido realizado el {pedido.fecha}
          </div>

          {/* Botón */}
          <button
            onClick={onCerrar}
            className="w-full bg-gray-900 text-white py-4 font-light tracking-wide hover:bg-gray-800 transition-colors"
          >
            VOLVER A LA TIENDA
          </button>
        </div>
      </div>
    </div>
  );
}
