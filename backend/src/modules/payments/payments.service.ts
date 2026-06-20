/**
 * payments.service — Núcleo de la pasarela de pago Wompi (Fase 1: plataforma).
 *
 * Las llaves Wompi del SUPERADMIN cobran a los comercios (suscripciones, paquetes…).
 * Integración Web Checkout: el backend genera la referencia + la FIRMA DE INTEGRIDAD
 * (SHA256, server-side) y el front redirige a Wompi. La confirmación llega por WEBHOOK,
 * verificada con el secreto de eventos. Las llaves se guardan CIFRADAS (crypto AES-256).
 *
 * Docs: https://docs.wompi.co/docs/colombia/widget-checkout-web/
 */
import crypto from 'crypto';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { encrypt, decrypt } from '../../utils/crypto';

export type WompiEnv = 'sandbox' | 'production';
export type PayContext = 'subscription' | 'package' | 'order';

const CHECKOUT_URL = 'https://checkout.wompi.co/p/';
export const apiBase = (env: WompiEnv) =>
  env === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';

// Planes de suscripción (mismos límites que el flujo MercadoPago existente).
type PlanKey = 'basico' | 'profesional' | 'empresarial';
const PLAN_LIMITS: Record<PlanKey, { maxUsers: number; maxProducts: number }> = {
  basico:      { maxUsers: 3,    maxProducts: 100  },
  profesional: { maxUsers: 10,   maxProducts: 1000 },
  empresarial: { maxUsers: 9999, maxProducts: 9999 },
};

/** Lee un valor de platform_settings (precios de planes, etc.). */
async function getPlatformSetting(key: string): Promise<string | null> {
  const [rows]: any = await db.query(`SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1`, [key]);
  return rows?.[0]?.setting_value ?? null;
}

interface PlatformGateway {
  provider: string;
  environment: WompiEnv;
  publicKey: string | null;
  privateKey: string | null;
  integritySecret: string | null;
  eventsSecret: string | null;
  isActive: boolean;
}

/** Lee la config de plataforma con las llaves DESCIFRADAS (uso interno). */
async function getPlatformGatewayRaw(): Promise<PlatformGateway | null> {
  const [rows]: any = await db.query(`SELECT * FROM platform_payment_gateways WHERE provider = 'wompi' LIMIT 1`);
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  const dec = (v: any) => (v ? decrypt(String(v)) : null);
  return {
    provider: 'wompi',
    environment: (r.environment as WompiEnv) || 'sandbox',
    publicKey: dec(r.public_key),
    privateKey: dec(r.private_key),
    integritySecret: dec(r.integrity_secret),
    eventsSecret: dec(r.events_secret),
    isActive: !!r.is_active,
  };
}

/** Config segura para la UI del superadmin: NO expone secretos, solo si están seteados. */
export async function getPlatformGatewayPublic() {
  const gw = await getPlatformGatewayRaw();
  if (!gw) return { provider: 'wompi', environment: 'sandbox' as WompiEnv, isActive: false, publicKey: '', hasPrivateKey: false, hasIntegritySecret: false, hasEventsSecret: false };
  return {
    provider: 'wompi',
    environment: gw.environment,
    isActive: gw.isActive,
    publicKey: gw.publicKey || '', // la pública no es secreta
    hasPrivateKey: !!gw.privateKey,
    hasIntegritySecret: !!gw.integritySecret,
    hasEventsSecret: !!gw.eventsSecret,
  };
}

