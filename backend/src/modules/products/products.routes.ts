import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { productsController } from './products.controller';
import { authenticate } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';

const PRODUCT_TYPES = ['general', 'alimentos', 'bebidas', 'ropa', 'electronica', 'farmacia', 'ferreteria', 'libreria', 'juguetes', 'cosmetica', 'perfumes', 'deportes', 'hogar', 'mascotas', 'otros'];

const router: ReturnType<typeof Router> = Router();

// Todas las rutas requieren autenticacion
router.use(authenticate);

// GET /api/products
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Pagina invalida'),
    query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Limite invalido'),
    query('category')
      .optional()
      .notEmpty()
      .withMessage('Categoria invalida'),
    query('productType')
      .optional()
      .isIn(PRODUCT_TYPES)
      .withMessage('Tipo de producto invalido'),
    query('stockStatus')
      .optional()
      .isIn(['suficiente', 'bajo', 'agotado'])
      .withMessage('Estado de stock invalido'),
    query('sedeId').optional().isString(),
    validateRequest,
  ],
  productsController.findAll.bind(productsController)
);

// GET /api/products/image-urls — devuelve { imageUrl, name, id } de todos los productos con imagen
// Usado por el picker de Cloudinary para marcar qué imágenes ya están en inventario
router.get('/image-urls', productsController.getImageUrls.bind(productsController));

// GET /api/products/low-stock
router.get('/low-stock', productsController.getLowStock.bind(productsController));

// GET /api/products/out-of-stock
router.get('/out-of-stock', productsController.getOutOfStock.bind(productsController));

// GET /api/products/export/csv
router.get('/export/csv', productsController.exportCsv.bind(productsController));

// GET /api/products/sku/:sku
router.get(
  '/sku/:sku',
  [param('sku').notEmpty().withMessage('SKU requerido'), validateRequest],
  productsController.findBySku.bind(productsController)
);

// GET /api/products/barcode/:barcode
router.get(
  '/barcode/:barcode',
  [param('barcode').notEmpty().withMessage('Código de barras requerido'), validateRequest],
  productsController.findByBarcode.bind(productsController)
);

// GET /api/products/:id
router.get(
  '/:id',
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  productsController.findById.bind(productsController)
);

// POST /api/products/bulk-with-variants — crea productos + variantes en una sola transacción
// IMPORTANTE: antes de /bulk para que Express no confunda el path
router.post(
  '/bulk-with-variants',
  [
    body('items').isArray({ min: 1, max: 100 }).withMessage('Se requiere array de 1-100 items'),
    body('items.*.product.name').notEmpty().withMessage('name requerido'),
    body('items.*.product.category').notEmpty().withMessage('category requerida'),
    body('items.*.product.sku').notEmpty().withMessage('sku requerido'),
    body('items.*.product.purchasePrice').isFloat({ min: 0 }).withMessage('purchasePrice inválido'),
    body('items.*.product.salePrice').isFloat({ min: 0 }).withMessage('salePrice inválido'),
    body('items.*.product.stock').isInt({ min: 0 }).withMessage('stock inválido'),
    body('items.*.product.reorderPoint').isInt({ min: 0 }).withMessage('reorderPoint inválido'),
    body('items.*.product.entryDate').isISO8601().withMessage('entryDate inválida'),
    body('items.*.variants').isArray().withMessage('variants debe ser array'),
    validateRequest,
  ],
  productsController.bulkCreateWithVariants.bind(productsController)
);

// POST /api/products/bulk
router.post(
  '/bulk',
  [
    body('products')
      .isArray({ min: 1, max: 500 })
      .withMessage('Se requiere un array de 1-500 productos'),
    body('products.*.name')
      .notEmpty()
      .withMessage('El nombre es requerido'),
    body('products.*.category')
      .notEmpty()
      .withMessage('La categoría es requerida'),
    body('products.*.sku')
      .notEmpty()
      .withMessage('El SKU es requerido'),
    body('products.*.purchasePrice')
      .isFloat({ min: 0 })
      .withMessage('Precio de compra inválido'),
    body('products.*.salePrice')
      .isFloat({ min: 0 })
      .withMessage('Precio de venta inválido'),
    body('products.*.stock')
      .isInt({ min: 0 })
      .withMessage('Stock inválido'),
    body('products.*.reorderPoint')
      .isInt({ min: 0 })
      .withMessage('Punto de reorden inválido'),
    body('products.*.entryDate')
      .isISO8601()
      .withMessage('Fecha de entrada inválida'),
    body('products.*.productType')
      .optional()
      .isIn(PRODUCT_TYPES)
      .withMessage('Tipo de producto inválido'),
    body('products.*.barcode')
      .optional({ values: 'falsy' })
      .trim(),
    validateRequest,
  ],
  productsController.bulkCreate.bind(productsController)
);

