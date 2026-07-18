import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { mealPassesService } from './meal-passes.service';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

const fail = (res: Response, e: any) =>
  res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error interno' });

// Roles que operan tiqueteras en un restaurante
const RB = ['superadmin', 'comerciante', 'administrador_rb', 'cajero', 'mesero'] as const;

// GET /api/meal-passes?search=&status= — lista + búsqueda rápida
router.get('/', [query('search').optional(), query('status').optional(), validateRequest], async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await mealPassesService.list(req.user!.tenantId!, { search: req.query.search as string, status: req.query.status as string }) });
  } catch (e) { fail(res, e); }
});

// GET /api/meal-passes/:id
router.get('/:id', [param('id').notEmpty(), validateRequest], async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await mealPassesService.findById(req.user!.tenantId!, req.params.id) });
  } catch (e) { fail(res, e); }
});

// GET /api/meal-passes/:id/movements — historial de consumos y recargas
router.get('/:id/movements', [param('id').notEmpty(), validateRequest], async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await mealPassesService.getMovements(req.user!.tenantId!, req.params.id) });
  } catch (e) { fail(res, e); }
});

// POST /api/meal-passes — crear tiquetera
router.post(
  '/',
  authorize(...RB),
  [body('customerName').notEmpty().isLength({ max: 255 }), body('totalMeals').optional().isInt({ min: 0 }), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const pass = await mealPassesService.create(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data: pass });
    } catch (e) { fail(res, e); }
  }
);

// PUT /api/meal-passes/:id — editar datos
router.put(
  '/:id',
  authorize(...RB),
  [param('id').notEmpty(), body('customerName').notEmpty().isLength({ max: 255 }), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true, data: await mealPassesService.update(req.user!.tenantId!, req.params.id, req.body) });
    } catch (e) { fail(res, e); }
  }
);

// POST /api/meal-passes/:id/recharge — recargar almuerzos
router.post(
  '/:id/recharge',
  authorize(...RB),
  [param('id').notEmpty(), body('meals').isInt({ min: 1 }), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true, data: await mealPassesService.recharge(req.user!.tenantId!, req.params.id, Number(req.body.meals), req.body.note) });
    } catch (e) { fail(res, e); }
  }
);

// POST /api/meal-passes/:id/consume — consumir almuerzos (F5 lo usará desde el cobro)
router.post(
  '/:id/consume',
  authorize(...RB),
  [param('id').notEmpty(), body('meals').isInt({ min: 1 }), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const { meals, orderId, orderItemId, tableNumber, note } = req.body;
      const data = await mealPassesService.consume(req.user!.tenantId!, req.params.id, Number(meals), {
        orderId, orderItemId, tableNumber, note,
        employeeId: req.user!.id, employeeName: req.user!.name,
      });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  }
);

// POST /api/meal-passes/:id/annul — anular
router.post('/:id/annul', authorize(...RB), [param('id').notEmpty(), validateRequest], async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await mealPassesService.annul(req.user!.tenantId!, req.params.id, req.body?.note) });
  } catch (e) { fail(res, e); }
});

// DELETE /api/meal-passes/:id — soft delete
router.delete('/:id', authorize(...RB), [param('id').notEmpty(), validateRequest], async (req: AuthRequest, res: Response) => {
  try {
    await mealPassesService.remove(req.user!.tenantId!, req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (e) { fail(res, e); }
});

export default router;
