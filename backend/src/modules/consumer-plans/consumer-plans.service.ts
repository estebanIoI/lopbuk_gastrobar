/**
 * consumer-plans.service — Access service + entitlement engine (G2).
 *
 * Núcleo del sistema Consumer Plans / LEGEND:
 *   - redeemCode()      canje transaccional (FOR UPDATE, anti-race, idempotente,
 *                       aplica stack_policy con tope, escribe grant + ledger).
 *   - getUserTier()     estado del usuario (expira perezosamente).
 *   - hasEntitlement()  gate universal por feature.
 *   - admin: createCode / listCodes / updateCode.
 *   - getLegendConfig / saveLegendConfig (platform_settings KV).
 *
 * Convención del proyecto: ids VARCHAR(36) UUID; respuestas API { success, data }.
 */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import {
  STACK_CAP_DAYS, DEFAULT_LEGEND_CONFIG, LEGEND_MILESTONES,
  type DurationUnit, type StackPolicy, type CodeScope,
  type UserTierState, type LegendConfig,
} from './consumer-plans.types';

// ── Helpers ────────────────────────────────────────────────────────────────
const FREE: UserTierState = { tier: 'free', status: 'free', startedAt: null, expiresAt: null, remainingSeconds: 0, isExpired: true, entitlements: [], powerDays: 0, milestones: [] };

/** Normaliza y hashea el código (no se guarda el código real, solo su SHA256). */
const hashCode = (raw: string) =>
  crypto.createHash('sha256').update(String(raw || '').trim().toUpperCase()).digest('hex');

const codePreview = (raw: string) => {
  const c = String(raw || '').trim().toUpperCase();
  return (c.length <= 6 ? c : `${c.slice(0, 6)}${'*'.repeat(Math.min(8, c.length - 6))}`).slice(0, 30);
};

const toMysql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

/** Suma duración (día/mes) a una fecha base. */
function addDuration(base: Date, value: number, unit: DurationUnit): Date {
  const d = new Date(base.getTime());
  if (unit === 'month') d.setMonth(d.getMonth() + value);
  else d.setDate(d.getDate() + value);
  return d;
}

