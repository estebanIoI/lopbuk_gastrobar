import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { privacyService } from './privacy.service';

const router: ReturnType<typeof Router> = Router();

// ── Rate limit propio para las rutas públicas (mismo patrón que hidden-access) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, maxPerMin = 10): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= maxPerMin;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of rateLimitMap) {
    if (e.resetAt < now) rateLimitMap.delete(ip);
  }
}, 5 * 60_000).unref();

// =============================================
// PUBLIC: registrar consentimiento (banner de cookies / checkout)
// =============================================
router.post(
  '/public/consents',
  [
    body('tenantId').notEmpty().withMessage('tenantId requerido'),
    body('identifier').optional({ checkFalsy: true }).isString().isLength({ min: 5, max: 255 }),
    body('consents').isArray({ min: 1 }).withMessage('consents debe ser un array'),
    body('consents.*.type').isIn(['data_processing', 'terms', 'marketing_whatsapp', 'marketing_email', 'analytics_tracking']),
    body('consents.*.granted').isBoolean(),
    body('source').optional().isIn(['checkout', 'cookie_banner', 'whatsapp', 'signup']),
    body('policyVersion').optional().isString().isLength({ max: 20 }),
    validateRequest,
  ],
  async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!rateLimit(ip, 10)) {
      res.status(429).json({ success: false, error: 'Demasiadas solicitudes, intenta en un minuto' });
      return;
    }
    try {
      const { tenantId, identifier, consents, source, policyVersion } = req.body;
      // Consentimientos anónimos del banner (sin teléfono/email todavía) se
      // registran con el hash de sesión que envía el frontend
      const finalIdentifier = identifier || `anon-${ip}`;
      const ids: string[] = [];
      for (const c of consents) {
        const id = await privacyService.recordConsent({
          tenantId,
          identifier: finalIdentifier,
          consentType: c.type,
          granted: !!c.granted,
          source: source || 'cookie_banner',
          policyVersion,
          ipAddress: ip,
          userAgent: req.headers['user-agent'],
        });
        ids.push(id);
      }
      res.status(201).json({ success: true, data: { consentIds: ids } });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Error al registrar consentimiento' });
    }
  }
);

// =============================================
// PUBLIC: crear solicitud de derechos (acceso / rectificación / borrado)
// =============================================
router.post(
  '/public/requests',
  [
    body('tenantId').notEmpty(),
    body('requestType').isIn(['access', 'rectify', 'erase', 'revoke_consent']),
    body('identifier').notEmpty().isLength({ min: 5, max: 255 }).withMessage('Teléfono o email requerido'),
    body('requesterName').notEmpty().isLength({ min: 3, max: 255 }).withMessage('Nombre requerido'),
    body('details').optional().isString().isLength({ max: 2000 }),
    validateRequest,
  ],
  async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!rateLimit(ip, 5)) {
      res.status(429).json({ success: false, error: 'Demasiadas solicitudes, intenta en un minuto' });
      return;
    }
    try {
      const { tenantId, requestType, identifier, requesterName, details } = req.body;
      const result = await privacyService.createPublicRequest({
        tenantId, requestType, identifier, requesterName, details,
      });
      res.status(201).json({
        success: true,
        data: {
          requestId: result.id,
          dueAt: result.dueAt,
          message: 'Solicitud registrada. El comercio debe responder en máximo 10 días hábiles (Ley 1581 de 2012).',
        },
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Error al crear la solicitud' });
    }
  }
);

// =============================================
// ADMIN (tenant): gestión de solicitudes y derechos del titular
// =============================================
router.use(authenticate);

router.get(
  '/requests',
  [query('status').optional().isIn(['pending', 'in_progress', 'completed', 'denied']), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const rows = await privacyService.listRequests(req.user!.tenantId!, req.query.status as string | undefined);
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  }
);

router.patch(
  '/requests/:id',
  authorize('superadmin', 'comerciante'),
  [
    param('id').notEmpty(),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'denied']),
    body('notes').optional().isString().isLength({ max: 2000 }),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      await privacyService.updateRequest(
        req.user!.tenantId!,
        req.params.id,
        { status: req.body.status, notes: req.body.notes },
        req.user!.userId
      );
      res.json({ success: true, data: { message: 'Solicitud actualizada' } });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  }
);

// Derecho de acceso (Ley 1581 art. 8): exportación consolidada de datos del cliente
router.get(
  '/customers/:id/export',
  authorize('superadmin', 'comerciante'),
  [param('id').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await privacyService.exportCustomerData(req.user!.tenantId!, req.params.id, req.user!.userId);
      res.setHeader('Content-Disposition', `attachment; filename="datos-cliente-${req.params.id}.json"`);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  }
);

// Derecho al olvido: anonimización irreversible (cliente + pedidos + chat)
router.post(
  '/customers/:id/erase',
  authorize('superadmin', 'comerciante'),
  [param('id').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await privacyService.eraseCustomer(req.user!.tenantId!, req.params.id, req.user!.userId);
      res.json({
        success: true,
        data: { ...result, message: 'Datos personales anonimizados de forma irreversible' },
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  }
);

export default router;
