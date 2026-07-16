import pool from '../../config/database';

// ─── Automation Engine ────────────────────────────────────────────────────────
// Centraliza toda la lógica de disparadores (triggers) y acciones (actions).
// El scheduler de index.ts llama a engine.tick() cada 15 min.
// Nunca se lanza al flujo origen (defensivo).

type TriggerEvaluator = (tenantId: string, automation: any) => Promise<any[]>;
type ActionExecutor = (tenantId: string, accountId: string | null, config: any) => Promise<void>;

const triggerEvaluators = new Map<string, TriggerEvaluator>();
const actionExecutors = new Map<string, ActionExecutor>();

// ─── Trigger Evaluators ──────────────────────────────────────────────────────

triggerEvaluators.set('time_of_day', async (tenantId, automation) => {
  const cfg = typeof automation.trigger_config === 'string'
    ? JSON.parse(automation.trigger_config)
    : (automation.trigger_config || {});
  const scheduledTime = cfg?.time || '';
  const now = new Date();
  const currentHour = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (!scheduledTime || Math.abs(timeToMinutes(scheduledTime) - timeToMinutes(currentHour)) > 15) return [];

  const [rows] = (await pool.query(
    'SELECT id FROM loyalty_accounts WHERE tenant_id = ? LIMIT 500', [tenantId],
  )) as any;
  return rows;
});

triggerEvaluators.set('inactive_7d', async (tenantId) => {
  const [rows] = (await pool.query(
    'SELECT id FROM loyalty_accounts WHERE tenant_id = ? AND last_visit < DATE_SUB(NOW(), INTERVAL 7 DAY) AND last_visit > DATE_SUB(NOW(), INTERVAL 30 DAY) LIMIT 500',
    [tenantId],
  )) as any;
  return rows;
});

triggerEvaluators.set('inactive_30d', async (tenantId) => {
  const [rows] = (await pool.query(
    'SELECT id FROM loyalty_accounts WHERE tenant_id = ? AND (last_visit IS NULL OR last_visit < DATE_SUB(NOW(), INTERVAL 30 DAY)) LIMIT 500',
    [tenantId],
  )) as any;
  return rows;
});

triggerEvaluators.set('birthday', async (tenantId) => {
  const [rows] = (await pool.query(
    "SELECT id FROM loyalty_accounts WHERE tenant_id = ? AND MONTH(birthday) = MONTH(CURDATE()) AND DAY(birthday) = DAY(CURDATE()) LIMIT 500",
    [tenantId],
  )) as any;
  return rows;
});

triggerEvaluators.set('near_reward', async (tenantId) => {
  const [rows] = (await pool.query(
    `SELECT la.id FROM loyalty_accounts la
     JOIN loyalty_rewards lr ON lr.tenant_id = la.tenant_id AND lr.is_active = 1
     WHERE la.tenant_id = ? AND la.points_balance >= (lr.points_cost * 0.9) AND la.points_balance < lr.points_cost
     LIMIT 500`,
    [tenantId],
  )) as any;
  return rows;
});

// ─── Action Executors ────────────────────────────────────────────────────────

actionExecutors.set('push', async (tenantId, accountId, config) => {
  if (!accountId) return;
  try {
    const { pushService } = await import('../push/push.service');
    const [users] = (await pool.query(
      'SELECT u.id FROM users u JOIN loyalty_accounts la ON u.phone = la.customer_phone WHERE la.id = ? LIMIT 1',
      [accountId],
    )) as any;
    if (users[0]) {
      await pushService.sendToUser(users[0].id, {
        title: config.title || 'Lopbuk',
        body: config.body || 'Tienes una novedad',
        url: config.url,
      });
    }
  } catch { /* defensive */ }
});

actionExecutors.set('notification', async (tenantId, _accountId, config) => {
  try {
    const { createNotification } = await import('../notifications/notifications.routes');
    await createNotification(tenantId, {
      type: 'engagement',
      title: config.title || 'Automatización',
      body: config.body,
      link: config.link,
    });
  } catch { /* defensive */ }
});

actionExecutors.set('whatsapp', async (tenantId, accountId, config) => {
  if (!accountId) return;
  try {
    const [acct] = (await pool.query(
      'SELECT customer_phone FROM loyalty_accounts WHERE id = ?', [accountId],
    )) as any;
    if (!acct[0]) return;
    const { sendMarketingMessage } = await import('../whatsapp/whatsapp.service');
    const [whatsappCfg] = (await pool.query(
      'SELECT instance_name FROM whatsapp_instances WHERE tenant_id = ? LIMIT 1', [tenantId],
    )) as any;
    if (whatsappCfg[0]) {
      await sendMarketingMessage(tenantId, whatsappCfg[0].instance_name, acct[0].customer_phone, config.body || '');
    }
  } catch { /* defensive */ }
});

actionExecutors.set('wallet_update', async (tenantId, accountId) => {
  if (!accountId) return;
  try {
    const { syncPassAfterEarn } = await import('./customer-engagement.service');
    await syncPassAfterEarn(tenantId, accountId);
  } catch { /* defensive */ }
});

// ─── Engine API ──────────────────────────────────────────────────────────────

export async function tick(): Promise<void> {
  // 1. Get all active automations
  const [automations] = (await pool.query(
    'SELECT * FROM engagement_automations WHERE is_active = 1',
  )) as any;

  // 2. Group by tenant + trigger type
  const byTrigger = new Map<string, any[]>();
  for (const auto of automations) {
    const key = auto.trigger_type;
    if (!byTrigger.has(key)) byTrigger.set(key, []);
    byTrigger.get(key)!.push(auto);
  }

  // 3. For each trigger type, evaluate + execute
  for (const [triggerType, autos] of byTrigger) {
    const evaluator = triggerEvaluators.get(triggerType);
    if (!evaluator) continue;

    for (const auto of autos) {
      try {
        const customers = await evaluator(auto.tenant_id, auto);
        if (!customers.length) continue;

        const actionCfg = typeof auto.action_config === 'string'
          ? JSON.parse(auto.action_config)
          : (auto.action_config || {});
        const executor = actionExecutors.get(auto.action_type);
        if (!executor) continue;

        for (const cust of customers) {
          await executor(auto.tenant_id, cust.id, actionCfg);
        }
      } catch { /* defensive */ }
    }
  }
}

export async function runEventAutomations(tenantId: string, accountId: string | null, eventType: string): Promise<void> {
  const [rows] = (await pool.query(
    'SELECT * FROM engagement_automations WHERE tenant_id = ? AND trigger_type = ? AND is_active = 1',
    [tenantId, eventType],
  )) as any;

  for (const auto of rows) {
    const actionCfg = typeof auto.action_config === 'string'
      ? JSON.parse(auto.action_config)
      : (auto.action_config || {});
    const executor = actionExecutors.get(auto.action_type);
    if (executor) {
      await executor(tenantId, accountId, actionCfg).catch(() => {});
    }
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
