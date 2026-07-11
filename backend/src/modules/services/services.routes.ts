import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { servicesController } from './services.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

// ── PUBLIC endpoints (no auth) ─────────────────────────────────
// GET /api/services/public?store=slug
router.get('/public', servicesController.findPublic.bind(servicesController));

// GET /api/services/:id/slots?date=YYYY-MM-DD&store=slug
router.get('/:id/slots',
  [query('date').notEmpty().isISO8601(), query('store').notEmpty(), validateRequest],
  servicesController.getSlots.bind(servicesController)
);

// GET /api/services/:id/slots-detailed?date=YYYY-MM-DD&store=slug — slots con estado
router.get('/:id/slots-detailed',
  [query('date').notEmpty().isISO8601(), query('store').notEmpty(), validateRequest],
  servicesController.getSlotsDetailed.bind(servicesController)
);

// GET /api/services/:id/month-availability?year=&month=&store=slug — cupos por día
router.get('/:id/month-availability',
  [query('year').notEmpty().isInt(), query('month').notEmpty().isInt({ min: 1, max: 12 }), query('store').notEmpty(), validateRequest],
  servicesController.getMonthAvailability.bind(servicesController)
);

// GET /api/services/:id/addons?store=slug — complementos publicados (cross-sell)
router.get('/:id/addons',
  [query('store').notEmpty(), validateRequest],
  servicesController.getAddons.bind(servicesController)
);

// GET /api/services/:id/specialists?store=slug — especialistas del servicio (público)
router.get('/:id/specialists',
  [query('store').notEmpty(), validateRequest],
  servicesController.getServiceSpecialists.bind(servicesController)
);

// POST /api/services/:id/waitlist?store=slug — unirse a la lista de espera (público)
router.post('/:id/waitlist',
  [
    query('store').notEmpty(),
    body('clientName').notEmpty().withMessage('Nombre requerido'),
    body('clientPhone').notEmpty().withMessage('Teléfono requerido'),
    validateRequest,
  ],
  (req: any, res: any, next: any) => { req.body.serviceId = req.params.id; next(); },
  servicesController.joinWaitlist.bind(servicesController)
);

// POST /api/services/:id/hold?store=slug — aparta el cupo 5 min (anti doble reserva)
router.post('/:id/hold',
  [query('store').notEmpty(), body('date').notEmpty().isISO8601(), body('startTime').notEmpty(), validateRequest],
  servicesController.createHold.bind(servicesController)
);

// POST /api/services/hold/release — libera un hold (al cancelar/cerrar)
router.post('/hold/release',
  [body('holdToken').notEmpty(), validateRequest],
  servicesController.releaseHold.bind(servicesController)
);

// POST /api/services/bookings?store=slug  (public booking)
router.post('/bookings',
  [
    query('store').notEmpty().withMessage('store requerido'),
    body('serviceId').notEmpty(),
    body('clientName').notEmpty().withMessage('Nombre requerido'),
    body('clientPhone').notEmpty().withMessage('Teléfono requerido'),
    body('clientEmail').optional().isEmail(),
    validateRequest,
  ],
  servicesController.createBooking.bind(servicesController)
);

// ── AUTHENTICATED endpoints ────────────────────────────────────
router.use(authenticate);

// GET /api/services
router.get('/', servicesController.findAll.bind(servicesController));

// GET /api/services/bookings/list
router.get('/bookings/list', servicesController.findBookings.bind(servicesController));

// GET /api/services/bookings/stats — métricas de reservas (Fase 6)
router.get('/bookings/stats', servicesController.getBookingStats.bind(servicesController));

// GET /api/services/blocked
router.get('/blocked', servicesController.getBlocked.bind(servicesController));

// ── Lista de espera (Fase 6) — gestión autenticada ─────────────
router.get('/waitlist', servicesController.findWaitlist.bind(servicesController));
router.put('/waitlist/:id',
  authorize('comerciante', 'superadmin'),
  [param('id').notEmpty(), body('status').notEmpty(), validateRequest],
  servicesController.updateWaitlist.bind(servicesController)
);

// ── Especialistas (Fase 5) — CRUD autenticado ──────────────────
router.get('/specialists', servicesController.findSpecialists.bind(servicesController));

router.post('/specialists',
  authorize('comerciante', 'superadmin'),
  [body('name').notEmpty().withMessage('Nombre requerido'), validateRequest],
  servicesController.createSpecialist.bind(servicesController)
);

router.put('/specialists/:id',
  authorize('comerciante', 'superadmin'),
  [param('id').notEmpty(), validateRequest],
  servicesController.updateSpecialist.bind(servicesController)
);

router.delete('/specialists/:id',
  authorize('comerciante', 'superadmin'),
  [param('id').notEmpty(), validateRequest],
  servicesController.removeSpecialist.bind(servicesController)
);

// POST /api/services/blocked
router.post('/blocked',
  authorize('comerciante', 'superadmin'),
  [body('blockedDate').notEmpty().isISO8601(), validateRequest],
  servicesController.addBlocked.bind(servicesController)
);

// DELETE /api/services/blocked/:id
router.delete('/blocked/:id',
  authorize('comerciante', 'superadmin'),
  servicesController.removeBlocked.bind(servicesController)
);

// PUT /api/services/bookings/:id/reschedule — reprogramar cita (Fase 6)
router.put('/bookings/:id/reschedule',
  [param('id').notEmpty(), body('bookingDate').notEmpty().isISO8601(), body('startTime').notEmpty(), validateRequest],
  servicesController.rescheduleBooking.bind(servicesController)
);

// PUT /api/services/bookings/:id
router.put('/bookings/:id',
  [param('id').notEmpty(), validateRequest],
  servicesController.updateBookingStatus.bind(servicesController)
);

// GET /api/services/:id
router.get('/:id',
  [param('id').notEmpty(), validateRequest],
  servicesController.findById.bind(servicesController)
);

// POST /api/services
router.post('/',
  authorize('comerciante', 'superadmin'),
  [
    body('name').notEmpty().withMessage('Nombre requerido'),
    body('serviceType').isIn(['cita', 'asesoria', 'contacto']).withMessage('Tipo inválido'),
    body('price').optional().isFloat({ min: 0 }),
    body('durationMinutes').optional().isInt({ min: 5 }),
    validateRequest,
  ],
  servicesController.create.bind(servicesController)
);

// PUT /api/services/:id
router.put('/:id',
  authorize('comerciante', 'superadmin'),
  [param('id').notEmpty(), validateRequest],
  servicesController.update.bind(servicesController)
);

// DELETE /api/services/:id
router.delete('/:id',
  authorize('comerciante', 'superadmin'),
  [param('id').notEmpty(), validateRequest],
  servicesController.remove.bind(servicesController)
);

// GET /api/services/:id/availability
router.get('/:id/availability',
  [param('id').notEmpty(), validateRequest],
  servicesController.getAvailability.bind(servicesController)
);

// POST /api/services/:id/availability
router.post('/:id/availability',
  authorize('comerciante', 'superadmin'),
  [
    param('id').notEmpty(),
    body('slots').isArray({ min: 0 }),
    body('slots.*.dayOfWeek').isInt({ min: 0, max: 6 }),
    body('slots.*.startTime').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Hora inicio inválida (HH:MM)'),
    body('slots.*.endTime').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Hora fin inválida (HH:MM)'),
    body('slots.*.slotDurationMinutes').isInt({ min: 5, max: 480 }),
    body('slots.*.maxSimultaneous').isInt({ min: 1, max: 50 }),
    validateRequest,
  ],
  servicesController.setAvailability.bind(servicesController)
);

export default router;
