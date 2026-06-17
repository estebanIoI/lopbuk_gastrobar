import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { reservationsService } from './reservations.service';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import { UserRole } from '../../common/types';
import { createNotification } from '../notifications/notifications.routes';
import pool from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

const router: ReturnType<typeof Router> = Router();

const ADMIN_ROLES: UserRole[] = ['superadmin', 'comerciante', 'administrador_rb'];

// ── PUBLIC endpoints (sin autenticación) ─────────────────────────────────────

// GET /api/restbar/reservations/public-config/:slug
router.get('/public-config/:slug', async (req: Request, res: Response) => {
  try {
    const config = await reservationsService.getPublicConfig(req.params.slug);
    if (!config) {
      res.status(404).json({ success: false, error: 'Reservas no disponibles' });
      return;
    }
    const { tenantId, ...publicConfig } = config;
    res.json({ success: true, data: publicConfig });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener configuración' });
  }
});

// GET /api/restbar/reservations/available-slots/:slug?date=YYYY-MM-DD
router.get(
  '/available-slots/:slug',
  [query('date').notEmpty().isISO8601().withMessage('Fecha requerida (YYYY-MM-DD)'), validateRequest],
  async (req: Request, res: Response) => {
    try {
      const config = await reservationsService.getPublicConfig(req.params.slug);
      if (!config) { res.status(404).json({ success: false, error: 'Reservas no disponibles' }); return; }
      const slots = await reservationsService.getAvailableSlots(config.tenantId, req.query.date as string);
      res.json({ success: true, data: slots });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error al obtener horarios' });
    }
  }
);

// GET /api/restbar/reservations/available-tables/:slug?date=&time=&guests=
router.get(
  '/available-tables/:slug',
  [
    query('date').notEmpty().isISO8601(),
    query('time').notEmpty().matches(/^\d{2}:\d{2}$/),
    query('guests').notEmpty().isInt({ min: 1 }),
    validateRequest,
  ],
  async (req: Request, res: Response) => {
    try {
      const config = await reservationsService.getPublicConfig(req.params.slug);
      if (!config) { res.status(404).json({ success: false, error: 'Reservas no disponibles' }); return; }
      const tables = await reservationsService.getAvailableTables(
        config.tenantId,
        req.query.date as string,
        req.query.time as string,
        Number(req.query.guests)
      );
      res.json({ success: true, data: tables });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error al obtener mesas' });
    }
  }
);

// POST /api/restbar/reservations/public
router.post(
  '/public',
  [
    body('slug').notEmpty().withMessage('slug requerido'),
    body('tableId').notEmpty().withMessage('Mesa requerida'),
    body('customerName').notEmpty().withMessage('Nombre requerido'),
    body('customerPhone').notEmpty().withMessage('Teléfono requerido'),
    body('customerEmail').optional().isEmail(),
    body('reservationDate').notEmpty().isISO8601().withMessage('Fecha inválida'),
    body('reservationTime').notEmpty().matches(/^\d{2}:\d{2}$/).withMessage('Hora inválida (HH:MM)'),
    body('guestsCount').isInt({ min: 1, max: 50 }).withMessage('Número de personas inválido'),
    body('occasion').optional().isString(),
    body('notes').optional().isString(),
    body('preOrderItems').optional().isArray(),
    body('preOrderNotes').optional().isString(),
    validateRequest,
  ],
  async (req: Request, res: Response) => {
    try {
      const { slug, ...data } = req.body;
      const config = await reservationsService.getPublicConfig(slug);
      if (!config) { res.status(404).json({ success: false, error: 'Reservas no disponibles' }); return; }

      const result = await reservationsService.createReservation(config.tenantId, data);
      if ('error' in result) {
        res.status(409).json({ success: false, error: result.error });
        return;
      }
      // Aviso al comercio: nueva reserva online (no bloquea la respuesta).
      createNotification(config.tenantId, {
        type: 'reservation',
        title: '📅 Nueva reserva online',
        body: `${data.customerName} · ${data.guestsCount} pers · ${data.reservationDate} ${data.reservationTime}`,
        link: '/restbar',
      }).catch(() => {});
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      console.error('Create reservation error:', err);
      res.status(500).json({ success: false, error: 'Error al crear la reserva' });
    }
  }
);

