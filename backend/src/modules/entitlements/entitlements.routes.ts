/**
 * ============================================================================
 *  ENTITLEMENTS — Rutas
 * ============================================================================
 *  GET  /api/me/entitlements   → derechos activos del usuario
 *  GET  /api/me/workspaces     → espacios disponibles (derivados de entitlements)
 *  POST /api/merchant/activate → activa un negocio sobre la cuenta actual (1 transacción)
 *
 * Nota de montaje (index.ts): este router se monta en la raíz de la API porque cubre
 * dos prefijos (`/me`, `/merchant`):  app.use(`${apiPrefix}`, entitlementsRoutes)
 */
import { Router, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { authenticate, AuthRequest } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import { entitlementsService } from './entitlements.service';

const router: ReturnType<typeof Router> = Router();

// GET /api/me/entitlements
router.get('/me/entitlements', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entitlements = await entitlementsService.listActive(req.user!.userId);
    res.json({ success: true, data: entitlements });
  } catch (err) { next(err); }
});

// GET /api/me/workspaces
router.get('/me/workspaces', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const resolved = await entitlementsService.resolveForUser(req.user!.userId);
    res.json({ success: true, data: resolved });
  } catch (err) { next(err); }
});

// POST /api/merchant/activate — activar negocio sobre la cuenta actual
router.post(
  '/merchant/activate',
  authenticate,
  [
    body('businessName').isString().trim().isLength({ min: 2, max: 120 })
      .withMessage('El nombre del negocio es requerido (2 a 120 caracteres)'),
    body('businessType').optional().isString().withMessage('Tipo de negocio inválido'),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Solo se toman datos de negocio; tenant_id, owner_id, role y plan los calcula el servidor.
      const result = await entitlementsService.activateMerchant(req.user!.userId, {
        businessName: req.body.businessName,
        businessType: req.body.businessType,
      });
      res.status(201).json({
        success: true,
        data: result,
        message: 'Negocio activado. Ya puedes vender en DAIMUZ.',
      });
    } catch (err) { next(err); }
  }
);

export default router;
