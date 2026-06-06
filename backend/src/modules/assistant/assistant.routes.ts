/**
 * assistant.routes.ts — Asistente personal de plataforma (superadmin + comerciante).
 */
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../common/middleware';
import { runPlatformAssistant, isPlatformAssistantEnabled } from './assistant.service';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

router.get('/status', async (_req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: { enabled: await isPlatformAssistantEnabled() } }); }
  catch { res.json({ success: true, data: { enabled: false } }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isPlatformAssistantEnabled())) {
      res.status(403).json({ success: false, error: 'El asistente no está habilitado' });
      return;
    }
    const { message, history } = req.body || {};
    if (!message?.trim()) { res.status(400).json({ success: false, error: 'Mensaje requerido' }); return; }
    const u = req.user!;
    const data = await runPlatformAssistant(
      { userId: u.userId, role: u.role, tenantId: u.tenantId ?? undefined },
      message.trim(), history || []
    );
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('Platform assistant error:', e);
    res.status(500).json({ success: false, error: 'Error en el asistente' });
  }
});

export default router;
