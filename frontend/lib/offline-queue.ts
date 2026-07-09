/**
 * Cola offline para la app del conductor/auxiliar.
 *
 * Cuando una acción crítica (marcar entregado, prueba de entrega) no puede subir
 * por falta de señal, se ENCOLA en localStorage con un clientActionId único y se
 * reintenta al reconectar (evento `online`) o cada 30s. El backend es idempotente:
 * aunque una acción se reintente varias veces, se aplica UNA sola vez.
 *
 * Uso: en vez de llamar api.updateDeliveryStatus directo, pasa la acción por
 * `enqueueOrRun`. Si hay red, se ejecuta ya; si no, queda en cola y se sincroniza.
 */

const STORAGE_KEY = 'lopbuk_offline_queue_v1'

export interface QueuedAction {
  id: string            // clientActionId (idempotencia)
  kind: 'delivery-status'
  label: string         // texto para el indicador ("Entrega #123")
  payload: any
  createdAt: number
  attempts: number
}

type Listener = (pending: QueuedAction[]) => void
const listeners = new Set<Listener>()

function genId(): string {
  try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }
}

function read(): QueuedAction[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function write(list: QueuedAction[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  listeners.forEach(l => l(list))
}

export function getPending(): QueuedAction[] { return read() }
export function subscribe(l: Listener): () => void {
  listeners.add(l); l(read())
  return () => { listeners.delete(l) }
}

/** Ejecuta la acción ejecutora (`runner`) con el clientActionId; encola si falla por red. */
export async function enqueueOrRun(
  kind: QueuedAction['kind'],
  label: string,
  payload: any,
  runner: (payload: any, clientActionId: string) => Promise<{ success: boolean; error?: string }>,
): Promise<{ ok: boolean; queued: boolean }> {
  const id = genId()
  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  if (online) {
    try {
      const res = await runner(payload, id)
      if (res?.success) return { ok: true, queued: false }
      // Falla de negocio (no de red) → no encolar, dejar que la UI lo muestre
      return { ok: false, queued: false }
    } catch {
      // Falla de red → cae a la cola
    }
  }
  const list = read()
  list.push({ id, kind, label, payload, createdAt: Date.now(), attempts: 0 })
  write(list)
  return { ok: true, queued: true }
}

/** Runners registrados por tipo de acción (los define el componente que sincroniza). */
const runners: Record<string, (payload: any, clientActionId: string) => Promise<{ success: boolean }>> = {}
export function registerRunner(kind: QueuedAction['kind'], fn: (payload: any, clientActionId: string) => Promise<{ success: boolean }>) {
  runners[kind] = fn
}

/** Intenta subir todo lo pendiente. Devuelve cuántas se sincronizaron. */
export async function flushQueue(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0
  let list = read()
  if (!list.length) return 0
  let synced = 0
  const remaining: QueuedAction[] = []
  for (const action of list) {
    const runner = runners[action.kind]
    if (!runner) { remaining.push(action); continue }
    try {
      const res = await runner(action.payload, action.id)
      if (res?.success) { synced++; continue }        // aplicada (o duplicada → idempotente)
      remaining.push({ ...action, attempts: action.attempts + 1 })
    } catch {
      remaining.push({ ...action, attempts: action.attempts + 1 }) // sigue sin red
    }
  }
  write(remaining)
  return synced
}

let started = false
/** Arranca el auto-flush: al volver la conexión y cada 30s. Idempotente. */
export function startAutoFlush() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => { flushQueue() })
  setInterval(() => { flushQueue() }, 30000)
  // Intento inicial
  flushQueue()
}
