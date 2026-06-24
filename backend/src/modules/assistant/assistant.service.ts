/**
 * assistant.service.ts
 * Asistente personal de plataforma, CONSCIENTE DEL ROL:
 *  - superadmin  → Agente Maestro (KPIs globales, top comercios, pedidos, stock, inactivos)
 *  - comerciante/staff → asistente de SU negocio (ventas, pedidos, stock, citas) scoped por tenant_id
 *
 * Soporta Gemini (AIza…) y Groq (gsk_…) — detecta automáticamente por prefijo de key.
 */
import { db } from '../../config';
import { textReply, agentLoop, ToolDef } from '../ai/orchestrator.service';
import { RowDataPacket } from 'mysql2';

const fmt = (n: number) => `$${Number(n || 0).toLocaleString('es-CO')}`;

// ─────────────────────────────────────────────────────────────
// Tool definitions (JSON-schema estándar; el orchestrator las traduce
// a OpenAI `tools` o Gemini `functionDeclarations` según el proveedor)
// ─────────────────────────────────────────────────────────────
const SUPERADMIN_TOOLS: ToolDef[] = [
  { name: 'kpis_globales',              description: 'KPIs de toda la red: comercios, usuarios, productos, ventas hoy/mes, pedidos y citas pendientes.', parameters: { type: 'object', properties: {} } },
  { name: 'top_comercios',              description: 'Top comercios por ventas.', parameters: { type: 'object', properties: { limit: { type: 'integer' }, period: { type: 'string', description: 'hoy | mes | total' } } } },
  { name: 'pedidos_pendientes_globales',description: 'Pedidos pendientes/en preparación de todos los comercios.', parameters: { type: 'object', properties: {} } },
  { name: 'stock_critico_global',       description: 'Productos con stock crítico en toda la red.', parameters: { type: 'object', properties: {} } },
  { name: 'comercios_inactivos',        description: 'Comercios suspendidos o sin ventas recientes.', parameters: { type: 'object', properties: {} } },
];
export const MERCHANT_TOOLS: ToolDef[] = [
  { name: 'mis_ventas',           description: 'Ventas de mi negocio (hoy y mes).', parameters: { type: 'object', properties: {} } },
  { name: 'mis_pedidos_pendientes',description: 'Pedidos pendientes de mi tienda online.', parameters: { type: 'object', properties: {} } },
  { name: 'mi_stock_critico',     description: 'Mis productos con stock bajo o agotado.', parameters: { type: 'object', properties: {} } },
  { name: 'mis_citas',            description: 'Mis próximas citas/reservas de servicios.', parameters: { type: 'object', properties: {} } },
];

const SUPERADMIN_PROMPT = `Eres el Agente Maestro de Lopbuk, el asistente del superadministrador de la plataforma. Tienes acceso de solo lectura a métricas de TODA la red de comercios. Responde en español, claro y ejecutivo. Usa las herramientas para traer datos reales; NO inventes cifras. Resume con números concretos y, si aplica, recomienda acciones.`;
const MERCHANT_PROMPT   = `Eres el asistente del negocio en Lopbuk. Ayudas al comerciante a entender y operar SU tienda: ventas, pedidos pendientes, stock crítico y citas. Responde en español, conciso y accionable. Usa las herramientas para datos reales; NO inventes.`;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await db.execute<RowDataPacket[]>(sql, params);
  return rows as any[];
}

export function toOpenAITools(tools: typeof SUPERADMIN_TOOLS) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: (t.parameters.properties as any) || {},
        required: [] as string[],
      },
    },
  }));
}