async function setPlatformSetting(key: string, value: string): Promise<void> {
  await db.query(
    `INSERT INTO platform_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value]
  );
}

// ── Entitlements ─────────────────────────────────────────────────────────────
export async function getEntitlementsForTier(tier: string): Promise<string[]> {
  if (!tier || tier === 'free') return [];
  const [rows]: any = await db.query(
    `SELECT entitlement_key FROM consumer_entitlements WHERE tier = ?`, [tier]
  );
  return (rows as any[]).map(r => r.entitlement_key);
}

// ── Estado del usuario (expira perezosamente) ────────────────────────────────
export async function getUserTier(userId: string): Promise<UserTierState> {
  if (!userId) return { ...FREE };
  // Expiración perezosa: marca como vencidos los grants pasados de fecha.
  await db.query(
    `UPDATE consumer_plan_grants SET status = 'expired', last_checked_at = NOW()
      WHERE user_id = ? AND status = 'active' AND expires_at <= NOW()`,
    [userId]
  );
  const [rows]: any = await db.query(
    `SELECT tier, status, started_at, expires_at FROM consumer_plan_grants
      WHERE user_id = ? AND status = 'active' AND expires_at > NOW()
      ORDER BY expires_at DESC LIMIT 1`,
    [userId]
  );
  const g = (rows as any[])[0];
  if (!g) return { ...FREE };
  const remainingSeconds = Math.max(0, Math.floor((new Date(g.expires_at).getTime() - Date.now()) / 1000));
  const entitlements = await getEntitlementsForTier(g.tier);
  const powerDays = Math.max(0, Math.floor((Date.now() - new Date(g.started_at).getTime()) / 86400000));
  const milestones = LEGEND_MILESTONES.filter(m => powerDays >= m.days).map(m => m.key);
  return {
    tier: g.tier, status: 'active', startedAt: g.started_at, expiresAt: g.expires_at,
    remainingSeconds, isExpired: false, entitlements, powerDays, milestones,
  };
}

/** Gate universal por feature. */
export async function hasEntitlement(userId: string, key: string): Promise<boolean> {
  const state = await getUserTier(userId);
  return !state.isExpired && state.entitlements.includes(key);
}

/**
 * Middleware Express: exige un entitlement para acceder a un endpoint premium.
 * Si no lo tiene, 403 con code ENTITLEMENT_REQUIRED y registra el intento en el ledger.
 * Reusable: `router.post('/ai/advanced', authenticate, requireEntitlement('routine_ai'), ...)`
 */
export function requireEntitlement(key: string) {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.userId;
      if (!userId) { res.status(401).json({ success: false, error: 'No autenticado' }); return; }
      const ok = await hasEntitlement(userId, key);
      if (!ok) {
        // Auditoría: acceso denegado en el ledger (action 'revoke' con metadata de gate).
        try {
          await db.query(
            `INSERT INTO consumer_access_ledger (id, user_id, action, metadata) VALUES (?, ?, 'revoke', ?)`,
            [uuidv4(), userId, JSON.stringify({ gate: key, result: 'denied' })]
          );
        } catch { /* el ledger no debe bloquear la respuesta */ }
        res.status(403).json({ success: false, error: 'Esta función es exclusiva de LEGEND', code: 'ENTITLEMENT_REQUIRED', entitlement: key });
        return;
      }
      next();
    } catch (e) { next(e); }
  };
}

// ── Descuentos del usuario (C7.5) ────────────────────────────────────────────
/** Resumen de descuentos aplicables al usuario, solo si tiene el entitlement 'discounts'. */
export async function getMyDiscounts(userId: string): Promise<{
  hasDiscounts: boolean; percentOff: number; freeShipping: boolean; rules: any[];
}> {
  const empty = { hasDiscounts: false, percentOff: 0, freeShipping: false, rules: [] as any[] };
  if (!userId) return empty;
  const state = await getUserTier(userId);
  if (state.isExpired || !state.entitlements.includes('discounts')) return empty;

  const [rows]: any = await db.query(
    `SELECT kind, percent_off, scope, category FROM consumer_discount_rules WHERE tier = ? AND is_active = 1`,
    [state.tier]
  );
  const rules = rows as any[];
  const percentOff = rules
    .filter(r => r.kind === 'percent' && r.scope === 'all')
    .reduce((mx: number, r: any) => Math.max(mx, Number(r.percent_off) || 0), 0);
  const freeShipping = rules.some(r => r.kind === 'free_shipping');
  return { hasDiscounts: true, percentOff, freeShipping, rules };
}

// ── Streak engine (C7.7) ─────────────────────────────────────────────────────
/** Cuenta días consecutivos con actividad terminando hoy (o ayer). */
export async function getStreak(userId: string): Promise<number> {
  if (!userId) return 0;
  const [rows]: any = await db.query(
    `SELECT day FROM consumer_streak_days WHERE user_id = ? AND day >= (CURDATE() - INTERVAL 120 DAY)`,
    [userId]
  );
  const set = new Set((rows as any[]).map(r => String(r.day).slice(0, 10)));
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  const d = new Date();
  if (!set.has(fmt(d))) { d.setDate(d.getDate() - 1); if (!set.has(fmt(d))) return 0; }
  let streak = 0;
  while (set.has(fmt(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

/** Registra actividad de hoy (idempotente) y devuelve el streak. */
export async function pingActivity(userId: string): Promise<{ streak: number }> {
  if (!userId) return { streak: 0 };
  await db.query(`INSERT IGNORE INTO consumer_streak_days (user_id, day) VALUES (?, CURDATE())`, [userId]);
  const streak = await getStreak(userId);
  // Logro (V3): Guerrero de Racha a los 7 días.
  if (streak >= 7) { try { const { achievementsService } = await import('../achievements/achievements.service'); await achievementsService.award(userId, 'streak_warrior', 'streak'); } catch { /* no bloquear */ } }
  return { streak };
}

// ── Analytics de eventos (C7.10) ─────────────────────────────────────────────
const KNOWN_EVENTS = new Set([
  'legend_redeemed', 'legend_expired', 'smart_combo_clicked', 'discount_used',
  'ai_advanced_opened', 'milestone_unlocked', 'explore_opened', 'product_added',
  'coach_program_started', 'coach_program_completed', 'coach_checkin_sent', 'coach_program_cancelled',
  'coach_review_submitted', 'vault_key_redeemed', 'drop_claimed',
]);

export async function trackEvent(userId: string | null, event: string, metadata?: any): Promise<void> {
  if (!event || !KNOWN_EVENTS.has(event)) return;
  try {
    await db.query(
      `INSERT INTO consumer_events (id, user_id, event, metadata) VALUES (?, ?, ?, ?)`,
      [uuidv4(), userId ?? null, event, metadata ? JSON.stringify(metadata) : null]
    );
  } catch { /* analytics no debe romper el flujo */ }
}

export async function getEventStats(days = 30) {
  const d = Math.max(1, Math.min(365, Math.floor(Number(days) || 30)));   // entero saneado (evita INTERVAL ? DAY)
  const [rows]: any = await db.query(
    `SELECT event, COUNT(*) c FROM consumer_events WHERE created_at >= NOW() - INTERVAL ${d} DAY GROUP BY event ORDER BY c DESC`
  );
  return (rows as any[]).map(r => ({ event: r.event, count: Number(r.c) || 0 }));
}

// ── Admin: configuración de reglas de descuento (C7.5) ───────────────────────
export async function adminGetDiscountConfig(): Promise<{ percentOff: number; freeShipping: boolean }> {
  const [rows]: any = await db.query(`SELECT kind, percent_off, is_active FROM consumer_discount_rules WHERE tier = 'legend'`);
  const pct = (rows as any[]).find(r => r.kind === 'percent');
  const ship = (rows as any[]).find(r => r.kind === 'free_shipping');
  return {
    percentOff: pct && pct.is_active ? Number(pct.percent_off) || 0 : 0,
    freeShipping: !!(ship && ship.is_active),
  };
}

export async function adminSaveDiscountConfig(params: { percentOff: number; freeShipping: boolean }) {
  const pct = Math.min(100, Math.max(0, Math.round(Number(params.percentOff) || 0)));
  await db.query(
    `INSERT INTO consumer_discount_rules (id, tier, kind, percent_off, scope, is_active)
       VALUES ('seed-legend-percent','legend','percent',?, 'all', ?)
     ON DUPLICATE KEY UPDATE percent_off = VALUES(percent_off), is_active = VALUES(is_active)`,
    [pct, pct > 0 ? 1 : 0]
  );
  await db.query(
    `INSERT INTO consumer_discount_rules (id, tier, kind, scope, is_active)
       VALUES ('seed-legend-shipping','legend','free_shipping','all', ?)
     ON DUPLICATE KEY UPDATE is_active = VALUES(is_active)`,
    [params.freeShipping ? 1 : 0]
  );
  return adminGetDiscountConfig();
}

// ── Canje (transaccional, anti-race, idempotente) ────────────────────────────
export async function redeemCode(params: {
  userId: string;
  code: string;
  tenantId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<UserTierState> {
  const { userId } = params;
  if (!userId) throw new AppError('Usuario no autenticado', 401);
  if (!params.code || !params.code.trim()) throw new AppError('Ingresa un código', 400);
  const hash = hashCode(params.code);

  const conn = await (db as any).getConnection();
  try {
    await conn.beginTransaction();

    // 1) Código (bloqueado para evitar carreras en redemptions).
    const [codeRows] = await conn.query(
      `SELECT * FROM consumer_access_codes WHERE code_hash = ? FOR UPDATE`, [hash]
    );
    const code = (codeRows as any[])[0];
    if (!code || !code.is_active) throw new AppError('Código inválido o inactivo', 404);

    const now = new Date();
    if (code.valid_from && new Date(code.valid_from) > now) throw new AppError('Este código aún no está disponible', 409);
    if (code.valid_until && new Date(code.valid_until) < now) throw new AppError('Este código ya venció', 409);
    if (code.max_redemptions != null && code.redemptions >= code.max_redemptions) throw new AppError('Este código ya alcanzó su límite de canjes', 409);
    if ((code.scope as CodeScope) === 'tenant' && code.tenant_id && params.tenantId && code.tenant_id !== params.tenantId) {
      throw new AppError('Este código no aplica para esta tienda', 409);
    }

    // 2) Idempotencia: un usuario no puede canjear DOS veces el mismo código.
    const [dup] = await conn.query(
      `SELECT 1 FROM consumer_access_ledger WHERE user_id = ? AND code_id = ? LIMIT 1`, [userId, code.id]
    );
    if ((dup as any[]).length > 0) throw new AppError('Ya usaste este código', 409);

    // 3) Grant activo vigente del mismo tier (bloqueado).
    const [grantRows] = await conn.query(
      `SELECT * FROM consumer_plan_grants
        WHERE user_id = ? AND tier = ? AND status = 'active' AND expires_at > NOW()
        ORDER BY expires_at DESC LIMIT 1 FOR UPDATE`,
      [userId, code.tier]
    );
    const existing = (grantRows as any[])[0];
    const stack = code.stack_policy as StackPolicy;

    if (existing && stack === 'block') throw new AppError('Ya tienes un plan activo; no se puede apilar este código', 409);

    // 4) Calcular nueva expiración.
    const base = (existing && stack === 'extend') ? new Date(Math.max(now.getTime(), new Date(existing.expires_at).getTime())) : now;
    let newExpiry = addDuration(base, code.duration_value, code.duration_unit as DurationUnit);
    const cap = addDuration(now, STACK_CAP_DAYS, 'day');           // tope acumulado (180 días)
    if (newExpiry > cap) newExpiry = cap;
    const startedAt = existing && stack === 'extend' ? new Date(existing.started_at) : now;
    const action = !existing ? 'redeem' : (stack === 'replace' ? 'replace' : 'extend');

    // 5) Ledger.
    const ledgerId = uuidv4();
    await conn.query(
      `INSERT INTO consumer_access_ledger (id, user_id, code_id, grant_id, action, old_expires_at, new_expires_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ledgerId, userId, code.id, existing?.id ?? null, action,
       existing ? toMysql(new Date(existing.expires_at)) : null, toMysql(newExpiry),
       JSON.stringify({ ip: params.ip ?? null, userAgent: params.userAgent ?? null })]
    );

    // 6) Grant: extiende/reemplaza el activo o crea uno nuevo.
    if (existing) {
      await conn.query(
        `UPDATE consumer_plan_grants SET expires_at = ?, started_at = ?, status = 'active', source_ledger_id = ?, last_checked_at = NOW() WHERE id = ?`,
        [toMysql(newExpiry), toMysql(startedAt), ledgerId, existing.id]
      );
    } else {
      await conn.query(
        `INSERT INTO consumer_plan_grants (id, user_id, tier, status, started_at, expires_at, source_ledger_id)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`,
        [uuidv4(), userId, code.tier, toMysql(startedAt), toMysql(newExpiry), ledgerId]
      );
    }

    // 7) Incrementa canjes del código.
    await conn.query(`UPDATE consumer_access_codes SET redemptions = redemptions + 1 WHERE id = ?`, [code.id]);

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  // Logro (V3): LEGEND — activó membresía.
  try { const { achievementsService } = await import('../achievements/achievements.service'); await achievementsService.award(userId, 'legend_member', 'legend'); } catch { /* no bloquear */ }

  return getUserTier(userId);
}

