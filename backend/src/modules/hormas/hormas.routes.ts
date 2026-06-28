import { Router } from 'express';
import { body, param } from 'express-validator';
import { hormasController } from './hormas.controller';
import { authenticate } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

// ── Hormas ──────────────────────────────────────────────────────────────────
// GET    /api/hormas
// POST   /api/hormas
// GET    /api/hormas/:id
// PUT    /api/hormas/:id
// DELETE /api/hormas/:id
router.get('/', hormasController.findAll.bind(hormasController));


router.post(
  '/',
  [body('name').notEmpty().withMessage('Nombre requerido'), validateRequest],
  hormasController.create.bind(hormasController)
);

router.get(
  '/:id',
  [param('id').isUUID().withMessage('ID inválido'), validateRequest],
  hormasController.findById.bind(hormasController)
);

router.put(
  '/:id',
  [param('id').isUUID(), validateRequest],
  hormasController.update.bind(hormasController)
);

router.delete(
  '/:id',
  [param('id').isUUID(), validateRequest],
  hormasController.delete.bind(hormasController)
);

// ── Colores (paleta) ─────────────────────────────────────────────────────────
// GET    /api/hormas/:id/colors
// POST   /api/hormas/:id/colors
// DELETE /api/hormas/colors/:colorId
router.get(
  '/:id/colors',
  [param('id').isUUID(), validateRequest],
  hormasController.getColors.bind(hormasController)
);

router.post(
  '/:id/colors',
  [
    param('id').isUUID(),
    body('color').notEmpty().withMessage('Color requerido'),
    validateRequest,
  ],
  hormasController.addColor.bind(hormasController)
);

// PATCH /api/hormas/colors/:colorId  — actualiza shelf (y/o hex) de un color
router.patch(
  '/colors/:colorId',
  [param('colorId').isUUID(), validateRequest],
  hormasController.updateColor.bind(hormasController)
);

router.delete(
  '/colors/:colorId',
  [param('colorId').isUUID(), validateRequest],
  hormasController.removeColor.bind(hormasController)
);

export default router;
