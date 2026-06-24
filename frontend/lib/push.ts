/**
 * push.ts — registro de Web Push en el cliente. Registra el service worker,
 * pide permiso, se suscribe con la clave VAPID del backend y la guarda.
 */
import { api } from '@/lib/api'

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** Activa las notificaciones. Devuelve { ok, error? }. */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'Tu navegador no soporta notificaciones.' }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, error: 'Permiso de notificaciones denegado.' }

    const keyRes = await api.getPushPublicKey()
    if (!keyRes.success || !keyRes.data?.publicKey) return { ok: false, error: 'No se pudo obtener la clave del servidor.' }

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey) as BufferSource,
      })
    }
    const r = await api.savePushSubscription(sub.toJSON())
    if (!r.success) return { ok: false, error: r.error || 'No se pudo registrar.' }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error al activar notificaciones.' }
  }
}

export function pushPermissionState(): 'default' | 'granted' | 'denied' | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission as any
}