// POST /api/products
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('category')
      .notEmpty()
      .withMessage('Categoria invalida'),
    body('productType')
      .optional()
      .isIn(PRODUCT_TYPES)
      .withMessage('Tipo de producto invalido'),
    body('brand').optional().trim(),
    body('model').optional().trim(),
    body('description').optional().trim(),
    body('size').optional().trim(),
    body('color').optional().trim(),
    body('purchasePrice')
      .isFloat({ min: 0 })
      .withMessage('El precio de compra debe ser mayor o igual a 0'),
    body('salePrice')
      .isFloat({ min: 0 })
      .withMessage('El precio de venta debe ser mayor a 0'),
    body('sku').notEmpty().withMessage('El SKU es requerido'),
    body('barcode')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ min: 8, max: 100 })
      .withMessage('Código de barras debe tener entre 8 y 100 caracteres'),
    body('stock')
      .isInt({ min: 0 })
      .withMessage('El stock debe ser mayor o igual a 0'),
    body('reorderPoint')
      .isInt({ min: 0 })
      .withMessage('El punto de reorden debe ser mayor o igual a 0'),
    body('supplier').optional().trim(),
    body('entryDate').isISO8601().withMessage('Fecha de entrada invalida'),
    body('imageUrl').optional({ values: 'falsy' }).isURL().withMessage('URL de imagen invalida'),
    // Optional type-specific fields - just sanitize
    body('expiryDate').optional({ values: 'falsy' }).isISO8601().withMessage('Fecha de vencimiento invalida'),
    body('warrantyMonths').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Garantia invalida'),
    body('netWeight').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Peso invalido'),
    body('alcoholContent').optional({ values: 'falsy' }).isFloat({ min: 0, max: 100 }).withMessage('Grado alcoholico invalido'),
    body('pages').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Numero de paginas invalido'),
    body('publicationYear').optional({ values: 'falsy' }).isInt({ min: 1000 }).withMessage('Año de publicacion invalido'),
    body('powerWatts').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Potencia invalida'),
    body('unitsPerPackage').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Unidades por paquete invalido'),
    body('requiresPrescription').optional().isBoolean().withMessage('Valor invalido'),
    body('requiresBatteries').optional().isBoolean().withMessage('Valor invalido'),
    validateRequest,
  ],
  productsController.create.bind(productsController)
);

// PUT /api/products/bulk/preorder — Aplica pre-orden a todos o lista de productos
// IMPORTANTE: antes de /:id para que Express no lo capture como ID
router.put(
  '/bulk/preorder',
  [
    body('isPreorder').isBoolean().withMessage('isPreorder debe ser boolean'),
    body('productIds')
      .optional()
      .isArray()
      .withMessage('productIds debe ser un array'),
    body('preorderWindowEnd')
      .optional({ values: 'null' })
      .isISO8601()
      .withMessage('Fecha de cierre inválida'),
    body('preorderShipStart')
      .optional({ values: 'null' })
      .isISO8601()
      .withMessage('Fecha inicio envío inválida'),
    body('preorderShipEnd')
      .optional({ values: 'null' })
      .isISO8601()
      .withMessage('Fecha fin envío inválida'),
    body('preorderBadgeText')
      .optional()
      .isString()
      .isLength({ max: 60 })
      .withMessage('Badge máximo 60 caracteres'),
    body('preorderPolicyText').optional({ values: 'null' }).isString(),
    validateRequest,
  ],
  productsController.bulkUpdatePreorder.bind(productsController)
);

// PUT /api/products/:id
router.put(
  '/:id',
  [
    param('id').notEmpty().withMessage('ID requerido'),
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacio'),
    body('category')
      .optional()
      .notEmpty()
      .withMessage('Categoria invalida'),
    body('productType')
      .optional()
      .isIn(PRODUCT_TYPES)
      .withMessage('Tipo de producto invalido'),
    body('size').optional().trim(),
    body('barcode')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ min: 8, max: 100 })
      .withMessage('Código de barras debe tener entre 8 y 100 caracteres'),
    body('purchasePrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('El precio de compra debe ser mayor o igual a 0'),
    body('salePrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('El precio de venta debe ser mayor a 0'),
    body('stock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('El stock debe ser mayor o igual a 0'),
    body('reorderPoint')
      .optional()
      .isInt({ min: 0 })
      .withMessage('El punto de reorden debe ser mayor o igual a 0'),
    body('imageUrl').optional({ values: 'falsy' }).isURL().withMessage('URL de imagen invalida'),
    body('expiryDate').optional({ values: 'falsy' }).isISO8601().withMessage('Fecha de vencimiento invalida'),
    body('warrantyMonths').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Garantia invalida'),
    body('netWeight').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Peso invalido'),
    body('requiresPrescription').optional().isBoolean().withMessage('Valor invalido'),
    body('requiresBatteries').optional().isBoolean().withMessage('Valor invalido'),
    validateRequest,
  ],
  productsController.update.bind(productsController)
);

// PUT /api/products/:id/preorder — Configurar pre-orden de un producto
router.put(
  '/:id/preorder',
  [
    param('id').notEmpty().withMessage('ID requerido'),
    body('isPreorder').isBoolean().withMessage('isPreorder debe ser boolean'),
    body('preorderWindowEnd')
      .optional({ values: 'null' })
      .isISO8601()
      .withMessage('Fecha de cierre inválida'),
    body('preorderShipStart')
      .optional({ values: 'null' })
      .isISO8601()
      .withMessage('Fecha inicio envío inválida'),
    body('preorderShipEnd')
      .optional({ values: 'null' })
      .isISO8601()
      .withMessage('Fecha fin envío inválida'),
    body('preorderBadgeText')
      .optional()
      .isString()
      .isLength({ max: 60 })
      .withMessage('Badge máximo 60 caracteres'),
    body('preorderPolicyText').optional({ values: 'null' }).isString(),
    validateRequest,
  ],
  productsController.updatePreorder.bind(productsController)
);

// DELETE /api/products/bulk — eliminación múltiple (ANTES de /:id)
router.delete(
  '/bulk',
  [body('ids').isArray({ min: 1 }).withMessage('ids requeridos'), validateRequest],
  productsController.bulkDelete.bind(productsController)
);

// DELETE /api/products/:id
router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('ID requerido'), validateRequest],
  productsController.delete.bind(productsController)
);

export default router;
