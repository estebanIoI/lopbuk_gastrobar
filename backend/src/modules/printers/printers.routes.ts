import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../../common/middleware';
import { printersController } from './printers.controller';

const router: ReturnType<typeof Router> = Router();

// All printer routes require authentication and comerciante/superadmin role
router.use(authenticate);
router.use(authorize('comerciante', 'superadmin'));

// GET /api/printers
router.get('/', printersController.findAll.bind(printersController));

// GET /api/printers/:id
router.get('/:id',
  param('id').isUUID(),
  printersController.findById.bind(printersController)
);

// POST /api/printers
router.post('/',
  [
    body('name').notEmpty().trim().withMessage('El nombre es requerido'),
    body('connectionType').isIn(['lan', 'usb', 'bluetooth']).withMessage('Tipo de conexión inválido'),
    body('ip').optional({ nullable: true }).isIP().withMessage('IP inválida'),
    body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Puerto inválido'),
    body('paperWidth').optional().isIn([58, 80]).withMessage('Ancho de papel debe ser 58 o 80'),
    body('assignedModule').optional({ nullable: true }).isIn(['caja', 'cocina', 'bar', 'factura']),
  ],
  printersController.create.bind(printersController)
);

// PUT /api/printers/:id
router.put('/:id',
  [
    param('id').isUUID(),
    body('name').optional().notEmpty().trim(),
    body('connectionType').optional().isIn(['lan', 'usb', 'bluetooth']),
    body('ip').optional({ nullable: true }).isIP(),
    body('port').optional().isInt({ min: 1, max: 65535 }),
    body('paperWidth').optional().isIn([58, 80]),
    body('isActive').optional().isBoolean(),
    body('assignedModule').optional({ nullable: true }).isIn(['caja', 'cocina', 'bar', 'factura', null]),
  ],
  printersController.update.bind(printersController)
);

// DELETE /api/printers/:id
router.delete('/:id',
  param('id').isUUID(),
  printersController.delete.bind(printersController)
);

// POST /api/printers/:id/test
router.post('/:id/test',
  param('id').isUUID(),
  printersController.testPrint.bind(printersController)
);

// POST /api/printers/:id/print-ticket
router.post('/:id/print-ticket',
  param('id').isUUID(),
  body('ticket').notEmpty().withMessage('Los datos del ticket son requeridos'),
  printersController.printTicket.bind(printersController)
);

// POST /api/printers/module/:module/print-ticket  (impresión automática por módulo)
router.post('/module/:module/print-ticket',
  param('module').isIn(['caja', 'cocina', 'bar', 'factura']),
  body('ticket').notEmpty(),
  printersController.printTicketByModule.bind(printersController)
);

export { router as printersRoutes };
