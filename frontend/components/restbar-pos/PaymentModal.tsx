'use client'

import { useState } from 'react'
import type { Order } from './PosShell'
import { X, Banknote, CreditCard, Smartphone, ArrowLeftRight } from 'lucide-react'

interface PaymentModalProps {
  order: Order
  onPay: (data: { paymentMethod: string; amountPaid: number; guestNumber?: number | null }) => void
  onClose: () => void
}

const PAY_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote, color: 'bg-emerald-600 hover:bg-emerald-500' },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard, color: 'bg-blue-600 hover:bg-blue-500' },
  { id: 'nequi', label: 'Nequi', icon: Smartphone, color: 'bg-purple-600 hover:bg-purple-500' },
  { id: 'transferencia', label: 'Transferencia', icon: ArrowLeftRight, color: 'bg-amber-600 hover:bg-amber-500' },
  { id: 'mixto', label: 'Mixto', icon: Banknote, color: 'bg-zinc-600 hover:bg-zinc-500' },
]

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export function PaymentModal({ order, onPay, onClose }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('efectivo')
  const [amountReceived, setAmountReceived] = useState('')
  const [processing, setProcessing] = useState(false)

  const total = order.total
  const received = parseFloat(amountReceived) || 0
  const change = received - total

  const handlePay = async () => {
    if (received <= 0) return
    setProcessing(true)
    await onPay({
      paymentMethod: selectedMethod,
      amountPaid: received,
    })
    setProcessing(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[250] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-100">Cobrar</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Order info */}
        <div className="mb-4 p-3 bg-zinc-800 rounded-xl">
          <div className="flex justify-between text-sm text-zinc-400">
            <span>Mesa {order.tableNumber}</span>
            <span>{order.orderNumber}</span>
          </div>
          <div className="text-2xl font-extrabold text-zinc-100 mt-1">
            {formatCOP(total)}
          </div>
        </div>

        {/* Payment methods */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PAY_METHODS.map(m => (
            <button key={m.id}
              onClick={() => setSelectedMethod(m.id)}
              className={`p-3 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold transition-all
                ${selectedMethod === m.id
                  ? `${m.color} text-white ring-2 ring-white/20`
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
              <m.icon className="h-5 w-5" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Amount received */}
        <div className="mb-4">
          <label className="text-xs text-zinc-500 mb-1 block">Monto recibido</label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[total, total + 5000, total + 10000, total + 20000, total + 50000, 100000].map(amt => (
              <button key={amt}
                onClick={() => setAmountReceived(String(amt))}
                className="h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-semibold text-zinc-300 transition-colors">
                {formatCOP(amt)}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={amountReceived}
            onChange={e => setAmountReceived(e.target.value)}
            placeholder="Ingresa el monto..."
            className="w-full h-12 px-4 bg-zinc-800 border border-zinc-700 rounded-xl text-lg font-bold text-zinc-100
              placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-center"
          />
        </div>

        {/* Change */}
        {received > 0 && change >= 0 && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl mb-4 text-center">
            <div className="text-xs text-green-400">Cambio</div>
            <div className="text-xl font-extrabold text-green-300">{formatCOP(change)}</div>
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={received <= 0 || processing}
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500
            text-white rounded-xl text-sm font-bold transition-colors">
          {processing ? 'Procesando...' : `Cobrar ${formatCOP(total)}`}
        </button>
      </div>
    </div>
  )
}
