import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from './auth.controller';
import { authenticate } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email invalido'),
    body('password').notEmpty().withMessage('La contrasena es requerida'),
    validateRequest,
  ],
  authController.login.bind(authController)
);

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Email invalido'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contrasena debe tener al menos 6 caracteres'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    // SEGURIDAD (F1): 'superadmin' NO puede crearse por este endpoint público.
    // Crear un superadmin es una acción privilegiada; debe hacerse por un flujo
    // autenticado y explícito, nunca desde un registro abierto.
    body('role')
      .optional()
      .isIn(['comerciante', 'vendedor', 'repartidor'])
      .withMessage('Rol invalido'),
    validateRequest,
  ],
  authController.register.bind(authController)
);

// POST /api/auth/google (PUBLIC - Google OAuth login/register)
router.post(
  '/google',
  [
    body('credential').notEmpty().withMessage('Token de Google es requerido'),
    body('storeSlug').optional().notEmpty().withMessage('Identificador de tienda invalido'),
    validateRequest,
  ],
  authController.googleLogin.bind(authController)
);

// POST /api/auth/register-client (PUBLIC - no auth required)
router.post(
  '/register-client',
  [
    body('email').isEmail().withMessage('Email invalido'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contrasena debe tener al menos 6 caracteres'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('phone').optional().notEmpty().withMessage('Telefono invalido'),
    body('storeSlug').optional().notEmpty().withMessage('Identificador de tienda invalido'),
    validateRequest,
  ],
  authController.registerClient.bind(authController)
);

// POST /api/auth/logout
router.post('/logout', authController.logout.bind(authController));

// GET /api/auth/profile
router.get(
  '/profile',
  authenticate,
  authController.getProfile.bind(authController)
);

// PUT /api/auth/profile
router.put(
  '/profile',
  authenticate,
  [
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacio'),
    body('avatar').optional().isURL().withMessage('URL de avatar invalida'),
    validateRequest,
  ],
  authController.updateProfile.bind(authController)
);

// GET /api/auth/addresses
router.get('/addresses', authenticate, authController.getAddresses.bind(authController));

// POST /api/auth/addresses
router.post(
  '/addresses',
  authenticate,
  [
    body('label').notEmpty().withMessage('El nombre de la dirección es requerido'),
    body('department').notEmpty().withMessage('El departamento es requerido'),
    body('municipality').notEmpty().withMessage('El municipio es requerido'),
    body('address').notEmpty().withMessage('La dirección es requerida'),
    validateRequest,
  ],
  authController.addAddress.bind(authController)
);

// PUT /api/auth/addresses/:id
router.put('/addresses/:id', authenticate, authController.updateAddress.bind(authController));

// DELETE /api/auth/addresses/:id
router.delete('/addresses/:id', authenticate, authController.deleteAddress.bind(authController));

// PATCH /api/auth/addresses/:id/default
router.patch('/addresses/:id/default', authenticate, authController.setDefaultAddress.bind(authController));

// PUT /api/auth/change-password
router.put(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('La contrasena actual es requerida'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('La nueva contrasena debe tener al menos 6 caracteres'),
    validateRequest,
  ],
  authController.changePassword.bind(authController)
);

export default router;
