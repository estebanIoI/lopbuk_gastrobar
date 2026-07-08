import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import { authenticate, authorize } from '../../common/middleware';
import pickingService from './picking.service';
import { emitOps } from '../fleet/logistics.routes';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
// Bodega + operación: auxiliares preparan, despachador/comerciante gestionan
router.use(authorize('comerciante', 'despachador', 'auxiliar_bodega', 'vendedor'));

const tenantOf = (req: Request) => (req as any).user!.tenantId! as string;
const userOf = (req: Request) => (req as any).user!.userId as string;

// GET /api/picking/board?sedeId= — cola de bodega (pendientes / en preparación / preparadas hoy)
router.get('/board', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await pickingService.board(tenantOf(req), req.query.sedeId as string | undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/picking/productivity?days=30 — ranking de auxiliares
router.get('/productivity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const data = await pickingService.productivity(tenantOf(req), days);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/picking/tasks — crear tarea para un pedido
router.post(
  '/tasks',
  [body('orderId').notEmpty(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = tenantOf(req);
      const data = await pickingService.createTask(tenantId, req.body.orderId);
      emitOps(tenantId, 'picking-changed', { kind: 'task-created', taskId: data.id });
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/picking/tasks/generate-pending — 1 clic: tareas para todos los pedidos confirmados sin tarea
router.post('/tasks/generate-pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantOf(req);
    const data = await pickingService.generatePending(tenantId);
    if (data.created > 0) emitOps(tenantId, 'picking-changed', { kind: 'generated', count: data.created });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PATCH /api/picking/tasks/:id/take — el auxiliar toma la tarea
router.patch(
  '/tasks/:id/take',
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = tenantOf(req);
      const data = await pickingService.take(tenantId, req.params.id, userOf(req));
      emitOps(tenantId, 'picking-changed', { kind: 'task-taken', taskId: req.params.id });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// PATCH /api/picking/tasks/:id/complete — preparada (lista para cargar)
router.patch(
  '/tasks/:id/complete',
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = tenantOf(req);
      const data = await pickingService.complete(tenantId, req.params.id, userOf(req));
      emitOps(tenantId, 'picking-changed', { kind: 'task-completed', taskId: req.params.id });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// PATCH /api/picking/tasks/:id/cancel
router.patch(
  '/tasks/:id/cancel',
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = tenantOf(req);
      const data = await pickingService.cancel(tenantId, req.params.id);
      emitOps(tenantId, 'picking-changed', { kind: 'task-cancelled', taskId: req.params.id });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

export default router;