// ── Compra self-serve de LEGEND (pricing + Wompi) ────────────────────────────
export const LEGEND_PLANS = [
  { key: 'mensual', label: 'Mensual', months: 1, priceCop: 29900, badge: null as string | null },
  { key: 'semestral', label: 'Semestral', months: 6, priceCop: 149900, badge: 'Ahorra 16%' },
  { key: 'anual', label: 'Anual', months: 12, priceCop: 249900, badge: 'Más popular' },
];
export function getLegendPricing() {
  return LEGEND_PLANS.map(p => ({ ...p, perMonthCop: Math.round(p.priceCop / p.months) }));
}

/** Otorga/extiende LEGEND por N meses (compra pagada). Transaccional, sin tope de stack. */
export async function grantLegendMonths(userId: string, months: number, source = 'purchase') {
  if (!userId || !(months > 0)) throw new AppError('Datos de membresía inválidos', 400);
  const conn = await (db as any).getConnection();
  try {
    await conn.beginTransaction();
    const now = new Date();
    const [grantRows] = await conn.query(
      `SELECT * FROM consumer_plan_grants WHERE user_id = ? AND tier = 'legend' AND status = 'active' AND expires_at > NOW()
        ORDER BY expires_at DESC LIMIT 1 FOR UPDATE`, [userId]
    );
    const existing = (grantRows as any[])[0];
    const base = existing ? new Date(Math.max(now.getTime(), new Date(existing.expires_at).getTime())) : now;
    const newExpiry = addDuration(base, months, 'month');
    const startedAt = existing ? new Date(existing.started_at) : now;
    const ledgerId = uuidv4();
    await conn.query(
      `INSERT INTO consumer_access_ledger (id, user_id, code_id, grant_id, action, old_expires_at, new_expires_at, metadata)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
      [ledgerId, userId, existing?.id ?? null, existing ? 'extend' : 'redeem',
       existing ? toMysql(new Date(existing.expires_at)) : null, toMysql(newExpiry), JSON.stringify({ source })]
    );
    if (existing) {
      await conn.query(`UPDATE consumer_plan_grants SET expires_at = ?, status = 'active', source_ledger_id = ?, last_checked_at = NOW() WHERE id = ?`,
        [toMysql(newExpiry), ledgerId, existing.id]);
    } else {
      await conn.query(`INSERT INTO consumer_plan_grants (id, user_id, tier, status, started_at, expires_at, source_ledger_id) VALUES (?, ?, 'legend', 'active', ?, ?, ?)`,
        [uuidv4(), userId, toMysql(startedAt), toMysql(newExpiry), ledgerId]);
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  try { const { achievementsService } = await import('../achievements/achievements.service'); await achievementsService.award(userId, 'legend_member', 'legend'); } catch { /* no bloquear */ }
}

/** Crea una compra pendiente + checkout Wompi. Devuelve { checkoutUrl }. */
export async function createLegendCheckout(userId: string, planKey: string, origin?: string) {
  if (!userId) throw new AppError('No autenticado', 401);
  const plan = LEGEND_PLANS.find(p => p.key === planKey);
  if (!plan) throw new AppError('Plan inválido', 400);
  const id = uuidv4();
  await db.execute(
    `INSERT INTO legend_purchases (id, user_id, plan_key, months, amount_cop, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
    [id, userId, plan.key, plan.months, plan.priceCop]
  );
  const { createCheckout } = await import('../payments/payments.service');
  const co = await createCheckout({
    context: 'legend_subscription', contextId: id, tenantId: null, amountInCents: 0,
    redirectUrl: `${String(origin || '').replace(/\/$/, '')}/pago/resultado`,
  });
  return { purchaseId: id, amountCop: plan.priceCop, checkoutUrl: co.checkoutUrl };
}

/** Monto (en centavos) de una compra LEGEND pendiente — para payments. */
export async function getLegendPurchaseAmountCents(purchaseId: string): Promise<number> {
  const [rows]: any = await db.query('SELECT amount_cop, status FROM legend_purchases WHERE id = ? LIMIT 1', [purchaseId]);
  const p = rows?.[0];
  if (!p) throw new AppError('Compra no encontrada', 404);
  if (String(p.status) !== 'pending') throw new AppError('Esta compra ya no está pendiente', 409);
  return Math.round(Number(p.amount_cop) * 100);
}

/** Activa LEGEND tras pago aprobado (idempotente). */
export async function activateLegendPurchase(purchaseId: string, gatewayPaymentId?: string | null) {
  const [rows]: any = await db.query('SELECT * FROM legend_purchases WHERE id = ? LIMIT 1', [purchaseId]);
  const p = rows?.[0];
  if (!p || p.status === 'paid') return;
  await db.query('UPDATE legend_purchases SET status = ?, gateway_payment_id = ? WHERE id = ?', ['paid', gatewayPaymentId ?? null, purchaseId]);
  await grantLegendMonths(p.user_id, Number(p.months) || 1, 'purchase');
}

// ── Admin: CRUD de códigos ───────────────────────────────────────────────────
export async function createCode(params: {
  tier?: string;
  durationValue: number;
  durationUnit: DurationUnit;
  stackPolicy?: StackPolicy;
  maxRedemptions?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  scope?: CodeScope;
  tenantId?: string | null;
  rawCode?: string;            // opcional: si no llega, se genera
  createdBy?: string | null;
}): Promise<{ id: string; code: string; codePreview: string }> {
  const tier = params.tier || 'legend';
  const dv = Math.floor(Number(params.durationValue));
  if (!Number.isFinite(dv) || dv <= 0) throw new AppError('Duración inválida', 400);
  if (!['day', 'month'].includes(params.durationUnit)) throw new AppError('Unidad de duración inválida', 400);

  // Genera un código legible si no se provee uno.
  const raw = (params.rawCode && params.rawCode.trim())
    ? params.rawCode.trim().toUpperCase()
    : `${tier.toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const hash = hashCode(raw);
  const id = uuidv4();

  try {
    await db.query(
      `INSERT INTO consumer_access_codes
        (id, code_hash, code_preview, tier, duration_value, duration_unit, stack_policy,
         max_redemptions, valid_from, valid_until, scope, tenant_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, hash, codePreview(raw), tier, dv, params.durationUnit, params.stackPolicy || 'extend',
       params.maxRedemptions ?? null, params.validFrom ?? null, params.validUntil ?? null,
       params.scope || 'global', params.tenantId ?? null, params.createdBy ?? null]
    );
  } catch (e: any) {
    if (e?.errno === 1062) throw new AppError('Ese código ya existe', 409);
    throw e;
  }
  // Se devuelve el código real UNA sola vez (no se vuelve a poder leer del hash).
  return { id, code: raw, codePreview: codePreview(raw) };
}

