/**
 * affiliates.routes.ts — Rutas del módulo de Promotores / Afiliados (Sprint 2).
 *
 * Tres audiencias:
 *   • Promotor  → auth propia (authenticateAffiliate).
 *   • Superadmin → authenticate + authorize('superadmin')  (rutas /admin/*).
 *   • Comercio  → authenticate + authorize('comerciante','superadmin') (rutas /tenant/*).
 *
 * Manejadores inline (mismo patrón que restbar-qr.routes / external-cards).
 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { affiliatesService } from './affiliates.service';

const router: ReturnType<typeof Router> = Router();

interface AffReq extends Request { affiliateId?: string; affiliate?: any }

const ok = (res: Response, data: any, code = 200) => res.status(code).json({ success: true, data });
const fail = (res: Response, e: any) => res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' });

// Auth propia del promotor (JWT con type='affiliate')
async function authenticateAffiliate(req: AffReq, res: Response, next: NextFunction): Promise<void> {
  try {
    const token: string | undefined =
      req.cookies?.affiliateToken ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : undefined);
    if (!token) { res.status(401).json({ success: false, error: 'No autenticado' }); return; }
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    if (decoded?.type !== 'affiliate' || !decoded.affiliateId) { res.status(401).json({ success: false, error: 'Token inválido' }); return; }
    const aff = await affiliatesService.getById(decoded.affiliateId);
    if (!aff) { res.status(401).json({ success: false, error: 'Promotor no encontrado' }); return; }
    if (aff.status === 'suspended') { res.status(403).json({ success: false, error: 'Tu cuenta de promotor está suspendida' }); return; }
    req.affiliateId = aff.id; req.affiliate = aff;
    next();
  } catch { res.status(401).json({ success: false, error: 'Token inválido o expirado' }); }
}

// ─────────── PÚBLICO: registro / login del promotor ───────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { affiliate, token } = await affiliatesService.register(req.body);
    res.cookie('affiliateToken', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
    ok(res, { affiliate, token }, 201);
  } catch (e) { fail(res, e); }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { affiliate, token } = await affiliatesService.login(req.body?.email, req.body?.password);
    res.cookie('affiliateToken', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
    ok(res, { affiliate, token });
  } catch (e) { fail(res, e); }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('affiliateToken');
  ok(res, { loggedOut: true });
});

// ─────────── SUPERADMIN (/admin/*) — antes del middleware de promotor ───────────
const sa = [authenticate, authorize('superadmin')];

router.get('/admin/analytics', ...sa, async (_req, res) => { try { ok(res, await affiliatesService.adminAnalytics()); } catch (e) { fail(res, e); } });
router.post('/admin/run-approvals', ...sa, async (_req, res) => { try { ok(res, await affiliatesService.runAutoApprovals()); } catch (e) { fail(res, e); } });
router.get('/admin/affiliates', ...sa, async (_req, res) => { try { ok(res, await affiliatesService.adminListAffiliates()); } catch (e) { fail(res, e); } });
router.patch('/admin/affiliates/:id/status', ...sa, async (req, res) => {
  try { await affiliatesService.adminSetStatus(req.params.id, req.body?.status === 'suspended' ? 'suspended' : 'active'); ok(res, { id: req.params.id }); } catch (e) { fail(res, e); }
});
router.get('/admin/withdrawals', ...sa, async (req, res) => { try { ok(res, await affiliatesService.adminListWithdrawals(req.query.status as string | undefined)); } catch (e) { fail(res, e); } });
router.patch('/admin/withdrawals/:id', ...sa, async (req: AuthRequest, res) => {
  try {
    const st = req.body?.status;
    if (!['processing', 'paid', 'rejected'].includes(st)) { fail(res, new Error('Estado inválido')); return; }
    await affiliatesService.adminProcessWithdrawal(req.params.id, st, req.user!.userId, req.body?.note);
    ok(res, { id: req.params.id, status: st });
  } catch (e) { fail(res, e); }
});
router.get('/admin/missions', ...sa, async (_req, res) => { try { ok(res, await affiliatesService.adminListMissions()); } catch (e) { fail(res, e); } });
router.post('/admin/missions', ...sa, async (req, res) => { try { ok(res, await affiliatesService.adminCreateMission(req.body), 201); } catch (e) { fail(res, e); } });
router.patch('/admin/missions/:id', ...sa, async (req, res) => { try { await affiliatesService.adminUpdateMission(req.params.id, req.body); ok(res, { id: req.params.id }); } catch (e) { fail(res, e); } });
router.get('/admin/submissions', ...sa, async (req, res) => { try { ok(res, await affiliatesService.adminListSubmissions(req.query.status as string | undefined)); } catch (e) { fail(res, e); } });
router.patch('/admin/submissions/:id', ...sa, async (req: AuthRequest, res) => {
  try {
    const st = req.body?.status;
    if (!['approved', 'rejected'].includes(st)) { fail(res, new Error('Estado inválido')); return; }
    await affiliatesService.adminReviewSubmission(req.params.id, st, req.user!.userId, req.body?.note);
    ok(res, { id: req.params.id, status: st });
  } catch (e) { fail(res, e); }
});

// Paquetes de publicidad (catálogo + bandeja de pagos)
router.get('/admin/packages', ...sa, async (_req, res) => { try { ok(res, await affiliatesService.adminListPackages()); } catch (e) { fail(res, e); } });
router.post('/admin/packages', ...sa, async (req, res) => { try { ok(res, await affiliatesService.adminCreatePackage(req.body), 201); } catch (e) { fail(res, e); } });
router.patch('/admin/packages/:id', ...sa, async (req, res) => { try { await affiliatesService.adminUpdatePackage(req.params.id, req.body); ok(res, { id: req.params.id }); } catch (e) { fail(res, e); } });
router.delete('/admin/packages/:id', ...sa, async (req, res) => { try { await affiliatesService.adminDeletePackage(req.params.id); ok(res, { id: req.params.id }); } catch (e) { fail(res, e); } });
router.get('/admin/package-orders', ...sa, async (req, res) => { try { ok(res, await affiliatesService.adminListPackageOrders(req.query.status as string | undefined)); } catch (e) { fail(res, e); } });
router.patch('/admin/package-orders/:id/pay', ...sa, async (req, res) => { try { ok(res, await affiliatesService.markPackagePaid(req.params.id)); } catch (e) { fail(res, e); } });

// ─────────── COMERCIO (/tenant/*) ───────────
const mer = [authenticate, authorize('comerciante', 'superadmin')];
router.get('/tenant/overview', ...mer, async (req: AuthRequest, res) => { try { ok(res, await affiliatesService.tenantOverview(req.user!.tenantId!)); } catch (e) { fail(res, e); } });
router.get('/tenant/conversions', ...mer, async (req: AuthRequest, res) => { try { ok(res, await affiliatesService.tenantConversions(req.user!.tenantId!)); } catch (e) { fail(res, e); } });
router.get('/tenant/packages', ...mer, async (_req, res) => { try { ok(res, await affiliatesService.listActivePackages()); } catch (e) { fail(res, e); } });
router.post('/tenant/package-orders', ...mer, async (req: AuthRequest, res) => { try { ok(res, await affiliatesService.contractPackage(req.user!.tenantId!, req.body), 201); } catch (e) { fail(res, e); } });
router.get('/tenant/package-orders', ...mer, async (req: AuthRequest, res) => { try { ok(res, await affiliatesService.tenantPackageOrders(req.user!.tenantId!)); } catch (e) { fail(res, e); } });
router.patch('/tenant/package-orders/:id/complete', ...mer, async (req: AuthRequest, res) => { try { await affiliatesService.completePackageOrder(req.user!.tenantId!, req.params.id); ok(res, { id: req.params.id, status: 'completed' }); } catch (e) { fail(res, e); } });

// ─────────── PROMOTOR (auth propia) ───────────
router.get('/me', authenticateAffiliate, async (req: AffReq, res) => { ok(res, req.affiliate); });
router.get('/me/campaigns', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.listMyCampaigns(req.affiliateId!)); } catch (e) { fail(res, e); } });
router.post('/campaigns', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.createCampaign(req.affiliateId!, req.body), 201); } catch (e) { fail(res, e); } });
router.get('/campaigns/:id/metrics', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.campaignMetrics(req.affiliateId!, req.params.id)); } catch (e) { fail(res, e); } });
router.get('/me/conversions', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.listMyConversions(req.affiliateId!)); } catch (e) { fail(res, e); } });
router.get('/me/commissions', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.listMyCommissions(req.affiliateId!)); } catch (e) { fail(res, e); } });
router.get('/me/withdrawals', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.listMyWithdrawals(req.affiliateId!)); } catch (e) { fail(res, e); } });
router.post('/withdrawals', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.requestWithdrawal(req.affiliateId!, req.body), 201); } catch (e) { fail(res, e); } });
router.get('/leaderboard', authenticateAffiliate, async (_req, res) => { try { ok(res, await affiliatesService.leaderboard()); } catch (e) { fail(res, e); } });
router.get('/missions', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.listMissions(req.affiliate.tier)); } catch (e) { fail(res, e); } });
router.post('/missions/:id/submit', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.submitMission(req.affiliateId!, req.params.id, req.body?.contentUrl), 201); } catch (e) { fail(res, e); } });

// Paquetes para el promotor: catálogo, mis contrataciones y entrega de contenido
router.get('/packages', authenticateAffiliate, async (_req, res) => { try { ok(res, await affiliatesService.listActivePackages()); } catch (e) { fail(res, e); } });
router.get('/me/package-orders', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.listMyPackageOrders(req.affiliateId!)); } catch (e) { fail(res, e); } });
router.patch('/me/package-orders/:id/deliver', authenticateAffiliate, async (req: AffReq, res) => { try { ok(res, await affiliatesService.deliverPackageContent(req.affiliateId!, req.params.id, req.body?.urls)); } catch (e) { fail(res, e); } });

export default router;
