import { Router } from 'express';
import { body, param } from 'express-validator';
import { popularSearchesController } from './popular-searches.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

router.get('/public', popularSearchesController.findPublic.bind(popularSearchesController));

router.use(authenticate);

router.get('/', popularSearchesController.findAll.bind(popularSearchesController));

router.post(
  '/',
  authorize('comerciante', 'superadmin'),
  [
    body('term').notEmpty().withMessage('El término es requerido'),
    body('sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  popularSearchesController.create.bind(popularSearchesController)
);

router.put(
  '/:id',
  authorize('comerciante', 'superadmin'),
  [
    param('id').isString().notEmpty().withMessage('ID inválido'),
    body('term').optional().notEmpty(),
    body('sortOrder').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  popularSearchesController.update.bind(popularSearchesController)
);

router.delete(
  '/:id',
  authorize('comerciante', 'superadmin'),
  [
    param('id').isString().notEmpty().withMessage('ID inválido'),
    validateRequest,
  ],
  popularSearchesController.delete.bind(popularSearchesController)
);

export default router;
