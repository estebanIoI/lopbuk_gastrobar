/**
 * payments/routes.ts
 * Endpoints REST del dominio Pagos del Gimnasio.
 *  - POST   /gym/payments                      → registrar pago
 *  - GET    /gym/payments                      → listar (con filtros)
 *  - GET    /gym/payments/:id                  → detalle
 *  - PATCH  /gym/payments/:id/void             → anular
 *  - PATCH  /gym/payments/:id/refund           → reembolsar
 *  - POST   /gym/debts/generate                → job: regenerar deudas desde morosos
 *  - GET    /gym/debts                         → listar deudas
 *  - PATCH  /gym/debts/:id/pay                 → pagar deuda (parcial/total)
 *  - PATCH  /gym/debts/:id/waive               → condonar
 *  - GET    /gym/billing/summary               → KPIs financieros
 *  - GET    /gym/billing/revenue               → ingresos por período
 *  - GET    /gym/billing/overdue               → lista de morosos
 */
import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../../../common/middleware';
import * as svc from './service';

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);
// Asegurar que las tablas existen (CREATE TABLE IF NOT EXISTS — idempotente).
// Solo en la primera request: flag interno en el service.
router.use(async (_req, _res, next) => { await svc.ensurePaymentsTables(); next(); });

const STAFF = authorize('comerciante', 'administrador_rb');

const ok = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, e: unknown, msg: string) => {
  const err = e as { statusCode?: number; message?: string };
  const code = err?.statusCode || 500;
  if (code === 500) console.error(`${msg}:`, e);
  res.status(code).json({ success: false, error: err?.message || msg });
};
const tid = (req: AuthRequest) => req.user!.tenantId as string;

// ─── PAGOS ────────────────────────────────────────────────────────

router.post('/payments', STAFF, async (req: AuthRequest, res) => {
  try {
    const r = await svc.registerPayment(tid(req), req.body, req.user!.userId);
    ok(res, r);
  } catch (e) { fail(res, e, 'Error al registrar el pago'); }
});

router.get('/payments', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.listPayments(tid(req), req.query));
  } catch (e) { fail(res, e, 'Error al listar pagos'); }
});

router.get('/payments/:id', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.getPayment(tid(req), req.params.id));
  } catch (e) { fail(res, e, 'Error al obtener el pago'); }
});

router.patch('/payments/:id/void', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.voidPayment(tid(req), req.params.id, req.body, req.user!.userId));
  } catch (e) { fail(res, e, 'Error al anular el pago'); }
});

router.patch('/payments/:id/refund', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.refundPayment(tid(req), req.params.id, req.body, req.user!.userId));
  } catch (e) { fail(res, e, 'Error al reembolsar el pago'); }
});

// ─── DEUDAS ───────────────────────────────────────────────────────

router.post('/debts/generate', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.generateOverdueDebts(tid(req)));
  } catch (e) { fail(res, e, 'Error al generar deudas'); }
});

router.get('/debts', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.listDebts(tid(req), req.query));
  } catch (e) { fail(res, e, 'Error al listar deudas'); }
});

router.patch('/debts/:id/pay', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.payDebt(tid(req), req.params.id, { ...req.body, receivedBy: req.user!.userId }));
  } catch (e) { fail(res, e, 'Error al pagar la deuda'); }
});

router.patch('/debts/:id/waive', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.waiveDebt(tid(req), req.params.id, req.body));
  } catch (e) { fail(res, e, 'Error al condonar la deuda'); }
});

// ─── REPORTES / BILLING ───────────────────────────────────────────

router.get('/billing/summary', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.getBillingSummary(tid(req)));
  } catch (e) { fail(res, e, 'Error al obtener el resumen financiero'); }
});

router.get('/billing/revenue', STAFF, async (req: AuthRequest, res) => {
  try {
    const from = String(req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
    const to = String(req.query.to || new Date().toISOString().slice(0, 10));
    ok(res, await svc.getRevenueByPeriod(tid(req), from, to));
  } catch (e) { fail(res, e, 'Error al obtener los ingresos'); }
});

router.get('/billing/overdue', STAFF, async (req: AuthRequest, res) => {
  try {
    ok(res, await svc.listOverdue(tid(req)));
  } catch (e) { fail(res, e, 'Error al listar morosos'); }
});

export default router;
