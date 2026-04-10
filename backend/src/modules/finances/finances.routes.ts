import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { financesController } from './finances.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import { UserRole } from '../../common/types';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

const ADMIN_ROLES: UserRole[] = ['superadmin', 'comerciante', 'administrador_rb'];
const ALL_STAFF: UserRole[]   = [...ADMIN_ROLES, 'cajero'];

// ── CATEGORIES ────────────────────────────────────────────────────────────────

router.get(
  '/categories',
  authorize(...ALL_STAFF),
  [query('type').optional().isIn(['ingreso','egreso']), validateRequest],
  financesController.getCategories.bind(financesController)
);

router.post(
  '/categories/seed',
  authorize(...ADMIN_ROLES),
  financesController.seedCategories.bind(financesController)
);

router.post(
  '/categories',
  authorize(...ADMIN_ROLES),
  [
    body('type').isIn(['ingreso','egreso']).withMessage('Tipo inválido: ingreso o egreso'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('icon').optional().isString(),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color hex inválido'),
    validateRequest,
  ],
  financesController.createCategory.bind(financesController)
);

router.put(
  '/categories/:id',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), body('name').optional().notEmpty(), validateRequest],
  financesController.updateCategory.bind(financesController)
);

router.delete(
  '/categories/:id',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  financesController.deleteCategory.bind(financesController)
);

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────

router.get(
  '/transactions',
  authorize(...ALL_STAFF),
  [
    query('type').optional().isIn(['ingreso','egreso']),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    validateRequest,
  ],
  financesController.getTransactions.bind(financesController)
);

router.post(
  '/transactions',
  authorize(...ALL_STAFF),
  [
    body('type').isIn(['ingreso','egreso']).withMessage('Tipo inválido'),
    body('categoryId').notEmpty().withMessage('La categoría es requerida'),
    body('description').notEmpty().withMessage('La descripción es requerida'),
    body('amount').isFloat({ min: 0.01 }).withMessage('El monto debe ser mayor a 0'),
    body('transactionDate').isISO8601().withMessage('Fecha inválida'),
    body('paymentMethod').optional().isIn(['efectivo','tarjeta','transferencia','nequi','daviplata','cheque','otro']),
    body('isRecurring').optional().isBoolean(),
    body('recurrenceType').optional().isIn(['diario','semanal','quincenal','mensual','bimestral','anual']),
    body('recurrenceDay').optional().isInt({ min: 1, max: 31 }),
    validateRequest,
  ],
  financesController.createTransaction.bind(financesController)
);

router.put(
  '/transactions/:id',
  authorize(...ALL_STAFF),
  [
    param('id').notEmpty(),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('transactionDate').optional().isISO8601(),
    validateRequest,
  ],
  financesController.updateTransaction.bind(financesController)
);

router.delete(
  '/transactions/:id',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  financesController.deleteTransaction.bind(financesController)
);

// ── SUMMARY & REPORTS ─────────────────────────────────────────────────────────

router.get(
  '/summary',
  authorize(...ALL_STAFF),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    validateRequest,
  ],
  financesController.getSummary.bind(financesController)
);

router.get(
  '/reports/cashflow',
  authorize(...ADMIN_ROLES),
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    validateRequest,
  ],
  financesController.getCashflow.bind(financesController)
);

// ── BUDGETS ───────────────────────────────────────────────────────────────────

router.get(
  '/budgets',
  authorize(...ADMIN_ROLES),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    validateRequest,
  ],
  financesController.getBudgets.bind(financesController)
);

router.post(
  '/budgets',
  authorize(...ADMIN_ROLES),
  [
    body('categoryId').notEmpty().withMessage('La categoría es requerida'),
    body('year').isInt({ min: 2020, max: 2100 }).withMessage('Año inválido'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Mes inválido (1-12)'),
    body('budgetedAmount').isFloat({ min: 0 }).withMessage('El monto presupuestado debe ser >= 0'),
    validateRequest,
  ],
  financesController.upsertBudget.bind(financesController)
);

router.delete(
  '/budgets/:id',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  financesController.deleteBudget.bind(financesController)
);

export default router;
