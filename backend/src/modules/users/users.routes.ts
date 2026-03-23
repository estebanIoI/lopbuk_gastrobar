import { Router } from 'express';
import { body, param } from 'express-validator';
import { usersController } from './users.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

// Todas las rutas requieren autenticacion y rol comerciante o superadmin
router.use(authenticate);
router.use(authorize('comerciante', 'superadmin'));

// GET /api/users
router.get('/', usersController.findAll.bind(usersController));

// GET /api/users/:id
router.get(
  '/:id',
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  usersController.findById.bind(usersController)
);

// POST /api/users
router.post(
  '/',
  [
    body('email').isEmail().withMessage('Email invalido'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contrasena debe tener al menos 6 caracteres'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('role')
      .optional()
      .isIn(['comerciante', 'vendedor', 'auxiliar_bodega', 'repartidor', 'cliente',
             'mesero', 'cocinero', 'cajero', 'bartender', 'administrador_rb'])
      .withMessage('Rol invalido'),
    body('phone').optional().isString().withMessage('Telefono invalido'),
    body('tenantId').optional({ nullable: true }).isString().withMessage('Tenant ID invalido'),
    body('cargoId').optional({ nullable: true }).isString().withMessage('Cargo ID invalido'),
    validateRequest,
  ],
  usersController.create.bind(usersController)
);

// PUT /api/users/:id
router.put(
  '/:id',
  [
    param('id').notEmpty().withMessage('ID requerido'),
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacio'),
    body('role').optional().isIn(['comerciante', 'vendedor', 'auxiliar_bodega', 'repartidor', 'cliente',
                                  'mesero', 'cocinero', 'cajero', 'bartender', 'administrador_rb']).withMessage('Rol invalido'),
    body('avatar').optional().isURL().withMessage('URL de avatar invalida'),
    body('canLogin').optional().isBoolean().withMessage('canLogin debe ser booleano'),
    validateRequest,
  ],
  usersController.update.bind(usersController)
);

// DELETE /api/users/:id
router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  usersController.delete.bind(usersController)
);

// PUT /api/users/:id/reset-password
router.put(
  '/:id/reset-password',
  [
    param('id').notEmpty().withMessage('ID requerido'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('La nueva contrasena debe tener al menos 6 caracteres'),
    validateRequest,
  ],
  usersController.resetPassword.bind(usersController)
);

export default router;
