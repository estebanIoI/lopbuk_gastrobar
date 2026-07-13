import { Router } from 'express';
import { body } from 'express-validator';
import { homepageController } from './homepage.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

router.get('/public', homepageController.findPublic.bind(homepageController));

router.use(authenticate);

router.get(
  '/config',
  authorize('comerciante', 'superadmin'),
  homepageController.getConfig.bind(homepageController)
);

router.put(
  '/config',
  authorize('comerciante', 'superadmin'),
  [
    body('sections').isArray().withMessage('El campo sections debe ser un array'),
    validateRequest,
  ],
  homepageController.saveConfig.bind(homepageController)
);

export default router;
