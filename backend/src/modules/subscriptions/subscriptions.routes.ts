import { Router } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import * as ctrl from './subscriptions.controller';

const router = Router();

// Public: MP sends webhooks here
router.post('/webhook', ctrl.webhook);

// Public: check if MP is configured & plan IDs exist
router.get('/config', ctrl.getConfig);

// Protected (superadmin): create/recreate MP subscription plans
router.post('/sync-plans', authenticate, ctrl.syncPlans);

// Protected (comerciante): start subscription checkout
router.post('/subscribe', authenticate, ctrl.subscribe);

export { router as subscriptionsRoutes };