export async function listCodes(filters: { status?: 'active' | 'inactive' | 'exhausted'; tier?: string } = {}) {
  const where: string[] = [];
  const args: any[] = [];
  if (filters.tier) { where.push('tier = ?'); args.push(filters.tier); }
  if (filters.status === 'active') where.push('is_active = 1');
  if (filters.status === 'inactive') where.push('is_active = 0');
  if (filters.status === 'exhausted') where.push('max_redemptions IS NOT NULL AND redemptions >= max_redemptions');
  const sql = `SELECT id, code_preview, tier, duration_value, duration_unit, stack_policy,
                      max_redemptions, redemptions, valid_from, valid_until, scope, tenant_id,
                      is_active, created_at
                 FROM consumer_access_codes
                 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY created_at DESC LIMIT 500`;
  const [rows]: any = await db.query(sql, args);
  return (rows as any[]).map(r => ({
    id: r.id, codePreview: r.code_preview, tier: r.tier,
    durationValue: r.duration_value, durationUnit: r.duration_unit, stackPolicy: r.stack_policy,
    maxRedemptions: r.max_redemptions, redemptions: r.redemptions,
    validFrom: r.valid_from, validUntil: r.valid_until, scope: r.scope, tenantId: r.tenant_id,
    isActive: Boolean(r.is_active), createdAt: r.created_at,
  }));
}

