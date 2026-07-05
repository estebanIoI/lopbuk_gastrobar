/**
 * whatsapp.service.ts
 * HTTP client for the Evolution API (self-hosted WhatsApp Web wrapper).
 * Configure via env vars: EVOLUTION_API_URL, EVOLUTION_API_KEY
 */

const BASE_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const API_KEY  = process.env.EVOLUTION_API_KEY  || '';

function headers() {
  return {
    'Content-Type': 'application/json',
    'apikey':       API_KEY,
  };
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!BASE_URL) throw new Error('EVOLUTION_API_URL no configurado');

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(`Evolution API ${method} ${path} → ${res.status}: ${text}`);
  }
  return data as T;
}

// ─────────────────────────────────────────────────────────────
// Send text message
// ─────────────────────────────────────────────────────────────

export async function sendTextMessage(
  instanceName: string,
  to: string,
  text: string,
): Promise<void> {
  // Normalize phone: strip non-digits, ensure country code is present
  const number = to.replace(/\D/g, '');
  await api('POST', `/message/sendText/${instanceName}`, { number, text });
}

/**
 * Envío de MARKETING por WhatsApp — Ley 1581: exige autorización previa.
 * Cualquier feature futura de campañas/broadcast DEBE usar esta función (no
 * sendTextMessage directo): verifica el último consentimiento marketing_whatsapp
 * del teléfono y no envía si el cliente no autorizó o revocó ("BAJA"/"STOP").
 */
export async function sendMarketingMessage(
  tenantId: string,
  instanceName: string,
  to: string,
  text: string,
): Promise<{ sent: boolean; reason?: string }> {
  const { privacyService } = await import('../privacy/privacy.service');
  const allowed = await privacyService.hasConsent(tenantId, to, 'marketing_whatsapp');
  if (!allowed) {
    return { sent: false, reason: 'sin-consentimiento-marketing' };
  }
  await sendTextMessage(instanceName, to, text);
  return { sent: true };
}

// ─────────────────────────────────────────────────────────────
// Instance management
// ─────────────────────────────────────────────────────────────

export interface InstanceStatus {
  state: 'open' | 'close' | 'connecting' | 'unknown';
  qrcode?: string;
}

export async function getInstanceStatus(instanceName: string): Promise<InstanceStatus> {
  try {
    const data = await api<any>('GET', `/instance/connectionState/${instanceName}`);
    const state = data?.instance?.state || data?.state || 'unknown';
    return { state };
  } catch {
    return { state: 'unknown' };
  }
}

export async function getQRCode(instanceName: string): Promise<string | null> {
  try {
    const data = await api<any>('GET', `/instance/connect/${instanceName}`);
    return data?.base64 || data?.qrcode?.base64 || null;
  } catch {
    return null;
  }
}

export async function createInstance(instanceName: string): Promise<{ qrcode: string | null }> {
  const data = await api<any>('POST', '/instance/create', {
    instanceName,
    qrcode:     true,
    integration: 'WHATSAPP-BAILEYS',
  });
  const qrcode = data?.qrcode?.base64 || null;
  return { qrcode };
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await api('DELETE', `/instance/delete/${instanceName}`);
}

// ─────────────────────────────────────────────────────────────
// Set webhook on an instance so Evolution API sends events here
// ─────────────────────────────────────────────────────────────

export async function setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
  // Evolution API v2 body format (flat, no nested "webhook" object)
  await api('POST', `/webhook/set/${instanceName}`, {
    url:               webhookUrl,
    webhook_by_events: false,
    webhook_base64:    false,
    events:            ['MESSAGES_UPSERT'],
  });
}