// POST /api/restbar/reservations/public-quick — reserva simple (sin elegir mesa).
// Guarda la reserva (visible en el panel) auto-asignando mesa si hay, o con mesa
// pendiente (table_id NULL) si no, y notifica al comercio.
router.post(
  '/public-quick',
  [
    body('slug').notEmpty(),
    body('customerName').notEmpty(),
    body('customerPhone').notEmpty(),
    body('reservationDate').notEmpty().isISO8601(),
    body('reservationTime').notEmpty().matches(/^\d{2}:\d{2}$/),
    body('guestsCount').optional().isInt({ min: 1, max: 50 }),
    validateRequest,
  ],
  async (req: Request, res: Response) => {
    try {
      const { slug, customerName, customerPhone, reservationDate, reservationTime, guestsCount, notes, occasion } = req.body;
      const config = await reservationsService.getPublicConfig(slug);
      if (!config) { res.status(404).json({ success: false, error: 'Reservas no disponibles' }); return; }
      const tenantId = config.tenantId;
      const guests = Number(guestsCount) || 1;

      let result: any;
      const tables = await reservationsService.getAvailableTables(tenantId, reservationDate, reservationTime, guests).catch(() => [] as any[]);
      if (tables.length > 0) {
        result = await reservationsService.createReservation(tenantId, {
          tableId: tables[0].id, customerName, customerPhone, reservationDate, reservationTime,
          guestsCount: guests, occasion: occasion || undefined, notes: notes || undefined,
        });
        if (result && result.error) { res.status(409).json({ success: false, error: result.error }); return; }
      } else {
        const conn = await (pool as any).getConnection();
        try {
          await conn.beginTransaction();
          await conn.query(`INSERT INTO rb_reservation_sequence (tenant_id, prefix, current_number) VALUES (?, 'R', 1) ON DUPLICATE KEY UPDATE current_number = current_number + 1`, [tenantId]);
          const [seqRow]: any = await conn.query(`SELECT current_number FROM rb_reservation_sequence WHERE tenant_id = ? LIMIT 1`, [tenantId]);
          const reservationNumber = `R-${String(seqRow[0].current_number).padStart(4, '0')}`;
          const id = uuidv4();
          const timeFormatted = String(reservationTime).length === 5 ? reservationTime + ':00' : reservationTime;
          await conn.query(
            `INSERT INTO rb_reservations (id, tenant_id, table_id, reservation_number, customer_name, customer_phone, reservation_date, reservation_time, guests_count, occasion, notes, status)
             VALUES (?,?,NULL,?,?,?,?,?,?,?,?,'pendiente')`,
            [id, tenantId, reservationNumber, customerName, customerPhone, reservationDate, timeFormatted, guests, occasion || null, notes || null]);
          await conn.commit();
          result = { id, reservationNumber };
        } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
      }

      createNotification(tenantId, {
        type: 'reservation',
        title: `Nueva reserva: ${customerName}`,
        body: `${result.reservationNumber || ''} — ${reservationDate} ${reservationTime} — ${guests} pers`,
        link: '/restbar',
      }).catch(() => {});

      res.status(201).json({ success: true, data: { reservationNumber: result.reservationNumber, id: result.id } });
    } catch (err) {
      console.error('Quick reservation error:', err);
      res.status(500).json({ success: false, error: 'Error al crear la reserva' });
    }
  }
);

// ── AUTHENTICATED endpoints ───────────────────────────────────────────────────
router.use(authenticate);

// GET /api/restbar/reservations
router.get(
  '/',
  authorize(...ADMIN_ROLES),
  [
    query('date').optional().isISO8601(),
    query('status').optional().isIn(['pendiente','confirmada','cancelada','completada','no_show']),
    query('page').optional().isInt({ min: 1 }),
    validateRequest,
  ],
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const result = await reservationsService.listReservations(tenantId, {
        date: req.query.date as string,
        status: req.query.status as string,
        page: req.query.page ? Number(req.query.page) : 1,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error al obtener reservas' });
    }
  }
);

// GET /api/restbar/reservations/pending-count
router.get('/pending-count', authorize(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const count = await reservationsService.getPendingCount(tenantId);
    res.json({ success: true, data: count });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error' });
  }
});

// GET /api/restbar/reservations/settings
router.get('/settings', authorize(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const settings = await reservationsService.getSettings(tenantId);
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener configuración' });
  }
});

// PATCH /api/restbar/reservations/settings
router.patch(
  '/settings',
  authorize(...ADMIN_ROLES),
  [
    body('enabled').optional().isBoolean(),
    body('whatsapp').optional({ nullable: true }).isString(),
    body('openTime').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('closeTime').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
    body('slotMinutes').optional().isInt({ min: 15, max: 240 }),
    body('maxAdvanceDays').optional().isInt({ min: 1, max: 365 }),
    body('minAdvanceHours').optional().isInt({ min: 0, max: 72 }),
    body('occasions').optional().isArray(),
    validateRequest,
  ],
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      await reservationsService.updateSettings(tenantId, req.body);
      const settings = await reservationsService.getSettings(tenantId);
      res.json({ success: true, data: settings });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error al guardar configuración' });
    }
  }
);

// GET /api/restbar/reservations/:id
router.get(
  '/:id',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const reservation = await reservationsService.getById(tenantId, req.params.id);
      if (!reservation) { res.status(404).json({ success: false, error: 'Reserva no encontrada' }); return; }
      res.json({ success: true, data: reservation });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error' });
    }
  }
);

// PATCH /api/restbar/reservations/:id/confirm
router.patch(
  '/:id/confirm',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), body('tableId').optional().isString(), validateRequest],
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const ok = await reservationsService.confirmReservation(tenantId, req.params.id, req.body.tableId);
      if (!ok) { res.status(400).json({ success: false, error: 'No se pudo confirmar' }); return; }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error al confirmar' });
    }
  }
);

// PATCH /api/restbar/reservations/:id/cancel
router.patch(
  '/:id/cancel',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), body('reason').optional().isString(), validateRequest],
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const ok = await reservationsService.cancelReservation(tenantId, req.params.id, req.body.reason || '');
      if (!ok) { res.status(400).json({ success: false, error: 'No se pudo cancelar' }); return; }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error al cancelar' });
    }
  }
);

// PATCH /api/restbar/reservations/:id/complete
router.patch(
  '/:id/complete',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const ok = await reservationsService.completeReservation(tenantId, req.params.id);
      if (!ok) { res.status(400).json({ success: false, error: 'No se pudo completar' }); return; }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error al completar' });
    }
  }
);

// PATCH /api/restbar/reservations/:id/noshow
router.patch(
  '/:id/noshow',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const ok = await reservationsService.markNoShow(tenantId, req.params.id);
      if (!ok) { res.status(400).json({ success: false, error: 'No se pudo marcar' }); return; }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error' });
    }
  }
);

// PATCH /api/restbar/reservations/:id/whatsapp-notified
router.patch(
  '/:id/whatsapp-notified',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      await reservationsService.markWhatsappNotified(tenantId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Error' });
    }
  }
);

export default router;
