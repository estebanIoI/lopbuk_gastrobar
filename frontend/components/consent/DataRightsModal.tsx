"use client"

import { useState } from 'react'
import { X } from 'lucide-react'

interface DataRightsModalProps {
  tenantId?: string | null
  apiUrl: string
  onClose: () => void
}

const REQUEST_TYPES = [
  { value: 'access', label: 'Conocer mis datos', desc: 'Recibir copia de los datos que este comercio tiene sobre mí' },
  { value: 'rectify', label: 'Corregir mis datos', desc: 'Actualizar información incorrecta o desactualizada' },
  { value: 'erase', label: 'Eliminar mis datos', desc: 'Suprimir mis datos personales (derecho al olvido)' },
  { value: 'revoke_consent', label: 'Revocar autorización', desc: 'Dejar de recibir mensajes de marketing' },
] as const

/**
 * Formulario público de habeas data (Ley 1581 arts. 14-15): el cliente final
 * crea una solicitud que el comercio debe responder en máximo 10 días hábiles.
 */
export function DataRightsModal({ tenantId, apiUrl, onClose }: DataRightsModalProps) {
  const [requestType, setRequestType] = useState<string>('access')
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const submit = async () => {
    if (!tenantId) {
      setResult({ ok: false, message: 'No se pudo identificar la tienda. Recarga la página.' })
      return
    }
    if (name.trim().length < 3 || identifier.trim().length < 5) {
      setResult({ ok: false, message: 'Ingresa tu nombre completo y el teléfono o email con el que compraste.' })
      return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(`${apiUrl}/privacy/public/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          requestType,
          identifier: identifier.trim(),
          requesterName: name.trim(),
          details: details.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ ok: true, message: data.data?.message || 'Solicitud registrada correctamente.' })
      } else {
        setResult({ ok: false, message: data.error || 'No se pudo registrar la solicitud.' })
      }
    } catch {
      setResult({ ok: false, message: 'Error de conexión. Intenta de nuevo.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <h2 className="font-semibold text-base">Protección de datos personales</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {result?.ok ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              ✓ {result.message}
            </div>
          ) : (
            <>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Conforme a la Ley 1581 de 2012 (Habeas Data), puedes ejercer tus derechos sobre los datos
                personales que este comercio guarda de ti. El comercio debe responder en máximo{' '}
                <strong>10 días hábiles</strong>.
              </p>

              <div className="space-y-2">
                {REQUEST_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      requestType === t.value ? 'border-foreground bg-muted' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="requestType"
                      value={t.value}
                      checked={requestType === t.value}
                      onChange={() => setRequestType(t.value)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-medium">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Nombre completo *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="El nombre que usaste al comprar"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Teléfono o email de tus compras *</label>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Ej: 3001234567"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Detalles (opcional)</label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={2}
                    placeholder="Cuéntanos qué necesitas"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {result && !result.ok && (
                <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                  {result.message}
                </div>
              )}

              <button
                onClick={submit}
                disabled={sending}
                className="w-full rounded-full bg-foreground py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {sending ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
