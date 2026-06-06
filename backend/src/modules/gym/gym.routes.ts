/**
 * gym.routes.ts
 * Módulo GIMNASIO. Dos grupos de rutas:
 *  - STAFF del gym  → /api/gym/...        (authorize roles de comercio)
 *  - MIEMBRO cliente → /api/gym/me/...     (authorize 'cliente')
 *
 * authorize se aplica POR RUTA para poder mezclar ambos grupos en un router.
 */
import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import * as svc from './gym.service';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

// Roles de staff que pueden gestionar el gimnasio
const STAFF = authorize('comerciante', 'administrador_rb', 'vendedor', 'cajero');
const MEMBER = authorize('cliente');

const ok  = (res: Response, data: any) => res.json({ success: true, data });
const fail = (res: Response, e: any, msg: string) => {
  const code = e?.statusCode || 500;
  if (code === 500) console.error(`${msg}:`, e);
  res.status(code).json({ success: false, error: e?.message || msg });
};

// ════════════════ MIEMBRO (cliente) — sus propios datos ════════════════
// (van primero para que /me no choque con rutas de staff)
router.get('/me/membresias', MEMBER, async (req: AuthRequest, res) => {
  try { ok(res, await svc.misMembresias(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener membresías'); }
});
router.get('/me/plan', MEMBER, async (req: AuthRequest, res) => {
  try { ok(res, await svc.miPlan(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener plan'); }
});
router.get('/me/progreso', MEMBER, async (req: AuthRequest, res) => {
  try { ok(res, await svc.miProgreso(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener progreso'); }
});
router.get('/me/asistencia', MEMBER, async (req: AuthRequest, res) => {
  try { ok(res, await svc.miAsistencia(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener asistencia'); }
});
router.post('/me/checkin', MEMBER, async (req: AuthRequest, res) => {
  try { ok(res, await svc.memberCheckIn(req.user!.userId, req.body?.tenantId)); }
  catch (e) { fail(res, e, 'Error al registrar entrada'); }
});
router.post('/me/checkout', MEMBER, async (req: AuthRequest, res) => {
  try { ok(res, await svc.memberCheckOut(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al registrar salida'); }
});
router.get('/me/acceso', MEMBER, async (req: AuthRequest, res) => {
  try { ok(res, await svc.memberAccess(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener acceso'); }
});

// ════════════════ STAFF ════════════════
const tid = (req: AuthRequest) => req.user!.tenantId as string;

// Dashboard
router.get('/stats', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getStats(tid(req))); }
  catch (e) { fail(res, e, 'Error al obtener estadísticas'); }
});

// Escaneo de QR de acceso (recepción)
router.post('/scan', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.scanAccess(tid(req), req.body?.code, req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al procesar el acceso'); }
});

// Miembros + membresías
router.get('/members', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.listMembers(tid(req), req.query.status as string)); }
  catch (e) { fail(res, e, 'Error al obtener miembros'); }
});
router.post('/members', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.addMember(tid(req), req.body)); }
  catch (e) { fail(res, e, 'Error al agregar miembro'); }
});
router.get('/members/:userId', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getMemberDetail(tid(req), req.params.userId)); }
  catch (e) { fail(res, e, 'Error al obtener miembro'); }
});
router.put('/members/:userId/membership', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.updateMembership(tid(req), req.params.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al actualizar membresía'); }
});
router.post('/members/:userId/pago', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.registrarPago(tid(req), req.params.userId)); }
  catch (e) { fail(res, e, 'Error al registrar pago'); }
});
router.delete('/members/:userId', STAFF, async (req: AuthRequest, res) => {
  try { await svc.removeMember(tid(req), req.params.userId); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar miembro'); }
});

// Planes de entrenamiento
router.get('/members/:userId/plans', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.listMemberPlans(tid(req), req.params.userId)); }
  catch (e) { fail(res, e, 'Error al obtener planes'); }
});
router.post('/members/:userId/plans', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.createPlan(tid(req), req.user!.userId, req.params.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al crear plan'); }
});
router.get('/plans/:planId', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getPlan(tid(req), req.params.planId)); }
  catch (e) { fail(res, e, 'Error al obtener plan'); }
});
router.delete('/plans/:planId', STAFF, async (req: AuthRequest, res) => {
  try { await svc.deletePlan(tid(req), req.params.planId); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar plan'); }
});

// Progreso
router.get('/members/:userId/progress', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.listProgress(tid(req), req.params.userId)); }
  catch (e) { fail(res, e, 'Error al obtener progreso'); }
});
router.post('/members/:userId/progress', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.addProgress(tid(req), req.params.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al registrar progreso'); }
});

// Asistencia
router.get('/asistencia/hoy', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.todayAttendance(tid(req))); }
  catch (e) { fail(res, e, 'Error al obtener asistencia'); }
});
router.get('/members/:userId/asistencia', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.listMemberAttendance(tid(req), req.params.userId)); }
  catch (e) { fail(res, e, 'Error al obtener asistencia del miembro'); }
});
router.post('/members/:userId/checkin', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.checkIn(tid(req), req.params.userId)); }
  catch (e) { fail(res, e, 'Error al registrar entrada'); }
});
router.patch('/asistencia/:id/checkout', STAFF, async (req: AuthRequest, res) => {
  try { await svc.checkOut(tid(req), req.params.id); ok(res, { ok: true }); }
  catch (e) { fail(res, e, 'Error al registrar salida'); }
});

export default router;
