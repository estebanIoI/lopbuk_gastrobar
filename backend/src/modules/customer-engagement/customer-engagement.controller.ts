import { Request, Response } from 'express';
import { AuthRequest } from '../../common/middleware';
import * as svc from './customer-engagement.service';

const ok = (res: Response, data: any, code = 200) => res.status(code).json({ success: true, data });
const bad = (res: Response, msg: string, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── CRM / Customers ───

export async function getCustomers(req: AuthRequest, res: Response) {
  try {
    const { search, level, sort, limit, offset } = req.query;
    const result = await svc.listCustomers(req.user!.tenantId!, {
      search: search as string,
      level: level as any,
      sort: sort as string,
      limit: Number(limit) || undefined,
      offset: Number(offset) || undefined,
    });
    ok(res, result);
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

export async function getCustomerDetail(req: AuthRequest, res: Response) {
  try {
    const profile = await svc.getCrmProfile(req.user!.tenantId!, req.params.id);
    ok(res, profile);
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

// ─── Wallet / Pass ───

export async function getMyWallet(req: AuthRequest, res: Response) {
  try {
    const phone = String(req.query.phone || '');
    if (!phone) return bad(res, 'Teléfono requerido');
    const acct = await svc.getAccountByPhone(req.user!.tenantId!, phone);
    if (!acct) return bad(res, 'No tienes cuenta de fidelización', 404);
    const cfg = await svc.getLoyaltyConfig(req.user!.tenantId!);
    const saveUrl = cfg.wallet_enabled && acct.wallet_id
      ? `https://pay.google.com/gp/v/save/${acct.wallet_id}`
      : null;
    ok(res, {
      ...acct,
      walletSaveUrl: saveUrl,
      levelColor: require('../../common/types').LEVEL_THRESHOLDS[acct.level]?.color || '#CD7F32',
    });
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

// ── ConsumerOS: "Mi Wallet" — todas las tarjetas del consumidor a través de comercios ──
// El teléfono se toma SIEMPRE del registro del usuario autenticado (no del cliente) → sin IDOR.
export async function getMyCards(req: AuthRequest, res: Response) {
  try {
    const phone = await svc.getUserPhone(req.user!.userId);
    if (!phone) return ok(res, { hasPhone: false, phone: null, cards: [], totalBalance: 0, totalStores: 0, totalEarned: 0 });
    const data = await svc.listMyCardsByPhone(phone);
    ok(res, { hasPhone: true, phone, ...data });
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

// Guarda/actualiza el teléfono del consumidor en su propia cuenta (para vincular sus tarjetas).
export async function setMyPhone(req: AuthRequest, res: Response) {
  try {
    const phone = String(req.body?.phone || '');
    if (!phone.trim()) return bad(res, 'Teléfono requerido');
    const saved = await svc.setUserPhone(req.user!.userId, phone);
    const data = await svc.listMyCardsByPhone(saved);
    ok(res, { hasPhone: true, phone: saved, ...data });
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

export async function getWalletPass(req: AuthRequest, res: Response) {
  try {
    const phone = String(req.body?.phone || req.query.phone || '');
    const name = String(req.body?.name || '');
    const email = String(req.body?.email || '');
    if (!phone) return bad(res, 'Teléfono requerido');
    const acct = await svc.ensureAccount(req.user!.tenantId!, phone, name, email);
    const { saveUrl } = await svc.getOrCreatePass(req.user!.tenantId!, acct.id, req.body?.storeSlug || '');
    ok(res, { saveUrl, accountId: acct.id });
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

export async function getCustomerTimeline(req: AuthRequest, res: Response) {
  try {
    const timeline = await svc.getCustomerTimeline(req.user!.tenantId!, req.params.id, Number(req.query.limit) || 50);
    ok(res, { timeline });
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

export async function getCustomer360(req: AuthRequest, res: Response) {
  try {
    const data = await svc.getCustomer360(req.user!.tenantId!, req.params.id);
    ok(res, data);
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

export async function addCustomerNote(req: AuthRequest, res: Response) {
  try {
    const { note } = req.body;
    if (!note) return bad(res, 'Nota requerida');
    const { default: pool } = await import('../../config/database');
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    await pool.query(
      'INSERT INTO engagement_notes (id, tenant_id, account_id, note, created_by) VALUES (?, ?, ?, ?, ?)',
      [id, req.user!.tenantId!, req.params.id, note.slice(0, 1000), req.user!.name || 'Admin'],
    );
    ok(res, { id, note, createdAt: new Date().toISOString() });
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Public registration ───

export async function publicRegister(req: Request, res: Response) {
  try {
    const { phone, name, email, storeSlug } = req.body;
    if (!phone) return bad(res, 'Teléfono requerido');
    if (!storeSlug) return bad(res, 'storeSlug requerido');

    const { default: pool } = await import('../../config/database');
    const [tenants] = (await pool.query(
      'SELECT id FROM tenants WHERE slug = ? AND status = ? LIMIT 1', [storeSlug, 'activo'],
    )) as any;
    if (!tenants[0]) return bad(res, 'Comercio no encontrado', 404);

    const tenantId = tenants[0].id;
    const acct = await svc.ensureAccount(tenantId, phone, name, email);

    let saveUrl = '';
    try { ({ saveUrl } = await svc.getOrCreatePass(tenantId, acct.id, storeSlug)); } catch { /* pass gen optional */ }

    ok(res, { accountId: acct.id, phone: acct.customer_phone, saveUrl, level: acct.level });
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

export async function publicLookup(req: Request, res: Response) {
  try {
    const { phone, storeSlug } = req.query;
    if (!phone || !storeSlug) return bad(res, 'phone y storeSlug requeridos');

    const { default: pool } = await import('../../config/database');
    const [tenants] = (await pool.query(
      'SELECT id FROM tenants WHERE slug = ? AND status = ? LIMIT 1', [storeSlug, 'activo'],
    )) as any;
    if (!tenants[0]) return bad(res, 'Comercio no encontrado', 404);

    const acct = await svc.getAccountByPhone(tenants[0].id, String(phone));
    if (!acct) return ok(res, { found: false });
    ok(res, {
      found: true,
      name: acct.customer_name,
      balance: acct.points_balance,
      level: acct.level,
      visits: acct.visits,
    });
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Redeem ───

export async function redeemReward(req: AuthRequest, res: Response) {
  try {
    const { phone, rewardId, name } = req.body;
    if (!phone) return bad(res, 'Teléfono requerido');
    if (!rewardId) return bad(res, 'rewardId requerido');
    const acct = await svc.getAccountByPhone(req.user!.tenantId!, phone);
    if (!acct) return bad(res, 'Cuenta no encontrada', 404);
    const result = await svc.redeemReward(req.user!.tenantId!, acct.id, rewardId, phone, name);
    ok(res, result);
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

// ─── Config ───

export async function getConfig(req: AuthRequest, res: Response) {
  try {
    const cfg = await svc.getLoyaltyConfig(req.user!.tenantId!);
    ok(res, cfg);
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

export async function updateConfig(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId!;
    const fields: string[] = []; const vals: any[] = [];
    const allowed = [
      'walletEnabled', 'walletLogoUrl', 'walletPrimaryColor',
      'walletBusinessName', 'walletShortDescription',
      'geoRadiusMeters', 'geoPushEnabled', 'geoPushMessage',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const col = key.replace(/[A-Z]/g, (m: string) => '_' + m.toLowerCase());
        fields.push(`${col} = ?`);
        vals.push(req.body[key]);
      }
    }
    if (!fields.length) return bad(res, 'Nada que actualizar');
    vals.push(tenantId);
    const { default: pool } = await import('../../config/database');
    await pool.query(
      `INSERT INTO loyalty_config (tenant_id, ${fields.map((f: string) => f.split(' ')[0]).join(', ')})
       VALUES (?, ${vals.slice(0, -1).map(() => '?').join(', ')})
       ON DUPLICATE KEY UPDATE ${fields.join(', ')}`,
      [tenantId, ...vals.slice(0, -1), ...vals],
    );
    ok(res, await svc.getLoyaltyConfig(tenantId));
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Location ───

export async function reportLocation(req: AuthRequest, res: Response) {
  try {
    const { lat, lng, phone } = req.body;
    if (!lat || !lng) return bad(res, 'lat y lng requeridos');
    const tenantId = req.user!.tenantId!;
    let accountId: string | null = null;
    if (phone) {
      const acct = await svc.getAccountByPhone(tenantId, phone);
      accountId = acct?.id || null;
    }
    const geo = await svc.checkGeoPush(tenantId, accountId || '', Number(lat), Number(lng));
    ok(res, geo);
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Campaigns ───

export async function getCampaigns(req: AuthRequest, res: Response) {
  try { ok(res, { campaigns: await svc.listCampaigns(req.user!.tenantId!) }); }
  catch (e: any) { bad(res, e.message || 'Error', 500); }
}

export async function createCampaign(req: AuthRequest, res: Response) {
  try {
    const { name } = req.body;
    if (!name) return bad(res, 'Nombre requerido');
    ok(res, await svc.createCampaign(req.user!.tenantId!, req.body));
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Segments ───

export async function getSegments(req: AuthRequest, res: Response) {
  try { ok(res, { segments: await svc.listSegments(req.user!.tenantId!) }); }
  catch (e: any) { bad(res, e.message || 'Error', 500); }
}

export async function createSegment(req: AuthRequest, res: Response) {
  try {
    const { name, rules } = req.body;
    if (!name) return bad(res, 'Nombre requerido');
    ok(res, await svc.createSegment(req.user!.tenantId!, req.body));
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Analytics ───

export async function getAnalytics(req: AuthRequest, res: Response) {
  try { ok(res, await svc.getAnalytics(req.user!.tenantId!)); }
  catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Automations ───

export async function getAutomations(req: AuthRequest, res: Response) {
  try { ok(res, { automations: await svc.listAutomations(req.user!.tenantId!) }); }
  catch (e: any) { bad(res, e.message || 'Error', 500); }
}

export async function createAutomation(req: AuthRequest, res: Response) {
  try {
    const { name, triggerType, actionType } = req.body;
    if (!name) return bad(res, 'Nombre requerido');
    if (!triggerType) return bad(res, 'triggerType requerido');
    if (!actionType) return bad(res, 'actionType requerido');
    ok(res, await svc.createAutomation(req.user!.tenantId!, req.body));
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

export async function updateAutomation(req: AuthRequest, res: Response) {
  try {
    await svc.updateAutomation(req.user!.tenantId!, req.params.id, req.body);
    ok(res, { id: req.params.id });
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

export async function deleteAutomation(req: AuthRequest, res: Response) {
  try {
    await svc.deleteAutomation(req.user!.tenantId!, req.params.id);
    ok(res, { id: req.params.id });
  } catch (e: any) { bad(res, e.message || 'Error', e.statusCode || 500); }
}

// ─── Rewards ───

export async function getRewards(req: AuthRequest, res: Response) {
  try {
    const { default: pool } = await import('../../config/database');
    const [rows] = (await pool.query(
      'SELECT id, name, description, points_cost AS pointsCost, reward_type AS rewardType, condition_value AS conditionValue, streak_days AS streakDays, is_active AS isActive FROM loyalty_rewards WHERE tenant_id = ? ORDER BY is_active DESC, points_cost ASC',
      [req.user!.tenantId!],
    )) as any;
    ok(res, { rewards: rows });
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Streaks ───

export async function getStreak(req: AuthRequest, res: Response) {
  try {
    const phone = String(req.query.phone || '');
    if (!phone) return bad(res, 'Teléfono requerido');
    const acct = await svc.getAccountByPhone(req.user!.tenantId!, phone);
    if (!acct) return bad(res, 'Cuenta no encontrada', 404);
    const streak = await svc.computeStreak(req.user!.tenantId!, acct.id);
    ok(res, { streak, accountId: acct.id });
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

export async function claimDailyReward(req: AuthRequest, res: Response) {
  try {
    const { phone, accountId } = req.body;
    if (!phone && !accountId) return bad(res, 'phone o accountId requerido');
    let acctId = accountId;
    if (!acctId) {
      const acct = await svc.getAccountByPhone(req.user!.tenantId!, phone);
      if (!acct) return bad(res, 'Cuenta no encontrada', 404);
      acctId = acct.id;
    }
    const result = await svc.checkDailyReward(req.user!.tenantId!, acctId);
    ok(res, result);
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Segment Recompute ───

export async function recomputeSegments(req: AuthRequest, res: Response) {
  try {
    await svc.recomputeSegments(req.user!.tenantId!);
    ok(res, { message: 'Segmentos actualizados' });
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Live Activity ───

export async function getLiveActivity(req: AuthRequest, res: Response) {
  try {
    const activity = await svc.getLiveActivity(req.user!.tenantId!, Number(req.query.limit) || 20);
    ok(res, { activity });
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── AI Insights ───

export async function getAIInsights(req: AuthRequest, res: Response) {
  try {
    const insights = await svc.getAIInsights(req.user!.tenantId!);
    ok(res, { insights });
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── Revenue Attribution ───

export async function getRevenueAttribution(req: AuthRequest, res: Response) {
  try {
    const days = Number(req.query.days) || 30;
    const data = await svc.getRevenueAttribution(req.user!.tenantId!, days);
    ok(res, data);
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}

// ─── AI Copilot ───

export async function copilotChat(req: AuthRequest, res: Response) {
  try {
    const { message, history } = req.body;
    if (!message) return bad(res, 'Mensaje requerido');
    const result = await svc.copilotChat(req.user!.tenantId!, message, history || []);
    ok(res, result);
  } catch (e: any) { bad(res, e.message || 'Error', 500); }
}
