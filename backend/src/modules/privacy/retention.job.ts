import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { ResultSetHeader } from 'mysql2';

/**
 * Job de retención de datos (Ley 1581: los datos no se conservan más tiempo
 * del necesario para su finalidad). Corre al boot y cada 24 horas.
 *
 * Reglas (globales, todos los tenants):
 * - chatbot_messages       > 12 meses → DELETE (conversaciones vencidas)
 * - delivery_chat_messages > 6 meses  → DELETE (coordinación de entregas vencida)
 * - GPS de pedidos ENTREGADOS > 90 días → NULL (la ubicación exacta del domicilio
 *   ya cumplió su finalidad; la dirección textual queda para reclamos/fiscal)
 */
export const RETENTION_RULES = {
  chatbotMessagesMonths: 12,
  deliveryChatMonths: 6,
  deliveredOrderGpsDays: 90,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

async function writeRetentionAudit(details: Record<string, number>): Promise<void> {
  try {
    // tenant_id NULL: corrida global de plataforma
    await db.execute(
      `INSERT INTO audit_log (id, tenant_id, action, severity, entity_type, details)
       VALUES (?, NULL, 'retention_purge', 'info', 'platform', ?)`,
      [uuidv4(), JSON.stringify(details)]
    );
  } catch (e: any) {
    console.error('[privacy] retention audit write failed:', e?.message || e);
  }
}

export async function runRetentionPurge(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const [chatRes] = await db.execute<ResultSetHeader>(
    `DELETE FROM chatbot_messages WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)`,
    [RETENTION_RULES.chatbotMessagesMonths]
  );
  counts.chatbotMessages = chatRes.affectedRows;

  const [deliveryRes] = await db.execute<ResultSetHeader>(
    `DELETE FROM delivery_chat_messages WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)`,
    [RETENTION_RULES.deliveryChatMonths]
  );
  counts.deliveryChatMessages = deliveryRes.affectedRows;

  const [gpsRes] = await db.execute<ResultSetHeader>(
    `UPDATE storefront_orders
        SET delivery_latitude = NULL, delivery_longitude = NULL
      WHERE status = 'entregado'
        AND delivery_latitude IS NOT NULL
        AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [RETENTION_RULES.deliveredOrderGpsDays]
  );
  counts.deliveredOrderGps = gpsRes.affectedRows;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total > 0) await writeRetentionAudit(counts);
  return counts;
}

/** Arranca el job: primera corrida 1 min después del boot, luego cada 24h. */
export function startRetentionJob(): void {
  const run = () =>
    runRetentionPurge()
      .then((c) => console.log('[privacy] retention purge:', JSON.stringify(c)))
      .catch((e) => console.error('[privacy] retention purge failed:', e?.message || e));

  setTimeout(run, 60_000).unref();
  setInterval(run, DAY_MS).unref();
}
