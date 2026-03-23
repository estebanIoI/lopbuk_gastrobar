import Stripe from 'stripe';
import { db } from '../../config';
import { RowDataPacket } from 'mysql2';

interface SettingRow extends RowDataPacket {
  setting_value: string;
}

async function getStripeInstance(): Promise<Stripe> {
  const [rows] = await db.execute<SettingRow[]>(
    `SELECT setting_value FROM platform_settings WHERE setting_key = 'stripe_secret_key' LIMIT 1`
  );
  const secretKey = rows[0]?.setting_value;
  if (!secretKey) {
    throw new Error('Stripe no está configurado. El superadmin debe ingresar la clave secreta.');
  }
  return new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
}

async function getPlatformSetting(key: string): Promise<string | null> {
  const [rows] = await db.execute<SettingRow[]>(
    `SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1`,
    [key]
  );
  return rows[0]?.setting_value ?? null;
}

export async function createCheckoutSession(
  tenantId: string,
  plan: 'basico' | 'profesional' | 'empresarial',
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string }> {
  const stripe = await getStripeInstance();

  const priceIdKey = `stripe_price_id_${plan}`;
  const priceId = await getPlatformSetting(priceIdKey);

  if (!priceId) {
    throw new Error(`No hay un precio configurado para el plan ${plan}. El superadmin debe configurarlo.`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenantId, plan },
  });

  return { url: session.url! };
}

export async function handleWebhook(
  payload: Buffer,
  signature: string
): Promise<void> {
  const webhookSecret = await getPlatformSetting('stripe_webhook_secret');
  if (!webhookSecret) {
    throw new Error('Stripe webhook secret no configurado');
  }

  const stripe = await getStripeInstance();
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { tenantId, plan } = session.metadata ?? {};
    if (tenantId && plan) {
      const planLimits: Record<string, { maxUsers: number; maxProducts: number }> = {
        basico:       { maxUsers: 3,   maxProducts: 100 },
        profesional:  { maxUsers: 10,  maxProducts: 1000 },
        empresarial:  { maxUsers: 9999, maxProducts: 9999 },
      };
      const limits = planLimits[plan] ?? planLimits['basico'];
      await db.execute(
        `UPDATE tenants SET plan = ?, max_users = ?, max_products = ?, updated_at = NOW() WHERE id = ?`,
        [plan, limits.maxUsers, limits.maxProducts, tenantId]
      );
    }
  }
}

export async function getStripePublishableKey(): Promise<string | null> {
  return getPlatformSetting('stripe_publishable_key');
}
