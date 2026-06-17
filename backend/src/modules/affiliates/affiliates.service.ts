/**
 * affiliates.service.ts — Lógica del módulo de Promotores / Afiliados (Sprint 2).
 *
 * Incluye: auth propia del promotor (bcrypt + JWT), perfil/wallet, CRUD de campañas
 * con generación de ref_token / discount_code, listados de conversiones y comisiones,
 * solicitudes de retiro, leaderboard mensual, misiones, y operaciones de superadmin
 * y del comercio (merchant).
 *
 * El motor de atribución (hooks en storefront/POS) y el modelo de paquetes con pago
 * inmediato se implementan en sprints posteriores.
 */
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { config, db } from '../../config';
import { AppError } from '../../common/middleware';
import { AffiliateTier, TIER_RULES, DEFAULT_COOKIE_DAYS } from './affiliates.types';

const TIER_RANK: Record<AffiliateTier, number> = { bronze: 0, silver: 1, gold: 2 };

function mapAffiliate(r: any) {
  return {
    id: r.id,
    userId: r.user_id ?? null,
    name: r.name,
    email: r.email,
    phone: r.phone ?? null,
    handle: r.handle ?? null,
    tier: r.tier as AffiliateTier,
    balanceCop: Number(r.balance_cop) || 0,
    pendingCop: Number(r.pending_cop) || 0,
    monthlySales: Number(r.monthly_sales) || 0,
    status: r.status,
    createdAt: r.created_at,
  };
}

function token12(): string {
  return (uuidv4().replace(/-/g, '') + Math.random().toString(36).slice(2)).slice(0, 12);
}

class AffiliatesService {
  // ── Auth propia del promotor ───────────────────────────────────────────────
  signToken(affiliateId: string): string {
    return jwt.sign({ affiliateId, type: 'affiliate' }, config.jwt.secret, { expiresIn: '30d' } as jwt.SignOptions);
  }

  async getById(id: string): Promise<any | null> {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliates WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? mapAffiliate(rows[0]) : null;
  }

  async register(data: { name: string; email: string; password: string; phone?: string; handle?: string }) {
    const email = String(data.email || '').trim().toLowerCase();
    const name = String(data.name || '').trim();
    if (!name) throw new AppError('El nombre es requerido', 400);
    if (!email) throw new AppError('El email es requerido', 400);
    if (!data.password || data.password.length < 6) throw new AppError('La contraseña debe tener al menos 6 caracteres', 400);

    const [dup] = await db.execute<RowDataPacket[]>('SELECT id FROM affiliates WHERE email = ? LIMIT 1', [email]);
    if (dup.length > 0) throw new AppError('Ya existe un promotor con ese email', 409);

    let handle = data.handle ? String(data.handle).trim().toLowerCase().replace(/[^a-z0-9_.]/g, '') : null;
    if (handle) {
      const [h] = await db.execute<RowDataPacket[]>('SELECT id FROM affiliates WHERE handle = ? LIMIT 1', [handle]);
      if (h.length > 0) handle = `${handle}${Math.floor(Math.random() * 900 + 100)}`;
    }

    const id = uuidv4();
    const hash = await bcrypt.hash(data.password, 10);
    await db.execute(
      `INSERT INTO affiliates (id, name, email, phone, handle, password_hash) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, email, data.phone || null, handle, hash]
    );
    const profile = await this.getById(id);
    return { affiliate: profile, token: this.signToken(id) };
  }

  async login(email: string, password: string) {
    const e = String(email || '').trim().toLowerCase();
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliates WHERE email = ? LIMIT 1', [e]);
    const row = rows[0];
    if (!row || !row.password_hash) throw new AppError('Credenciales inválidas', 401);
    if (row.status === 'suspended') throw new AppError('Tu cuenta de promotor está suspendida', 403);
    const ok = await bcrypt.compare(String(password || ''), row.password_hash);
    if (!ok) throw new AppError('Credenciales inválidas', 401);
    return { affiliate: mapAffiliate(row), token: this.signToken(row.id) };
  }

  // ── Campañas ───────────────────────────────────────────────────────────────
  async listMyCampaigns(affiliateId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT c.*, t.name AS tenantName,
              (SELECT COUNT(*) FROM affiliate_conversions ac WHERE ac.campaign_id = c.id) AS conversions
         FROM affiliate_campaigns c
         LEFT JOIN tenants t ON t.id = c.tenant_id
        WHERE c.affiliate_id = ? ORDER BY c.created_at DESC`,
      [affiliateId]
    );
    return rows.map(this.mapCampaign);
  }

