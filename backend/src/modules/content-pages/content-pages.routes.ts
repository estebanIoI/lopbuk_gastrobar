import { Router } from 'express';
import { body, param } from 'express-validator';
import { contentPagesController } from './content-pages.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

router.get(
  '/public/:slug',
  contentPagesController.findPublic.bind(contentPagesController)
);

router.use(authenticate);

router.get('/', contentPagesController.findAll.bind(contentPagesController));

router.get(
  '/:id',
  [param('id').isInt().withMessage('ID inválido'), validateRequest],
  contentPagesController.findById.bind(contentPagesController)
);

router.post(
  '/',
  authorize('comerciante', 'superadmin'),
  [
    body('slug').notEmpty().withMessage('El slug es requerido'),
    body('title').notEmpty().withMessage('El título es requerido'),
    body('content').notEmpty().withMessage('El contenido es requerido'),
    body('metaTitle').optional().isString(),
    body('metaDescription').optional().isString(),
    body('pageType').optional().isString(),
    body('isPublished').optional().isBoolean(),
    validateRequest,
  ],
  contentPagesController.create.bind(contentPagesController)
);

router.put(
  '/:id',
  authorize('comerciante', 'superadmin'),
  [
    param('id').isInt().withMessage('ID inválido'),
    body('slug').optional().notEmpty(),
    body('title').optional().notEmpty(),
    body('content').optional().notEmpty(),
    body('metaTitle').optional().isString(),
    body('metaDescription').optional().isString(),
    body('pageType').optional().isString(),
    body('isPublished').optional().isBoolean(),
    body('sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  contentPagesController.update.bind(contentPagesController)
);

router.delete(
  '/:id',
  authorize('comerciante', 'superadmin'),
  [
    param('id').isInt().withMessage('ID inválido'),
    validateRequest,
  ],
  contentPagesController.delete.bind(contentPagesController)
);

export default router;
