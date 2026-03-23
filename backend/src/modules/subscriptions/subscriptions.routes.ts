import { Router } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import * as ctrl from './subscriptions.controller';
import { reconcileSubscriptions } from './subscriptions.service';

const router = Router();

// Public: MP sends webhooks here
router.post('/webhook', ctrl.webhook);

// Public: check if MP is configured & plan IDs exist
router.get('/config', ctrl.getConfig);

// Protected (superadmin): create/recreate MP subscription plans
router.post('/sync-plans', authenticate, ctrl.syncPlans);

// Protected (comerciante): start subscription checkout
router.post('/subscribe', authenticate, ctrl.subscribe);

// ── Daily reconciliation job ──────────────────────────────────────────────────
// Runs once per day to catch any missed webhooks and downgrade stale paid plans
const RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function scheduleReconciliation() {
  setTimeout(async () => {
    try {
      await reconcileSubscriptions();
    } catch { /* errors are handled inside the function */ }
    scheduleReconciliation(); // reschedule for next day
  }, RECONCILE_INTERVAL_MS);
}

scheduleReconciliation();

export { router as subscriptionsRoutes };
