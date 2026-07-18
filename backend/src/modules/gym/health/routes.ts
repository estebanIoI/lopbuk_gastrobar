/**
 * health/routes.ts
 * Endpoints REST del dominio Health.
 */
import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest, AppError } from '../../../common/middleware';
import { db } from '../../../config';
import * as svc from './service';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

const STAFF = authorize('comerciante', 'administrador_rb', 'vendedor', 'cajero');
const MEMBER = authorize('cliente');

const ok = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, e: unknown, msg: string) => {
  const err = e as { statusCode?: number; message?: string };
  const code = err?.statusCode || 500;
  if (code === 500) console.error(`${msg}:`, e);
  res.status(code).json({ success: false, error: err?.message || msg });
};

const tid = (req: AuthRequest) => req.user!.tenantId as string;

// ─── STAFF: Evaluaciones ──────────────────────────────────────────

router.get('/health/assessments', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.listAssessments(tid(req), req.query.memberId as string)); }
  catch (e) { fail(res, e, 'Error al listar evaluaciones'); }
});

router.get('/health/assessments/:id', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getAssessment(tid(req), req.params.id)); }
  catch (e) { fail(res, e, 'Error al obtener evaluación'); }
});

router.post('/health/assessments', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.createAssessment(tid(req), req.body.memberId, req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al crear evaluación'); }
});

// ─── STAFF: Fotos de progreso ─────────────────────────────────────

router.get('/health/photos', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.listProgressPhotos(tid(req), req.query.memberId as string, req.query.category as string)); }
  catch (e) { fail(res, e, 'Error al listar fotos'); }
});

router.post('/health/photos', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.addProgressPhoto(tid(req), req.body.memberId, req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al subir foto'); }
});

router.delete('/health/photos/:id', STAFF, async (req: AuthRequest, res) => {
  try { await svc.deleteProgressPhoto(tid(req), req.params.id); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar foto'); }
});

router.put('/health/photos/reorder', STAFF, async (req: AuthRequest, res) => {
  try { await svc.reorderPhotos(tid(req), req.body.photoIds); ok(res, { ok: true }); }
  catch (e) { fail(res, e, 'Error al reordenar fotos'); }
});

// ─── STAFF: Archivos de evaluación ────────────────────────────────

router.post('/health/files', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.uploadAssessmentFile(tid(req), req.body.memberId, req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al subir archivo'); }
});

// ─── STAFF: Condiciones médicas ───────────────────────────────────

router.get('/health/conditions', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.listMedicalConditions(tid(req), req.query.memberId as string, req.query.status as string)); }
  catch (e) { fail(res, e, 'Error al listar condiciones'); }
});

router.post('/health/conditions', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.reportMedicalCondition(tid(req), req.body.memberId, req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al reportar condición'); }
});

router.put('/health/conditions/:id', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.updateMedicalCondition(tid(req), req.params.id, req.body)); }
  catch (e) { fail(res, e, 'Error al actualizar condición'); }
});

router.get('/health/restrictions', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getActiveRestrictions(tid(req), req.query.memberId as string)); }
  catch (e) { fail(res, e, 'Error al obtener restricciones'); }
});

// ─── STAFF: Dashboard de salud ────────────────────────────────────

router.get('/health/dashboard', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getHealthDashboard(tid(req), req.query.memberId as string)); }
  catch (e) { fail(res, e, 'Error al obtener dashboard'); }
});

// ─── MIEMBRO (cliente) ────────────────────────────────────────────

async function resolveMember(req: AuthRequest): Promise<{ tenantId: string; memberId: string }> {
  const [members]: any = await db.execute(
    'SELECT id, tenant_id AS tenantId FROM gym_members WHERE user_id = ? LIMIT 1',
    [req.user!.userId],
  );
  if (!members.length) throw new AppError('No eres miembro de un gimnasio', 404);
  return { tenantId: members[0].tenantId, memberId: members[0].id };
}

router.get('/me/health/dashboard', MEMBER, async (req: AuthRequest, res) => {
  try {
    const { tenantId, memberId } = await resolveMember(req);
    ok(res, await svc.getHealthDashboard(tenantId, memberId));
  } catch (e) { fail(res, e, 'Error al obtener dashboard'); }
});

router.get('/me/health/assessments', MEMBER, async (req: AuthRequest, res) => {
  try {
    const { tenantId, memberId } = await resolveMember(req);
    ok(res, await svc.listAssessments(tenantId, memberId));
  } catch (e) { fail(res, e, 'Error al obtener evaluaciones'); }
});

router.get('/me/health/photos', MEMBER, async (req: AuthRequest, res) => {
  try {
    const { tenantId, memberId } = await resolveMember(req);
    ok(res, await svc.listProgressPhotos(tenantId, memberId, req.query.category as string));
  } catch (e) { fail(res, e, 'Error al obtener fotos'); }
});

router.get('/me/health/conditions', MEMBER, async (req: AuthRequest, res) => {
  try {
    const { tenantId, memberId } = await resolveMember(req);
    ok(res, await svc.listMedicalConditions(tenantId, memberId));
  } catch (e) { fail(res, e, 'Error al obtener condiciones'); }
});

router.post('/me/health/photos', MEMBER, async (req: AuthRequest, res) => {
  try {
    const { tenantId, memberId } = await resolveMember(req);
    ok(res, await svc.addProgressPhoto(tenantId, memberId, req.user!.userId, req.body));
  } catch (e) { fail(res, e, 'Error al subir foto'); }
});

export default router;
