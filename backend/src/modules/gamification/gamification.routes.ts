/**
 * gamification.routes — XP, nivel y liga del usuario (P2).
 */
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../common/middleware';
import { gamificationService } from './gamification.service';

const router: ReturnType<typeof Router> = Router();

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await gamificationService.getXpProfile(req.user!.userId) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});
router.get('/league', authenticate, async (req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await gamificationService.getLeagueBoard(req.user!.userId, Number(req.query.limit) || 20) }); }
  catch (e: any) { res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error' }); }
});

export default router;
