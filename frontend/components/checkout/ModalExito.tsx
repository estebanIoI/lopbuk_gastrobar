"use client";

import { useState } from 'react';
import { Check, Mail, ShoppingBag, Truck, Copy, CheckCheck, Package, PartyPopper, ArrowRight, ShieldCheck } from 'lucide-react';

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
import { ensureAbsoluteUrl } from '@/utils/url';
import type { PedidoConfirmado } from '@/types';

interface ModalExitoProps {
  pedido: PedidoConfirmado;
  onCerrar: () => void;
  accentColor?: string;
}

export function ModalExito({ pedido, onCerrar, accentColor = '#059669' }: ModalExitoProps) {
  const [copied, setCopied] = useState(false);

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(pedido.numeroPedido);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard no disponible */ }
  };

  // Desglose: usa los campos nuevos si vienen; si no, cae al total como subtotal.
  const subtotal = pedido.subtotal ?? pedido.total;
  const descuento = pedido.descuento ?? 0;
  const envio = pedido.envio ?? 0;
  const hasBreakdown = descuento > 0 || envio > 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <style>{`
        @keyframes sm-pop { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes sm-ring { 0% { transform: scale(.6); opacity: .55 } 100% { transform: scale(1.8); opacity: 0 } }
        @keyframes sm-slide { 0% { transform: translateY(16px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        .sm-card { animation: sm-slide .35s cubic-bezier(.16,1,.3,1) both }
        .sm-check { animation: sm-pop .5s cubic-bezier(.16,1,.3,1) both }
        .sm-ring { animation: sm-ring 1.4s ease-out .2s infinite }
      `}</style>

      <div className="sm-card bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* ── Header celebratorio ── */}
        <div className="relative px-6 pt-8 pb-7 text-center text-white overflow-hidden shrink-0"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd 55%, #0f172a)` }}>
          {/* Halo decorativo */}
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(60% 60% at 50% 0%, #fff, transparent 70%)' }} />
          <div className="relative">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <span className="sm-ring absolute inset-0 rounded-full bg-white/40" />
              <div className="sm-check relative w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg">
                <Check className="w-10 h-10" style={{ color: accentColor }} strokeWidth={3} />
              </div>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center justify-center gap-2">
              ¡Pedido confirmado! <PartyPopper className="w-5 h-5 opacity-90" />
            </h2>
            <p className="text-white/85 text-sm mt-1">
              Gracias por tu compra. Ya estamos preparando tu pedido.
            </p>
          </div>
        </div>

        {/* ── Cuerpo scrolleable ── */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Número de pedido con copiar */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">N.º de pedido</div>
              <div className="text-lg font-bold text-gray-900 tracking-wide truncate">{pedido.numeroPedido}</div>
            </div>
            <button
              onClick={copyOrder}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors"
              style={copied
                ? { color: accentColor, borderColor: accentColor, background: `${accentColor}12` }
                : { color: '#374151', borderColor: '#d1d5db', background: '#fff' }}
            >
              {copied ? <><CheckCheck className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
            </button>
          </div>

          {/* Confirmación por correo */}
          {pedido.email && (
            <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-gray-600">
                Enviamos la confirmación a <strong className="text-gray-900">{pedido.email}</strong>. Revisa también tu carpeta de spam.
              </div>
            </div>
          )}

          {/* Vehículo asignado (ferretería) */}
          {pedido.vehiculoAsignado && (
            <div className="flex items-start gap-3 rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
              <Truck className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <div className="text-xs text-gray-600">
                Despacho asignado: <strong className="text-gray-900">{pedido.vehiculoAsignado.tipoVehiculo}</strong>
                {' '}· Peso del pedido <strong className="text-gray-900">{pedido.vehiculoAsignado.pesoTotal.toFixed(2)} kg</strong>
              </div>
            </div>
          )}

          {/* Productos */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Productos ({pedido.productos.length})
              </span>
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {pedido.productos.map((item, i) => (
                <div key={`${item.id}-${i}`} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
                  {item.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ensureAbsoluteUrl(item.imagen)} alt={item.nombre} className="w-11 h-11 rounded-md object-cover bg-gray-100 shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">{item.nombre}</div>
                    <div className="text-[11px] text-gray-500">Cantidad: {item.cantidad}</div>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 shrink-0">
                    {formatCOP(item.precio * item.cantidad)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desglose de totales */}
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
            {hasBreakdown && (
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
                </div>
                {descuento > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Descuento</span><span>-{formatCOP(descuento)}</span>
                  </div>
                )}
                {envio > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-gray-400" /> Envío</span>
                    <span>+{formatCOP(envio)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Total a pagar</span>
              <span className="text-xl font-extrabold" style={{ color: accentColor }}>{formatCOP(pedido.total)}</span>
            </div>
          </div>

          {/* Método de pago + fecha */}
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            {pedido.metodoPago
              ? <span className="inline-flex items-center gap-1 font-medium text-gray-600"><ShieldCheck className="w-3.5 h-3.5" /> {pedido.metodoPago}</span>
              : <span />}
            <span>{pedido.fecha}</span>
          </div>
        </div>

        {/* ── CTA fijo ── */}
        <div className="p-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onCerrar}
            className="w-full inline-flex items-center justify-center gap-2 text-white py-3.5 rounded-xl font-semibold tracking-wide transition-transform hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: accentColor }}
          >
            Seguir comprando <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
