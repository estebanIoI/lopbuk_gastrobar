"use client"

import { useEffect, useState } from 'react'
import {
  getStoredConsent,
  storeConsent,
  syncConsentToBackend,
  type ConsentState,
} from '@/lib/consent'

interface CookieConsentBannerProps {
  tenantId?: string | null
  apiUrl: string
  /** Abre la política de cookies/privacidad de la tienda (modal legal existente). */
  onOpenPolicy?: () => void
}

/**
 * Banner de consentimiento granular (Ley 1581 / RGPD).
 * Analítica y marketing (Meta Pixel) quedan bloqueados hasta aceptación explícita.
 */
export function CookieConsentBanner({ tenantId, apiUrl, onOpenPolicy }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    // Solo se muestra si no hay una decisión vigente para esta versión de política
    if (!getStoredConsent()) setVisible(true)
  }, [])

  const decide = (analyticsGranted: boolean, marketingGranted: boolean) => {
    const state: ConsentState = storeConsent(analyticsGranted, marketingGranted)
    if (tenantId) void syncConsentToBackend(apiUrl, tenantId, state)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">🍪 Tu privacidad importa</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          Usamos cookies esenciales para que la tienda funcione (sesión y carrito). La analítica y el
          marketing (Meta Pixel) solo se activan si tú lo autorizas.{' '}
          {onOpenPolicy && (
            <button type="button" onClick={onOpenPolicy} className="underline hover:text-gray-900 dark:hover:text-gray-100">
              Ver política de cookies
            </button>
          )}
        </p>

        {showConfig && (
          <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
            <label className="flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-200">
              <span><span className="font-medium">Esenciales</span> — sesión y carrito (siempre activas)</span>
              <input type="checkbox" checked disabled className="h-4 w-4 accent-gray-400" />
            </label>
            <label className="flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-200">
              <span><span className="font-medium">Analítica</span> — medición de uso de la tienda</span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-200">
              <span><span className="font-medium">Marketing</span> — Meta Pixel para campañas del comercio</span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => decide(true, true)}
            className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Aceptar todo
          </button>
          <button
            type="button"
            onClick={() => decide(false, false)}
            className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Solo esenciales
          </button>
          {showConfig ? (
            <button
              type="button"
              onClick={() => decide(analytics, marketing)}
              className="rounded-full border border-emerald-600 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
            >
              Guardar selección
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfig(true)}
              className="px-2 py-2 text-xs font-medium text-gray-500 underline hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Configurar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
