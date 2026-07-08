import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import { authenticate, authorize } from '../../common/middleware';
import opsTimeline from './ops-timeline.service';
import executive from './executive.service';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(authorize('comerciante', 'despachador', 'auxiliar_bodega', 'superadmin'));

const tenantOf = (req: Request) => (req as any).user!.tenantId! as string;
const userOf = (req: Request) => (req as any).user!.userId as string;

// ── Dashboard Gerencial (F6) ──────────────────────────────────────────────────

// GET /api/ops/executive-dashboard — la pantalla única del gerente (un payload)
router.get('/executive-dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await executive.dashboard(tenantOf(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/ops/sales-heatmap?days=30 — zonas que más compran (rutas + expansión)
router.get('/sales-heatmap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const data = await executive.salesHeatmap(tenantOf(req), days);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/ops/purchase-suggestions — qué pedir antes de que se agote
router.get('/purchase-suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await executive.purchaseSuggestions(tenantOf(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/ops/stage-analytics?days=30&sedeId= — tiempos por etapa + cuello de botella
router.get('/stage-analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const data = await opsTimeline.stageAnalytics(tenantOf(req), days, req.query.sedeId as string | undefined);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/ops/at-risk — pedidos en riesgo de incumplir la promesa de entrega
router.get('/at-risk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await opsTimeline.atRisk(tenantOf(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/ops/orders/:id/timeline — línea de tiempo de un pedido
router.get('/orders/:id/timeline', [param('id').notEmpty(), validateRequest], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await opsTimeline.orderTimeline(tenantOf(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PATCH /api/ops/orders/:id/promise — fija la promesa de entrega
router.patch(
  '/orders/:id/promise',
  [param('id').notEmpty(), body('promisedAt').optional({ nullable: true }).isString(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await opsTimeline.setPromise(tenantOf(req), req.params.id, req.body.promisedAt || null);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/ops/recent-purchases — compras recientes con estado de recepción
router.get('/recent-purchases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await opsTimeline.recentPurchases(tenantOf(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/ops/reception-analytics?days=90 — tiempo de recepción por proveedor
router.get('/reception-analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 90));
    const data = await opsTimeline.receptionAnalytics(tenantOf(req), days);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/ops/purchases/:id/arrival — marca la llegada + bodega destino (opcional)
router.post(
  '/purchases/:id/arrival',
  [param('id').notEmpty(), body('sedeId').optional({ nullable: true }).isString(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await opsTimeline.markArrival(
        tenantOf(req), req.params.id,
        req.body.sedeId !== undefined ? (req.body.sedeId || null) : undefined
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/ops/purchases/:id/received — marca recibida/almacenada
router.post('/purchases/:id/received', [param('id').notEmpty(), validateRequest], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await opsTimeline.markReceived(tenantOf(req), req.params.id, userOf(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
