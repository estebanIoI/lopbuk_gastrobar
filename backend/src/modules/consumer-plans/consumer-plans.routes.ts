/**
 * consumer-plans.routes — API del sistema Consumer Plans / LEGEND (G3).
 *   Consumidor (authenticate):
 *     POST /redeem            canjear código  (rate-limit 5/15min)
 *     GET  /me                estado del plan + entitlements
 *     GET  /legend-config     animación/colores del reveal
 *   Superadmin:
 *     POST /admin/codes  ·  GET /admin/codes  ·  PATCH /admin/codes/:id
 *     GET/PUT /admin/legend-config
 */
import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import * as svc from './consumer-plans.service';

const router: ReturnType<typeof Router> = Router();

const fail = (res: Response, e: any, msg: string) => {
  const code = e?.statusCode || 500;
  if (code === 500) console.error(`${msg}:`, e);
  res.status(code).json({ success: false, error: e?.message || msg });
};

// ── Rate limit simple en memoria para /redeem (5 intentos / 15 min por usuario) ──
const REDEEM_WINDOW_MS = 15 * 60 * 1000;
const REDEEM_MAX = 5;
const redeemHits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (redeemHits.get(userId) || []).filter(t => now - t < REDEEM_WINDOW_MS);
  hits.push(now);
  redeemHits.set(userId, hits);
  return hits.length > REDEEM_MAX;
}

const SUPERADMIN = [authenticate, authorize('superadmin')];

// ── Consumidor ───────────────────────────────────────────────────────────────
router.post('/redeem', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (rateLimited(userId)) {
      res.status(429).json({ success: false, error: 'Demasiados intentos. Espera unos minutos.' });
      return;
    }
    const out = await svc.redeemCode({
      userId,
      code: String(req.body?.code || ''),
      tenantId: req.user?.tenantId ?? null,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    const cfg = await svc.getLegendConfig();
    res.json({ success: true, data: { ...out, revealAnimation: cfg.animation } });
  } catch (e) { fail(res, e, 'Error al canjear el código'); }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.getUserTier(req.user!.userId) }); }
  catch (e) { fail(res, e, 'Error al consultar el plan'); }
});

router.get('/legend-config', authenticate, async (_req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.getLegendConfig() }); }
  catch (e) { fail(res, e, 'Error al leer la configuración'); }
});

router.get('/me/discounts', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.getMyDiscounts(req.user!.userId) }); }
  catch (e) { fail(res, e, 'Error al consultar descuentos'); }
});

// ── Compra self-serve de LEGEND ──
router.get('/legend/pricing', authenticate, async (_req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: svc.getLegendPricing() }); }
  catch (e) { fail(res, e, 'Error al obtener precios'); }
});
router.post('/legend/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.createLegendCheckout(req.user!.userId, String(req.body?.plan || ''), req.body?.origin) }); }
  catch (e) { fail(res, e, 'Error al iniciar la compra'); }
});

router.post('/me/ping', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.pingActivity(req.user!.userId) }); }
  catch (e) { fail(res, e, 'Error al registrar actividad'); }
});

router.post('/me/event', authenticate, async (req: AuthRequest, res: Response) => {
  try { await svc.trackEvent(req.user!.userId, String(req.body?.event || ''), req.body?.metadata); res.json({ success: true }); }
  catch (e) { fail(res, e, 'Error al registrar evento'); }
});

// ── Superadmin ───────────────────────────────────────────────────────────────
router.post('/admin/codes', SUPERADMIN, async (req: AuthRequest, res: Response) => {
  try {
    const b = req.body || {};
    const out = await svc.createCode({
      tier: b.tier, durationValue: Number(b.durationValue), durationUnit: b.durationUnit,
      stackPolicy: b.stackPolicy, maxRedemptions: b.maxRedemptions ?? null,
      validFrom: b.validFrom ?? null, validUntil: b.validUntil ?? null,
      scope: b.scope, tenantId: b.tenantId ?? null, rawCode: b.code,
      createdBy: req.user?.userId ?? null,
    });
    res.json({ success: true, data: out });
  } catch (e) { fail(res, e, 'Error al crear el código'); }
});

router.get('/admin/codes', SUPERADMIN, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await svc.listCodes({ status: req.query.status as any, tier: req.query.tier as any }) });
  } catch (e) { fail(res, e, 'Error al listar los códigos'); }
});

router.patch('/admin/codes/:id', SUPERADMIN, async (req: AuthRequest, res: Response) => {
  try {
    await svc.updateCode(req.params.id, {
      isActive: req.body?.isActive, validUntil: req.body?.validUntil, maxRedemptions: req.body?.maxRedemptions,
    });
    res.json({ success: true });
  } catch (e) { fail(res, e, 'Error al actualizar el código'); }
});

router.delete('/admin/codes/:id', SUPERADMIN, async (req: AuthRequest, res: Response) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    res.json({ success: true, data: await svc.deleteCode(req.params.id, force) });
  } catch (e) { fail(res, e, 'Error al eliminar el código'); }
});

router.get('/admin/analytics', SUPERADMIN, async (_req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.getAnalytics() }); }
  catch (e) { fail(res, e, 'Error al obtener analytics'); }
});

router.get('/admin/events', SUPERADMIN, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.getEventStats(Number(req.query.days) || 30) }); }
  catch (e) { fail(res, e, 'Error al obtener eventos'); }
});

router.get('/admin/legend-config', SUPERADMIN, async (_req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.getLegendConfig() }); }
  catch (e) { fail(res, e, 'Error al leer la configuración'); }
});

router.put('/admin/legend-config', SUPERADMIN, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.saveLegendConfig(req.body || {}) }); }
  catch (e) { fail(res, e, 'Error al guardar la configuración'); }
});

router.get('/admin/discounts', SUPERADMIN, async (_req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.adminGetDiscountConfig() }); }
  catch (e) { fail(res, e, 'Error al leer los descuentos'); }
});

router.put('/admin/discounts', SUPERADMIN, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.adminSaveDiscountConfig({ percentOff: Number(req.body?.percentOff) || 0, freeShipping: !!req.body?.freeShipping }) }); }
  catch (e) { fail(res, e, 'Error al guardar los descuentos'); }
});

export default router;
