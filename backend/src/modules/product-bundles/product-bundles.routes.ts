import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { productBundlesService } from './product-bundles.service';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

const fail = (res: Response, e: any) =>
  res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error interno' });

const itemValidator = [
  body('items').optional().isArray(),
  body('items.*.productId').optional().notEmpty(),
  body('items.*.quantity').optional().isInt({ min: 1 }),
];

// GET /api/product-bundles — lista con precio/ahorro/stock resueltos
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await productBundlesService.list(req.user!.tenantId!) });
  } catch (e) { fail(res, e); }
});

// GET /api/product-bundles/:id
router.get('/:id', [param('id').notEmpty(), validateRequest], async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await productBundlesService.findById(req.user!.tenantId!, req.params.id) });
  } catch (e) { fail(res, e); }
});

// POST /api/product-bundles — crear (draft)
router.post(
  '/',
  authorize('superadmin', 'comerciante'),
  [
    body('name').notEmpty().isLength({ max: 160 }),
    body('discountType').optional().isIn(['fixed_total', 'percent', 'amount_off']),
    body('discountValue').optional().isFloat({ min: 0 }),
    ...itemValidator,
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const bundle = await productBundlesService.create(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data: bundle });
    } catch (e) { fail(res, e); }
  }
);

// PUT /api/product-bundles/:id — actualizar (incluye ítems)
router.put(
  '/:id',
  authorize('superadmin', 'comerciante'),
  [
    param('id').notEmpty(),
    body('name').notEmpty().isLength({ max: 160 }),
    body('discountType').optional().isIn(['fixed_total', 'percent', 'amount_off']),
    body('discountValue').optional().isFloat({ min: 0 }),
    ...itemValidator,
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true, data: await productBundlesService.update(req.user!.tenantId!, req.params.id, req.body) });
    } catch (e) { fail(res, e); }
  }
);

// PATCH /api/product-bundles/:id/status — draft / published / archived
router.patch(
  '/:id/status',
  authorize('superadmin', 'comerciante'),
  [param('id').notEmpty(), body('status').isIn(['draft', 'published', 'archived']), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      await productBundlesService.setStatus(req.user!.tenantId!, req.params.id, req.body.status);
      res.json({ success: true, data: { status: req.body.status } });
    } catch (e) { fail(res, e); }
  }
);

// PATCH /api/product-bundles/:id/anchor — asigna el PDP donde aparece
router.patch(
  '/:id/anchor',
  authorize('superadmin', 'comerciante'),
  [param('id').notEmpty(), body('anchorProductId').optional({ nullable: true }), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await productBundlesService.setAnchor(req.user!.tenantId!, req.params.id, req.body.anchorProductId ?? null);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  }
);

// POST /api/product-bundles/:id/duplicate
router.post(
  '/:id/duplicate',
  authorize('superadmin', 'comerciante'),
  [param('id').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const copy = await productBundlesService.duplicate(req.user!.tenantId!, req.params.id);
      res.status(201).json({ success: true, data: copy });
    } catch (e) { fail(res, e); }
  }
);

// DELETE /api/product-bundles/:id — soft delete
router.delete(
  '/:id',
  authorize('superadmin', 'comerciante'),
  [param('id').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      await productBundlesService.remove(req.user!.tenantId!, req.params.id);
      res.json({ success: true, data: { deleted: true } });
    } catch (e) { fail(res, e); }
  }
);

export default router;
