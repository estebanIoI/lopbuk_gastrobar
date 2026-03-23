import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware';
import * as stripeService from './stripe.service';

export async function createCheckout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { plan } = req.body as { plan: 'basico' | 'profesional' | 'empresarial' };
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(400).json({ success: false, error: 'No tienes un tenant asociado' });
      return;
    }

    if (!['basico', 'profesional', 'empresarial'].includes(plan)) {
      res.status(400).json({ success: false, error: 'Plan inválido' });
      return;
    }

    const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';
    const result = await stripeService.createCheckoutSession(
      tenantId,
      plan,
      `${origin}?checkout=success&plan=${plan}`,
      `${origin}?checkout=cancelled`
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Error al crear sesión de pago' });
  }
}

export async function webhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;
  try {
    await stripeService.handleWebhook(req.body as Buffer, signature);
    res.json({ received: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const publishableKey = await stripeService.getStripePublishableKey();
    res.json({ success: true, data: { publishableKey } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
