import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { AppError } from '../../common/middleware';
import {
  LoyaltyLevel, LEVEL_THRESHOLDS, computeLevel,
  EngagementAutomation, EngagementCampaign, EngagementSegment,
} from '../../common/types';
import { getWalletProvider } from './providers/google-wallet.provider';
import { emitEngagementEvent } from './engagement-events';

// ──────────────────────────── CRM / Account ────────────────────────────

export async function getAccount(tenantId: string, accountId: string): Promise<any> {
  const [rows] = (await pool.query(
    'SELECT * FROM loyalty_accounts WHERE id = ? AND tenant_id = ? LIMIT 1',
    [accountId, tenantId],
  )) as any;
  if (!rows[0]) throw new AppError('Cuenta no encontrada', 404);
  return rows[0];
}

export async function getAccountByPhone(tenantId: string, phone: string): Promise<any | null> {
  const ph = phone.replace(/\s/g, '').slice(0, 40);
  const [rows] = (await pool.query(
    'SELECT * FROM loyalty_accounts WHERE tenant_id = ? AND customer_phone = ? LIMIT 1',
    [tenantId, ph],
  )) as any;
  return rows[0] || null;
}

// ─────────────── ConsumerOS: "Mi Wallet" (multi-comercio, por teléfono) ───────────────
// El consumidor autenticado ve TODAS sus tarjetas de fidelización a lo largo de los comercios.
// Seguridad: el teléfono se deriva SIEMPRE del registro del usuario (users.phone), nunca del
// cliente, para evitar IDOR (que un usuario consulte tarjetas de un teléfono ajeno).

export async function getUserPhone(userId: string): Promise<string | null> {
  const [rows] = (await pool.query('SELECT phone FROM users WHERE id = ? LIMIT 1', [userId])) as any;
  const raw = rows[0]?.phone;
  if (!raw) return null;
  const ph = String(raw).replace(/\s/g, '').slice(0, 40);
  return ph || null;
}

export async function setUserPhone(userId: string, phone: string): Promise<string> {
  const ph = String(phone || '').replace(/\s/g, '').slice(0, 40);
  if (ph.replace(/\D/g, '').length < 7) throw new AppError('Teléfono inválido', 400);
  await pool.query('UPDATE users SET phone = ? WHERE id = ?', [ph, userId]);
  return ph;
}

export async function listMyCardsByPhone(phone: string): Promise<{
  cards: any[]; totalBalance: number; totalStores: number; totalEarned: number;
}> {
  const ph = String(phone || '').replace(/\s/g, '').slice(0, 40);
  if (!ph) return { cards: [], totalBalance: 0, totalStores: 0, totalEarned: 0 };
  const [rows] = (await pool.query(
    `SELECT la.id, la.tenant_id AS tenantId, la.customer_name AS name, la.customer_phone AS phone,
            la.points_balance AS balance, la.level, la.visits, la.total_spent AS totalSpent,
            la.total_earned AS totalEarned,
            t.slug AS storeSlug, COALESCE(si.name, t.name) AS storeName, si.logo_url AS storeLogo
       FROM loyalty_accounts la
       JOIN tenants t ON t.id = la.tenant_id AND t.status = 'activo'
       LEFT JOIN store_info si ON si.tenant_id = la.tenant_id
      WHERE la.customer_phone = ?
      ORDER BY la.points_balance DESC, la.total_earned DESC`,
    [ph],
  )) as any;
  const cards = (rows as any[]).map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    storeSlug: r.storeSlug,
    storeName: r.storeName,
    storeLogo: r.storeLogo || null,
    name: r.name || null,
    phone: r.phone,
    balance: Number(r.balance) || 0,
    level: r.level || 'bronze',
    visits: Number(r.visits) || 0,
    totalSpent: Number(r.totalSpent) || 0,
    totalEarned: Number(r.totalEarned) || 0,
  }));
  return {
    cards,
    totalBalance: cards.reduce((s, c) => s + c.balance, 0),
    totalStores: cards.length,
    totalEarned: cards.reduce((s, c) => s + c.totalEarned, 0),
  };
}

export async function ensureAccount(tenantId: string, phone: string, name?: string, email?: string): Promise<any> {
  const ph = phone.replace(/\s/g, '').slice(0, 40);
  const existing = await getAccountByPhone(tenantId, ph);
  if (existing) {
    const sets: string[] = [];
    const vals: any[] = [];
    if (name && !existing.customer_name) { sets.push('customer_name = ?'); vals.push(name.slice(0, 120)); }
    if (email && !existing.customer_email) { sets.push('customer_email = ?'); vals.push(email.slice(0, 255)); }
    if (sets.length) {
      vals.push(existing.id);
      await pool.query(`UPDATE loyalty_accounts SET ${sets.join(', ')} WHERE id = ?`, vals);
    }
    return await getAccount(tenantId, existing.id);
  }
  const id = uuidv4();
  await pool.query(
    `INSERT INTO loyalty_accounts (id, tenant_id, customer_name, customer_phone, customer_email, level)
     VALUES (?, ?, ?, ?, ?, 'bronze')`,
    [id, tenantId, name?.slice(0, 120) || null, ph, email?.slice(0, 255) || null],
  );
  return await getAccount(tenantId, id);
}

