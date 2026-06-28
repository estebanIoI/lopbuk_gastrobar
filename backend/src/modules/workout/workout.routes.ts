/**
 * workout.routes.ts
 * Endpoints del WORKOUT RUNTIME (consumidor). Sesión de cliente; datos por userId.
 * Endpoints mínimos (Fase 5): iniciar, ver, registrar set, completar + lifecycle.
 */
import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import * as sessionSvc from './application/services/workout-session.service';
import * as setSvc from './application/services/set-tracking.service';
import { buildTodayPlan } from './application/services/today-plan.service';
import { WorkoutValidationError } from './shared/schema';
import { InvalidSessionTransitionError } from './domain/state-machine/session-state-machine';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);
router.use(authorize('cliente'));

const ok = (res: Response, data: any) => res.json({ success: true, data });
const fail = (res: Response, e: any, msg: string) => {
  let code = e?.statusCode || 500;
  if (e instanceof WorkoutValidationError) code = 400;
  if (e instanceof InvalidSessionTransitionError) code = 409;
  if (code === 500) console.error(`${msg}:`, e);
  res.status(code).json({ success: false, error: e?.message || msg });
};

// Iniciar una sesión con ejercicios explícitos
router.post('/start', async (req: AuthRequest, res) => {
  try { ok(res, await sessionSvc.startSession(req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al iniciar la sesión'); }
});

// Iniciar la sesión de HOY (ensambla plan: template + pesos sugeridos del motor)
router.post('/start-today', async (req: AuthRequest, res) => {
  try {
    const title = String(req.body?.sessionTitle || 'Entrenamiento');
    const plan = await buildTodayPlan(req.user!.userId, title, req.body?.routineId);
    ok(res, await sessionSvc.startSession(req.user!.userId, plan));
  } catch (e) { fail(res, e, 'Error al iniciar la sesión de hoy'); }
});

// Listar sesiones recientes
router.get('/', async (req: AuthRequest, res) => {
  try { ok(res, await sessionSvc.listSessions(req.user!.userId, Number(req.query.limit) || undefined)); }
  catch (e) { fail(res, e, 'Error al listar sesiones'); }
});

// Detalle de una sesión (con ejercicios y sets)
router.get('/:id', async (req: AuthRequest, res) => {
  try { ok(res, await sessionSvc.getSession(req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al obtener la sesión'); }
});

// Registrar (completar) un set
router.post('/:id/sets/:setId/complete', async (req: AuthRequest, res) => {
  try { ok(res, await setSvc.completeSet(req.user!.userId, req.params.id, req.params.setId, req.body)); }
  catch (e) { fail(res, e, 'Error al registrar el set'); }
});

// Lifecycle
router.post('/:id/pause', async (req: AuthRequest, res) => {
  try { ok(res, await sessionSvc.pauseSession(req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al pausar la sesión'); }
});
router.post('/:id/resume', async (req: AuthRequest, res) => {
  try { ok(res, await sessionSvc.resumeSession(req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al reanudar la sesión'); }
});
router.post('/:id/cancel', async (req: AuthRequest, res) => {
  try { ok(res, await sessionSvc.cancelSession(req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al cancelar la sesión'); }
});

// Completar la sesión → corre progresión, guarda snapshots, devuelve resumen
router.post('/:id/complete', async (req: AuthRequest, res) => {
  try { ok(res, await sessionSvc.completeSession(req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al completar la sesión'); }
});

export default router;
