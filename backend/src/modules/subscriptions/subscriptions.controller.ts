import { Request, Response } from 'express';
import { AuthRequest } from '../../common/middleware';
import * as svc from './subscriptions.service';

/** GET /api/subscriptions/config — is MP configured? */
export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const configured = await svc.isMPConfigured();
    const planIds = await svc.getPlanIds();
    const prices = await svc.getPlanPrices();
    res.json({ success: true, data: { configured, planIds, prices } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/** POST /api/subscriptions/sync-plans — superadmin creates/recreates MP plans */
export async function syncPlans(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo el superadmin puede sincronizar planes' });
      return;
    }
    const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';
    const planIds = await svc.syncPlans(origin);
    res.json({ success: true, data: planIds, message: 'Planes sincronizados correctamente con MercadoPago' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

/** POST /api/subscriptions/subscribe — comerciante inicia suscripción */
export async function subscribe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { plan } = req.body as { plan: svc.PlanKey };
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(400).json({ success: false, error: 'No tienes un negocio asociado' });
      return;
    }
    if (!['basico', 'profesional', 'empresarial'].includes(plan)) {
      res.status(400).json({ success: false, error: 'Plan inválido' });
      return;
    }

    const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';
    const result = await svc.createSubscription(tenantId, plan, origin);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

/** POST /api/subscriptions/webhook — MercadoPago webhook */
export async function webhook(req: Request, res: Response): Promise<void> {
  try {
    await svc.handleWebhook(req.body);
    res.json({ success: true });
  } catch (err: any) {
    // Always 200 so MP doesn't retry
    console.error('[Subscriptions Webhook]', err.message);
    res.json({ success: false, error: err.message });
  }
}
