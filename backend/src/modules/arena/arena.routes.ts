/**
 * arena.routes — Community Layer (F5.1).
 * Leaderboard social + retos de temporada.
 */
import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { arenaService } from './arena.service';

const router: ReturnType<typeof Router> = Router();

// ── Público (usuarios autenticados) ──
router.get('/leaderboard', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.getLeaderboard(req.user!.userId, Number(req.query.limit) || 20) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

router.get('/challenges', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.listActive(req.user!.userId) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

router.get('/challenges/:id/leaderboard', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.challengeLeaderboard(req.params.id, Number(req.query.limit) || 20) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

router.post('/challenges/:id/join', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.join(req.user!.userId, req.params.id) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

// ── Admin ──
router.get('/admin/challenges', authenticate, authorize('superadmin'), async (_req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.adminList() }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

router.post('/admin/challenges', authenticate, authorize('superadmin'), async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.adminCreate(req.body, req.user?.userId) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

router.patch('/admin/challenges/:id', authenticate, authorize('superadmin'), async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.adminUpdate(req.params.id, req.body) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

export default router;
