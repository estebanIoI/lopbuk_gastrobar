'use client'

/**
 * WompiSubscribeButton — botón para que el comercio pague su suscripción con Wompi.
 * Inicia el checkout (monto resuelto en el servidor según el plan) y redirige a Wompi.
 * Al volver, /pago/resultado consulta el estado y el webhook activa el plan.
 *
 * Uso: <WompiSubscribeButton plan="profesional" label="Pagar Plan Profesional" />
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

export type PlanKey = 'basico' | 'profesional' | 'empresarial'

export function WompiSubscribeButton({
  plan,
  label,
  className,
}: {
  plan: PlanKey
  label?: string
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pay = async () => {
    setLoading(true); setError('')
    try {
      const redirectUrl = `${window.location.origin}/pago/resultado`
      const res = await api.createPaymentCheckout({ context: 'subscription', contextId: plan, redirectUrl })
      if (res?.success && res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl
        return
      }
      setError(res?.error || 'No se pudo iniciar el pago')
    } catch (e: any) {
      setError(e?.message || 'Error al iniciar el pago')
    }
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={pay}
        disabled={loading}
        className={className || 'inline-flex items-center justify-center gap-2 rounded-md bg-[#3483fa] text-white text-sm font-medium px-4 py-2.5 disabled:opacity-60 hover:opacity-90 transition-opacity'}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {label || 'Pagar con Wompi'}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export default WompiSubscribeButton
