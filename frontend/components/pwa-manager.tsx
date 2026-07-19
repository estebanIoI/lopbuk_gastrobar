'use client'

/**
 * PwaManager — gestiona la experiencia de "app instalable" en escritorio y móvil:
 *  1. Registra el service worker (necesario para que el navegador ofrezca instalar).
 *  2. Captura `beforeinstallprompt` y muestra un botón "Instalar app" (Chrome/Edge de
 *     escritorio y Android). Se oculta si ya está instalada (display-mode: standalone).
 *  3. Sondea /app-version y, si el servidor tiene un build distinto al que corre el
 *     cliente, muestra un aviso persistente "Actualizar" que recarga a la nueva versión.
 *
 * No cachea la app (el SW actual es solo push), así que "actualizar" = recargar y traer
 * los assets nuevos del servidor. El aviso evita que el comerciante se quede en una
 * versión vieja sin darse cuenta.
 */
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, X } from 'lucide-react'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'
const POLL_MS = 2 * 60 * 1000 // cada 2 minutos + al volver a la pestaña

/**
 * Descarte del botón "Instalar app".
 * Antes solo vivía en el estado del componente: bastaba recargar o navegar para
 * que volviera a aparecer. Ahora se recuerda en localStorage.
 */
const SNOOZE_KEY = 'pwa-install-snooze'
const AUTO_HIDE_MS = 20_000            // se retira solo a los 20s
const SNOOZE_AUTO_MS = 24 * 3600_000   // tras auto-ocultarse: 1 día
const SNOOZE_MANUAL_MS = 7 * 24 * 3600_000 // si el usuario lo cierra: 7 días

function snoozedUntil(): number {
  try { return Number(localStorage.getItem(SNOOZE_KEY)) || 0 } catch { return 0 }
}
function snooze(ms: number) {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms)) } catch { /* modo privado */ }
}

export function PwaManager() {
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const updateShown = useRef(false)

  // Se retira solo pasado un rato: informa sin quedarse estorbando.
  useEffect(() => {
    if (!installEvt || dismissed) return
    const t = setTimeout(() => { setDismissed(true); snooze(SNOOZE_AUTO_MS) }, AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [installEvt, dismissed])

  // ── 1. Registrar el service worker ──
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => { /* no crítico */ })
  }, [])

  // ── 2. Prompt de instalación (escritorio + Android) ──
  useEffect(() => {
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
    if (isStandalone) return
    // Si se descartó hace poco, no reaparece (antes volvía en cada navegación).
    if (snoozedUntil() > Date.now()) return

    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e as BIPEvent) }
    const onInstalled = () => { setInstallEvt(null); toast.success('App instalada') }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // ── 3. Detección de versión nueva ──
  useEffect(() => {
    if (CURRENT_VERSION === 'dev') return // en desarrollo no molesta

    const check = async () => {
      if (updateShown.current) return
      try {
        const res = await fetch('/app-version', { cache: 'no-store' })
        if (!res.ok) return
        const { version } = await res.json()
        if (version && version !== 'dev' && version !== CURRENT_VERSION) {
          updateShown.current = true
          toast('Hay una versión nueva disponible', {
            description: 'Actualiza para obtener las últimas mejoras.',
            duration: Infinity,
            action: { label: 'Actualizar', onClick: () => window.location.reload() },
          })
        }
      } catch { /* red intermitente: reintenta en el próximo ciclo */ }
    }

    check()
    const id = setInterval(check, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const install = async () => {
    if (!installEvt) return
    await installEvt.prompt()
    await installEvt.userChoice.catch(() => {})
    setInstallEvt(null)
  }

  if (!installEvt || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-[300] flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 shadow-lg dark:border-white/10 dark:bg-neutral-900">
      <button onClick={install} className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
        <Download className="h-4 w-4 text-emerald-600" />
        Instalar app
      </button>
      <button
        onClick={() => { setDismissed(true); snooze(SNOOZE_MANUAL_MS) }}
        aria-label="Cerrar" className="text-neutral-400 hover:text-neutral-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
