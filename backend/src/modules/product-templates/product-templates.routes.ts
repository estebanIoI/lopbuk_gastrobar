import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { productTemplatesService } from './product-templates.service';
import { DEFAULT_TEMPLATES } from './default-templates';

const router: ReturnType<typeof Router> = Router();

// Todas las rutas del módulo son del panel del comerciante
router.use(authenticate);

const fail = (res: Response, e: any) =>
  res.status(e?.statusCode || 500).json({ success: false, error: e?.message || 'Error interno' });

// GET /api/product-templates — lista con conteo de productos asignados
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await productTemplatesService.list(req.user!.tenantId!) });
  } catch (e) { fail(res, e); }
});

// GET /api/product-templates/:id
router.get('/:id', [param('id').notEmpty(), validateRequest], async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await productTemplatesService.findById(req.user!.tenantId!, req.params.id) });
  } catch (e) { fail(res, e); }
});

// POST /api/product-templates — crear (nace en draft)
router.post(
  '/',
  authorize('superadmin', 'comerciante'),
  [
    body('name').notEmpty().isLength({ max: 120 }).withMessage('Nombre requerido (máx 120)'),
    body('description').optional().isString().isLength({ max: 300 }),
    body('sections').optional().isArray(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tpl = await productTemplatesService.create(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data: tpl });
    } catch (e) { fail(res, e); }
  }
);

// POST /api/product-templates/seed-defaults — crea Moda/Tecnología/Belleza si no hay ninguna
router.post('/seed-defaults', authorize('superadmin', 'comerciante'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const existing = await productTemplatesService.list(tenantId);
    if (existing.length > 0) {
      res.json({ success: true, data: { created: 0, templates: existing } });
      return;
    }
    for (const seed of DEFAULT_TEMPLATES) {
      const tpl = await productTemplatesService.create(tenantId, seed);
      // Las semillas nacen publicadas: el comerciante solo asigna y ya funcionan
      await productTemplatesService.setStatus(tenantId, tpl.id, 'published');
    }
    res.status(201).json({ success: true, data: { created: DEFAULT_TEMPLATES.length, templates: await productTemplatesService.list(tenantId) } });
  } catch (e) { fail(res, e); }
});

// PUT /api/product-templates/:id — actualizar nombre/descripcion/secciones
router.put(
  '/:id',
  authorize('superadmin', 'comerciante'),
  [
    param('id').notEmpty(),
    body('name').optional().isLength({ min: 1, max: 120 }),
    body('description').optional().isString().isLength({ max: 300 }),
    body('sections').optional().isArray(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true, data: await productTemplatesService.update(req.user!.tenantId!, req.params.id, req.body) });
    } catch (e) { fail(res, e); }
  }
);

// PATCH /api/product-templates/:id/status — draft / published / archived
router.patch(
  '/:id/status',
  authorize('superadmin', 'comerciante'),
  [param('id').notEmpty(), body('status').isIn(['draft', 'published', 'archived']), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      await productTemplatesService.setStatus(req.user!.tenantId!, req.params.id, req.body.status);
      res.json({ success: true, data: { status: req.body.status } });
    } catch (e) { fail(res, e); }
  }
);

// POST /api/product-templates/:id/duplicate — copia en draft (versionado ligero)
router.post(
  '/:id/duplicate',
  authorize('superadmin', 'comerciante'),
  [param('id').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const copy = await productTemplatesService.duplicate(req.user!.tenantId!, req.params.id);
      res.status(201).json({ success: true, data: copy });
    } catch (e) { fail(res, e); }
  }
);

// DELETE /api/product-templates/:id — soft delete
router.delete(
  '/:id',
  authorize('superadmin', 'comerciante'),
  [param('id').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      await productTemplatesService.delete(req.user!.tenantId!, req.params.id);
      res.json({ success: true, data: { deleted: true } });
    } catch (e) { fail(res, e); }
  }
);

// PATCH /api/product-templates/assign — asignación (masiva); templateId null = quitar
router.patch(
  '/assign',
  authorize('superadmin', 'comerciante'),
  [
    body('productIds').isArray({ min: 1 }).withMessage('productIds requerido'),
    body('templateId').optional({ nullable: true }).isString(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const updated = await productTemplatesService.assign(
        req.user!.tenantId!,
        (req.body.productIds as unknown[]).map(String),
        req.body.templateId || null
      );
      res.json({ success: true, data: { updated } });
    } catch (e) { fail(res, e); }
  }
);

// PUT /api/product-templates/products/:productId/page-content — contenido único del producto
router.put(
  '/products/:productId/page-content',
  authorize('superadmin', 'comerciante'),
  [param('productId').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      await productTemplatesService.setPageContent(req.user!.tenantId!, req.params.productId, req.body?.pageContent ?? null);
      res.json({ success: true, data: { saved: true } });
    } catch (e) { fail(res, e); }
  }
);

export default router;
