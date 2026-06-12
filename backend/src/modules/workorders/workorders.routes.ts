import { Router } from 'express';
import { authenticate } from '../../common/middleware';
import { workOrdersController as c } from './workorders.controller';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

// Dashboard
router.get('/stats',                           c.stats);

// Work orders
router.get('/',                                c.list);
router.post('/',                               c.create);
router.get('/:id',                             c.getOne);
router.put('/:id',                             c.update);
router.patch('/:id/status',                    c.updateStatus);
router.delete('/:id',                          c.remove);

// Materials
router.post('/:id/materials',                  c.addMaterial);
router.delete('/:id/materials/:materialId',    c.removeMaterial);

// Payments
router.post('/:id/payments',                   c.addPayment);

export { router as workOrderRoutes };
