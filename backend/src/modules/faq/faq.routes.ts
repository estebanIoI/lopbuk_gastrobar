import { Router } from 'express';
import { body, param } from 'express-validator';
import { faqController } from './faq.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

// ── Public ──────────────────────────────────────────────────────────
router.get('/public', faqController.findPublic.bind(faqController));

// ── Admin (categories) ──────────────────────────────────────────────
router.use('/categories', authenticate);

router.get('/categories', faqController.findAllCategories.bind(faqController));

router.post(
  '/categories',
  authorize('comerciante', 'superadmin', 'administrador_rb'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  faqController.createCategory.bind(faqController)
);

router.put(
  '/categories/:id',
  authorize('comerciante', 'superadmin', 'administrador_rb'),
  [
    param('id').notEmpty().withMessage('ID requerido'),
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    body('sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  faqController.updateCategory.bind(faqController)
);

router.delete(
  '/categories/:id',
  authorize('comerciante', 'superadmin', 'administrador_rb'),
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  faqController.deleteCategory.bind(faqController)
);

// ── Admin (items) ───────────────────────────────────────────────────
router.use('/items', authenticate);

router.get('/items', faqController.findAllItems.bind(faqController));

router.post(
  '/items',
  authorize('comerciante', 'superadmin', 'administrador_rb'),
  [
    body('categoryId').notEmpty().withMessage('La categoría es requerida'),
    body('question').notEmpty().withMessage('La pregunta es requerida'),
    body('answer').notEmpty().withMessage('La respuesta es requerida'),
    body('sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  faqController.createItem.bind(faqController)
);

router.put(
  '/items/:id',
  authorize('comerciante', 'superadmin', 'administrador_rb'),
  [
    param('id').notEmpty().withMessage('ID requerido'),
    body('categoryId').optional().notEmpty().withMessage('La categoría no puede estar vacía'),
    body('question').optional().notEmpty().withMessage('La pregunta no puede estar vacía'),
    body('answer').optional().notEmpty().withMessage('La respuesta no puede estar vacía'),
    body('sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  faqController.updateItem.bind(faqController)
);

router.delete(
  '/items/:id',
  authorize('comerciante', 'superadmin', 'administrador_rb'),
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  faqController.deleteItem.bind(faqController)
);

export default router;
