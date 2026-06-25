import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { usersController } from './users.controller';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';

const router: ReturnType<typeof Router> = Router();

// Todas las rutas requieren autenticacion y rol comerciante o superadmin
router.use(authenticate);
router.use(authorize('comerciante', 'superadmin'));

const ROLE_VALUES = ['superadmin', 'comerciante', 'vendedor', 'auxiliar_bodega', 'repartidor', 'cliente',
  'mesero', 'cocinero', 'cajero', 'bartender', 'administrador_rb', 'despachador', 'comunidad_admin'];

// ── SUPERADMIN: buscar usuario por email (cross-tenant) para corregir su rol ──
// GET /api/users/superadmin/find?email=...
router.get('/superadmin/find', async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
  const q = String(req.query.email || '').trim();
  if (q.length < 3) { res.json({ success: true, data: [] }); return; }
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.auth_provider, u.is_active AS isActive,
              u.tenant_id AS tenantId, t.name AS tenantName
       FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email LIKE ? ORDER BY u.created_at DESC LIMIT 20`,
      [`%${q}%`]
    ) as any;
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Error al buscar usuarios' });
  }
});

// ── SUPERADMIN: cambiar el rol de un usuario (limpia el tenant si pasa a cliente) ──
// PUT /api/users/superadmin/:id/role  Body: { role }
router.put('/superadmin/:id/role', async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
  const role = String(req.body?.role || '');
  if (!ROLE_VALUES.includes(role)) { res.status(400).json({ success: false, error: 'Rol inválido' }); return; }
  try {
    // Un cliente es un consumidor del OS: no debe arrastrar un tenant de comercio.
    if (role === 'cliente') {
      await pool.query('UPDATE users SET role = ?, tenant_id = NULL WHERE id = ?', [role, req.params.id]);
    } else {
      await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    }
    res.json({ success: true, message: 'Rol actualizado' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Error al actualizar el rol' });
  }
});

// ── SUPERADMIN: suspender / activar una cuenta (is_active) ──
// PUT /api/users/superadmin/:id/active  Body: { active: boolean }
router.put('/superadmin/:id/active', async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
  if (req.params.id === req.user!.userId) { res.status(400).json({ success: false, error: 'No puedes suspender tu propia cuenta' }); return; }
  try {
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [req.body?.active ? 1 : 0, req.params.id]);
    res.json({ success: true, message: req.body?.active ? 'Cuenta activada' : 'Cuenta suspendida' });
  } catch {
    res.status(500).json({ success: false, error: 'Error al actualizar el estado' });
  }
});

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
             'mesero', 'cocinero', 'cajero', 'bartender', 'administrador_rb', 'despachador'])
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
                                  'mesero', 'cocinero', 'cajero', 'bartender', 'administrador_rb', 'despachador']).withMessage('Rol invalido'),
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
