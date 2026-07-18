/**
 * training/routes.ts
 * Endpoints REST del dominio Training.
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

// ─── CATEGORÍAS ────────────────────────────────────────────────────

router.get('/training/categories', STAFF, async (_req, res) => {
  try { ok(res, await svc.listCategories()); }
  catch (e) { fail(res, e, 'Error al obtener categorías'); }
});

// ─── BIBLIOTECA DE EJERCICIOS ──────────────────────────────────────

router.get('/training/exercises', STAFF, async (req: AuthRequest, res) => {
  try {
    const filters = {
      muscleGroup: req.query.muscleGroup as string,
      equipment: req.query.equipment as string,
      difficulty: req.query.difficulty as string,
      categoryId: req.query.categoryId as string,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };
    ok(res, await svc.listExercises(tid(req), req.user!.userId, filters));
  } catch (e) { fail(res, e, 'Error al listar ejercicios'); }
});

router.get('/training/exercises/:id', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getExercise(tid(req), req.params.id)); }
  catch (e) { fail(res, e, 'Error al obtener ejercicio'); }
});

router.post('/training/exercises', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.createExercise(tid(req), req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al crear ejercicio'); }
});

router.post('/training/exercises/:id/favorite', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.toggleFavorite(tid(req), req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al marcar favorito'); }
});

// ─── PLANTILLAS ────────────────────────────────────────────────────

router.get('/training/templates', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.listTemplates(tid(req), { category: req.query.category as string })); }
  catch (e) { fail(res, e, 'Error al listar plantillas'); }
});

router.get('/training/templates/:id', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getTemplate(tid(req), req.params.id)); }
  catch (e) { fail(res, e, 'Error al obtener plantilla'); }
});

router.post('/training/templates', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.createTemplate(tid(req), req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al crear plantilla'); }
});

router.delete('/training/templates/:id', STAFF, async (req: AuthRequest, res) => {
  try { await svc.deleteTemplate(tid(req), req.params.id); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar plantilla'); }
});

// ─── ASIGNACIONES ──────────────────────────────────────────────────

router.post('/training/assignments', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.assignTemplate(tid(req), req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al asignar plantilla'); }
});

router.get('/training/assignments', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.listAssignments(tid(req), {
      memberId: req.query.memberId as string,
      status: req.query.status as string,
    }));
  } catch (e) { fail(res, e, 'Error al listar asignaciones'); }
});

// ─── SESIONES ──────────────────────────────────────────────────────

router.post('/training/sessions', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.startSession(tid(req), req.body.memberId, req.body)); }
  catch (e) { fail(res, e, 'Error al iniciar sesión'); }
});

router.get('/training/sessions/:id', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getSession(tid(req), req.params.id)); }
  catch (e) { fail(res, e, 'Error al obtener sesión'); }
});

router.post('/training/sessions/:id/sets', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.logSet(tid(req), req.params.id, req.body)); }
  catch (e) { fail(res, e, 'Error al registrar serie'); }
});

router.put('/training/sessions/:id/end', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.endSession(tid(req), req.params.id, req.body)); }
  catch (e) { fail(res, e, 'Error al finalizar sesión'); }
});

router.get('/training/sessions', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.listSessions(tid(req), req.query.memberId as string, parseInt(req.query.limit as string) || 30)); }
  catch (e) { fail(res, e, 'Error al listar sesiones'); }
});

// ─── RECORDS ───────────────────────────────────────────────────────

router.get('/training/records', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.listPersonalRecords(tid(req), req.query.memberId as string, {
      exerciseId: req.query.exerciseId as string,
      recordType: req.query.recordType as string,
    }));
  } catch (e) { fail(res, e, 'Error al obtener récords'); }
});

router.get('/training/stats', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getMemberTrainingStats(tid(req), req.query.memberId as string)); }
  catch (e) { fail(res, e, 'Error al obtener estadísticas'); }
});

// ─── MIEMBRO (cliente) — entrenamiento propio ─────────────────────

router.get('/me/training/plan', MEMBER, async (req: AuthRequest, res) => {
  try {
    const [member] = await db.execute('SELECT id, tenant_id FROM gym_members WHERE user_id = ? LIMIT 1', [req.user!.userId]) as any;
    if (!member.length) return ok(res, null);
    ok(res, await svc.getActiveAssignment(member[0].tenant_id, member[0].id));
  } catch (e) { fail(res, e, 'Error al obtener plan'); }
});

router.post('/me/training/sessions', MEMBER, async (req: AuthRequest, res) => {
  try {
    const [member] = await db.execute('SELECT id, tenant_id FROM gym_members WHERE user_id = ? LIMIT 1', [req.user!.userId]) as any;
    if (!member.length) throw new AppError('No eres miembro de un gimnasio', 404);
    ok(res, await svc.startSession(member[0].tenant_id, member[0].id, req.body));
  } catch (e) { fail(res, e, 'Error al iniciar sesión'); }
});

router.post('/me/training/sessions/:id/sets', MEMBER, async (req: AuthRequest, res) => {
  try {
    const [member] = await db.execute('SELECT id, tenant_id FROM gym_members WHERE user_id = ? LIMIT 1', [req.user!.userId]) as any;
    if (!member.length) throw new AppError('No eres miembro', 404);
    ok(res, await svc.logSet(member[0].tenant_id, req.params.id, req.body));
  } catch (e) { fail(res, e, 'Error al registrar serie'); }
});

router.put('/me/training/sessions/:id/end', MEMBER, async (req: AuthRequest, res) => {
  try {
    const [member] = await db.execute('SELECT id, tenant_id FROM gym_members WHERE user_id = ? LIMIT 1', [req.user!.userId]) as any;
    if (!member.length) throw new AppError('No eres miembro', 404);
    ok(res, await svc.endSession(member[0].tenant_id, req.params.id, req.body));
  } catch (e) { fail(res, e, 'Error al finalizar sesión'); }
});

router.get('/me/training/history', MEMBER, async (req: AuthRequest, res) => {
  try {
    const [member] = await db.execute('SELECT id, tenant_id FROM gym_members WHERE user_id = ? LIMIT 1', [req.user!.userId]) as any;
    if (!member.length) return ok(res, []);
    ok(res, await svc.listSessions(member[0].tenant_id, member[0].id));
  } catch (e) { fail(res, e, 'Error al obtener historial'); }
});

router.get('/me/training/records', MEMBER, async (req: AuthRequest, res) => {
  try {
    const [member] = await db.execute('SELECT id, tenant_id FROM gym_members WHERE user_id = ? LIMIT 1', [req.user!.userId]) as any;
    if (!member.length) return ok(res, []);
    ok(res, await svc.listPersonalRecords(member[0].tenant_id, member[0].id));
  } catch (e) { fail(res, e, 'Error al obtener récords'); }
});

router.get('/me/training/stats', MEMBER, async (req: AuthRequest, res) => {
  try {
    const [member] = await db.execute('SELECT id, tenant_id FROM gym_members WHERE user_id = ? LIMIT 1', [req.user!.userId]) as any;
    if (!member.length) return ok(res, null);
    ok(res, await svc.getMemberTrainingStats(member[0].tenant_id, member[0].id));
  } catch (e) { fail(res, e, 'Error al obtener estadísticas'); }
});

export default router;
