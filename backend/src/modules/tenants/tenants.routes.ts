import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { tenantsController } from './tenants.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

// All tenants routes require superadmin
router.use(authenticate);
router.use(authorize('superadmin'));

// GET /api/tenants - List all tenants
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Pagina invalida'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite invalido'),
    query('search').optional().isString(),
    validateRequest,
  ],
  tenantsController.findAll.bind(tenantsController)
);

// GET /api/tenants/stats - Platform statistics
router.get('/stats', tenantsController.getStats.bind(tenantsController));

// GET /api/tenants/platform-settings - Get platform settings
router.get('/platform-settings', tenantsController.getPlatformSettings.bind(tenantsController));

// PUT /api/tenants/platform-settings - Update platform setting
router.put(
  '/platform-settings',
  [
    body('key').notEmpty().withMessage('La clave es requerida'),
    body('value').exists().withMessage('El valor es requerido'),
    validateRequest,
  ],
  tenantsController.updatePlatformSettings.bind(tenantsController)
);

// GET /api/tenants/business-types - List business type categories (BEFORE /:id)
router.get('/business-types', tenantsController.getBusinessTypes.bind(tenantsController));

// POST /api/tenants/business-types - Create business type category (BEFORE /:id)
router.post(
  '/business-types',
  [body('name').notEmpty().withMessage('El nombre es requerido'), validateRequest],
  tenantsController.createBusinessType.bind(tenantsController)
);

// DELETE /api/tenants/business-types/:name - Delete business type category (BEFORE /:id)
router.delete(
  '/business-types/:name',
  [param('name').notEmpty().withMessage('Nombre requerido'), validateRequest],
  tenantsController.deleteBusinessType.bind(tenantsController)
);

// GET /api/tenants/:id - Get tenant detail (MUST be after static routes to avoid conflict)
router.get(
  '/:id',
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  tenantsController.findById.bind(tenantsController)
);

// POST /api/tenants - Create new tenant with owner
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('slug')
      .notEmpty().withMessage('El slug es requerido')
      .matches(/^[a-z0-9-]+$/).withMessage('El slug solo puede contener letras minúsculas, números y guiones'),
    body('plan')
      .optional()
      .isIn(['basico', 'profesional', 'empresarial'])
      .withMessage('Plan inválido'),
    body('maxUsers')
      .optional()
      .isInt({ min: 1 }).withMessage('Máximo de usuarios debe ser al menos 1'),
    body('maxProducts')
      .optional()
      .isInt({ min: 1 }).withMessage('Máximo de productos debe ser al menos 1'),
    body('ownerName').notEmpty().withMessage('Nombre del propietario requerido'),
    body('ownerEmail').isEmail().withMessage('Email del propietario inválido'),
    body('ownerPassword')
      .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    validateRequest,
  ],
  tenantsController.create.bind(tenantsController)
);

// PUT /api/tenants/:id - Update tenant
router.put(
  '/:id',
  [
    param('id').notEmpty().withMessage('ID requerido'),
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    body('plan')
      .optional()
      .isIn(['basico', 'profesional', 'empresarial'])
      .withMessage('Plan inválido'),
    body('status')
      .optional()
      .isIn(['activo', 'suspendido', 'cancelado'])
      .withMessage('Estado inválido'),
    body('maxUsers')
      .optional()
      .isInt({ min: 1 }).withMessage('Máximo de usuarios debe ser al menos 1'),
    body('maxProducts')
      .optional()
      .isInt({ min: 1 }).withMessage('Máximo de productos debe ser al menos 1'),
    body('bgColor')
      .optional()
      .matches(/^#[0-9a-fA-F]{6}$/).withMessage('Color de fondo inválido (formato: #RRGGBB)'),
    validateRequest,
  ],
  tenantsController.update.bind(tenantsController)
);

// PATCH /api/tenants/:id/toggle-status - Activate/Suspend tenant
router.patch(
  '/:id/toggle-status',
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  tenantsController.toggleStatus.bind(tenantsController)
);

// POST /api/tenants/:id/activate-trial - Activate 7-day empresarial trial
router.post(
  '/:id/activate-trial',
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  tenantsController.activateTrial.bind(tenantsController)
);

export default router;
