import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { checkoutExperienceService } from './checkout-experience.service';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

const fail = (res: Response, e: any) =>
  res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error interno' });

// GET /api/checkout-experience — config del tenant (o defaults)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await checkoutExperienceService.get(req.user!.tenantId!) });
  } catch (e) { fail(res, e); }
});

// PUT /api/checkout-experience — guardar (el servicio fuerza las invariantes)
router.put('/', authorize('superadmin', 'comerciante'), async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await checkoutExperienceService.save(req.user!.tenantId!, req.body?.config ?? req.body) });
  } catch (e) { fail(res, e); }
});

// POST /api/checkout-experience/reset — volver a la config por defecto
router.post('/reset', authorize('superadmin', 'comerciante'), async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await checkoutExperienceService.reset(req.user!.tenantId!) });
  } catch (e) { fail(res, e); }
});

export default router;
