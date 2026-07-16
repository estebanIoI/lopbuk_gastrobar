import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { eventsController } from './events.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router = Router();
const ctrl = eventsController;

// ── PUBLIC (sin auth) ─────────────────────────────
const slugCheck = [query('slug').isString().notEmpty(), validateRequest];

router.get('/public', ctrl.findPublic.bind(ctrl));
router.get('/public/:slug', ctrl.findPublicBySlug.bind(ctrl));
router.get('/public/:slug/availability', ctrl.getAvailability.bind(ctrl));
router.post('/public/:slug/hold',
  [param('slug').isString(), body('ticketTypeId').isString(), body('quantity').isInt({ min: 1, max: 20 })],
  validateRequest, ctrl.createHold.bind(ctrl));
router.post('/public/:slug/release-hold',
  [body('holdToken').isString().notEmpty()],
  validateRequest, ctrl.releaseHold.bind(ctrl));
router.post('/public/:slug/checkout',
  [param('slug').isString(), body('holdToken').isString(), body('customerName').isString().notEmpty()],
  validateRequest, ctrl.createCheckout.bind(ctrl));
router.post('/public/:slug/validate-coupon',
  [body('code').isString().notEmpty(), body('ticketTypeId').isString(), body('quantity').isInt({ min: 1 })],
  validateRequest, ctrl.validateCouponPublic.bind(ctrl));
router.get('/public/booking/:reference', ctrl.getBookingStatus.bind(ctrl));

// ── AUTHENTICATED ─────────────────────────────────
router.use(authenticate);

// Events CRUD
router.get('/', ctrl.findAll.bind(ctrl));
router.post('/',
  authorize('comerciante', 'superadmin'),
  [body('title').isString().notEmpty(), body('eventDate').isString().notEmpty()],
  validateRequest, ctrl.create.bind(ctrl));
router.get('/:id', ctrl.findById.bind(ctrl));
router.put('/:id', authorize('comerciante', 'superadmin'), ctrl.update.bind(ctrl));
router.delete('/:id', authorize('comerciante', 'superadmin'), ctrl.delete.bind(ctrl));
router.patch('/:id/publish', authorize('comerciante', 'superadmin'), ctrl.publish.bind(ctrl));
router.patch('/:id/unpublish', authorize('comerciante', 'superadmin'), ctrl.unpublish.bind(ctrl));

// Venues
router.get('/venues/list', ctrl.findVenues.bind(ctrl));
router.post('/venues', authorize('comerciante', 'superadmin'),
  [body('name').isString().notEmpty()], validateRequest, ctrl.createVenue.bind(ctrl));
router.put('/venues/:vid', authorize('comerciante', 'superadmin'), ctrl.updateVenue.bind(ctrl));
router.delete('/venues/:vid', authorize('comerciante', 'superadmin'), ctrl.deleteVenue.bind(ctrl));

// Seat Maps
router.get('/seat-maps/list', ctrl.findSeatMaps.bind(ctrl));
router.post('/seat-maps', authorize('comerciante', 'superadmin'),
  [body('name').isString().notEmpty(), body('venueId').isString()],
  validateRequest, ctrl.createSeatMap.bind(ctrl));
router.put('/seat-maps/:sid', authorize('comerciante', 'superadmin'), ctrl.updateSeatMap.bind(ctrl));
router.delete('/seat-maps/:sid', authorize('comerciante', 'superadmin'), ctrl.deleteSeatMap.bind(ctrl));

// Health + Superadmin (van ANTES de /:id para no colisionar)
router.get('/health', ctrl.health.bind(ctrl));
router.get('/superadmin/stats', authorize('superadmin'), ctrl.superadminStats.bind(ctrl));
router.get('/trace', authorize('comerciante', 'superadmin'), ctrl.getTraceLogs.bind(ctrl));

// Ticket Types
router.get('/:id/ticket-types', ctrl.findTicketTypes.bind(ctrl));
router.post('/:id/ticket-types', authorize('comerciante', 'superadmin'),
  [body('name').isString().notEmpty(), body('price').isNumeric()],
  validateRequest, ctrl.createTicketType.bind(ctrl));
router.put('/:id/ticket-types/:ttid', authorize('comerciante', 'superadmin'), ctrl.updateTicketType.bind(ctrl));
router.delete('/:id/ticket-types/:ttid', authorize('comerciante', 'superadmin'), ctrl.deleteTicketType.bind(ctrl));

// Check-in
router.get('/checkin/:id/ticket/:code', authorize('comerciante', 'superadmin'), ctrl.validateTicket.bind(ctrl));
router.post('/checkin/:id/ticket/:code', authorize('comerciante', 'superadmin'), ctrl.checkin.bind(ctrl));
router.post('/checkin/:id/batch-sync', authorize('comerciante', 'superadmin'), ctrl.batchSyncCheckin.bind(ctrl));
router.get('/checkin/:id/stats', authorize('comerciante', 'superadmin'), ctrl.checkinStats.bind(ctrl));

// Bookings + Analytics
router.get('/:id/bookings', authorize('comerciante', 'superadmin'), ctrl.findBookings.bind(ctrl));
router.get('/:id/analytics', authorize('comerciante', 'superadmin'), ctrl.getAnalytics.bind(ctrl));
router.get('/:id/timeline', authorize('comerciante', 'superadmin'), ctrl.getTimeline.bind(ctrl));

// Transfer
router.post('/transfer', ctrl.transferTicket.bind(ctrl));

export default router;
