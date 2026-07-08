import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import { authenticate, authorize } from '../../common/middleware';
import pool from '../../config/database';
import { RowDataPacket } from 'mysql2';
import quotesService from './quotes.service';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(authorize('comerciante', 'vendedor', 'cajero', 'despachador'));

const tenantOf = (req: Request) => (req as any).user!.tenantId! as string;
const userOf = (req: Request) => (req as any).user! as { userId: string; name?: string };

// GET /api/quotes/stats — KPIs del mes (conversión, pipeline)
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await quotesService.stats(tenantOf(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/quotes?status=&search=
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await quotesService.list(tenantOf(req), {
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/quotes/:id
router.get('/:id', [param('id').notEmpty(), validateRequest], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await quotesService.findById(tenantOf(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/quotes — crear (borrador o enviada)
router.post(
  '/',
  [
    body('items').isArray({ min: 1 }),
    body('customerName').optional().isString(),
    body('customerPhone').optional().isString(),
    body('sedeId').optional({ nullable: true }).isString(),
    body('validUntil').optional({ nullable: true }).isString(),
    body('deliveryPromise').optional({ nullable: true }).isString(),
    body('status').optional().isIn(['borrador', 'enviada']),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = userOf(req);
      // Nombre del vendedor para el registro
      const [[u]] = await pool.query<RowDataPacket[]>('SELECT name FROM users WHERE id = ?', [user.userId]) as any;
      const data = await quotesService.create(tenantOf(req), user.userId, u?.name || 'Vendedor', req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// PUT /api/quotes/:id — editar (solo borrador/enviada)
router.put(
  '/:id',
  [param('id').notEmpty(), body('items').isArray({ min: 1 }), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await quotesService.update(tenantOf(req), req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// PATCH /api/quotes/:id/status — enviada | aceptada (reserva) | cancelada (libera)
router.patch(
  '/:id/status',
  [param('id').notEmpty(), body('status').isIn(['enviada', 'aceptada', 'cancelada']), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await quotesService.setStatus(tenantOf(req), req.params.id, req.body.status);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/quotes/:id/convert — facturar (1 clic): crea la venta y marca facturada
router.post(
  '/:id/convert',
  [
    param('id').notEmpty(),
    body('paymentMethod').optional().isString(),
    body('amountPaid').optional().isFloat({ min: 0 }),
    body('applyTax').optional().isBoolean(),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = userOf(req);
      const [[u]] = await pool.query<RowDataPacket[]>('SELECT name FROM users WHERE id = ?', [user.userId]) as any;
      const data = await quotesService.convertToSale(
        tenantOf(req), req.params.id,
        { paymentMethod: req.body.paymentMethod || 'efectivo', amountPaid: req.body.amountPaid, applyTax: req.body.applyTax },
        { id: user.userId, name: u?.name || 'Vendedor' }
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/quotes/:id/send-whatsapp — enviar resumen al cliente (transaccional)
router.post(
  '/:id/send-whatsapp',
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = tenantOf(req);
      const [[store]] = await pool.query<RowDataPacket[]>(
        'SELECT name FROM store_info WHERE tenant_id = ? LIMIT 1', [tenantId]
      ) as any;
      const data = await quotesService.sendWhatsApp(tenantId, req.params.id, store?.name || 'Nuestro comercio');
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

export default router;
