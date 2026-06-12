import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import * as ctrl from './dev-requests.controller';

const router: ReturnType<typeof Router> = Router();

const REQUEST_TYPES = ['objetivo', 'mejora', 'actualizacion', 'bug', 'otro'];
const PRIORITIES    = ['baja', 'media', 'alta'];
const STATUSES      = ['pendiente','en_revision','cotizado','aprobado','en_progreso','completado','rechazado'];

router.use(authenticate);

// ── Superadmin-only routes ────────────────────────────────────────────────────
router.get('/admin/all',        authorize('superadmin'), ctrl.getAllRequests);
router.get('/admin/settings',   authorize('superadmin'), ctrl.getDevSettings);
router.put('/admin/settings',
  authorize('superadmin'),
  [
    body('hourlyRate').optional().isNumeric().withMessage('Tarifa inválida'),
    body('whatsapp').optional().isString(),
    validateRequest,
  ],
  ctrl.updateDevSettings
);
router.patch('/admin/:id/quote',
  authorize('superadmin'),
  [
    param('id').notEmpty(),
    body('estimatedHours').isNumeric().withMessage('Horas estimadas inválidas'),
    body('pricePerHour').isNumeric().withMessage('Precio por hora inválido'),
    body('adminNotes').optional().isString(),
    validateRequest,
  ],
  ctrl.quoteRequest
);
router.patch('/admin/:id/status',
  authorize('superadmin'),
  [
    param('id').notEmpty(),
    body('status').isIn(STATUSES).withMessage('Estado inválido'),
    body('adminNotes').optional().isString(),
    body('rejectionReason').optional().isString(),
    validateRequest,
  ],
  ctrl.updateRequestStatus
);

// ── Comerciante routes ────────────────────────────────────────────────────────

// Contact info only (whatsapp) — comerciante needs this to show payment options
router.get('/contact-info', authorize('comerciante'), async (req, res, next) => {
  try {
    const settings = await (await import('./dev-requests.service')).devRequestsService.getSettings();
    res.json({ success: true, data: { whatsapp: settings.whatsapp } });
  } catch (err) { next(err); }
});

router.get('/', authorize('comerciante'), ctrl.getMyRequests);

router.post('/',
  authorize('comerciante'),
  [
    body('title').notEmpty().isString().withMessage('El título es requerido'),
    body('description').notEmpty().isString().withMessage('La descripción es requerida'),
    body('type').isIn(REQUEST_TYPES).withMessage('Tipo de solicitud inválido'),
    body('priority').isIn(PRIORITIES).withMessage('Prioridad inválida'),
    validateRequest,
  ],
  ctrl.createRequest
);

router.patch('/:id/confirm',
  authorize('comerciante'),
  [param('id').notEmpty(), validateRequest],
  ctrl.confirmQuote
);

router.post('/:id/checkout',
  authorize('comerciante'),
  [param('id').notEmpty(), validateRequest],
  ctrl.createCheckout
);

router.delete('/:id',
  authorize('comerciante'),
  [param('id').notEmpty(), validateRequest],
  ctrl.deleteMyRequest
);

export default router;
