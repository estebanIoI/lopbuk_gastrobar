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

// ── Guilds (F5.2) ──
router.get('/guilds', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.listGuilds(req.user!.userId, Number(req.query.limit) || 20) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
router.get('/guilds/mine', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.getMyGuild(req.user!.userId) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
router.post('/guilds', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.createGuild(req.user!.userId, req.body || {}) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
router.post('/guilds/:id/join', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.joinGuild(req.user!.userId, req.params.id) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
router.post('/guilds/leave', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.leaveGuild(req.user!.userId) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

// ── Social feed (F5.3) ──
router.get('/feed', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.listFeed(req.user!.userId, Number(req.query.limit) || 30) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
router.post('/feed', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.postFeed(req.user!.userId, req.body || {}) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
router.post('/feed/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.toggleLike(req.user!.userId, req.params.id) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
router.get('/feed/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.listComments(req.params.id, req.user!.userId, Number(req.query.limit) || 50) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
router.post('/feed/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.addComment(req.user!.userId, req.params.id, String(req.body?.body || '')) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

// ── Admin ──
router.post('/admin/challenges/:id/settle', authenticate, authorize('superadmin'), async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await arenaService.settleChallenge(req.params.id) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
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
