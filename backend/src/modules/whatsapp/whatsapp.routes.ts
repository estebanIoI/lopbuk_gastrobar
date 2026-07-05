/**
 * whatsapp.routes.ts
 * Webhook receiver + merchant management endpoints for WhatsApp via Evolution API.
 *
 * Public:
 *   POST /api/whatsapp/webhook/:tenantSlug  — Evolution API event hook
 *
 * Authenticated (merchant):
 *   GET    /api/whatsapp/status             — connection state
 *   POST   /api/whatsapp/connect            — create instance & get QR
 *   DELETE /api/whatsapp/disconnect         — delete instance
 *   GET    /api/whatsapp/qr                 — refresh QR code
 */

import { Router, Request, Response } from 'express';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';
import { v4 as uuidv4 } from 'uuid';
import {
  getOrCreateSession,
  isHumanTakeover,
  saveMessage,
  processAgentMessage,
} from '../agent/agent.service';
import {
  sendTextMessage,
  getInstanceStatus,
  getQRCode,
  createInstance,
  deleteInstance,
  setWebhook,
} from './whatsapp.service';

const router: ReturnType<typeof Router> = Router();

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function phoneFromJid(remoteJid: string): string {
  // "5511999999999@s.whatsapp.net" → "5511999999999"
  return remoteJid.split('@')[0];
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: Webhook
// POST /api/whatsapp/webhook/:tenantSlug
// ─────────────────────────────────────────────────────────────
router.post('/webhook/:tenantSlug', async (req: Request, res: Response) => {
  // Acknowledge immediately so Evolution API does not retry
  res.status(200).json({ received: true });

  try {
    const { tenantSlug } = req.params;
    const payload        = req.body;

    // Only process incoming user messages
    const event = payload?.event as string | undefined;
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') return;

    const msgData = payload?.data;
    if (!msgData) return;

    // Skip outbound messages
    if (msgData?.key?.fromMe) return;

    const remoteJid    = msgData?.key?.remoteJid as string | undefined;
    const messageText  = (
      msgData?.message?.conversation ||
      msgData?.message?.extendedTextMessage?.text ||
      ''
    ).trim() as string;
    const senderName   = (msgData?.pushName || '') as string;

    if (!remoteJid || !messageText) return;

    const phoneNumber = phoneFromJid(remoteJid);

    // Resolve tenant
    const [tenants] = await pool.query(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
      [tenantSlug]
    ) as any;
    if (!tenants?.length) return;
    const tenantId = tenants[0].id;

    // Check chatbot + WhatsApp enabled
    const [cfgRows] = await pool.query(
      `SELECT * FROM chatbot_config WHERE tenant_id = ? AND is_enabled = 1 LIMIT 1`,
      [tenantId]
    ) as any;
    if (!cfgRows?.length) return;
    const config = cfgRows[0];

    // Optional: check whatsapp_enabled flag if column exists
    if (config.whatsapp_enabled === 0) return;

    // ── Opt-out de marketing (Ley 1581: revocación de la autorización) ──
    // Palabras clave estándar: el cliente deja de recibir mensajes promocionales.
    const normalized = messageText.toUpperCase().replace(/[¡!.,]/g, '').trim();
    if (['BAJA', 'STOP', 'NO MAS', 'NO MÁS', 'CANCELAR SUSCRIPCION', 'CANCELAR SUSCRIPCIÓN', 'UNSUBSCRIBE'].includes(normalized)) {
      const { privacyService } = await import('../privacy/privacy.service');
      await privacyService.recordConsent({
        tenantId,
        subjectType: 'chat_contact',
        identifier: phoneNumber,
        consentType: 'marketing_whatsapp',
        granted: false,
        source: 'whatsapp',
      }).catch(() => {/* la revocación no debe romper el webhook */});
      const optOutInstance = config.evolution_instance as string | null;
      if (optOutInstance) {
        await sendTextMessage(
          optOutInstance,
          phoneNumber,
          '✅ Listo. No volverás a recibir mensajes promocionales nuestros. Si necesitas ayuda con un pedido, escríbenos cuando quieras.'
        ).catch(() => {});
      }
      return;
    }

    // Session keyed by phone number (stable across conversations)
    const sessionToken = `wa:${phoneNumber}`;
    const sessionId    = await getOrCreateSession(sessionToken, tenantId, {
      customerName:  senderName || undefined,
      customerPhone: phoneNumber,
    });

    if (await isHumanTakeover(sessionId)) return;

    await saveMessage(sessionId, tenantId, 'user', messageText);

    const { reply } = await processAgentMessage(tenantId, sessionId, messageText, config);

    await saveMessage(sessionId, tenantId, 'assistant', reply);

    // Send reply back via Evolution API
    const instanceName = config.evolution_instance as string | null;
    if (instanceName) {
      await sendTextMessage(instanceName, phoneNumber, reply);
    }
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
  }
});

// ─────────────────────────────────────────────────────────────
// MERCHANT: GET connection status
// GET /api/whatsapp/status
// ─────────────────────────────────────────────────────────────
router.get('/status', authenticate, async (req: Request, res: Response) => {
  if (!process.env.EVOLUTION_API_URL) {
    res.json({ success: true, data: { connected: false, state: 'not_configured', evolutionConfigured: false } });
    return;
  }

  try {
    const tenantId = (req as any).user.tenantId;

    const [cfgRows] = await pool.query(
      'SELECT whatsapp_enabled, whatsapp_number, evolution_instance FROM chatbot_config WHERE tenant_id = ? LIMIT 1',
      [tenantId]
    ) as any;
    const cfg = cfgRows?.[0];

    if (!cfg?.evolution_instance) {
      res.json({ success: true, data: { connected: false, state: 'not_configured' } });
      return;
    }

    const status = await getInstanceStatus(cfg.evolution_instance);

    res.json({
      success: true,
      data: {
        connected:        status.state === 'open',
        state:            status.state,
        whatsappNumber:   cfg.whatsapp_number  || null,
        evolutionInstance: cfg.evolution_instance,
      },
    });
  } catch (error) {
    console.error('WhatsApp status error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estado de WhatsApp' });
  }
});

