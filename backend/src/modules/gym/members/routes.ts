/**
 * members/routes.ts
 * Endpoints REST del dominio Personas.
 * Staff gestiona miembros; el cliente consulta su propio perfil.
 * tenant_id SIEMPRE desde req.user.tenantId (JWT), nunca del body.
 */
import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../../../common/middleware';
import type { MemberStatus } from './types';
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

// ─── Objetivos (catálogo público para ambos roles) ─────────────────

router.get('/objectives', async (_req, res) => {
  try { ok(res, await svc.listObjectives()); }
  catch (e) { fail(res, e, 'Error al obtener objetivos'); }
});

// ─── STAFF ────────────────────────────────────────────────────────

router.get('/members', STAFF, async (req: AuthRequest, res) => {
  try {
    const statusVal = req.query.status as string | undefined;
    const filters = {
      status: (statusVal && ['activo','inactivo','congelado','lesionado','dado_de_baja'].includes(statusVal)
        ? statusVal as MemberStatus : undefined),
      trainerId: req.query.trainerId as string | undefined,
      objectiveId: req.query.objectiveId as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };
    ok(res, await svc.listMembers(tid(req), filters));
  } catch (e) { fail(res, e, 'Error al listar miembros'); }
});

router.post('/members', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.createMember(tid(req), req.body)); }
  catch (e) { fail(res, e, 'Error al crear miembro'); }
});

router.get('/members/:memberId', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getMember(tid(req), req.params.memberId)); }
  catch (e) { fail(res, e, 'Error al obtener miembro'); }
});

router.put('/members/:memberId', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.updateMember(tid(req), req.params.memberId, req.body)); }
  catch (e) { fail(res, e, 'Error al actualizar miembro'); }
});

router.get('/members/:memberId/profile', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.getMemberProfile(req.params.memberId)); }
  catch (e) { fail(res, e, 'Error al obtener perfil'); }
});

router.put('/members/:memberId/profile', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.updateMemberProfile(req.params.memberId, req.body)); }
  catch (e) { fail(res, e, 'Error al actualizar perfil'); }
});

router.put('/members/:memberId/status', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.changeMemberStatus(tid(req), req.params.memberId, req.body.status)); }
  catch (e) { fail(res, e, 'Error al cambiar estado'); }
});

router.put('/members/:memberId/trainer', STAFF, async (req: AuthRequest, res) => {
  try { ok(res, await svc.reassignTrainer(tid(req), req.params.memberId, req.body.trainerId ?? null)); }
  catch (e) { fail(res, e, 'Error al reasignar entrenador'); }
});

// ─── MIEMBRO (cliente) — su propio perfil de gimnasio ─────────────

router.get('/me/profile', MEMBER, async (req: AuthRequest, res) => {
  try {
    const { db } = await import('../../../config');
    const [[member]] = await db.execute(
      'SELECT id FROM gym_members WHERE user_id = ? LIMIT 1', [req.user!.userId],
    ) as unknown as [{ id: string }[]];
    if (!member) return ok(res, null);
    ok(res, await svc.getMemberProfile(member.id));
  } catch (e) { fail(res, e, 'Error al obtener perfil'); }
});

export default router;
