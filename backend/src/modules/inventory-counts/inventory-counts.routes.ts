import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import { authenticate, authorize } from '../../common/middleware';
import service from './inventory-counts.service';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(authorize('comerciante', 'despachador', 'auxiliar_bodega', 'superadmin'));

const tenantOf = (req: Request) => (req as any).user!.tenantId! as string;
const userOf = (req: Request) => (req as any).user!.userId as string;

// GET /api/inventory-counts — lista de conteos
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.list(tenantOf(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/inventory-counts/accuracy?days=90 — exactitud promedio (Gerencia)
router.get('/accuracy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 90));
    const data = await service.accuracy(tenantOf(req), days);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/inventory-counts/:id — detalle con ítems y diferencias
router.get('/:id', [param('id').notEmpty(), validateRequest], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getItems(tenantOf(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/inventory-counts — abrir conteo (congela esperado)
router.post(
  '/',
  [
    body('sedeId').optional({ nullable: true }).isString(),
    body('search').optional().isString(),
    body('notes').optional().isString(),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.create(tenantOf(req), userOf(req), req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// PATCH /api/inventory-counts/:id/items/:itemId — capturar contado
router.patch(
  '/:id/items/:itemId',
  [param('id').notEmpty(), param('itemId').notEmpty(), body('countedQty').optional({ nullable: true }).isFloat({ min: 0 }), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const countedQty = req.body.countedQty === null || req.body.countedQty === undefined ? null : Number(req.body.countedQty);
      const data = await service.setCounted(tenantOf(req), req.params.id, req.params.itemId, countedQty);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/inventory-counts/:id/close — cerrar y aplicar ajuste auditado
router.post('/:id/close', [param('id').notEmpty(), validateRequest], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.close(tenantOf(req), req.params.id, userOf(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/inventory-counts/:id/cancel
router.post('/:id/cancel', [param('id').notEmpty(), validateRequest], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.cancel(tenantOf(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