export async function listCustomers(
  tenantId: string,
  filters: { search?: string; level?: LoyaltyLevel; sort?: string; limit?: number; offset?: number } = {},
): Promise<{ customers: any[]; total: number }> {
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  const where: string[] = ['tenant_id = ?'];
  const vals: any[] = [tenantId];

  if (filters.search) {
    where.push('(customer_name LIKE ? OR customer_phone LIKE ?)');
    vals.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.level) {
    where.push('level = ?');
    vals.push(filters.level);
  }

  const [countRows] = (await pool.query(
    `SELECT COUNT(*) AS total FROM loyalty_accounts WHERE ${where.join(' AND ')}`, vals,
  )) as any;
  const total = Number(countRows[0].total);

  let orderBy = 'points_balance DESC';
  if (filters.sort === 'recent') orderBy = 'last_visit DESC';
  if (filters.sort === 'spent') orderBy = 'total_spent DESC';
  if (filters.sort === 'visits') orderBy = 'visits DESC';

  const [customers] = (await pool.query(
    `SELECT id, customer_name AS name, customer_phone AS phone, customer_email AS email,
            points_balance AS balance, total_earned AS totalEarned,
            level, visits, last_visit AS lastVisit, total_spent AS totalSpent,
            wallet_id AS walletId, wallet_provider AS walletProvider, wallet_status AS walletStatus,
            birthday, acquisition_channel AS acquisitionChannel,
            created_at AS createdAt
     FROM loyalty_accounts WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
    vals,
  )) as any;

  return { customers, total };
}

export async function getCrmProfile(tenantId: string, accountId: string): Promise<any> {
  const account = await getAccount(tenantId, accountId);
  // Last 5 transactions
  const [txs] = (await pool.query(
    'SELECT type, points, reason, created_at AS createdAt FROM loyalty_transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT 5',
    [accountId],
  )) as any;
  // Favorite products from sales
  const [favProducts] = (await pool.query(
    `SELECT si.product_name AS name, COUNT(*) AS count
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.tenant_id = ? AND s.customer_phone = ?
     GROUP BY si.product_name ORDER BY count DESC LIMIT 3`,
    [tenantId, account.customer_phone],
  )) as any;
  // Days since last visit
  const [lastVisitDays] = (await pool.query(
    'SELECT DATEDIFF(NOW(), last_visit) AS days FROM loyalty_accounts WHERE id = ?', [accountId],
  )) as any;
  // Churn risk: heuristic
  const daysInactive = lastVisitDays[0]?.days ?? 999;
  const churnRisk = daysInactive > 60 ? 'high' : daysInactive > 30 ? 'medium' : 'low';

  return {
    ...account,
    transactions: txs,
    favoriteProducts: favProducts || [],
    daysInactive,
    churnRisk,
    levelThreshold: LEVEL_THRESHOLDS[account.level as LoyaltyLevel],
  };
}

// ──────────────────────────── Customer 360° ────────────────────────────

export async function getCustomer360(tenantId: string, accountId: string): Promise<any> {
  const account = await getAccount(tenantId, accountId);

  // Timeline (últimos 30 eventos)
  const timeline = await getCustomerTimeline(tenantId, accountId, 30);

  // Compras recientes (últimas 10 ventas POS)
  const [sales] = (await pool.query(
    `SELECT id, invoice_number AS invoiceNumber, total, payment_method AS paymentMethod,
            created_at AS date, status
     FROM sales WHERE tenant_id = ? AND customer_phone = ?
     ORDER BY created_at DESC LIMIT 10`,
    [tenantId, account.customer_phone],
  )) as any;

  // Pedidos online recientes
  const [orders] = (await pool.query(
    `SELECT id, order_number AS orderNumber, total, status, created_at AS date
     FROM storefront_orders WHERE tenant_id = ? AND customer_phone = ?
     ORDER BY created_at DESC LIMIT 10`,
    [tenantId, account.customer_phone],
  )) as any;

  // Productos favoritos
  const [favProducts] = (await pool.query(
    `SELECT si.product_name AS name, COUNT(*) AS count, SUM(si.total_price) AS totalSpent
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.tenant_id = ? AND s.customer_phone = ?
     GROUP BY si.product_name ORDER BY count DESC LIMIT 5`,
    [tenantId, account.customer_phone],
  )) as any;

  // Recompensas canjeadas
  const [redeemed] = (await pool.query(
    `SELECT reason, points, created_at AS date
     FROM loyalty_transactions WHERE tenant_id = ? AND account_id = ? AND type = 'redeem'
     ORDER BY created_at DESC LIMIT 10`,
    [tenantId, accountId],
  )) as any;

  // Segmentos a los que pertenece
  const [segments] = (await pool.query(
    `SELECT es.name, es.id
     FROM engagement_segments es
     WHERE es.tenant_id = ? AND es.is_active = 1 AND es.is_dynamic = 1`,
    [tenantId],
  )) as any;
  const memberSegments: string[] = [];
  for (const seg of segments) {
    const rules = typeof seg.rules === 'string' ? JSON.parse(seg.rules) : seg.rules;
    const { where, vals } = buildSegmentWhere(rules);
    if (!where) continue;
    const [rows] = (await pool.query(
      `SELECT 1 FROM loyalty_accounts WHERE id = ? AND tenant_id = ? AND ${where} LIMIT 1`,
      [accountId, tenantId, ...vals],
    )) as any;
    if (rows[0]) memberSegments.push(seg.name);
  }

  // Predicción IA (heurística)
  const daysInactive = account.last_visit
    ? Math.floor((Date.now() - new Date(account.last_visit).getTime()) / 86400000)
    : 999;
  const visitFreq = account.visits > 1 && account.last_visit
    ? Math.round(daysInactive / Math.max(account.visits, 1))
    : 30;
  const churnProb = daysInactive > 60 ? 85 : daysInactive > 30 ? 55 : daysInactive > 14 ? 25 : 10;
  const avgTicket = account.visits > 0 ? Number(account.total_spent) / account.visits : 0;
  const ltv = Number(account.total_spent);
  const nextPurchaseEstimate = Math.max(0, visitFreq - daysInactive);
  const returnProb = Math.max(0, 100 - churnProb);

  // Notas internas
  let notes: any[] = [];
  try {
    const [n] = (await pool.query(
      `SELECT id, note, created_at AS date FROM engagement_notes
       WHERE tenant_id = ? AND account_id = ? ORDER BY created_at DESC LIMIT 20`,
      [tenantId, accountId],
    )) as any;
    notes = n || [];
  } catch { notes = []; }

  return {
    profile: {
      ...account,
      daysInactive,
      churnRisk: daysInactive > 60 ? 'high' : daysInactive > 30 ? 'medium' : 'low',
      levelThreshold: LEVEL_THRESHOLDS[account.level as LoyaltyLevel],
    },
    timeline,
    sales,
    orders,
    favoriteProducts: favProducts || [],
    redeemedRewards: redeemed || [],
    segments: memberSegments,
    notes: notes || [],
    prediction: {
      churnProbability: churnProb,
      returnProbability: returnProb,
      estimatedLTV: ltv,
      averageTicket: Math.round(avgTicket),
      visitFrequencyDays: visitFreq,
      nextPurchaseInDays: nextPurchaseEstimate,
    },
  };
}

const EVENT_ICONS: Record<string, string> = {
  points_earned: '💰',
  sale_completed: '🛒',
  level_up: '⬆️',
  redemption: '🎁',
  pass_installed: '📱',
  geo_enter: '📍',
  push_sent: '📲',
  push_opened: '👁️',
  daily_bonus: '🔥',
  campaign_sent: '📢',
};

const EVENT_LABELS: Record<string, string> = {
  points_earned: 'Puntos ganados',
  sale_completed: 'Compra',
  level_up: 'Subió de nivel',
  redemption: 'Canje',
  pass_installed: 'Instaló Wallet',
  geo_enter: 'Entró al local',
  push_sent: 'Push enviado',
  push_opened: 'Push abierto',
  daily_bonus: 'Racha',
  campaign_sent: 'Campaña',
};

export async function getCustomerTimeline(tenantId: string, accountId: string, limit = 50): Promise<any[]> {
  // Engagement events
  const [events] = (await pool.query(
    `SELECT event_type AS type, event_data AS data, created_at AS date
     FROM engagement_events WHERE tenant_id = ? AND account_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [tenantId, accountId, limit],
  )) as any;

  // Loyalty transactions
  const [txs] = (await pool.query(
    `SELECT type, points, reason, created_at AS date
     FROM loyalty_transactions WHERE tenant_id = ? AND account_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [tenantId, accountId, limit],
  )) as any;

  // Merge and sort
  const items = [
    ...events.map((e: any) => ({
      date: e.date,
      category: 'event',
      type: e.type,
      icon: EVENT_ICONS[e.type] || '📌',
      label: EVENT_LABELS[e.type] || e.type,
      detail: formatEventDetail(e.type, typeof e.data === 'string' ? JSON.parse(e.data) : e.data),
    })),
    ...txs.map((t: any) => ({
      date: t.date,
      category: 'transaction',
      type: t.type,
      icon: t.type === 'earn' ? '💰' : t.type === 'redeem' ? '🎁' : '✏️',
      label: t.type === 'earn' ? 'Puntos ganados' : t.type === 'redeem' ? 'Canje' : 'Ajuste',
      detail: `${t.reason || ''} ${t.points > 0 ? '+' : ''}${t.points} pts`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
   .slice(0, limit);

  return items;
}

function formatEventDetail(type: string, data: any): string {
  if (!data) return '';
  switch (type) {
    case 'points_earned': return `+$${(data.amount || 0).toLocaleString('es-CO')} → +${data.points || 0} pts`;
    case 'sale_completed': return data.customerName ? `${data.customerName} · $${(data.total || data.amount || 0).toLocaleString('es-CO')}` : `$${(data.total || data.amount || 0).toLocaleString('es-CO')}`;
    case 'level_up': return `${LEVEL_LABELS[data.previousLevel] || data.previousLevel} → ${LEVEL_LABELS[data.newLevel] || data.newLevel}`;
    case 'redemption': return `${data.reward || ''} · -${data.cost || 0} pts`;
    case 'geo_enter': return `Distancia: ${Math.round(data.distance || 0)}m`;
    case 'daily_bonus': return `Racha ${data.streak || 0} días 🔥 +${data.bonus || 0} pts`;
    default: return '';
  }
}

const LEVEL_LABELS: Record<string, string> = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino' };

// ──────────────────────────── Live Activity Feed ────────────────────────────

export async function getLiveActivity(tenantId: string, limit = 20): Promise<any[]> {
  const [events] = (await pool.query(
    `SELECT e.event_type AS type, e.event_data AS data, e.created_at AS date,
            la.customer_name AS name, la.customer_phone AS phone
     FROM engagement_events e
     LEFT JOIN loyalty_accounts la ON la.id = e.account_id
     WHERE e.tenant_id = ?
     ORDER BY e.created_at DESC LIMIT ?`,
    [tenantId, limit],
  )) as any;

  return events.map((e: any) => {
    const d = typeof e.data === 'string' ? JSON.parse(e.data) : (e.data || {});
    return {
      date: e.date,
      type: e.type,
      icon: EVENT_ICONS[e.type] || '📌',
      label: EVENT_LABELS[e.type] || e.type,
      customerName: e.name || 'Cliente',
      detail: formatEventDetail(e.type, d),
    };
  });
}

// ──────────────────────────── AI Insights ────────────────────────────

export async function getAIInsights(tenantId: string): Promise<any[]> {
  const insights: any[] = [];

  // 1. Customers near next level
  const [nearLevel] = (await pool.query(
    `SELECT level, COUNT(*) AS cnt FROM loyalty_accounts
     WHERE tenant_id = ? AND level = 'silver' AND visits >= 10 AND total_spent >= 100000
     GROUP BY level`, [tenantId],
  )) as any;
  if (nearLevel[0]?.cnt > 0) {
    insights.push({
      icon: '⬆️', priority: 'high',
      title: `${nearLevel[0].cnt} clientes a una compra del nivel Gold`,
      action: 'Enviar campaña para cerrar la brecha',
      type: 'near_level',
    });
  }

  // 2. High churn risk
  const [churnRisk] = (await pool.query(
    "SELECT COUNT(*) AS cnt FROM loyalty_accounts WHERE tenant_id = ? AND last_visit < DATE_SUB(NOW(), INTERVAL 30 DAY) AND last_visit > DATE_SUB(NOW(), INTERVAL 60 DAY)",
    [tenantId],
  )) as any;
  if (churnRisk[0]?.cnt > 5) {
    insights.push({
      icon: '⚠️', priority: 'high',
      title: `${churnRisk[0].cnt} clientes con riesgo de abandono (30+ días)`,
      action: 'Crear campaña de reactivación con cupón',
      type: 'churn_risk',
    });
  }

  // 3. Best day for campaign
  const [bestDay] = (await pool.query(
    `SELECT DAYNAME(last_visit) AS dayName, COUNT(*) AS cnt
     FROM loyalty_accounts WHERE tenant_id = ? AND last_visit IS NOT NULL
     GROUP BY dayName ORDER BY cnt DESC LIMIT 1`, [tenantId],
  )) as any;
  if (bestDay[0]) {
    insights.push({
      icon: '📅', priority: 'medium',
      title: `El ${bestDay[0].dayName} es el día con más actividad`,
      action: `Programa campañas para ${bestDay[0].dayName}`,
      type: 'best_day',
    });
  }

  // 4. Wallet adoption
  const [walletAdopt] = (await pool.query(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN wallet_status = 'active' THEN 1 ELSE 0 END) AS active FROM loyalty_accounts WHERE tenant_id = ?",
    [tenantId],
  )) as any;
  const totalC = Number(walletAdopt[0]?.total || 0);
  const activeW = Number(walletAdopt[0]?.active || 0);
  if (totalC > 10 && activeW / totalC < 0.3) {
    insights.push({
      icon: '📱', priority: 'medium',
      title: `Solo el ${((activeW / totalC) * 100).toFixed(0)}% tiene Wallet activa`,
      action: 'Incentiva la instalación con puntos extra',
      type: 'wallet_adoption',
    });
  }

  return insights;
}

// ──────────────────────────── Points / Loyalty ────────────────────────────

/**
 * Ubicaciones del negocio para el geofence de Google Wallet. Con esto el pase
 * aparece solo en la pantalla de bloqueo cuando el cliente está cerca del local.
 * Sin coordenadas cargadas devuelve [] y el pase se crea igual, pero sin
 * notificación por proximidad.
 */
export async function getWalletLocations(
  tenantId: string,
): Promise<Array<{ latitude: number; longitude: number }>> {
  const [rows] = (await pool.query(
    'SELECT latitude, longitude FROM store_info WHERE tenant_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL LIMIT 10',
    [tenantId],
  )) as any;
  return (rows || [])
    .map((r: any) => ({ latitude: Number(r.latitude), longitude: Number(r.longitude) }))
    .filter((l: any) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude)
      && !(l.latitude === 0 && l.longitude === 0));
}

export async function getLoyaltyConfig(tenantId: string): Promise<any> {
  const [rows] = (await pool.query(
    'SELECT * FROM loyalty_config WHERE tenant_id = ?', [tenantId],
  )) as any;
  if (rows[0]) return rows[0];
  return {
    enabled: true, points_per_thousand: 1,
    wallet_enabled: 0, wallet_logo_url: null, wallet_primary_color: '#000000',
    wallet_business_name: null, wallet_short_description: null,
    geo_radius_meters: 300, geo_push_enabled: 0, geo_push_message: null,
  };
}

export async function earnPoints(
  tenantId: string, phone: string, name: string | undefined,
  amount: number, orderId?: string | null,
): Promise<{ points: number; balance: number; accountId: string; level: string }> {
  const cfg = await getLoyaltyConfig(tenantId);
  if (!cfg.enabled) return { points: 0, balance: 0, accountId: '', level: 'bronze' };

  const acct = await ensureAccount(tenantId, phone, name);
  const points = Math.floor((amount / 1000) * Number(cfg.points_per_thousand));
  if (points <= 0) return { points: 0, balance: acct.points_balance, accountId: acct.id, level: acct.level };

  await pool.query(
    'UPDATE loyalty_accounts SET points_balance = points_balance + ?, total_earned = total_earned + ?, visits = visits + 1, last_visit = NOW(), total_spent = total_spent + ? WHERE id = ?',
    [points, points, amount, acct.id],
  );
  await pool.query(
    'INSERT INTO loyalty_transactions (id, tenant_id, account_id, type, points, reason, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), tenantId, acct.id, 'earn', points, `Consumo $${amount.toLocaleString('es-CO')}`, orderId || null],
  );

  // Emit event for level recalculation + automations
  emitEngagementEvent(tenantId, acct.id, 'points_earned', { amount, points, orderId }).catch(() => {});

  return { points, balance: Number(acct.points_balance) + points, accountId: acct.id, level: acct.level };
}

export async function redeemReward(
  tenantId: string, accountId: string, rewardId: string, phone: string, name?: string,
): Promise<{ code: string; reward: string; cost: number; remaining: number }> {
  const acct = await ensureAccount(tenantId, phone, name);
  const [rw] = (await pool.query(
    'SELECT * FROM loyalty_rewards WHERE id = ? AND tenant_id = ? AND is_active = 1 LIMIT 1',
    [rewardId, tenantId],
  )) as any;
  if (!rw[0]) throw new AppError('Recompensa no disponible', 404);

  const cost = rw[0].points_cost;
  const balance = Number(acct.points_balance);
  if (balance < cost) throw new AppError(`Te faltan ${cost - balance} puntos`, 400);

  const code = 'LC' + Math.floor(1000 + Math.random() * 8999).toString();
  await pool.query('UPDATE loyalty_accounts SET points_balance = points_balance - ? WHERE id = ?', [cost, acct.id]);
  await pool.query(
    'INSERT INTO loyalty_transactions (id, tenant_id, account_id, type, points, reason) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), tenantId, acct.id, 'redeem', -cost, `Canje: ${rw[0].name} [${code}]`],
  );

  emitEngagementEvent(tenantId, acct.id, 'redemption', { reward: rw[0].name, cost, code }).catch(() => {});

  return { code, reward: rw[0].name, cost, remaining: balance - cost };
}

// ──────────────────────────── Level / Status ────────────────────────────

export async function recalculateLevel(tenantId: string, accountId: string): Promise<LoyaltyLevel> {
  const [rows] = (await pool.query(
    'SELECT visits, total_spent, level FROM loyalty_accounts WHERE id = ? AND tenant_id = ? LIMIT 1',
    [accountId, tenantId],
  )) as any;
  if (!rows[0]) return 'bronze';

  const { visits, total_spent, level: currentLevel } = rows[0];
  const newLevel = computeLevel(Number(visits), Number(total_spent));

  if (newLevel !== currentLevel) {
    await pool.query('UPDATE loyalty_accounts SET level = ? WHERE id = ?', [newLevel, accountId]);
    emitEngagementEvent(tenantId, accountId, 'level_up', {
      previousLevel: currentLevel,
      newLevel,
      visits,
      total_spent,
    }).catch(() => {});
  }

  return newLevel;
}

// ──────────────────────────── Wallet / Pass ────────────────────────────

export async function getOrCreatePass(
  tenantId: string, accountId: string, storeSlug: string,
): Promise<{ saveUrl: string; walletId: string }> {
  const account = await getAccount(tenantId, accountId);
  if (account.wallet_id && account.wallet_status === 'active') {
    const provider = await getWalletProvider();
    if (provider) return { saveUrl: await provider.getSaveUrl(account.wallet_id), walletId: account.wallet_id };
    return { saveUrl: '', walletId: account.wallet_id };
  }

  const cfg = await getLoyaltyConfig(tenantId);
  if (!cfg.wallet_enabled) throw new AppError('Wallet no habilitada para este comercio', 400);

  const provider = await getWalletProvider();
  const walletId = `lopbuk-${accountId}`;

  if (provider) {
    const saveUrl = await provider.createPass({
      accountId,
      accountName: account.customer_name || account.customer_phone,
      phone: account.customer_phone,
      pointsBalance: account.points_balance,
      level: account.level,
      levelColor: LEVEL_THRESHOLDS[account.level as LoyaltyLevel]?.color || '#CD7F32',
      visits: account.visits,
      totalSpent: Number(account.total_spent),
      lastVisit: account.last_visit,
      businessName: cfg.wallet_business_name || 'Lopbuk Rewards',
      businessLogo: cfg.wallet_logo_url || '',
      primaryColor: cfg.wallet_primary_color || '#000000',
      shortDescription: cfg.wallet_short_description || 'Programa de fidelización',
      qrPayload: account.customer_phone,
      storeUrl: `${process.env.FRONTEND_URL || 'https://daimuz.alexsters.works'}/${storeSlug}`,
      // Geofence: el pase se muestra al acercarse el cliente al local
      locations: await getWalletLocations(tenantId),
    }, tenantId);

    await pool.query(
      'UPDATE loyalty_accounts SET wallet_id = ?, wallet_provider = ?, wallet_status = ? WHERE id = ?',
      [walletId, 'google', 'active', accountId],
    );

    emitEngagementEvent(tenantId, accountId, 'pass_installed', { provider: 'google' }).catch(() => {});
    return { saveUrl, walletId };
  }

  // No provider configured — just store the ID
  await pool.query(
    'UPDATE loyalty_accounts SET wallet_id = ?, wallet_provider = ?, wallet_status = ? WHERE id = ?',
    [walletId, 'google', 'active', accountId],
  );
  return { saveUrl: '', walletId };
}

export async function syncPassAfterEarn(tenantId: string, accountId: string): Promise<void> {
  const account = await getAccount(tenantId, accountId);
  if (!account.wallet_id || account.wallet_status !== 'active') return;

  const provider = await getWalletProvider();
  if (!provider) return;
  await provider.updatePass(account.wallet_id, {
    pointsBalance: account.points_balance,
    level: account.level,
    levelColor: LEVEL_THRESHOLDS[account.level as LoyaltyLevel]?.color || '#CD7F32',
    visits: account.visits,
    totalSpent: Number(account.total_spent),
    lastVisit: account.last_visit,
  }).catch(() => {});
}

// ──────────────────────────── Geolocation ────────────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function checkGeoPush(
  tenantId: string, accountId: string, lat: number, lng: number,
): Promise<{ near: boolean; message: string | null }> {
  const cfg = await getLoyaltyConfig(tenantId);
  if (!cfg.geo_push_enabled || !cfg.geo_push_message) return { near: false, message: null };

  // Find store location
  const [stores] = (await pool.query(
    'SELECT latitude, longitude FROM store_info WHERE tenant_id = ? LIMIT 1', [tenantId],
  )) as any;
  if (!stores[0] || !stores[0].latitude) return { near: false, message: null };

  const distance = haversineDistance(lat, lng, Number(stores[0].latitude), Number(stores[0].longitude));
  if (distance <= (cfg.geo_radius_meters || 300)) {
    emitEngagementEvent(tenantId, accountId, 'geo_enter', { distance, lat, lng }).catch(() => {});
    return { near: true, message: cfg.geo_push_message };
  }
  return { near: false, message: null };
}

// ──────────────────────────── Automations ────────────────────────────
// Delegated to automation-engine.ts

export async function processAutomationsForEvent(event: { tenantId: string; accountId: string | null; eventType: string; eventData: Record<string, any> }): Promise<void> {
  const { runEventAutomations } = await import('./automation-engine');
  await runEventAutomations(event.tenantId, event.accountId, event.eventType);
}

// ──────────────────────────── Campaigns ────────────────────────────

export async function createCampaign(tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO engagement_campaigns (id, tenant_id, name, description, objective, audience_filter, offer_type, offer_value, channels, scheduled_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, data.name, data.description || null, data.objective || 'increase_sales',
      data.audienceFilter ? JSON.stringify(data.audienceFilter) : null,
      data.offerType || null, data.offerValue || null,
      JSON.stringify(data.channels || []),
      data.scheduledAt || null, data.scheduledAt ? 'scheduled' : 'draft'],
  );
  return { id };
}

export async function listCampaigns(tenantId: string): Promise<EngagementCampaign[]> {
  const [rows] = (await pool.query(
    'SELECT * FROM engagement_campaigns WHERE tenant_id = ? AND is_active = 1 ORDER BY created_at DESC',
    [tenantId],
  )) as any;
  return rows.map((r: any) => ({
    ...r,
    channels: typeof r.channels === 'string' ? JSON.parse(r.channels) : r.channels,
    audienceFilter: typeof r.audience_filter === 'string' ? JSON.parse(r.audience_filter) : r.audience_filter,
  }));
}

// ──────────────────────────── Segments ────────────────────────────

export async function listSegments(tenantId: string): Promise<EngagementSegment[]> {
  const [rows] = (await pool.query(
    'SELECT * FROM engagement_segments WHERE tenant_id = ? AND is_active = 1 ORDER BY created_at DESC',
    [tenantId],
  )) as any;
  return rows.map((r: any) => ({
    ...r,
    rules: typeof r.rules === 'string' ? JSON.parse(r.rules) : r.rules,
  }));
}

export async function createSegment(tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO engagement_segments (id, tenant_id, name, description, rules, is_dynamic)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, tenantId, data.name, data.description || null, JSON.stringify(data.rules || {}), data.isDynamic ? 1 : 0],
  );
  return { id };
}

// ──────────────────────────── Analytics ────────────────────────────

export async function getAnalytics(tenantId: string): Promise<any> {
  // Total accounts
  const [totalRows] = (await pool.query(
    'SELECT COUNT(*) AS total FROM loyalty_accounts WHERE tenant_id = ?', [tenantId],
  )) as any;
  const total = Number(totalRows[0].total);

  // Active (visited in last 30 days)
  const [activeRows] = (await pool.query(
    'SELECT COUNT(*) AS active FROM loyalty_accounts WHERE tenant_id = ? AND last_visit >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
    [tenantId],
  )) as any;
  const active = Number(activeRows[0].active);

  // Recurrent (3+ visits in 90 days)
  const [recurrentRows] = (await pool.query(
    'SELECT COUNT(*) AS recurrent FROM loyalty_accounts WHERE tenant_id = ? AND visits >= 3',
    [tenantId],
  )) as any;
  const recurrent = Number(recurrentRows[0].recurrent);

  // Lost (no visit in 60 days)
  const [lostRows] = (await pool.query(
    'SELECT COUNT(*) AS lost FROM loyalty_accounts WHERE tenant_id = ? AND (last_visit IS NULL OR last_visit < DATE_SUB(NOW(), INTERVAL 60 DAY))',
    [tenantId],
  )) as any;
  const lost = Number(lostRows[0].lost);

  // By level
  const [levelRows] = (await pool.query(
    'SELECT level, COUNT(*) AS count FROM loyalty_accounts WHERE tenant_id = ? GROUP BY level',
    [tenantId],
  )) as any;

  // Wallet installs
  const [walletRows] = (await pool.query(
    'SELECT COUNT(*) AS installed FROM loyalty_accounts WHERE tenant_id = ? AND wallet_status = ?',
    [tenantId, 'active'],
  )) as any;

  // Redemptions (30d)
  const [redemptions] = (await pool.query(
    "SELECT COUNT(*) AS count FROM loyalty_transactions WHERE tenant_id = ? AND type = 'redeem' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
    [tenantId],
  )) as any;

  // Push events (30d)
  const [pushEvents] = (await pool.query(
    "SELECT COUNT(*) AS count FROM engagement_events WHERE tenant_id = ? AND event_type IN ('push_sent','push_opened','geo_enter') AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
    [tenantId],
  )) as any;

  return {
    totalCustomers: total,
    activeCustomers: active,
    recurrentCustomers: recurrent,
    lostCustomers: lost,
    churnRate: total > 0 ? ((lost / total) * 100).toFixed(1) : '0',
    retentionRate: total > 0 ? ((active / total) * 100).toFixed(1) : '0',
    byLevel: levelRows.reduce((acc: any, r: any) => ({ ...acc, [r.level]: Number(r.count) }), {}),
    walletInstalls: Number(walletRows[0].installed),
    walletConversion: total > 0 ? ((Number(walletRows[0].installed) / total) * 100).toFixed(1) : '0',
    redemptions30d: Number(redemptions[0].count),
    pushEvents30d: Number(pushEvents[0].count),
  };
}

// ──────────────────────────── Automation CRUD ────────────────────────────

export async function listAutomations(tenantId: string): Promise<any[]> {
  const [rows] = (await pool.query(
    'SELECT * FROM engagement_automations WHERE tenant_id = ? ORDER BY created_at DESC',
    [tenantId],
  )) as any;
  return rows.map((r: any) => ({
    ...r,
    triggerConfig: typeof r.trigger_config === 'string' ? JSON.parse(r.trigger_config) : r.trigger_config,
    actionConfig: typeof r.action_config === 'string' ? JSON.parse(r.action_config) : r.action_config,
  }));
}

export async function createAutomation(tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO engagement_automations (id, tenant_id, name, description, trigger_type, trigger_config, action_type, action_config, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, tenantId,
      data.name, data.description || null,
      data.triggerType, data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
      data.actionType, data.actionConfig ? JSON.stringify(data.actionConfig) : null,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
    ],
  );
  return { id };
}

export async function updateAutomation(tenantId: string, autoId: string, data: any): Promise<void> {
  const fields: string[] = []; const vals: any[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); vals.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); vals.push(data.description); }
  if (data.triggerType !== undefined) { fields.push('trigger_type = ?'); vals.push(data.triggerType); }
  if (data.triggerConfig !== undefined) { fields.push('trigger_config = ?'); vals.push(JSON.stringify(data.triggerConfig)); }
  if (data.actionType !== undefined) { fields.push('action_type = ?'); vals.push(data.actionType); }
  if (data.actionConfig !== undefined) { fields.push('action_config = ?'); vals.push(JSON.stringify(data.actionConfig)); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); vals.push(data.isActive ? 1 : 0); }
  if (!fields.length) throw new AppError('Nada que actualizar', 400);
  vals.push(autoId, tenantId);
  const [r] = (await pool.query(
    `UPDATE engagement_automations SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, vals,
  )) as any;
  if (r.affectedRows === 0) throw new AppError('Automatización no encontrada', 404);
}