export async function updateCode(id: string, patch: { isActive?: boolean; validUntil?: string | null; maxRedemptions?: number | null }) {
  const sets: string[] = [];
  const args: any[] = [];
  if (patch.isActive !== undefined) { sets.push('is_active = ?'); args.push(patch.isActive ? 1 : 0); }
  if (patch.validUntil !== undefined) { sets.push('valid_until = ?'); args.push(patch.validUntil); }
  if (patch.maxRedemptions !== undefined) { sets.push('max_redemptions = ?'); args.push(patch.maxRedemptions); }
  if (!sets.length) return;
  args.push(id);
  const [r]: any = await db.query(`UPDATE consumer_access_codes SET ${sets.join(', ')} WHERE id = ?`, args);
  if ((r as any).affectedRows === 0) throw new AppError('Código no encontrado', 404);
}

/**
 * Elimina un código LEGEND. Si ya fue canjeado se bloquea (para no romper el
 * historial/ledger) — en ese caso debe desactivarse. `force` permite borrar
 * de todos modos limpiando ledger huérfano (uso excepcional del superadmin).
 */
export async function deleteCode(id: string, force = false) {
  const [rows]: any = await db.query('SELECT redemptions FROM consumer_access_codes WHERE id = ? LIMIT 1', [id]);
  const c = rows?.[0];
  if (!c) throw new AppError('Código no encontrado', 404);
  if (Number(c.redemptions) > 0 && !force) {
    throw new AppError('Este código ya fue canjeado. Desactívalo, o elimínalo forzado para borrar también su historial.', 409);
  }
  if (force) { try { await db.query('DELETE FROM consumer_access_ledger WHERE code_id = ?', [id]); } catch { /* sin ledger */ } }
  const [r]: any = await db.query('DELETE FROM consumer_access_codes WHERE id = ?', [id]);
  if ((r as any).affectedRows === 0) throw new AppError('Código no encontrado', 404);
  return { deleted: true };
}

