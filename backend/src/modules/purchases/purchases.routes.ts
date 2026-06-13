import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { purchasesController } from './purchases.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

// GET /api/purchases
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  purchasesController.findAll.bind(purchasesController)
);

// GET /api/purchases/next-invoice-number
router.get(
  '/next-invoice-number',
  purchasesController.getNextInvoiceNumber.bind(purchasesController)
);

// POST /api/purchases/ocr — Lee una factura desde una foto con IA (OCR)
router.post(
  '/ocr',
  authorize('comerciante', 'superadmin'),
  [
    body('imageBase64').notEmpty().withMessage('La imagen es requerida'),
    body('mimeType').optional().isString(),
    validateRequest,
  ],
  purchasesController.ocrInvoice.bind(purchasesController)
);

// GET /api/purchases/suppliers
router.get(
  '/suppliers',
  purchasesController.getSuppliers.bind(purchasesController)
);

// POST /api/purchases/suppliers
router.post(
  '/suppliers',
  authorize('comerciante', 'superadmin'),
  [
    body('name').notEmpty().withMessage('El nombre del proveedor es requerido'),
    body('email').optional({ nullable: true }).isEmail().withMessage('Correo inválido'),
    validateRequest,
  ],
  purchasesController.createSupplier.bind(purchasesController)
);

// GET /api/purchases/suppliers/:supplierId/stats
router.get(
  '/suppliers/:supplierId/stats',
  [param('supplierId').notEmpty(), validateRequest],
  purchasesController.getSupplierStats.bind(purchasesController)
);

// GET /api/purchases/:id
router.get(
  '/:id',
  [param('id').notEmpty(), validateRequest],
  purchasesController.findById.bind(purchasesController)
);

// POST /api/purchases
router.post(
  '/',
  authorize('comerciante', 'superadmin'),
  [
    body('invoiceNumber').notEmpty().withMessage('El numero de factura es requerido'),
    body('supplierName').notEmpty().withMessage('El nombre del proveedor es requerido'),
    body('purchaseDate').notEmpty().isISO8601().withMessage('La fecha de compra es requerida'),
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un producto'),
    body('items.*.productId').notEmpty().withMessage('ID del producto requerido'),
    body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('La cantidad debe ser mayor a 0'),
    body('items.*.unitCost').isFloat({ min: 0 }).withMessage('El costo unitario debe ser mayor o igual a 0'),
    body('documentType').optional().isIn(['factura', 'remision', 'orden_compra', 'nota_credito']),
    body('paymentMethod').optional().isIn(['efectivo', 'tarjeta', 'transferencia', 'credito', 'nequi', 'daviplata', 'credito_proveedor', 'mixto']),
    body('paymentStatus').optional().isIn(['pagado', 'pendiente', 'parcial']),
    body('dueDate').optional({ nullable: true }).isISO8601(),
    body('discount').optional().isFloat({ min: 0 }),
    validateRequest,
  ],
  purchasesController.create.bind(purchasesController)
);

export default router;