export async function deleteAutomation(tenantId: string, autoId: string): Promise<void> {
  const [r] = (await pool.query(
    'DELETE FROM engagement_automations WHERE id = ? AND tenant_id = ?', [autoId, tenantId],
  )) as any;
  if (r.affectedRows === 0) throw new AppError('Automatización no encontrada', 404);
}

// ──────────────────────────── Time-of-day Scheduler ────────────────────────────
// Delegated to automation-engine.ts::tick()

export async function runTimeOfDayAutomations(): Promise<void> {
  const { tick } = await import('./automation-engine');
  await tick();
}

// ──────────────────────────── Segment Recalculation ────────────────────────────

function buildSegmentWhere(rules: Record<string, any>): { where: string; vals: any[] } {
  const where: string[] = [];
  const vals: any[] = [];

  if (rules.level) { where.push('level = ?'); vals.push(rules.level); }
  if (rules.minVisits !== undefined) { where.push('visits >= ?'); vals.push(rules.minVisits); }
  if (rules.minSpent !== undefined) { where.push('total_spent >= ?'); vals.push(rules.minSpent); }
  if (rules.minPoints !== undefined) { where.push('points_balance >= ?'); vals.push(rules.minPoints); }
  if (rules.maxDaysInactive !== undefined) {
    where.push('(last_visit IS NULL OR last_visit < DATE_SUB(NOW(), INTERVAL ? DAY))');
    vals.push(rules.maxDaysInactive);
  }
  if (rules.isRecurrent !== undefined) {
    where.push(rules.isRecurrent ? 'visits >= 3' : 'visits < 3');
  }

  return { where: where.join(' AND '), vals };
}

