import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { UserRole } from '../../common/types';
import * as ctl from './customer-engagement.controller';

const router = Router();
const ADMIN: UserRole[] = ['superadmin', 'comerciante', 'administrador_rb', 'cajero'];

// ─── PUBLIC (no auth) ───
router.post('/register', ctl.publicRegister);
router.get('/lookup', ctl.publicLookup);

// ─── CLIENT (authenticated) ───
router.get('/me/wallet', authenticate, ctl.getMyWallet);
router.post('/me/pass', authenticate, ctl.getWalletPass);
router.post('/me/location', authenticate, ctl.reportLocation);
router.post('/me/redeem', authenticate, ctl.redeemReward);
// ConsumerOS: todas mis tarjetas (multi-comercio) + vincular mi teléfono
router.get('/my-cards', authenticate, ctl.getMyCards);
router.post('/me/phone', authenticate, ctl.setMyPhone);

// ─── ADMIN ───
router.get('/customers', authenticate, authorize(...ADMIN), ctl.getCustomers);
router.get('/customers/:id', authenticate, authorize(...ADMIN), ctl.getCustomerDetail);
router.get('/customers/:id/360', authenticate, authorize(...ADMIN), ctl.getCustomer360);
router.get('/customers/:id/timeline', authenticate, authorize(...ADMIN), ctl.getCustomerTimeline);
router.post('/customers/:id/notes', authenticate, authorize(...ADMIN), ctl.addCustomerNote);
router.get('/config', authenticate, authorize(...ADMIN), ctl.getConfig);
router.put('/config', authenticate, authorize(...ADMIN), ctl.updateConfig);
router.get('/rewards', authenticate, authorize(...ADMIN), ctl.getRewards);
router.get('/campaigns', authenticate, authorize(...ADMIN), ctl.getCampaigns);
router.post('/campaigns', authenticate, authorize(...ADMIN), ctl.createCampaign);
router.get('/segments', authenticate, authorize(...ADMIN), ctl.getSegments);
router.post('/segments', authenticate, authorize(...ADMIN), ctl.createSegment);
router.get('/automations', authenticate, authorize(...ADMIN), ctl.getAutomations);
router.post('/automations', authenticate, authorize(...ADMIN), ctl.createAutomation);
router.patch('/automations/:id', authenticate, authorize(...ADMIN), ctl.updateAutomation);
router.delete('/automations/:id', authenticate, authorize(...ADMIN), ctl.deleteAutomation);
router.get('/analytics', authenticate, authorize(...ADMIN), ctl.getAnalytics);
router.get('/live-activity', authenticate, authorize(...ADMIN), ctl.getLiveActivity);
router.get('/ai-insights', authenticate, authorize(...ADMIN), ctl.getAIInsights);
router.get('/revenue-attribution', authenticate, authorize(...ADMIN), ctl.getRevenueAttribution);
router.post('/copilot', authenticate, authorize(...ADMIN), ctl.copilotChat);
router.get('/me/streak', authenticate, ctl.getStreak);
router.post('/me/daily-reward', authenticate, ctl.claimDailyReward);
router.post('/segments/recompute', authenticate, authorize(...ADMIN), ctl.recomputeSegments);

export default router;
