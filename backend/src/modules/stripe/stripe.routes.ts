import { Router, raw } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import * as stripeController from './stripe.controller';

const router = Router();

// Public: Stripe webhook (raw body required for signature verification)
router.post('/webhook', raw({ type: 'application/json' }), stripeController.webhook);

// Public: Get publishable key (needed by frontend before auth)
router.get('/config', stripeController.getConfig);

// Protected: Create checkout session
router.post('/checkout', authenticate, stripeController.createCheckout);

export { router as stripeRoutes };