  mapCampaign = (r: any) => ({
    id: r.id, affiliateId: r.affiliate_id, tenantId: r.tenant_id, tenantName: r.tenantName ?? null,
    entityType: r.entity_type, entityId: r.entity_id ?? null,
    refToken: r.ref_token, discountCode: r.discount_code ?? null,
    discountPct: Number(r.discount_pct) || 0, commissionPct: Number(r.commission_pct) || 0,
    cookieDays: Number(r.cookie_days) || DEFAULT_COOKIE_DAYS, isActive: Boolean(r.is_active),
    conversions: r.conversions != null ? Number(r.conversions) : undefined,
    createdAt: r.created_at,
  });

  async createCampaign(affiliateId: string, data: {
    tenantId: string; entityType?: string; entityId?: string;
    discountPct?: number; commissionPct?: number; cookieDays?: number; withCode?: boolean;
  }) {
    if (!data.tenantId) throw new AppError('Falta el comercio (tenantId)', 400);
    const [t] = await db.execute<RowDataPacket[]>("SELECT id, name FROM tenants WHERE id = ? AND status = 'activo' LIMIT 1", [data.tenantId]);
    if (t.length === 0) throw new AppError('Comercio no encontrado o inactivo', 404);

    const aff = await this.getById(affiliateId);
    if (!aff) throw new AppError('Promotor no encontrado', 404);
    const entityType = ['store', 'product', 'event', 'service'].includes(String(data.entityType)) ? data.entityType! : 'store';
    const commissionPct = data.commissionPct != null ? Number(data.commissionPct) : TIER_RULES[aff.tier as AffiliateTier].baseCommissionPct;
    const cookieDays = data.cookieDays != null ? Math.max(1, Math.min(60, Number(data.cookieDays))) : DEFAULT_COOKIE_DAYS;

    const id = uuidv4();
    let discountCode: string | null = null;
    if (data.withCode) {
      const base = (aff.handle || aff.name || 'PROMO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PROMO';
      discountCode = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
    }

    // ref_token único (reintenta ante colisión)
    for (let attempt = 0; attempt < 3; attempt++) {
      const refToken = token12();
      try {
        await db.execute(
          `INSERT INTO affiliate_campaigns
             (id, affiliate_id, tenant_id, entity_type, entity_id, ref_token, discount_code, discount_pct, commission_pct, cookie_days)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, affiliateId, data.tenantId, entityType, data.entityId || null, refToken, discountCode,
           Number(data.discountPct) || 0, commissionPct, cookieDays]
        );
        const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliate_campaigns WHERE id = ?', [id]);
        return this.mapCampaign({ ...rows[0], tenantName: t[0].name });
      } catch (e: any) {
        if (e?.code === 'ER_DUP_ENTRY' && /ref/i.test(e?.message || '') && attempt < 2) continue;
        if (e?.code === 'ER_DUP_ENTRY') throw new AppError('El código de descuento ya existe, intenta de nuevo', 409);
        throw e;
      }
    }
    throw new AppError('No se pudo generar la campaña, intenta de nuevo', 500);
  }

  async campaignMetrics(affiliateId: string, campaignId: string) {
    const [c] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliate_campaigns WHERE id = ? AND affiliate_id = ? LIMIT 1', [campaignId, affiliateId]);
    if (c.length === 0) throw new AppError('Campaña no encontrada', 404);
    const [agg] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS conversions,
              COALESCE(SUM(commission_cop), 0) AS totalCommission,
              COALESCE(SUM(CASE WHEN status='approved' THEN commission_cop ELSE 0 END), 0) AS approvedCommission,
              COALESCE(SUM(CASE WHEN status='pending'  THEN commission_cop ELSE 0 END), 0) AS pendingCommission,
              COALESCE(SUM(order_total_cop), 0) AS totalSales
         FROM affiliate_conversions WHERE campaign_id = ?`,
      [campaignId]
    );
    return {
      campaign: this.mapCampaign(c[0]),
      conversions: Number(agg[0].conversions) || 0,
      totalSalesCop: Number(agg[0].totalSales) || 0,
      totalCommissionCop: Number(agg[0].totalCommission) || 0,
      approvedCommissionCop: Number(agg[0].approvedCommission) || 0,
      pendingCommissionCop: Number(agg[0].pendingCommission) || 0,
    };
  }

  // ── Conversiones / comisiones (del promotor) ───────────────────────────────
  async listMyConversions(affiliateId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT ac.*, t.name AS tenantName
         FROM affiliate_conversions ac
         JOIN affiliate_campaigns c ON c.id = ac.campaign_id
         LEFT JOIN tenants t ON t.id = ac.tenant_id
        WHERE c.affiliate_id = ? ORDER BY ac.created_at DESC LIMIT 200`,
      [affiliateId]
    );
    return rows.map((r: any) => ({
      id: r.id, campaignId: r.campaign_id, tenantId: r.tenant_id, tenantName: r.tenantName ?? null,
      method: r.method, orderTotalCop: Number(r.order_total_cop) || 0, commissionCop: Number(r.commission_cop) || 0,
      status: r.status, createdAt: r.created_at,
    }));
  }

  async listMyCommissions(affiliateId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM affiliate_commissions WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT 200', [affiliateId]
    );
    return rows.map((r: any) => ({
      id: r.id, conversionId: r.conversion_id ?? null, type: r.type,
      amountCop: Number(r.amount_cop) || 0, status: r.status, note: r.note ?? null, createdAt: r.created_at,
    }));
  }

  // ── Retiros ────────────────────────────────────────────────────────────────
  async requestWithdrawal(affiliateId: string, data: { amountCop: number; paymentMethod: string }) {
    const amount = Number(data.amountCop) || 0;
    if (amount <= 0) throw new AppError('Monto inválido', 400);
    if (!data.paymentMethod?.trim()) throw new AppError('Indica el método de pago (ej: Nequi: 3001234567)', 400);
    const aff = await this.getById(affiliateId);
    if (!aff) throw new AppError('Promotor no encontrado', 404);
    if (amount > aff.balanceCop) throw new AppError('El monto supera tu saldo disponible', 400);
    const id = uuidv4();
    await db.execute(
      'INSERT INTO affiliate_withdrawals (id, affiliate_id, amount_cop, payment_method) VALUES (?, ?, ?, ?)',
      [id, affiliateId, amount, data.paymentMethod.trim()]
    );
    return { id, amountCop: amount, status: 'requested' };
  }

  async listMyWithdrawals(affiliateId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM affiliate_withdrawals WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT 100', [affiliateId]
    );
    return rows.map((r: any) => ({
      id: r.id, amountCop: Number(r.amount_cop) || 0, paymentMethod: r.payment_method,
      status: r.status, note: r.note ?? null, createdAt: r.created_at,
    }));
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────
  async leaderboard() {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT a.id, a.name, a.handle, a.tier,
              COUNT(ac.id) AS conversions,
              COALESCE(SUM(ac.commission_cop), 0) AS earned
         FROM affiliates a
         JOIN affiliate_campaigns c ON c.affiliate_id = a.id
         JOIN affiliate_conversions ac ON ac.campaign_id = c.id
        WHERE ac.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
        GROUP BY a.id, a.name, a.handle, a.tier
        ORDER BY conversions DESC, earned DESC LIMIT 10`
    );
    return rows.map((r: any, i: number) => ({
      rank: i + 1, id: r.id, name: r.name, handle: r.handle ?? null, tier: r.tier,
      conversions: Number(r.conversions) || 0, earnedCop: Number(r.earned) || 0,
    }));
  }

  // ── Misiones ───────────────────────────────────────────────────────────────
  async listMissions(affiliateTier: AffiliateTier) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM affiliate_missions
        WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC`
    );
    return rows
      .filter((r: any) => TIER_RANK[r.min_tier as AffiliateTier] <= TIER_RANK[affiliateTier])
      .map((r: any) => ({
        id: r.id, title: r.title, description: r.description ?? null, rewardCop: Number(r.reward_cop) || 0,
        requiredViews: r.required_views ?? null, minTier: r.min_tier, expiresAt: r.expires_at ?? null,
      }));
  }

  async submitMission(affiliateId: string, missionId: string, contentUrl: string) {
    if (!contentUrl?.trim()) throw new AppError('Pega la URL de tu contenido', 400);
    const [m] = await db.execute<RowDataPacket[]>('SELECT id FROM affiliate_missions WHERE id = ? AND is_active = 1 LIMIT 1', [missionId]);
    if (m.length === 0) throw new AppError('Misión no disponible', 404);
    const id = uuidv4();
    await db.execute(
      'INSERT INTO affiliate_mission_submissions (id, mission_id, affiliate_id, content_url) VALUES (?, ?, ?, ?)',
      [id, missionId, affiliateId, contentUrl.trim()]
    );
    return { id, status: 'submitted' };
  }

  // ── Superadmin ─────────────────────────────────────────────────────────────
  async adminListAffiliates() {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliates ORDER BY created_at DESC');
    return rows.map(mapAffiliate);
  }

  async adminSetStatus(id: string, status: 'active' | 'suspended') {
    const [r] = await db.execute<ResultSetHeader>('UPDATE affiliates SET status = ? WHERE id = ?', [status, id]);
    if (r.affectedRows === 0) throw new AppError('Promotor no encontrado', 404);
  }

  async adminListWithdrawals(status?: string) {
    const where = status ? 'WHERE w.status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT w.*, a.name AS affiliateName, a.handle AS affiliateHandle, a.balance_cop AS affiliateBalance
         FROM affiliate_withdrawals w JOIN affiliates a ON a.id = w.affiliate_id
         ${where} ORDER BY w.created_at DESC`, params
    );
    return rows.map((r: any) => ({
      id: r.id, affiliateId: r.affiliate_id, affiliateName: r.affiliateName, affiliateHandle: r.affiliateHandle ?? null,
      affiliateBalanceCop: Number(r.affiliateBalance) || 0,
      amountCop: Number(r.amount_cop) || 0, paymentMethod: r.payment_method, status: r.status,
      note: r.note ?? null, createdAt: r.created_at,
    }));
  }