export async function recomputeSegments(tenantId?: string): Promise<void> {
  const whereClause = tenantId ? 'WHERE tenant_id = ?' : '';
  const vals: any[] = tenantId ? [tenantId] : [];

  const [segments] = (await pool.query(
    `SELECT id, tenant_id, rules FROM engagement_segments WHERE is_active = 1 AND is_dynamic = 1 ${whereClause}`,
    vals,
  )) as any;

  for (const seg of segments) {
    try {
      const rules = typeof seg.rules === 'string' ? JSON.parse(seg.rules) : seg.rules;
      const { where, vals: ruleVals } = buildSegmentWhere(rules);
      const query = `SELECT COUNT(*) AS count FROM loyalty_accounts WHERE tenant_id = ? AND ${where}`;
      const [rows] = (await pool.query(query, [seg.tenant_id, ...ruleVals])) as any;
      const count = Number(rows[0].count);
      await pool.query('UPDATE engagement_segments SET customer_count = ? WHERE id = ?', [count, seg.id]);
    } catch { /* defensive */ }
  }
}

// ──────────────────────────── Streaks ────────────────────────────

export async function computeStreak(tenantId: string, accountId: string): Promise<number> {
  // Count consecutive days with transactions (earn or visit)
  const [rows] = (await pool.query(
    `SELECT DISTINCT DATE(created_at) AS dt
     FROM loyalty_transactions
     WHERE tenant_id = ? AND account_id = ? AND type = 'earn'
     ORDER BY dt DESC LIMIT 60`,
    [tenantId, accountId],
  )) as any;

  if (!rows.length) return 0;

  let streak = 1;
  const dates = rows.map((r: any) => new Date(r.dt));
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.abs(dates[i - 1].getTime() - dates[i].getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function checkDailyReward(tenantId: string, accountId: string): Promise<{ streak: number; bonus: number }> {
  const streak = await computeStreak(tenantId, accountId);

  // Streak bonuses: 3 days = 10pts, 5 days = 25pts, 7 days = 50pts, 10 = 100pts
  let bonus = 0;
  const [lastBonus] = (await pool.query(
    `SELECT event_data FROM engagement_events
     WHERE tenant_id = ? AND account_id = ? AND event_type = 'daily_bonus'
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId, accountId],
  )) as any;

  const lastBonusData = lastBonus?.[0]?.event_data;
  const lastStreakMilestone = lastBonusData
    ? (typeof lastBonusData === 'string' ? JSON.parse(lastBonusData) : lastBonusData)?.streak || 0
    : 0;

  // Only award for NEW milestones not already claimed
  const milestones = [
    { days: 3, pts: 10 }, { days: 5, pts: 25 }, { days: 7, pts: 50 }, { days: 10, pts: 100 },
    { days: 15, pts: 200 }, { days: 30, pts: 500 },
  ];

  for (const m of milestones) {
    if (streak >= m.days && lastStreakMilestone < m.days) {
      bonus = m.pts;
      // Award points
      await pool.query(
        'UPDATE loyalty_accounts SET points_balance = points_balance + ? WHERE id = ?',
        [bonus, accountId],
      );
      await pool.query(
        'INSERT INTO loyalty_transactions (id, tenant_id, account_id, type, points, reason) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), tenantId, accountId, 'earn', bonus, `Racha ${m.days} días 🔥`],
      );
      emitEngagementEvent(tenantId, accountId, 'daily_bonus', { streak, bonus, milestone: m.days }).catch(() => {});
      break;
    }
  }

  return { streak, bonus };
}

// ──────────────────────────── Revenue Attribution ────────────────────────────

export async function getRevenueAttribution(tenantId: string, days = 30): Promise<any> {
  // Revenue by source channel from sales
  const [salesByChannel] = (await pool.query(
    `SELECT
       COALESCE(notes, 'pos_direct') AS channel,
       COUNT(*) AS count,
       SUM(total) AS revenue
     FROM sales
     WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND status = 'completada'
     GROUP BY channel ORDER BY revenue DESC`,
    [tenantId, days],
  )) as any;

  // Revenue by source from storefront orders
  const [ordersByChannel] = (await pool.query(
    `SELECT
       CASE
         WHEN notes LIKE '%WhatsApp%' THEN 'whatsapp'
         WHEN notes LIKE '%chatbot%' OR notes LIKE '%IA%' THEN 'ai_chatbot'
         WHEN notes LIKE '%referido%' OR notes LIKE '%ref=%' THEN 'referral'
         WHEN notes LIKE '%campaign%' OR notes LIKE '%campaña%' THEN 'campaign'
         ELSE 'storefront'
       END AS channel,
       COUNT(*) AS count,
       SUM(total) AS revenue
     FROM storefront_orders
     WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND status IN ('confirmado','entregado')
     GROUP BY channel ORDER BY revenue DESC`,
    [tenantId, days],
  )) as any;

  // Engagement events by type (to measure engagement channels)
  const [eventsByType] = (await pool.query(
    `SELECT event_type AS type, COUNT(*) AS count
     FROM engagement_events
     WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY event_type ORDER BY count DESC`,
    [tenantId, days],
  )) as any;

  // Customers acquired by channel
  const [customersByChannel] = (await pool.query(
    `SELECT acquisition_channel AS channel, COUNT(*) AS count
     FROM loyalty_accounts WHERE tenant_id = ? AND acquisition_channel IS NOT NULL
     GROUP BY channel ORDER BY count DESC`,
    [tenantId],
  )) as any;

  // Top converting campaigns
  const [topCampaigns] = (await pool.query(
    `SELECT name, sent_count AS sent, opened_count AS opened, converted_count AS converted,
            CASE WHEN sent_count > 0 THEN ROUND(converted_count / sent_count * 100, 1) ELSE 0 END AS conversion_rate
     FROM engagement_campaigns
     WHERE tenant_id = ? AND sent_count > 0
     ORDER BY conversion_rate DESC LIMIT 5`,
    [tenantId],
  )) as any;

  return {
    salesByChannel: salesByChannel || [],
    ordersByChannel: ordersByChannel || [],
    eventsByType: eventsByType || [],
    customersByChannel: customersByChannel || [],
    topCampaigns: topCampaigns || [],
  };
}

// ──────────────────────────── AI Copilot ────────────────────────────

const COPILOT_SYSTEM_PROMPT = `Eres el asistente de negocio de un comercio en Lopbuk, una plataforma de delivery y fidelización.
Tu trabajo es analizar los datos del negocio y dar recomendaciones concretas y accionables.

REGLAS:
- Responde SIEMPRE en español
- Sé conciso y directo (máximo 4-5 líneas por punto)
- Cuando recomiendes una acción, sugiérela como botón clickable
- Usa datos reales del contexto para respaldar tus recomendaciones
- Si no tienes suficientes datos, dilo honestamente
- Formatea números en formato colombiano ($150.000)
- Puedes sugerir: crear campañas, crear segmentos, enviar push, configurar automatizaciones

FORMATO DE RESPUESTA:
- Texto normal para explicaciones
- Cuando sugieras una acción, inclúyela en un bloque: [ACTION:tipo:datos_json]
  Ejemplo: [ACTION:create_campaign:{"name":"Reactivación","objective":"recover_inactive","channels":["push"],"offerType":"percentage","offerValue":15}]`;

export async function copilotChat(tenantId: string, message: string, history: { role: string; content: string }[]): Promise<{ reply: string; actions: any[] }> {
  // Gather business context
  const analytics = await getAnalytics(tenantId).catch(() => null);
  const customers = await listCustomers(tenantId, { limit: 5, sort: 'spent' }).catch(() => ({ customers: [] }));
  const campaigns = await listCampaigns(tenantId).catch(() => []);
  const revenue = await getRevenueAttribution(tenantId, 30).catch(() => null);
  const insights = await getAIInsights(tenantId).catch(() => []);

  const context = `
CONTEXTO DEL NEGOCIO (últimos 30 días):
- Total clientes: ${analytics?.totalCustomers || 0}
- Activos (30d): ${analytics?.activeCustomers || 0}
- Recurrentes: ${analytics?.recurrentCustomers || 0}
- Perdidos (60d+): ${analytics?.lostCustomers || 0}
- Tasa retención: ${analytics?.retentionRate || '0'}%
- Tasa abandono: ${analytics?.churnRate || '0'}%
- Wallets instaladas: ${analytics?.walletInstalls || 0}
- Canjes (30d): ${analytics?.redemptions30d || 0}
- Distribución niveles: ${JSON.stringify(analytics?.byLevel || {})}

TOP CLIENTES (por gasto):
${customers.customers.map((c: any) => `- ${c.name || 'Sin nombre'}: $${Number(c.totalSpent || 0).toLocaleString('es-CO')}, ${c.level}, ${c.visits} visitas`).join('\n')}

CAMPAÑAS ACTIVAS:
${campaigns.length > 0 ? campaigns.map((c: any) => `- ${c.name}: ${c.status}, ${c.sentCount} enviados, ${c.convertedCount} conversiones`).join('\n') : 'Ninguna'}

REVENUE POR CANAL:
${revenue?.salesByChannel?.map((c: any) => `- ${c.channel}: $${Number(c.revenue || 0).toLocaleString('es-CO')} (${c.count} ventas)`).join('\n') || 'Sin datos'}

INSIGHTS:
${insights.map((i: any) => `- ${i.title}: ${i.action}`).join('\n') || 'Ninguno'}`;

  // Build messages
  const messages = [
    { role: 'user', content: context },
    ...history.slice(-6),
    { role: 'user', content: message },
  ];

  // Call AI
  let reply = 'No pude procesar tu pregunta. Verifica que la IA esté configurada en el superadmin.';
  try {
    const { getAIKeys, callAI } = await import('../agent/agent.service');
    const keys = await getAIKeys();
    const apiKey = keys.geminiKey || keys.openaiKey || keys.groqKey;
    if (apiKey) {
      reply = await callAI(apiKey, COPILOT_SYSTEM_PROMPT, messages);
    }
  } catch (e: any) {
    reply = `Error al conectar con la IA: ${e.message || 'servicio no disponible'}`;
  }

  // Extract actions from reply
  const actions: any[] = [];
  const actionRegex = /\[ACTION:(\w+):({.*?})\]/g;
  let match;
  while ((match = actionRegex.exec(reply)) !== null) {
    try {
      actions.push({ type: match[1], data: JSON.parse(match[2]) });
    } catch {}
  }
  // Clean reply (remove action markers for display)
  const cleanReply = reply.replace(/\[ACTION:\w+:.*?\]/g, '').trim();

  return { reply: cleanReply, actions };
}
