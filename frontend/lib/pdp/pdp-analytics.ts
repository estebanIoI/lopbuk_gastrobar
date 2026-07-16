// ── PurchaseFlow · emisor de eventos del PDP ─────────────────────────────────
// Fase 1 del Motor de PDP de DAIMUZ. Instrumenta cada interacción relevante del
// comprador. El sink real (endpoint / pipeline de analytics) llega en Fase 4; hoy
// despacha un CustomEvent `pdp:event` en window (para que un sink pueda escuchar
// sin acoplar) + console.debug en dev. Instrumentar temprano evita reinstrumentar.
//
// Regla del motor: SOLO el flujo emite eventos. Los componentes visuales llaman a
// emitPdpEvent en sus handlers, nunca hablan con un analytics concreto.

export type PdpEventName =
  | 'VIEW_PRODUCT'
  | 'SELECT_VARIANT'
  | 'CHANGE_PACK'
  | 'VIEW_SIZE_GUIDE'
  | 'OPEN_FAQ'
  | 'CLICK_REVIEW'
  | 'ADD_TO_CART'
  | 'BUY_NOW'
  | 'SCROLL_50'
  | 'SCROLL_100'

export interface PdpEventPayload {
  productId?: string | number
  [key: string]: unknown
}

export function emitPdpEvent(name: PdpEventName, payload: PdpEventPayload = {}): void {
  const detail = { name, ts: Date.now(), ...payload }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('pdp:event', { detail }))
    } catch {
      /* entornos sin CustomEvent: no-op */
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[pdp]', name, payload)
  }
}