  async adminProcessWithdrawal(id: string, status: 'processing' | 'paid' | 'rejected', processedBy: string, note?: string) {
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM affiliate_withdrawals WHERE id = ? FOR UPDATE', [id]);
      const w = (rows as any[])[0];
      if (!w) throw new AppError('Retiro no encontrado', 404);
      if (status === 'paid') {
        // Descuenta del saldo disponible al marcar pagado
        const [upd] = await conn.query('UPDATE affiliates SET balance_cop = balance_cop - ? WHERE id = ? AND balance_cop >= ?', [w.amount_cop, w.affiliate_id, w.amount_cop]);
        if ((upd as any).affectedRows === 0) throw new AppError('Saldo insuficiente del promotor para marcar pagado', 400);
      }
      await conn.query('UPDATE affiliate_withdrawals SET status = ?, processed_by = ?, note = ? WHERE id = ?', [status, processedBy, note || null, id]);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }

  async adminListMissions() {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliate_missions ORDER BY created_at DESC');
    return rows.map((r: any) => ({
      id: r.id, title: r.title, description: r.description ?? null, rewardCop: Number(r.reward_cop) || 0,
      requiredViews: r.required_views ?? null, minTier: r.min_tier, expiresAt: r.expires_at ?? null, isActive: Boolean(r.is_active),
    }));
  }

