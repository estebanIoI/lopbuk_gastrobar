import { MercadoPagoConfig, PreApprovalPlan, PreApproval } from 'mercadopago';
import { db } from '../../config';
import { RowDataPacket } from 'mysql2';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingRow extends RowDataPacket { setting_value: string }

export type PlanKey = 'basico' | 'profesional' | 'empresarial';

const PLAN_LABELS: Record<PlanKey, string> = {
  basico:       'Plan Básico - Lopbuk',
  profesional:  'Plan Profesional - Lopbuk',
  empresarial:  'Plan Empresarial - Lopbuk',
};

const PLAN_LIMITS: Record<PlanKey, { maxUsers: number; maxProducts: number }> = {
  basico:      { maxUsers: 3,    maxProducts: 100  },
  profesional: { maxUsers: 10,   maxProducts: 1000 },
  empresarial: { maxUsers: 9999, maxProducts: 9999 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string | null> {
  const [rows] = await db.execute<SettingRow[]>(
    `SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1`,
    [key]
  );
  return rows[0]?.setting_value ?? null;
}

async function saveSetting(key: string, value: string): Promise<void> {
  await db.execute(
    `INSERT INTO platform_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}

async function getClient(): Promise<MercadoPagoConfig> {
  const token = await getSetting('mp_access_token');
  if (!token) throw new Error('MercadoPago no está configurado. El superadmin debe ingresar el Access Token en Integraciones.');
  return new MercadoPagoConfig({ accessToken: token });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true if access token is set */
export async function isMPConfigured(): Promise<boolean> {
  const token = await getSetting('mp_access_token');
  return !!token;
}

/** Returns stored plan prices (null if not configured) */
export async function getPlanPrices(): Promise<Record<PlanKey, string | null>> {
  return {
    basico:      await getSetting('plan_price_basico'),
    profesional: await getSetting('plan_price_profesional'),
    empresarial: await getSetting('plan_price_empresarial'),
  };
}

/** Returns stored plan IDs (null if not yet synced) */
export async function getPlanIds(): Promise<Record<PlanKey, string | null>> {
  return {
    basico:      await getSetting('mp_plan_id_basico'),
    profesional: await getSetting('mp_plan_id_profesional'),
    empresarial: await getSetting('mp_plan_id_empresarial'),
  };
}

/**
 * Creates/recreates all three MP subscription plans using the prices
 * stored in platform_settings (plan_price_basico, etc.).
 * Always creates fresh plans to avoid MP restrictions on amount updates.
 * Also saves each plan's init_point for the hosted checkout flow.
 */
export async function syncPlans(frontendUrl: string): Promise<Record<PlanKey, string>> {
  const client = await getClient();
  const planApi = new PreApprovalPlan(client);
  const result: Partial<Record<PlanKey, string>> = {};

  for (const key of ['basico', 'profesional', 'empresarial'] as PlanKey[]) {
    const priceStr = await getSetting(`plan_price_${key}`);
    if (!priceStr || isNaN(Number(priceStr)) || Number(priceStr) <= 0) {
      throw new Error(`Precio inválido para el plan ${key}. Configura un valor mayor a 0.`);
    }

    const plan = await planApi.create({
      body: {
        reason: PLAN_LABELS[key],
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: Number(priceStr),
          currency_id: 'COP',
        },
        back_url: frontendUrl,
        status: 'active',
      } as any,
    });

    if (!plan.id) throw new Error(`MercadoPago no devolvió ID para el plan ${key}`);
    await saveSetting(`mp_plan_id_${key}`, plan.id);

    // Save the plan's hosted checkout URL
    const initPoint = (plan as any).init_point as string | undefined;
    if (initPoint) {
      await saveSetting(`mp_plan_init_${key}`, initPoint);
    }

    result[key] = plan.id;
  }

  return result as Record<PlanKey, string>;
}

/**
 * Returns the hosted MP checkout URL for a plan so the merchant can authorize
 * the recurring charge directly on MercadoPago's page (no card tokenization
 * needed on our side).
 *
 * Flow:
 *  1. Merchant clicks "Suscribirse" → redirected to MP's hosted page
 *  2. Merchant logs in with their MP account and authorizes the charge
 *  3. MP sends webhook → handleWebhook updates the tenant plan
 *
 * The tenant is identified in the webhook via payer_email → users table.
 */
export async function createSubscription(
  tenantId: string,
  plan: PlanKey,
  backUrl: string
): Promise<{ url: string }> {
  const client = await getClient();

  const planId = await getSetting(`mp_plan_id_${plan}`);
  if (!planId) {
    throw new Error(`No hay un plan configurado para "${plan}". El superadmin debe sincronizar los planes primero.`);
  }

  // Try the saved init_point first; if missing, fetch it from MP and cache it
  let initPoint = await getSetting(`mp_plan_init_${plan}`);

  if (!initPoint) {
    const planApi = new PreApprovalPlan(client);
    const planDetails = await (planApi as any).get({ id: planId });
    initPoint = (planDetails as any)?.init_point ?? null;
    if (initPoint) {
      await saveSetting(`mp_plan_init_${plan}`, initPoint);
    }
  }

  if (!initPoint) {
    throw new Error(
      'No se pudo obtener la URL de suscripción de MercadoPago. ' +
      'El superadmin debe volver a sincronizar los planes.'
    );
  }

  return { url: initPoint };
}

/**
 * Processes MercadoPago subscription webhook notifications.
 * Identifies the tenant by payer_email (matches against users table)
 * and the plan by matching preapproval_plan_id against stored plan IDs.
 */
export async function handleWebhook(body: any): Promise<void> {
  // MP sends different notification types — only handle subscriptions
  if (body.type !== 'subscription_preapproval') return;

  const preapprovalId = body.data?.id;
  if (!preapprovalId) return;

  const client = await getClient();
  const preApprovalApi = new PreApproval(client);
  const sub = await preApprovalApi.get({ id: String(preapprovalId) });

  const status = (sub as any).status as string;
  if (status !== 'authorized' && status !== 'cancelled') return;

  // ── Identify tenant ────────────────────────────────────────────────────────
  const payerEmail = (sub as any).payer_email as string | undefined;
  if (!payerEmail) return;

  const [userRows] = await db.execute<RowDataPacket[]>(
    `SELECT tenant_id FROM users
     WHERE email = ? AND role = 'comerciante' AND tenant_id IS NOT NULL
     LIMIT 1`,
    [payerEmail]
  );
  const tenantId = userRows[0]?.tenant_id as string | undefined;
  if (!tenantId) return;

  // ── Identify plan ──────────────────────────────────────────────────────────
  const preapprovalPlanId = (sub as any).preapproval_plan_id as string | undefined;
  let plan: PlanKey | undefined;

  if (preapprovalPlanId) {
    for (const key of ['basico', 'profesional', 'empresarial'] as PlanKey[]) {
      const storedId = await getSetting(`mp_plan_id_${key}`);
      if (storedId === preapprovalPlanId) {
        plan = key;
        break;
      }
    }
  }

  if (!plan) return;

  // ── Update tenant ──────────────────────────────────────────────────────────
  if (status === 'authorized') {
    const limits = PLAN_LIMITS[plan];
    await db.execute(
      `UPDATE tenants SET plan = ?, max_users = ?, max_products = ?, updated_at = NOW() WHERE id = ?`,
      [plan, limits.maxUsers, limits.maxProducts, tenantId]
    );
  } else {
    // cancelled → downgrade to basico
    await db.execute(
      `UPDATE tenants SET plan = 'basico', max_users = 3, max_products = 100, updated_at = NOW() WHERE id = ?`,
      [tenantId]
    );
  }
}
