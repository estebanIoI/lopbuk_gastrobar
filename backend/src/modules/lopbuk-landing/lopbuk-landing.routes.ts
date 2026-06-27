import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware';
import { getLandingConfig, saveLandingConfig } from './lopbuk-landing.service';

const router = Router();

// GET /api/lopbuk-landing — Pública: config para renderizar la landing.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await getLandingConfig();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Lopbuk landing get error:', err);
    res.status(500).json({ success: false, error: 'Error al cargar la landing' });
  }
});

// PUT /api/lopbuk-landing — Superadmin: guardar config (textos + medios).
router.put('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }
    const { config } = req.body;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      res.status(400).json({ success: false, error: 'Config inválida' });
      return;
    }
    const who = user.email || user.username || String(user.id || '');
    await saveLandingConfig(config, who);
    res.json({ success: true });
  } catch (err) {
    console.error('Lopbuk landing save error:', err);
    res.status(500).json({ success: false, error: 'Error al guardar la landing' });
  }
});

export const lopbukLandingRoutes: ReturnType<typeof Router> = router;
