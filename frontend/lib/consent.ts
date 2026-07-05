/**
 * Consentimiento de cookies/rastreo del cliente final (Ley 1581 / RGPD).
 * La decisión vive en localStorage['dz_consent'] y se replica al backend
 * (consent_records) como prueba. Marketing (Meta Pixel) y analítica quedan
 * bloqueados hasta que el usuario acepte.
 */

export const CONSENT_POLICY_VERSION = '1.0'
export const CONSENT_STORAGE_KEY = 'dz_consent'
export const CONSENT_CHANGED_EVENT = 'dz-consent-changed'

export interface ConsentState {
  version: string
  essential: true
  analytics: boolean
  marketing: boolean
  decidedAt: string
}

export function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentState
    // Si cambió la versión de la política, hay que volver a preguntar
    if (parsed.version !== CONSENT_POLICY_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function storeConsent(analytics: boolean, marketing: boolean): ConsentState {
  const state: ConsentState = {
    version: CONSENT_POLICY_VERSION,
    essential: true,
    analytics,
    marketing,
    decidedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state))
  } catch { /* modo incógnito con storage bloqueado: la sesión sigue sin rastreo */ }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: state }))
  return state
}

export function hasMarketingConsent(): boolean {
  return getStoredConsent()?.marketing === true
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics === true
}

/** Replica la decisión al backend como registro inmutable de consentimiento. */
export async function syncConsentToBackend(apiUrl: string, tenantId: string, state: ConsentState): Promise<void> {
  try {
    await fetch(`${apiUrl}/privacy/public/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        source: 'cookie_banner',
        policyVersion: state.version,
        consents: [
          { type: 'analytics_tracking', granted: state.analytics },
          { type: 'marketing_email', granted: state.marketing },
        ],
      }),
    })
  } catch { /* sin red no bloqueamos la tienda; queda el registro local */ }
}