// ─────────────────────────────────────────────────────────────
// Tool execution
// ─────────────────────────────────────────────────────────────
async function execSuper(name: string): Promise<string> {
  switch (name) {
    case 'kpis_globales': {
      const [t] = await q("SELECT SUM(status='activo') act, SUM(status='suspendido') susp, COUNT(*) total FROM tenants");
      const [u] = await q("SELECT COUNT(*) n FROM users");
      const [p] = await q("SELECT COUNT(*) n FROM products");
      const [vh] = await q("SELECT COALESCE(SUM(total),0) s FROM sales WHERE status='completada' AND DATE(created_at)=CURDATE()");
      const [vm] = await q("SELECT COALESCE(SUM(total),0) s FROM sales WHERE status='completada' AND YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())");
      const [pp] = await q("SELECT COUNT(*) n FROM storefront_orders WHERE status IN ('pendiente','confirmado','preparando')");
      const [cp] = await q("SELECT COUNT(*) n FROM service_bookings WHERE status IN ('pendiente','confirmada') AND (booking_date IS NULL OR booking_date>=CURDATE())");
      return `Comercios: ${t.act} activos, ${t.susp} suspendidos (${t.total} total). Usuarios: ${u.n}. Productos: ${p.n}. Ventas hoy: ${fmt(vh.s)}. Ventas mes: ${fmt(vm.s)}. Pedidos pendientes: ${pp.n}. Citas pendientes: ${cp.n}.`;
    }
    case 'top_comercios': {
      const rows = await q(`SELECT t.name, COALESCE(SUM(s.total),0) ventas
        FROM tenants t LEFT JOIN sales s ON s.tenant_id=t.id AND s.status='completada'
        GROUP BY t.id, t.name ORDER BY ventas DESC LIMIT 10`);
      return 'Top comercios por ventas: ' + rows.map((r, i) => `${i + 1}. ${r.name} ${fmt(r.ventas)}`).join(' · ');
    }
    case 'pedidos_pendientes_globales': {
      const rows = await q(`SELECT o.order_number, o.customer_name, o.total, o.status, t.name gym
        FROM storefront_orders o JOIN tenants t ON t.id=o.tenant_id
        WHERE o.status IN ('pendiente','confirmado','preparando')
        ORDER BY o.created_at DESC LIMIT 15`);
      if (!rows.length) return 'No hay pedidos pendientes en la red.';
      return `${rows.length} pedidos pendientes: ` + rows.map(r => `#${r.order_number} ${r.gym} ${r.customer_name} ${fmt(r.total)} [${r.status}]`).join('; ');
    }
    case 'stock_critico_global': {
      const [c] = await q("SELECT COUNT(*) n FROM products WHERE stock<=reorder_point");
      const rows = await q(`SELECT p.name, p.stock, t.name tienda FROM products p JOIN tenants t ON t.id=p.tenant_id
        WHERE p.stock<=p.reorder_point ORDER BY p.stock ASC LIMIT 12`);
      return `${c.n} productos en stock crítico. Más urgentes: ` + rows.map(r => `${r.name} (${r.tienda}): ${r.stock}`).join('; ');
    }
    case 'comercios_inactivos': {
      const rows = await q(`SELECT t.name, t.status,
        (SELECT MAX(created_at) FROM sales s WHERE s.tenant_id=t.id) ultima
        FROM tenants t
        HAVING t.status='suspendido' OR ultima IS NULL OR ultima < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ORDER BY ultima ASC LIMIT 15`);
      if (!rows.length) return 'Todos los comercios están activos y con ventas recientes.';
      return 'Comercios inactivos: ' + rows.map(r => `${r.name} [${r.status}${r.ultima ? ', última venta ' + String(r.ultima).slice(0, 10) : ', sin ventas'}]`).join('; ');
    }
    default: return 'Acción no reconocida.';
  }
}

export async function execMerchant(name: string, tenantId: string): Promise<string> {
  switch (name) {
    case 'mis_ventas': {
      const [h] = await q("SELECT COALESCE(SUM(total),0) s, COUNT(*) n FROM sales WHERE tenant_id=? AND status='completada' AND DATE(created_at)=CURDATE()", [tenantId]);
      const [m] = await q("SELECT COALESCE(SUM(total),0) s, COUNT(*) n FROM sales WHERE tenant_id=? AND status='completada' AND YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())", [tenantId]);
      return `Ventas hoy: ${fmt(h.s)} (${h.n} ventas). Este mes: ${fmt(m.s)} (${m.n} ventas).`;
    }
    case 'mis_pedidos_pendientes': {
      const rows = await q(`SELECT order_number, customer_name, total, status FROM storefront_orders
        WHERE tenant_id=? AND status IN ('pendiente','confirmado','preparando') ORDER BY created_at DESC LIMIT 15`, [tenantId]);
      if (!rows.length) return 'No tienes pedidos pendientes.';
      return `${rows.length} pedidos pendientes: ` + rows.map(r => `#${r.order_number} ${r.customer_name} ${fmt(r.total)} [${r.status}]`).join('; ');
    }
    case 'mi_stock_critico': {
      const rows = await q("SELECT name, stock, reorder_point FROM products WHERE tenant_id=? AND stock<=reorder_point ORDER BY stock ASC LIMIT 15", [tenantId]);
      if (!rows.length) return 'Todo tu inventario está por encima del punto de reorden.';
      return `${rows.length} productos con stock bajo: ` + rows.map(r => `${r.name}: ${r.stock}/${r.reorder_point}`).join('; ');
    }
    case 'mis_citas': {
      const rows = await q(`SELECT booking_date, start_time, status FROM service_bookings
        WHERE tenant_id=? AND status IN ('pendiente','confirmada') AND (booking_date IS NULL OR booking_date>=CURDATE())
        ORDER BY booking_date ASC, start_time ASC LIMIT 15`, [tenantId]);
      if (!rows.length) return 'No tienes citas próximas.';
      return `${rows.length} citas próximas: ` + rows.map(r => `${r.booking_date ? String(r.booking_date).slice(0, 10) : 'sin fecha'} ${r.start_time || ''} [${r.status}]`).join('; ');
    }
    default: return 'Acción no reconocida.';
  }
}

