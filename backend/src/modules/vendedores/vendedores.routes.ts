import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import { vendedoresController } from './vendedores.controller';

const router: ReturnType<typeof Router> = Router();

// Todas las rutas requieren auth y rol comerciante/superadmin
router.use(authenticate);
router.use(authorize('comerciante', 'superadmin'));

// GET  /api/vendedores                       – lista vendedores + config comisión
router.get('/', vendedoresController.getSellers.bind(vendedoresController));

// PUT  /api/vendedores/:sellerId/commission   – actualizar config de comisión
router.put(
  '/:sellerId/commission',
  [
    body('commissionType').isIn(['sin_comision', 'porcentaje', 'fijo_por_venta', 'fijo_por_item']),
    body('commissionValue').isFloat({ min: 0 }),
    body('salaryBase').isFloat({ min: 0 }),
    body('monthlyGoal').isFloat({ min: 0 }),
    body('goalBonus').isFloat({ min: 0 }),
    validateRequest,
  ],
  vendedoresController.updateSellerConfig.bind(vendedoresController)
);

// GET  /api/vendedores/performance            – rendimiento con comisiones calculadas
router.get('/performance', vendedoresController.getPerformance.bind(vendedoresController));

// GET  /api/vendedores/adjustments            – bonos/descuentos del periodo
router.get('/adjustments', vendedoresController.getAdjustments.bind(vendedoresController));

// POST /api/vendedores/adjustments            – agregar bono/descuento
router.post(
  '/adjustments',
  [
    body('sellerId').notEmpty(),
    body('sellerName').notEmpty(),
    body('periodFrom').isDate(),
    body('periodTo').isDate(),
    body('type').isIn(['bono', 'descuento']),
    body('concept').notEmpty(),
    body('amount').isFloat({ min: 0.01 }),
    validateRequest,
  ],
  vendedoresController.addAdjustment.bind(vendedoresController)
);

// DELETE /api/vendedores/adjustments/:id      – eliminar ajuste
router.delete('/adjustments/:id', vendedoresController.deleteAdjustment.bind(vendedoresController));

// POST /api/vendedores/payroll/generate       – generar nómina del periodo
router.post(
  '/payroll/generate',
  [
    body('periodFrom').isDate(),
    body('periodTo').isDate(),
    body('periodLabel').notEmpty(),
    validateRequest,
  ],
  vendedoresController.generatePayroll.bind(vendedoresController)
);

// GET  /api/vendedores/payroll               – historial de nóminas
router.get('/payroll', vendedoresController.getPayrollHistory.bind(vendedoresController));

// PUT  /api/vendedores/payroll/mark-paid     – marcar registros como pagados
router.put('/payroll/mark-paid', vendedoresController.markPayrollPaid.bind(vendedoresController));

// DELETE /api/vendedores/payroll/:id          – eliminar borrador
router.delete('/payroll/:id', vendedoresController.deletePayrollRecord.bind(vendedoresController));

export default router;
