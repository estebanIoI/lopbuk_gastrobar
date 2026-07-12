/**
 * print-agent.routes — distribución y vinculación del Agente de Impresión local.
 *
 * El agente es un programa que corre en un PC del local (misma LAN que las impresoras
 * Ethernet) y recibe los tickets desde la nube para imprimirlos localmente, porque el
 * backend en la nube no alcanza las IP privadas 192.168.x.x de las impresoras.
 *
 * Este módulo cubre el paso de DISTRIBUCIÓN:
 *   - Comerciante (auth):  descargar el .exe, generar/ver su código de vinculación, ver estado.
 *   - Agente (público):    canjear el código por un token durable + heartbeat (last_seen).
 *
 * La COLA de trabajos de impresión (jobs) se implementa en el siguiente paso.
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pool from '../../config/database';
import { authenticate, AuthRequest } from '../../common/middleware';

const router: ReturnType<typeof Router> = Router();

// Ruta del binario que sirve el botón "Descargar programa". Se puede fijar con
// PRINT_AGENT_BINARY_PATH; por defecto busca backend/assets/print-agent.exe.
const BINARY_PATH = process.env.PRINT_AGENT_BINARY_PATH
  || path.join(__dirname, '../../../assets/print-agent.exe');

// Código de vinculación corto, sin caracteres ambiguos (0/O, 1/I/L).
function genCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
const genToken = () => crypto.randomBytes(32).toString('hex'); // 64 chars

// ── PÚBLICO (agente) ───────────────────────────────────────────────────────────

// POST /print-agent/pair — el agente canjea el código por su token durable.
router.post('/pair', async (req: Request, res: Response) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const name = String(req.body?.name || '').trim().slice(0, 100) || null;
    if (!code) { res.status(400).json({ success: false, error: 'Código requerido' }); return; }

    const [rows] = await pool.query(
      `SELECT pa.id, pa.token, t.name AS tenantName
       FROM print_agents pa JOIN tenants t ON t.id = pa.tenant_id
       WHERE pa.pairing_code = ? LIMIT 1`,
      [code]
    ) as any;
    if (!rows.length) { res.status(404).json({ success: false, error: 'Código inválido o expirado' }); return; }

    await pool.query(
      'UPDATE print_agents SET paired_at = COALESCE(paired_at, NOW()), last_seen_at = NOW(), name = COALESCE(?, name) WHERE id = ?',
      [name, rows[0].id]
    );
    res.json({ success: true, data: { token: rows[0].token, tenantName: rows[0].tenantName } });
  } catch (error) {
    console.error('Pair print-agent error:', error);
    res.status(500).json({ success: false, error: 'Error al vincular el agente' });
  }
});

// Resuelve el agente (y su tenant) a partir del header x-agent-token.
async function agentFromToken(req: Request): Promise<{ id: string; tenantId: string } | null> {
  const token = String(req.headers['x-agent-token'] || '');
  if (!token) return null;
  const [rows] = await pool.query('SELECT id, tenant_id AS tenantId FROM print_agents WHERE token = ? LIMIT 1', [token]) as any;
  return rows.length ? { id: rows[0].id, tenantId: rows[0].tenantId } : null;
}

// POST /print-agent/heartbeat — el agente reporta que está vivo y recoge trabajos pendientes.
router.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const agent = await agentFromToken(req);
    if (!agent) { res.status(401).json({ success: false, error: 'Token inválido' }); return; }
    await pool.query('UPDATE print_agents SET last_seen_at = NOW() WHERE id = ?', [agent.id]);

    // Recupera trabajos que quedaron 'sent' sin confirmar hace >60s (agente caído a mitad).
    await pool.query(
      "UPDATE print_jobs SET status = 'pending' WHERE tenant_id = ? AND status = 'sent' AND sent_at < (NOW() - INTERVAL 60 SECOND)",
      [agent.tenantId]
    );
    // Reclama los pendientes (marca 'sent' + incrementa intentos, atómico por fila).
    await pool.query(
      "UPDATE print_jobs SET status = 'sent', sent_at = NOW(), attempts = attempts + 1 WHERE tenant_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 10",
      [agent.tenantId]
    );
    // Devuelve los reclamados con el formato que espera el agente.
    const [jobs] = await pool.query(
      "SELECT id, printer_ip AS ip, printer_port AS port, data_base64 AS dataBase64, module AS area FROM print_jobs WHERE tenant_id = ? AND status = 'sent' ORDER BY created_at ASC LIMIT 10",
      [agent.tenantId]
    ) as any;
    res.json({ success: true, data: { jobs } });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ success: false, error: 'Error en heartbeat' });
  }
});

// POST /print-agent/jobs/:id/done — el agente confirma que imprimió el trabajo.
router.post('/jobs/:id/done', async (req: Request, res: Response) => {
  try {
    const agent = await agentFromToken(req);
    if (!agent) { res.status(401).json({ success: false, error: 'Token inválido' }); return; }
    await pool.query(
      "UPDATE print_jobs SET status = 'done', done_at = NOW() WHERE id = ? AND tenant_id = ?",
      [req.params.id, agent.tenantId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al confirmar el trabajo' });
  }
});

// POST /print-agent/jobs/:id/failed — el agente reporta que no pudo imprimir (reintenta hasta 3).
router.post('/jobs/:id/failed', async (req: Request, res: Response) => {
  try {
    const agent = await agentFromToken(req);
    if (!agent) { res.status(401).json({ success: false, error: 'Token inválido' }); return; }
    const err = String(req.body?.error || '').slice(0, 255) || null;
    await pool.query(
      "UPDATE print_jobs SET status = IF(attempts >= 3, 'failed', 'pending'), error = ? WHERE id = ? AND tenant_id = ?",
      [err, req.params.id, agent.tenantId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al reportar el fallo' });
  }
});

// ── COMERCIANTE (auth) ──────────────────────────────────────────────────────────
router.use(authenticate);

// GET /print-agent/download — descarga el .exe del agente.
router.get('/download', (_req: AuthRequest, res: Response) => {
  if (!fs.existsSync(BINARY_PATH)) {
    res.status(503).json({
      success: false,
      error: 'El programa aún no está publicado en el servidor. Contacta al administrador.',
    });
    return;
  }
  res.download(BINARY_PATH, 'DAIMUZ-Impresion.exe', (err) => {
    if (err && !res.headersSent) res.status(500).end();
  });
});

// GET /print-agent/status — código de vinculación + agentes del tenant (para el panel).
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const [rows] = await pool.query(
      `SELECT id, name, pairing_code AS pairingCode, paired_at AS pairedAt, last_seen_at AS lastSeenAt
       FROM print_agents WHERE tenant_id = ? ORDER BY created_at DESC`,
      [tenantId]
    ) as any;
    const agents = (rows as any[]).map(a => ({
      id: a.id, name: a.name, pairingCode: a.pairingCode,
      paired: !!a.pairedAt,
      lastSeenAt: a.lastSeenAt,
      // "en línea" si dio señales en los últimos 90s
      online: a.lastSeenAt ? (Date.now() - new Date(a.lastSeenAt).getTime() < 90_000) : false,
    }));
    res.json({ success: true, data: { agents, binaryAvailable: fs.existsSync(BINARY_PATH) } });
  } catch (error) {
    console.error('Print-agent status error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener el estado' });
  }
});

// POST /print-agent/pairing-code — genera un código nuevo (una vinculación disponible).
router.post('/pairing-code', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    // Reutiliza un código aún NO vinculado si existe; si no, crea uno nuevo.
    const [pending] = await pool.query(
      'SELECT pairing_code AS code FROM print_agents WHERE tenant_id = ? AND paired_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [tenantId]
    ) as any;
    if (pending.length) { res.json({ success: true, data: { code: pending[0].code } }); return; }

    const code = genCode();
    await pool.query(
      'INSERT INTO print_agents (id, tenant_id, pairing_code, token) VALUES (?, ?, ?, ?)',
      [uuidv4(), tenantId, code, genToken()]
    );
    res.status(201).json({ success: true, data: { code } });
  } catch (error) {
    console.error('Generate pairing code error:', error);
    res.status(500).json({ success: false, error: 'Error al generar el código' });
  }
});

// DELETE /print-agent/:id — desvincula/elimina un agente.
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const [r] = await pool.query('DELETE FROM print_agents WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]) as any;
    if (!r.affectedRows) { res.status(404).json({ success: false, error: 'Agente no encontrado' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al eliminar el agente' });
  }
});

export default router;