// ─────────────────────────────────────────────────────────────
// MERCHANT: Connect (create instance + get QR)
// POST /api/whatsapp/connect
// Body: { whatsappNumber? }
// ─────────────────────────────────────────────────────────────
router.post('/connect', authenticate, async (req: Request, res: Response) => {
  if (!process.env.EVOLUTION_API_URL) {
    res.status(503).json({
      success: false,
      error: 'Evolution API no configurado. Agrega EVOLUTION_API_URL y EVOLUTION_API_KEY en las variables de entorno del servidor.',
    });
    return;
  }

  try {
    const tenantId      = (req as any).user.tenantId;
    const { whatsappNumber } = req.body;

    // Derive a stable instance name from tenantId
    const instanceName = `lopbuk-${tenantId.slice(0, 8)}`;

    const { qrcode } = await createInstance(instanceName);

    // Register webhook on the instance pointing back to this API
    const apiUrl     = process.env.API_BASE_URL || '';
    const tenantSlug = await getTenantSlug(tenantId);
    if (apiUrl && tenantSlug) {
      const webhookUrl = `${apiUrl}/api/whatsapp/webhook/${tenantSlug}`;
      await setWebhook(instanceName, webhookUrl).catch(() => {/* non-fatal */});
    }

    // Persist instance name (and optional phone) in chatbot_config
    await pool.query(
      `UPDATE chatbot_config
       SET evolution_instance = ?,
           whatsapp_number    = COALESCE(?, whatsapp_number),
           whatsapp_enabled   = 1
       WHERE tenant_id = ?`,
      [instanceName, whatsappNumber || null, tenantId]
    );

    res.json({ success: true, data: { instanceName, qrcode } });
  } catch (error) {
    console.error('WhatsApp connect error:', error);
    res.status(500).json({ success: false, error: 'Error al iniciar conexión con WhatsApp' });
  }
});

// ─────────────────────────────────────────────────────────────
// MERCHANT: Get fresh QR code
// GET /api/whatsapp/qr
// ─────────────────────────────────────────────────────────────
router.get('/qr', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const [cfgRows] = await pool.query(
      'SELECT evolution_instance FROM chatbot_config WHERE tenant_id = ? LIMIT 1',
      [tenantId]
    ) as any;
    const instanceName = cfgRows?.[0]?.evolution_instance;

    if (!instanceName) {
      res.status(404).json({ success: false, error: 'Instancia no configurada. Usa /connect primero.' });
      return;
    }

    const qrcode = await getQRCode(instanceName);
    res.json({ success: true, data: { qrcode } });
  } catch (error) {
    console.error('WhatsApp QR error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener QR' });
  }
});

// ─────────────────────────────────────────────────────────────
// MERCHANT: Disconnect
// DELETE /api/whatsapp/disconnect
// ─────────────────────────────────────────────────────────────
router.delete('/disconnect', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const [cfgRows] = await pool.query(
      'SELECT evolution_instance FROM chatbot_config WHERE tenant_id = ? LIMIT 1',
      [tenantId]
    ) as any;
    const instanceName = cfgRows?.[0]?.evolution_instance;

    if (instanceName) {
      await deleteInstance(instanceName).catch(() => {/* silent if already gone */});
    }

    await pool.query(
      `UPDATE chatbot_config
       SET evolution_instance = NULL,
           whatsapp_enabled   = 0
       WHERE tenant_id = ?`,
      [tenantId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('WhatsApp disconnect error:', error);
    res.status(500).json({ success: false, error: 'Error al desconectar WhatsApp' });
  }
});

// ─────────────────────────────────────────────────────────────
// Internal helper
// ─────────────────────────────────────────────────────────────

async function getTenantSlug(tenantId: string): Promise<string | null> {
  const [rows] = await pool.query(
    'SELECT slug FROM tenants WHERE id = ? LIMIT 1',
    [tenantId]
  ) as any;
  return rows?.[0]?.slug || null;
}

// Generate a new session token for the WhatsApp session
void uuidv4; // ensure import is used

export default router;
