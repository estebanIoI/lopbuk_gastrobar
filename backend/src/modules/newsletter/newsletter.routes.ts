import { Router } from 'express';
import { body, query } from 'express-validator';
import { newsletterController } from './newsletter.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

router.post(
  '/subscribe',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('acceptedTerms').isBoolean().withMessage('acceptedTerms debe ser booleano'),
    body('store').optional().isString(),
    validateRequest,
  ],
  newsletterController.subscribe.bind(newsletterController)
);

router.use(authenticate);

router.get(
  '/',
  authorize('comerciante', 'superadmin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  newsletterController.findAll.bind(newsletterController)
);

router.get(
  '/export',
  authorize('comerciante', 'superadmin'),
  newsletterController.exportCsv.bind(newsletterController)
);

export default router;
