import { Router } from 'express';
import { body, param } from 'express-validator';
import { recipePagesController } from './recipe-pages.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

// GET /api/recipe-pages/public?store=<slug> — público, sin auth (todas las recetas de la tienda)
router.get('/public', recipePagesController.findPublic.bind(recipePagesController));

router.use(authenticate);

// GET /api/recipe-pages
router.get('/', recipePagesController.findAll.bind(recipePagesController));

// GET /api/recipe-pages/:id
router.get(
  '/:id',
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  recipePagesController.findById.bind(recipePagesController)
);

// POST /api/recipe-pages
router.post(
  '/',
  authorize('comerciante', 'superadmin'),
  [
    body('id').notEmpty().withMessage('El identificador es requerido'),
    body('productId').notEmpty().withMessage('El productId es requerido'),
    body('title').notEmpty().withMessage('El título es requerido'),
    body('steps').isArray({ min: 1 }).withMessage('Los pasos son requeridos'),
    body('description').optional().isString(),
    body('imageUrl').optional().isString(),
    body('prepTimeMinutes').optional().isInt({ min: 0 }),
    body('difficulty').optional().isIn(['fácil', 'medio', 'difícil']),
    body('servings').optional().isInt({ min: 1 }),
    body('tips').optional().isString(),
    body('tags').optional().isString(),
    body('totalCost').optional().isFloat({ min: 0 }),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('ingredients').optional().isArray(),
    body('ingredients.*.productId').optional().notEmpty().withMessage('El productId del ingrediente es requerido'),
    body('ingredients.*.quantity').optional().isFloat({ min: 0 }),
    body('ingredients.*.unit').optional().isString(),
    body('ingredients.*.notes').optional().isString(),
    body('ingredients.*.sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  recipePagesController.create.bind(recipePagesController)
);

// PUT /api/recipe-pages/:id
router.put(
  '/:id',
  authorize('comerciante', 'superadmin'),
  [
    param('id').notEmpty().withMessage('ID requerido'),
    body('productId').optional().notEmpty().withMessage('El productId no puede estar vacío'),
    body('title').optional().notEmpty().withMessage('El título no puede estar vacío'),
    body('description').optional().isString(),
    body('imageUrl').optional().isString(),
    body('prepTimeMinutes').optional().isInt({ min: 0 }),
    body('difficulty').optional().isIn(['fácil', 'medio', 'difícil']),
    body('servings').optional().isInt({ min: 1 }),
    body('steps').optional().isArray({ min: 1 }).withMessage('steps debe ser un array con al menos un paso'),
    body('tips').optional().isString(),
    body('tags').optional().isString(),
    body('totalCost').optional().isFloat({ min: 0 }),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('ingredients').optional().isArray(),
    body('ingredients.*.productId').optional().notEmpty(),
    body('ingredients.*.quantity').optional().isFloat({ min: 0 }),
    body('ingredients.*.unit').optional().isString(),
    body('ingredients.*.notes').optional().isString(),
    body('ingredients.*.sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  recipePagesController.update.bind(recipePagesController)
);

// DELETE /api/recipe-pages/:id
router.delete(
  '/:id',
  authorize('comerciante', 'superadmin'),
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  recipePagesController.delete.bind(recipePagesController)
);

export default router;