  async adminCreateMission(data: any) {
    if (!data?.title?.trim()) throw new AppError('El título es requerido', 400);
    const id = uuidv4();
    await db.execute(
      `INSERT INTO affiliate_missions (id, title, description, reward_cop, required_views, min_tier, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, String(data.title).trim(), data.description || null, Number(data.rewardCop) || 0,
       data.requiredViews != null ? Number(data.requiredViews) : null,
       ['bronze', 'silver', 'gold'].includes(data.minTier) ? data.minTier : 'bronze',
       data.expiresAt || null, data.isActive === false ? 0 : 1]
    );
    return { id };
  }

  async adminUpdateMission(id: string, data: any) {
    const fields: string[] = []; const vals: any[] = [];
    const map: Record<string, string> = { title: 'title', description: 'description', rewardCop: 'reward_cop', requiredViews: 'required_views', minTier: 'min_tier', expiresAt: 'expires_at', isActive: 'is_active' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] === undefined) continue;
      let v = data[k];
      if (k === 'isActive') v = v ? 1 : 0;
      if (k === 'rewardCop' || k === 'requiredViews') v = v != null ? Number(v) : null;
      fields.push(`${col} = ?`); vals.push(v);
    }
    if (fields.length === 0) return;
    const [r] = await db.execute<ResultSetHeader>(`UPDATE affiliate_missions SET ${fields.join(', ')} WHERE id = ?`, [...vals, id]);
    if (r.affectedRows === 0) throw new AppError('Misión no encontrada', 404);
  }

  async adminListSubmissions(status?: string) {
    const where = status ? 'WHERE s.status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT s.*, m.title AS missionTitle, m.reward_cop AS rewardCop, a.name AS affiliateName
         FROM affiliate_mission_submissions s
         JOIN affiliate_missions m ON m.id = s.mission_id
         JOIN affiliates a ON a.id = s.affiliate_id
         ${where} ORDER BY s.created_at DESC`, params
    );
    return rows.map((r: any) => ({
      id: r.id, missionId: r.mission_id, missionTitle: r.missionTitle, rewardCop: Number(r.rewardCop) || 0,
      affiliateId: r.affiliate_id, affiliateName: r.affiliateName, contentUrl: r.content_url,
      status: r.status, reviewNote: r.review_note ?? null, createdAt: r.created_at,
    }));
  }