/** Guarda/actualiza la config. Los campos vacíos NO sobrescriben (se mantiene lo existente). */
export async function savePlatformGateway(data: {
  environment?: WompiEnv;
  publicKey?: string;
  privateKey?: string;
  integritySecret?: string;
  eventsSecret?: string;
  isActive?: boolean;
}) {
  const [rows]: any = await db.query(
    `SELECT public_key, private_key, integrity_secret, events_secret, environment, is_active FROM platform_payment_gateways WHERE provider = 'wompi' LIMIT 1`
  );
  const cur = rows?.[0] || {};
  // Si llega un valor nuevo no vacío → cifrar; si no → conservar el cifrado existente.
  const keep = (incoming: string | undefined, curEnc: any) =>
    incoming && incoming.trim() ? encrypt(incoming.trim()) : (curEnc ?? null);

  const environment: WompiEnv = data.environment || (cur.environment as WompiEnv) || 'sandbox';
  const publicKey = keep(data.publicKey, cur.public_key);
  const privateKey = keep(data.privateKey, cur.private_key);
  const integrity = keep(data.integritySecret, cur.integrity_secret);
  const events = keep(data.eventsSecret, cur.events_secret);
  const isActive = data.isActive == null ? (cur.is_active ?? 0) : (data.isActive ? 1 : 0);

  await db.query(
    `INSERT INTO platform_payment_gateways (provider, environment, public_key, private_key, integrity_secret, events_secret, is_active)
     VALUES ('wompi', ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE environment = VALUES(environment), public_key = VALUES(public_key),
       private_key = VALUES(private_key), integrity_secret = VALUES(integrity_secret),
       events_secret = VALUES(events_secret), is_active = VALUES(is_active)`,
    [environment, publicKey, privateKey, integrity, events, isActive]
  );
  return getPlatformGatewayPublic();
}