// ── Config visual del reveal LEGEND (platform_settings KV, clave única JSON) ──
const LEGEND_CONFIG_KEY = 'legend_config';

export async function getLegendConfig(): Promise<LegendConfig> {
  const [rows]: any = await db.query(`SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1`, [LEGEND_CONFIG_KEY]);
  const raw = rows?.[0]?.setting_value;
  if (!raw) return { ...DEFAULT_LEGEND_CONFIG };
  try { return { ...DEFAULT_LEGEND_CONFIG, ...JSON.parse(raw) }; } catch { return { ...DEFAULT_LEGEND_CONFIG }; }
}

export async function saveLegendConfig(patch: Partial<LegendConfig>): Promise<LegendConfig> {
  const current = await getLegendConfig();
  const next: LegendConfig = { ...current, ...patch };
  await setPlatformSetting(LEGEND_CONFIG_KEY, JSON.stringify(next));
  return next;
}

// ── Analytics / retención (superadmin) ───────────────────────────────────────
export async function getAnalytics() {
  // Normaliza estados vencidos antes de contar.
  await db.query(`UPDATE consumer_plan_grants SET status='expired' WHERE status='active' AND expires_at <= NOW()`);

  const [actRows]: any = await db.query(
    `SELECT COUNT(*) c FROM consumer_plan_grants WHERE status='active' AND expires_at > NOW()`
  );
  const [soonRows]: any = await db.query(
    `SELECT COUNT(*) c FROM consumer_plan_grants WHERE status='active' AND expires_at > NOW() AND expires_at <= NOW() + INTERVAL 7 DAY`
  );
  const [expRows]: any = await db.query(
    `SELECT COUNT(*) c FROM consumer_plan_grants WHERE status='expired'`
  );
  const [redRows]: any = await db.query(
    `SELECT COUNT(*) total, SUM(created_at >= NOW() - INTERVAL 30 DAY) last30 FROM consumer_access_ledger WHERE action='redeem'`
  );
  const [everRows]: any = await db.query(
    `SELECT COUNT(DISTINCT user_id) c FROM consumer_access_ledger WHERE action='redeem'`
  );
  const [msRows]: any = await db.query(
    `SELECT
        SUM(DATEDIFF(NOW(), started_at) >= 30)  AS constante,
        SUM(DATEDIFF(NOW(), started_at) >= 90)  AS elite,
        SUM(DATEDIFF(NOW(), started_at) >= 180) AS glow,
        SUM(DATEDIFF(NOW(), started_at) >= 365) AS founder
       FROM consumer_plan_grants WHERE status='active' AND expires_at > NOW()`
  );

  const active = Number(actRows[0]?.c) || 0;
  const everRedeemed = Number(everRows[0]?.c) || 0;
  const ms = msRows[0] || {};
  return {
    activeLegends: active,
    expiringSoon7d: Number(soonRows[0]?.c) || 0,
    expiredTotal: Number(expRows[0]?.c) || 0,
    redeemsTotal: Number(redRows[0]?.total) || 0,
    redeemsLast30: Number(redRows[0]?.last30) || 0,
    everRedeemed,
    retentionPct: everRedeemed > 0 ? Math.round((active / everRedeemed) * 100) : 0,
    milestones: {
      constante: Number(ms.constante) || 0,
      elite: Number(ms.elite) || 0,
      glow: Number(ms.glow) || 0,
      founder: Number(ms.founder) || 0,
    },
  };
}