  async adminReviewSubmission(id: string, status: 'approved' | 'rejected', reviewedBy: string, note?: string) {
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT s.*, m.reward_cop FROM affiliate_mission_submissions s
           JOIN affiliate_missions m ON m.id = s.mission_id WHERE s.id = ? FOR UPDATE`, [id]);
      const s = (rows as any[])[0];
      if (!s) throw new AppError('Envío no encontrado', 404);
      if (s.status !== 'submitted') throw new AppError('Este envío ya fue revisado', 400);
      await conn.query('UPDATE affiliate_mission_submissions SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?', [status, reviewedBy, note || null, id]);
      if (status === 'approved') {
        const reward = Number(s.reward_cop) || 0;
        if (reward > 0) {
          await conn.query('INSERT INTO affiliate_commissions (id, affiliate_id, type, amount_cop, status, note) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), s.affiliate_id, 'mission_bonus', reward, 'approved', `Misión aprobada`]);
          await conn.query('UPDATE affiliates SET balance_cop = balance_cop + ? WHERE id = ?', [reward, s.affiliate_id]);
        }
      }
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }

  async adminAnalytics() {
    const [[a]] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS total, SUM(status='active') AS active FROM affiliates") as any;
    const [[c]] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS conv, COALESCE(SUM(commission_cop),0) AS commission FROM affiliate_conversions WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')") as any;
    const [[p]] = await db.execute<RowDataPacket[]>("SELECT COALESCE(SUM(amount_cop),0) AS paid FROM affiliate_commissions WHERE status='paid'") as any;
    const [[w]] = await db.execute<RowDataPacket[]>("SELECT COALESCE(SUM(amount_cop),0) AS pending FROM affiliate_withdrawals WHERE status IN ('requested','processing')") as any;
    return {
      totalAffiliates: Number(a.total) || 0,
      activeAffiliates: Number(a.active) || 0,
      monthConversions: Number(c.conv) || 0,
      monthCommissionCop: Number(c.commission) || 0,
      totalPaidCop: Number(p.paid) || 0,
      pendingWithdrawalsCop: Number(w.pending) || 0,
    };
  }

  // ── Vista del comercio (merchant) ──────────────────────────────────────────
  async tenantOverview(tenantId: string) {
    const [promoters] = await db.execute<RowDataPacket[]>(
      `SELECT a.id, a.name, a.handle, a.tier,
              COUNT(DISTINCT c.id) AS campaigns,
              COUNT(ac.id) AS conversions,
              COALESCE(SUM(ac.commission_cop), 0) AS commission
         FROM affiliate_campaigns c
         JOIN affiliates a ON a.id = c.affiliate_id
         LEFT JOIN affiliate_conversions ac ON ac.campaign_id = c.id
        WHERE c.tenant_id = ?
        GROUP BY a.id, a.name, a.handle, a.tier
        ORDER BY conversions DESC`,
      [tenantId]
    );
    return promoters.map((r: any) => ({
      id: r.id, name: r.name, handle: r.handle ?? null, tier: r.tier,
      campaigns: Number(r.campaigns) || 0, conversions: Number(r.conversions) || 0,
      commissionCop: Number(r.commission) || 0,
    }));
  }

  async tenantConversions(tenantId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT ac.*, a.name AS affiliateName, a.handle AS affiliateHandle
         FROM affiliate_conversions ac
         JOIN affiliate_campaigns c ON c.id = ac.campaign_id
         JOIN affiliates a ON a.id = c.affiliate_id
        WHERE ac.tenant_id = ? ORDER BY ac.created_at DESC LIMIT 200`,
      [tenantId]
    );
    return rows.map((r: any) => ({
      id: r.id, affiliateName: r.affiliateName, affiliateHandle: r.affiliateHandle ?? null,
      method: r.method, orderTotalCop: Number(r.order_total_cop) || 0, commissionCop: Number(r.commission_cop) || 0,
      status: r.status, createdAt: r.created_at,
    }));
  }

  // ── Paquetes de publicidad (pago inmediato) ────────────────────────────────
  private mapPkg = (r: any) => ({
    id: r.id, name: r.name, description: r.description ?? null,
    deliverables: r.deliverables ? (typeof r.deliverables === 'string' ? JSON.parse(r.deliverables) : r.deliverables) : null,
    priceCop: Number(r.price_cop) || 0, affiliatePct: Number(r.affiliate_pct) || 0, platformPct: Number(r.platform_pct) || 0,
    isActive: Boolean(r.is_active), createdAt: r.created_at,
  });

  private mapPkgOrder = (r: any) => ({
    id: r.id, packageId: r.package_id, packageName: r.packageName ?? null,
    affiliateId: r.affiliate_id, affiliateName: r.affiliateName ?? null,
    tenantId: r.tenant_id, tenantName: r.tenantName ?? null,
    entityType: r.entity_type, entityId: r.entity_id ?? null, status: r.status,
    totalCop: Number(r.total_cop) || 0, affiliateCop: Number(r.affiliate_cop) || 0, platformCop: Number(r.platform_cop) || 0,
    paidAt: r.paid_at ?? null, contentDeadline: r.content_deadline ?? null,
    contentDelivered: r.content_delivered ? (typeof r.content_delivered === 'string' ? JSON.parse(r.content_delivered) : r.content_delivered) : null,
    createdAt: r.created_at,
  });

  async listActivePackages() {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliate_packages WHERE is_active = 1 ORDER BY price_cop ASC');
    return rows.map(this.mapPkg);
  }

  async adminListPackages() {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliate_packages ORDER BY created_at DESC');
    return rows.map(this.mapPkg);
  }

  async adminCreatePackage(data: any) {
    if (!data?.name?.trim()) throw new AppError('El nombre es requerido', 400);
    const price = Number(data.priceCop) || 0;
    if (price <= 0) throw new AppError('El precio debe ser mayor a 0', 400);
    let affPct = Number(data.affiliatePct);
    if (isNaN(affPct)) affPct = 70;
    affPct = Math.max(0, Math.min(100, affPct));
    const platPct = data.platformPct != null && !isNaN(Number(data.platformPct)) ? Math.max(0, Math.min(100, Number(data.platformPct))) : 100 - affPct;
    const id = uuidv4();
    await db.execute(
      `INSERT INTO affiliate_packages (id, name, description, deliverables, price_cop, affiliate_pct, platform_pct, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name.trim(), data.description || null, data.deliverables ? JSON.stringify(data.deliverables) : null, price, affPct, platPct, data.isActive === false ? 0 : 1]
    );
    return { id };
  }

  async adminUpdatePackage(id: string, data: any) {
    const fields: string[] = []; const vals: any[] = [];
    const map: Record<string, string> = { name: 'name', description: 'description', priceCop: 'price_cop', affiliatePct: 'affiliate_pct', platformPct: 'platform_pct', isActive: 'is_active' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] === undefined) continue;
      let v = data[k];
      if (k === 'isActive') v = v ? 1 : 0;
      if (k === 'priceCop' || k === 'affiliatePct' || k === 'platformPct') v = Number(v) || 0;
      fields.push(`${col} = ?`); vals.push(v);
    }
    if (data.deliverables !== undefined) { fields.push('deliverables = ?'); vals.push(data.deliverables ? JSON.stringify(data.deliverables) : null); }
    if (fields.length === 0) return;
    const [r] = await db.execute<ResultSetHeader>(`UPDATE affiliate_packages SET ${fields.join(', ')} WHERE id = ?`, [...vals, id]);
    if (r.affectedRows === 0) throw new AppError('Paquete no encontrado', 404);
  }

  async adminDeletePackage(id: string) {
    await db.execute('UPDATE affiliate_packages SET is_active = 0 WHERE id = ?', [id]);
  }

  // El comercio contrata un paquete con un promotor específico → queda pendiente de pago.
  async contractPackage(tenantId: string, data: { packageId: string; affiliateId: string; entityType?: string; entityId?: string; contentDeadline?: string }) {
    if (!data.packageId || !data.affiliateId) throw new AppError('Falta el paquete o el promotor', 400);
    const [pk] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliate_packages WHERE id = ? AND is_active = 1 LIMIT 1', [data.packageId]);
    if (pk.length === 0) throw new AppError('Paquete no disponible', 404);
    const [af] = await db.execute<RowDataPacket[]>("SELECT id FROM affiliates WHERE id = ? AND status = 'active' LIMIT 1", [data.affiliateId]);
    if (af.length === 0) throw new AppError('Promotor no disponible', 404);

    const price = Number(pk[0].price_cop) || 0;
    const affiliateCop = Math.round(price * (Number(pk[0].affiliate_pct) || 0) / 100);
    const platformCop = price - affiliateCop;
    const entityType = ['store', 'event', 'service'].includes(String(data.entityType)) ? data.entityType! : 'store';
    const id = uuidv4();
    await db.execute(
      `INSERT INTO affiliate_package_orders
         (id, package_id, affiliate_id, tenant_id, entity_type, entity_id, status, total_cop, affiliate_cop, platform_cop, content_deadline)
       VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?, ?)`,
      [id, data.packageId, data.affiliateId, tenantId, entityType, data.entityId || null, price, affiliateCop, platformCop, data.contentDeadline || null]
    );
    return { id, totalCop: price, affiliateCop, platformCop, status: 'pending_payment' };
  }

  // Pago confirmado → libera la comisión al wallet del promotor INMEDIATAMENTE.
  async markPackagePaid(orderId: string) {
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM affiliate_package_orders WHERE id = ? FOR UPDATE', [orderId]);
      const o = (rows as any[])[0];
      if (!o) throw new AppError('Contratación no encontrada', 404);
      if (o.status !== 'pending_payment') throw new AppError('Esta contratación ya fue procesada', 400);
      await conn.query("UPDATE affiliate_package_orders SET status = 'paid', paid_at = NOW() WHERE id = ?", [orderId]);
      const affiliateCop = Number(o.affiliate_cop) || 0;
      if (affiliateCop > 0) {
        await conn.query('INSERT INTO affiliate_commissions (id, affiliate_id, type, amount_cop, status, note) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), o.affiliate_id, 'package', affiliateCop, 'approved', `Paquete pagado (orden ${orderId})`]);
        await conn.query('UPDATE affiliates SET balance_cop = balance_cop + ? WHERE id = ?', [affiliateCop, o.affiliate_id]);
      }
      await conn.commit();
      return { id: orderId, status: 'paid', affiliateCop };
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }

  // El promotor entrega el contenido (URLs) → la orden pasa a "en progreso".
  async deliverPackageContent(affiliateId: string, orderId: string, urls: string[]) {
    const list = Array.isArray(urls) ? urls.filter(Boolean).map(String) : [];
    if (list.length === 0) throw new AppError('Agrega al menos una URL de contenido', 400);
    const [rows] = await db.execute<RowDataPacket[]>('SELECT status FROM affiliate_package_orders WHERE id = ? AND affiliate_id = ? LIMIT 1', [orderId, affiliateId]);
    if (rows.length === 0) throw new AppError('Contratación no encontrada', 404);
    if (rows[0].status === 'pending_payment') throw new AppError('El comercio aún no ha pagado esta contratación', 400);
    const nextStatus = rows[0].status === 'paid' ? 'in_progress' : rows[0].status;
    await db.execute('UPDATE affiliate_package_orders SET content_delivered = ?, status = ? WHERE id = ?', [JSON.stringify(list), nextStatus, orderId]);
    return { id: orderId, status: nextStatus, contentDelivered: list };
  }

  // El comercio marca la contratación como completada.
  async completePackageOrder(tenantId: string, orderId: string) {
    const [r] = await db.execute<ResultSetHeader>(
      "UPDATE affiliate_package_orders SET status = 'completed' WHERE id = ? AND tenant_id = ? AND status IN ('paid','in_progress')",
      [orderId, tenantId]
    );
    if (r.affectedRows === 0) throw new AppError('No se pudo completar (verifica que esté pagada)', 400);
  }

  async listMyPackageOrders(affiliateId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT po.*, p.name AS packageName, t.name AS tenantName
         FROM affiliate_package_orders po
         JOIN affiliate_packages p ON p.id = po.package_id
         LEFT JOIN tenants t ON t.id = po.tenant_id
        WHERE po.affiliate_id = ? ORDER BY po.created_at DESC`,
      [affiliateId]
    );
    return rows.map(this.mapPkgOrder);
  }

  async tenantPackageOrders(tenantId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT po.*, p.name AS packageName, a.name AS affiliateName
         FROM affiliate_package_orders po
         JOIN affiliate_packages p ON p.id = po.package_id
         JOIN affiliates a ON a.id = po.affiliate_id
        WHERE po.tenant_id = ? ORDER BY po.created_at DESC`,
      [tenantId]
    );
    return rows.map(this.mapPkgOrder);
  }

  async adminListPackageOrders(status?: string) {
    const where = status ? 'WHERE po.status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT po.*, p.name AS packageName, a.name AS affiliateName, t.name AS tenantName
         FROM affiliate_package_orders po
         JOIN affiliate_packages p ON p.id = po.package_id
         JOIN affiliates a ON a.id = po.affiliate_id
         LEFT JOIN tenants t ON t.id = po.tenant_id
         ${where} ORDER BY po.created_at DESC`, params
    );
    return rows.map(this.mapPkgOrder);
  }

  // ── Motor de atribución ────────────────────────────────────────────────────
  // Hook 1: atribución por enlace (?ref=TOKEN) al crear un pedido online.
  async attributeOrder(p: { refToken?: string | null; tenantId: string; orderId: string; orderTotalCop: number }) {
    const refToken = String(p.refToken || '').trim();
    if (!refToken) return null;
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM affiliate_campaigns WHERE ref_token = ? AND is_active = 1 LIMIT 1', [refToken]);
    const c = rows[0];
    if (!c) return null;
    if (c.tenant_id !== p.tenantId) return null; // la campaña debe ser de la tienda del pedido
    // Evita doble atribución del mismo pedido
    const [dup] = await db.execute<RowDataPacket[]>('SELECT id FROM affiliate_conversions WHERE order_id = ? LIMIT 1', [p.orderId]);
    if (dup.length > 0) return null;
    const total = Math.max(0, Number(p.orderTotalCop) || 0);
    const commission = Math.round(total * (Number(c.commission_pct) || 0) / 100);
    return this._recordConversion({
      campaignId: c.id, affiliateId: c.affiliate_id, tenantId: p.tenantId,
      orderId: p.orderId, saleId: null, method: 'link', orderTotalCop: total, commissionCop: commission,
    });
  }

  // Hook 2 (POS): ¿el código corresponde a una campaña de afiliado? (se chequea ANTES de cupones)
  async lookupAffiliateCode(code: string, tenantId: string) {
    const c = String(code || '').trim();
    if (!c) return null;
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM affiliate_campaigns WHERE discount_code = ? AND tenant_id = ? AND is_active = 1 LIMIT 1', [c, tenantId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return { campaignId: r.id, affiliateId: r.affiliate_id, discountPct: Number(r.discount_pct) || 0, commissionPct: Number(r.commission_pct) || 0 };
  }

  // Registra la conversión de una venta POS atribuida por código.
  async attributeSaleByCode(p: { code: string; tenantId: string; saleId: string; orderTotalCop: number }) {
    const camp = await this.lookupAffiliateCode(p.code, p.tenantId);
    if (!camp) return null;
    const [dup] = await db.execute<RowDataPacket[]>('SELECT id FROM affiliate_conversions WHERE sale_id = ? LIMIT 1', [p.saleId]);
    if (dup.length > 0) return null;
    const total = Math.max(0, Number(p.orderTotalCop) || 0);
    const commission = Math.round(total * camp.commissionPct / 100);
    return this._recordConversion({
      campaignId: camp.campaignId, affiliateId: camp.affiliateId, tenantId: p.tenantId,
      orderId: null, saleId: p.saleId, method: 'code', orderTotalCop: total, commissionCop: commission,
    });
  }

  private async _recordConversion(d: {
    campaignId: string; affiliateId: string; tenantId: string;
    orderId: string | null; saleId: string | null; method: 'link' | 'code';
    orderTotalCop: number; commissionCop: number;
  }) {
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const convId = uuidv4();
      await conn.query(
        `INSERT INTO affiliate_conversions
           (id, campaign_id, tenant_id, order_id, sale_id, method, order_total_cop, commission_cop, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [convId, d.campaignId, d.tenantId, d.orderId, d.saleId, d.method, d.orderTotalCop, d.commissionCop]
      );
      if (d.commissionCop > 0) {
        await conn.query(
          'INSERT INTO affiliate_commissions (id, affiliate_id, conversion_id, type, amount_cop, status, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), d.affiliateId, convId, 'conversion', d.commissionCop, 'pending', `Conversión ${d.method}`]
        );
        await conn.query('UPDATE affiliates SET pending_cop = pending_cop + ? WHERE id = ?', [d.commissionCop, d.affiliateId]);
      }
      await conn.commit();
      return { conversionId: convId, commissionCop: d.commissionCop };
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }

  // Aprobación automática: conversiones pendientes pasada su ventana → approved
  // (pending_cop → balance_cop, comisión approved, +1 venta mensual para el tier).
  async runAutoApprovals() {
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const [pend] = await conn.query(
        `SELECT ac.id, ac.commission_cop, c.affiliate_id
           FROM affiliate_conversions ac
           JOIN affiliate_campaigns c ON c.id = ac.campaign_id
          WHERE ac.status = 'pending'
            AND DATE_ADD(ac.created_at, INTERVAL COALESCE(c.cookie_days, 7) DAY) < NOW()
          FOR UPDATE`
      );
      let approved = 0;
      for (const row of (pend as any[])) {
        await conn.query("UPDATE affiliate_conversions SET status = 'approved', approved_at = NOW() WHERE id = ?", [row.id]);
        await conn.query("UPDATE affiliate_commissions SET status = 'approved' WHERE conversion_id = ?", [row.id]);
        await conn.query(
          'UPDATE affiliates SET pending_cop = GREATEST(0, pending_cop - ?), balance_cop = balance_cop + ?, monthly_sales = monthly_sales + 1 WHERE id = ?',
          [row.commission_cop, row.commission_cop, row.affiliate_id]
        );
        approved++;
      }
      await conn.commit();
      return { approved };
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }
}

export const affiliatesService = new AffiliatesService();