/** Crea una transacción Web Checkout: referencia + firma de integridad + URL de pago. */
export async function createCheckout(params: {
  context: PayContext;
  contextId?: string | null;
  tenantId?: string | null;
  amountInCents: number;
  currency?: string;
  redirectUrl?: string;
  customerEmail?: string;
}) {
  const gw = await getPlatformGatewayRaw();
  if (!gw || !gw.isActive) throw new AppError('La pasarela de pago no está configurada o activa', 400);
  if (!gw.publicKey || !gw.integritySecret) throw new AppError('Faltan las llaves de Wompi (pública / secreto de integridad)', 400);

  // El monto se resuelve en el SERVIDOR según el contexto; nunca se confía en el front.
  let amount = Math.round(Number(params.amountInCents));
  if (params.context === 'subscription') {
    const plan = String(params.contextId || '') as PlanKey;
    if (!PLAN_LIMITS[plan]) throw new AppError('Plan de suscripción inválido', 400);
    const priceStr = await getPlatformSetting(`plan_price_${plan}`);
    const price = Number(priceStr);
    if (!priceStr || !Number.isFinite(price) || price <= 0) throw new AppError(`El precio del plan "${plan}" no está configurado`, 400);
    amount = Math.round(price * 100); // pesos → centavos
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Monto inválido', 400);
  const currency = (params.currency || 'COP').toUpperCase();

  // Referencia única (no reutilizable).
  const reference = `DZ-${params.context}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
  const signature = crypto.createHash('sha256').update(`${reference}${amount}${currency}${gw.integritySecret}`).digest('hex');

  await db.query(
    `INSERT INTO wompi_transactions (reference, owner, tenant_id, context, context_id, amount_in_cents, currency, status, customer_email)
     VALUES (?, 'platform', ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [reference, params.tenantId ?? null, params.context, params.contextId ?? null, amount, currency, params.customerEmail ?? null]
  );

  // URL de Web Checkout (las claves con ':' se dejan literales; solo se codifican los valores).
  const pairs: [string, string][] = [
    ['public-key', gw.publicKey],
    ['currency', currency],
    ['amount-in-cents', String(amount)],
    ['reference', reference],
    ['signature:integrity', signature],
  ];
  if (params.redirectUrl) {
    // Adjunta nuestra referencia al redirect para que la página de resultado pueda
    // consultar el estado (Wompi además añadirá ?id=<txWompi>).
    const sep = params.redirectUrl.includes('?') ? '&' : '?';
    pairs.push(['redirect-url', `${params.redirectUrl}${sep}ref=${reference}`]);
  }
  if (params.customerEmail) pairs.push(['customer-data:email', params.customerEmail]);
  const checkoutUrl = `${CHECKOUT_URL}?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;

  return { reference, publicKey: gw.publicKey, amountInCents: amount, currency, signature, checkoutUrl, environment: gw.environment };
}

/** Estado actual de una transacción (para la pantalla de resultado). */
export async function getTransaction(reference: string) {
  const [rows]: any = await db.query(
    `SELECT reference, owner, tenant_id, context, context_id, amount_in_cents, currency, status, wompi_id, customer_email, created_at, updated_at
     FROM wompi_transactions WHERE reference = ? LIMIT 1`,
    [reference]
  );
  return rows?.[0] || null;
}

/** Resuelve un path tipo "transaction.status" sobre un objeto. */
function getPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * Procesa el webhook de Wompi. Verifica el checksum con el secreto de eventos
 * (concatenando las propiedades indicadas + timestamp + secreto, SHA256).
 */
export async function handleWebhook(body: any): Promise<{ ok: boolean; status?: string; reason?: string }> {
  const tx = body?.data?.transaction;
  if (!tx?.reference) return { ok: false, reason: 'sin-transaccion' };

  const gw = await getPlatformGatewayRaw();
  const eventsSecret = gw?.eventsSecret;

  // Verificación de integridad del evento (si hay secreto configurado).
  if (eventsSecret && body?.signature?.checksum && Array.isArray(body?.signature?.properties)) {
    const concat =
      body.signature.properties.map((p: string) => {
        const val = getPath(body.data, p);
        return val == null ? '' : String(val);
      }).join('') + String(body.timestamp ?? '') + eventsSecret;
    const checksum = crypto.createHash('sha256').update(concat).digest('hex');
    if (checksum.toLowerCase() !== String(body.signature.checksum).toLowerCase()) {
      return { ok: false, reason: 'firma-invalida' };
    }
  }

  const status = String(tx.status || 'PENDING').toUpperCase();
  await db.query(
    `UPDATE wompi_transactions SET status = ?, wompi_id = ?, payload = ? WHERE reference = ?`,
    [status, tx.id ?? null, JSON.stringify(tx).slice(0, 60000), tx.reference]
  );

  // Efecto al aprobar: activar suscripción / habilitar paquete (idempotente).
  if (status === 'APPROVED') {
    await onApproved(tx.reference).catch((e) => console.error('onApproved error:', e));
  }
  return { ok: true, status };
}

/**
 * Hook de activación tras un pago aprobado. Lee el contexto de la transacción y
 * activa lo que corresponda. Pendiente de cablear al módulo de suscripciones/paquetes
 * (se deja aislado para no acoplar el core de pagos a ese modelo todavía).
 */
async function onApproved(reference: string): Promise<void> {
  const txn = await getTransaction(reference);
  if (!txn) return;

  // Suscripción: activa el plan del comercio (mismos límites que el flujo MercadoPago).
  if (txn.context === 'subscription' && txn.tenant_id) {
    const plan = String(txn.context_id || '') as PlanKey;
    const limits = PLAN_LIMITS[plan];
    if (limits) {
      await db.query(
        `UPDATE tenants SET plan = ?, max_users = ?, max_products = ?, status = 'activo', updated_at = NOW() WHERE id = ?`,
        [plan, limits.maxUsers, limits.maxProducts, txn.tenant_id]
      );
      console.log(`[payments] Suscripción activada tenant=${txn.tenant_id} plan=${plan} ref=${reference}`);
      return;
    }
  }

  // Pedido de tienda: marca el pedido como confirmado (pagado).
  if (txn.context === 'order' && txn.context_id) {
    await db.query(`UPDATE storefront_orders SET status = 'confirmado' WHERE order_number = ?`, [txn.context_id]);
    console.log(`[payments] Pedido confirmado por pago Wompi order=${txn.context_id} ref=${reference}`);
    return;
  }

  // Otros contextos (paquetes): se cablearán a su modelo cuando se definan.
  console.log(`[payments] Pago APROBADO ref=${reference} context=${txn.context} contextId=${txn.context_id} tenant=${txn.tenant_id} (sin activación automática)`);
}

/** Disponibilidad pública de Wompi (sin exponer secretos) para el storefront. */
export async function getPublicAvailability(): Promise<{ wompi: boolean }> {
  const gw = await getPlatformGatewayRaw();
  return { wompi: !!(gw && gw.isActive && gw.publicKey && gw.integritySecret) };
}
