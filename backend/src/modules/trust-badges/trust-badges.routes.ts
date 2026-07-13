import { Router } from 'express';
import { body, param } from 'express-validator';
import { trustBadgesController } from './trust-badges.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

router.get('/public', trustBadgesController.findPublic.bind(trustBadgesController));

router.use(authenticate);

router.get('/', trustBadgesController.findAll.bind(trustBadgesController));

router.post(
  '/',
  authorize('comerciante', 'superadmin'),
  [
    body('icon').notEmpty().withMessage('El icono es requerido'),
    body('title').notEmpty().withMessage('El título es requerido'),
    body('description').optional().isString(),
    validateRequest,
  ],
  trustBadgesController.create.bind(trustBadgesController)
);

router.put(
  '/:id',
  authorize('comerciante', 'superadmin'),
  [
    param('id').isInt().withMessage('ID inválido'),
    body('icon').optional().notEmpty(),
    body('title').optional().notEmpty(),
    body('description').optional().isString(),
    body('sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  trustBadgesController.update.bind(trustBadgesController)
);

router.delete(
  '/:id',
  authorize('comerciante', 'superadmin'),
  [
    param('id').isInt().withMessage('ID inválido'),
    validateRequest,
  ],
  trustBadgesController.delete.bind(trustBadgesController)
);

export default router;
