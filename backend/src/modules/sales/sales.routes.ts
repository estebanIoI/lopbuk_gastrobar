import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { salesController } from './sales.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

// Todas las rutas requieren autenticacion
router.use(authenticate);

// GET /api/sales
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Pagina invalida'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite invalido'),
    query('status')
      .optional()
      .isIn(['completada', 'anulada'])
      .withMessage('Estado invalido'),
    query('paymentMethod')
      .optional()
      .isIn(['efectivo', 'tarjeta', 'transferencia', 'fiado', 'addi', 'sistecredito', 'mixto'])
      .withMessage('Metodo de pago invalido'),
    validateRequest,
  ],
  salesController.findAll.bind(salesController)
);

// GET /api/sales/recent
router.get('/recent', salesController.getRecentSales.bind(salesController));

// GET /api/sales/vendedores-performance  (solo comerciante/superadmin)
router.get(
  '/vendedores-performance',
  authorize('comerciante', 'superadmin'),
  salesController.getVendedoresPerformance.bind(salesController)
);

// GET /api/sales/vendedor/:sellerId  (ventas individuales de un vendedor)
router.get(
  '/vendedor/:sellerId',
  authorize('comerciante', 'superadmin'),
  salesController.getVendedorSales.bind(salesController)
);

// GET /api/sales/invoice/:invoiceNumber
router.get(
  '/invoice/:invoiceNumber',
  [param('invoiceNumber').notEmpty().withMessage('Numero de factura requerido'), validateRequest],
  salesController.findByInvoiceNumber.bind(salesController)
);

// GET /api/sales/:id
router.get(
  '/:id',
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  salesController.findById.bind(salesController)
);

// POST /api/sales
router.post(
  '/',
  [
    body('items')
      .isArray({ min: 1 })
      .withMessage('Debe incluir al menos un item'),
    body('items.*.productId')
      .notEmpty()
      .withMessage('ID del producto requerido'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('La cantidad debe ser mayor a 0'),
    body('items.*.discount')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('El descuento debe estar entre 0 y 100'),
    body('items.*.customAmount')
      .optional()
      .isFloat({ gt: 0 })
      .withMessage('El monto personalizado debe ser mayor a 0'),
    body('paymentMethod')
      .isIn(['efectivo', 'tarjeta', 'transferencia', 'fiado', 'addi', 'sistecredito', 'mixto'])
      .withMessage('Metodo de pago invalido'),
    body('amountPaid')
      .isFloat({ min: 0 })
      .withMessage('El monto pagado debe ser mayor a 0'),
    body('globalDiscount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('El descuento global debe ser mayor o igual a 0'),
    body('customerName')
      .optional()
      .notEmpty()
      .withMessage('El nombre del cliente no puede estar vacio'),
    body('sellerName')
      .optional()
      .notEmpty()
      .withMessage('El nombre del vendedor no puede estar vacio'),
    body('creditDays')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Los días de plazo deben ser mayor a 0'),
    validateRequest,
  ],
  salesController.create.bind(salesController)
);

// PUT /api/sales/:id/cancel
router.put(
  '/:id/cancel',
  authorize('comerciante', 'superadmin'),
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  salesController.cancel.bind(salesController)
);

// GET /api/sales/stats
router.get(
  '/stats',
  authorize('comerciante', 'superadmin'),
  salesController.getStats.bind(salesController)
);

// GET /api/sales/daily-report?date=YYYY-MM-DD
router.get(
  '/daily-report',
  authorize('comerciante', 'superadmin'),
  salesController.getDailyReport.bind(salesController)
);

export default router;
