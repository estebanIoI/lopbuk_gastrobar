'use client'

/**
 * Página de resultado de pago Wompi. Wompi redirige aquí tras el checkout con
 * ?ref=<referencia>&id=<txWompi>. Consultamos nuestra transacción por `ref` y
 * hacemos polling hasta que el webhook la marque en estado final.
 */
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

const COP = (cents: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format((cents || 0) / 100)

function Resultado() {
  const params = useSearchParams()
  const router = useRouter()
  const ref = params.get('ref') || ''
  const [status, setStatus] = useState<string>('PENDING')
  const [txn, setTxn] = useState<any>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!ref) { setDone(true); return }
    let alive = true
    let attempts = 0
    const tick = async () => {
      attempts++
      try {
        const res = await api.getPaymentTransaction(ref)
        if (alive && res?.success && res.data) {
          setTxn(res.data)
          const s = String(res.data.status || 'PENDING').toUpperCase()
          setStatus(s)
          if (s !== 'PENDING') { setDone(true); return }
        }
      } catch { /* reintenta */ }
      if (alive && attempts < 24) setTimeout(tick, 2500)
      else if (alive) setDone(true)
    }
    tick()
    return () => { alive = false }
  }, [ref])

  const approved = status === 'APPROVED'
  const failed = ['DECLINED', 'VOIDED', 'ERROR'].includes(status)
  const pending = !approved && !failed

  return (
    <div className="min-h-screen bg-[#ededed] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#e6e6e6] max-w-md w-full p-8 text-center">
        {pending && !done && (
          <>
            <Loader2 className="w-14 h-14 mx-auto animate-spin" style={{ color: '#3483fa' }} />
            <h1 className="mt-4 text-xl font-light text-[#333]">Confirmando tu pago…</h1>
            <p className="mt-1 text-sm text-[#666]">Estamos verificando la transacción con Wompi. Esto puede tardar unos segundos.</p>
          </>
        )}
        {approved && (
          <>
            <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: '#00a650' }} />
            <h1 className="mt-3 text-2xl font-light text-[#333]">¡Pago aprobado!</h1>
            <p className="mt-1 text-sm text-[#666]">Tu pago se procesó correctamente.</p>
          </>
        )}
        {failed && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-[#e74c3c]" />
            <h1 className="mt-3 text-2xl font-light text-[#333]">Pago no completado</h1>
            <p className="mt-1 text-sm text-[#666]">La transacción quedó en estado <strong>{status}</strong>. Puedes intentarlo de nuevo.</p>
          </>
        )}
        {pending && done && !approved && !failed && (
          <>
            <Loader2 className="w-14 h-14 mx-auto text-[#999]" />
            <h1 className="mt-4 text-xl font-light text-[#333]">Pago en proceso</h1>
            <p className="mt-1 text-sm text-[#666]">Aún no recibimos la confirmación. Te avisaremos cuando se acredite.</p>
          </>
        )}

        {txn && (
          <div className="mt-5 text-left text-sm bg-[#f7f7f7] rounded-lg p-4 space-y-1">
            <div className="flex justify-between"><span className="text-[#999]">Referencia</span><span className="text-[#333] font-medium break-all">{txn.reference}</span></div>
            {txn.amount_in_cents != null && <div className="flex justify-between"><span className="text-[#999]">Monto</span><span className="text-[#333] font-medium">{COP(Number(txn.amount_in_cents))}</span></div>}
            <div className="flex justify-between"><span className="text-[#999]">Estado</span><span className="text-[#333] font-medium">{status}</span></div>
          </div>
        )}

        <button onClick={() => router.push('/')} className="mt-6 w-full rounded-md py-3 text-sm font-medium text-white" style={{ backgroundColor: '#3483fa' }}>
          Volver
        </button>
      </div>
    </div>
  )
}

export default function PagoResultadoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#ededed]"><Loader2 className="w-8 h-8 animate-spin text-[#999]" /></div>}>
      <Resultado />
    </Suspense>
  )
}