// ─────────────────────────────────────────────────────────────
// Public entry point — corre sobre el orchestrator (agentLoop):
// function-calling provider-agnóstico (OpenCode Go / OpenAI / Groq / Gemini),
// con respaldo, telemetría, tiering y guardas de límite.
// ─────────────────────────────────────────────────────────────
export async function runPlatformAssistant(
  user: { userId: string; role: string; tenantId?: string },
  message: string,
  history: { role: string; content: string }[] = [],
): Promise<{ reply: string }> {
  const isSuper = user.role === 'superadmin';
  const tools        = isSuper ? SUPERADMIN_TOOLS : MERCHANT_TOOLS;
  const systemPrompt = isSuper ? SUPERADMIN_PROMPT : MERCHANT_PROMPT;
  const exec = (name: string) => isSuper ? execSuper(name) : execMerchant(name, user.tenantId || '');

  try {
    const result = await agentLoop({
      system: systemPrompt,
      messages: [...history, { role: 'user', content: message }],
      tools,
      execute: async (name) => exec(name),
      maxTokens: 800,
      temperature: 0.5,
      tier: 'main',
      tenantId: user.tenantId || null,
    });
    return { reply: result.reply || 'No pude procesar tu mensaje.' };
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'NO_AI_KEY') return { reply: 'El asistente no está configurado todavía. Agrega una clave de IA en Integraciones.' };
    if (msg.includes('429')) return { reply: 'Muchas consultas a la vez, intenta en unos segundos. 🙏' };
    return { reply: 'No pude responder en este momento, intenta de nuevo.' };
  }
}

export async function isPlatformAssistantEnabled(): Promise<boolean> {
  const rows = await q("SELECT setting_value v FROM platform_settings WHERE setting_key='platform_assistant_enabled' LIMIT 1");
  return rows?.[0]?.v === '1' || rows?.[0]?.v === 'true';
}

// ─────────────────────────────────────────────────────────────
// Asistente PÚBLICO (robot del portafolio). Sin herramientas ni
// acceso a datos internos: solo responde sobre DAIMUZ y sus servicios.
// ─────────────────────────────────────────────────────────────
const PUBLIC_PROMPT = `Eres el asistente virtual de DAIMUZ, una plataforma SaaS colombiana de gestión para negocios (POS, inventario, facturación, tienda en línea, restaurante, delivery, finanzas y más). Hablas en español, con tono MUY conversacional y breve, estilo chat de WhatsApp (1-2 frases cortas). Nunca escribas parrafos largos; si hace falta detallar, ofrece continuar. Ayudas a visitantes del portafolio: explicas qué es DAIMUZ, sus módulos, planes y beneficios, y los invitas a solicitar una demo por WhatsApp. No tienes acceso a datos privados ni a cuentas; si te piden algo interno o de una tienda específica, sugiéreles contactar al equipo. No inventes precios exactos: si preguntan, di que dependen del plan y que pueden verlos en la sección de planes.`;

export async function runPublicAssistant(
  message: string,
  history: { role: string; content: string }[] = [],
): Promise<{ reply: string }> {
  // IA1: todo pasa por el orchestrator. IA5: tier 'small' (Q&A corto del portafolio → modelo barato).
  try {
    const reply = await textReply(PUBLIC_PROMPT, message, history, { maxTokens: 220, temperature: 0.7, historyLimit: 8, tier: 'small' });
    return { reply: reply || 'No pude procesar tu mensaje.' };
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'NO_AI_KEY') return { reply: 'El asistente aún no está configurado. Vuelve pronto. 🙂' };
    if (msg.includes('429')) return { reply: 'Muchas consultas a la vez, intenta en unos segundos. 🙏' };
    return { reply: 'No pude responder en este momento, intenta de nuevo.' };
  }
}
