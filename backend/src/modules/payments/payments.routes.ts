/**
 * payments.routes — Endpoints de la pasarela Wompi (Fase 1: plataforma).
 *   - GET/PUT /superadmin/gateway  → config de llaves (solo superadmin, cifradas)
 *   - POST   /checkout             → crea transacción Web Checkout (comercio autenticado)
 *   - POST   /wompi/webhook        → confirmación de Wompi (SIN auth, firma verificada)
 *   - GET    /transaction/:ref     → estado de una transacción
 */
import { Router, Request, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import * as svc from './payments.service';

const router: ReturnType<typeof Router> = Router();

const fail = (res: Response, e: any, msg: string) => {
  const code = e?.statusCode || 500;
  if (code === 500) console.error(`${msg}:`, e);
  res.status(code).json({ success: false, error: e?.message || msg });
};

const SUPERADMIN = [authenticate, authorize('superadmin')];

// ── Config de llaves de plataforma (superadmin) ──
router.get('/superadmin/gateway', SUPERADMIN, async (_req: AuthRequest, res: Response) => {
  try { res.json({ success: true, data: await svc.getPlatformGatewayPublic() }); }
  catch (e) { fail(res, e, 'Error al leer la configuración de pagos'); }
});

router.put('/superadmin/gateway', SUPERADMIN, async (req: AuthRequest, res: Response) => {
  try {
    const { environment, publicKey, privateKey, integritySecret, eventsSecret, isActive } = req.body || {};
    const data = await svc.savePlatformGateway({ environment, publicKey, privateKey, integritySecret, eventsSecret, isActive });
    res.json({ success: true, data });
  } catch (e) { fail(res, e, 'Error al guardar la configuración de pagos'); }
});

// ── Crear checkout (comercio autenticado paga suscripción / paquete) ──
// NOTA: el monto debe resolverse en el servidor desde el contexto (precio del plan/paquete)
// cuando se cablee el modelo de suscripciones. Por ahora se acepta amountInCents del request.
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { context, contextId, amountInCents, currency, redirectUrl, customerEmail } = req.body || {};
    if (!['subscription', 'package', 'order'].includes(context)) {
      res.status(400).json({ success: false, error: 'context inválido' });
      return;
    }
    const out = await svc.createCheckout({
      context,
      contextId: contextId ?? null,
      tenantId: req.user?.tenantId ?? null,
      amountInCents: Number(amountInCents),
      currency,
      redirectUrl,
      customerEmail: customerEmail || undefined,
    });
    res.json({ success: true, data: out });
  } catch (e) { fail(res, e, 'Error al crear el checkout'); }
});

// ── Webhook de Wompi (SIN auth; se valida la firma del evento) ──
router.post('/wompi/webhook', async (req: Request, res: Response) => {
  try {
    const result = await svc.handleWebhook(req.body);
    // Responder 200 siempre para no provocar reintentos infinitos de eventos forjados/ya procesados.
    res.status(200).json({ success: result.ok, ...result });
  } catch (e) {
    console.error('Error en webhook Wompi:', e);
    res.status(200).json({ success: false });
  }
});

// ── Disponibilidad pública (storefront) ──
router.get('/public/availability', async (_req: Request, res: Response) => {
  try { res.json({ success: true, data: await svc.getPublicAvailability() }); }
  catch { res.json({ success: true, data: { wompi: false } }); }
});

// ── Estado de una transacción ──
router.get('/transaction/:reference', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const txn = await svc.getTransaction(req.params.reference);
    if (!txn) { res.status(404).json({ success: false, error: 'Transacción no encontrada' }); return; }
    res.json({ success: true, data: txn });
  } catch (e) { fail(res, e, 'Error al consultar la transacción'); }
});

export default router;
