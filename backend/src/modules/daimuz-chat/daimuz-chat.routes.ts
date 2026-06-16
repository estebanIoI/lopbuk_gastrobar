/**
 * daimuz-chat.routes.ts — "Modo Chat Daimuz" (agente operativo del comercio).
 *
 * El comerciante escribe en lenguaje natural y el agente:
 *  - DA ESTADÍSTICAS/ANÁLISIS de todos los módulos (reusa execMerchant).
 *  - OPERA módulos: Restbar (abrir/tomar/enviar/cobrar) e Inventario (ajustar stock).
 * Lecturas se ejecutan al vuelo; escrituras se PROPONEN y se ejecutan solo tras
 * confirmación humana (/execute). Soporta OpenAI/Groq (function-calling) y Gemini.
 * tenant_id del JWT. Montado en /api/daimuz-chat.
 */
import { Router, Response } from 'express';
import pool from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { UserRole } from '../../common/types';
import { getAIKeys } from '../agent/agent.service';
import { restbarService } from '../restbar/restbar.service';
import { productsService } from '../products/products.service';
import { salesService } from '../sales/sales.service';
import { MERCHANT_TOOLS, execMerchant, toOpenAITools } from '../assistant/assistant.service';

const router: ReturnType<typeof Router> = Router();
const ROLES: UserRole[] = ['superadmin', 'comerciante', 'administrador_rb', 'mesero', 'cajero', 'vendedor'];

const ok = (res: Response, data: any) => res.json({ success: true, data });
const bad = (res: Response, msg: string, code = 400) => res.status(code).json({ success: false, error: msg });

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const READ_TOOLS = new Set(['listar_mesas', 'ver_menu', 'ver_cuenta']);
const WRITE_TOOLS = new Set(['abrir_mesa', 'tomar_pedido', 'enviar_cocina', 'cobrar_mesa', 'ajustar_stock', 'crear_producto', 'registrar_venta']);
const MERCHANT_NAMES = new Set((MERCHANT_TOOLS as any[]).map(t => t.name));

const ACTION_TOOLS = [
  { type: 'function', function: { name: 'listar_mesas', description: 'Lista las mesas y su estado (libre/ocupada) con total.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'ver_menu', description: 'Lista los productos del menú con precio y disponibilidad.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'ver_cuenta', description: 'Muestra el pedido actual de una mesa.', parameters: { type: 'object', properties: { mesa: { type: 'string' } }, required: ['mesa'] } } },
  { type: 'function', function: { name: 'abrir_mesa', description: 'Abre/ocupa una mesa (crea su comanda).', parameters: { type: 'object', properties: { mesa: { type: 'string' } }, required: ['mesa'] } } },
  { type: 'function', function: { name: 'tomar_pedido', description: 'Agrega productos al pedido de una mesa.', parameters: { type: 'object', properties: { mesa: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { producto: { type: 'string' }, cantidad: { type: 'integer' } }, required: ['producto'] } } }, required: ['mesa', 'items'] } } },
  { type: 'function', function: { name: 'enviar_cocina', description: 'Envía a cocina los productos pendientes de una mesa.', parameters: { type: 'object', properties: { mesa: { type: 'string' } }, required: ['mesa'] } } },
  { type: 'function', function: { name: 'cobrar_mesa', description: 'Cobra (cierra) la cuenta de una mesa con un método de pago.', parameters: { type: 'object', properties: { mesa: { type: 'string' }, metodo: { type: 'string', description: 'efectivo | tarjeta | nequi | transferencia' } }, required: ['mesa'] } } },
  { type: 'function', function: { name: 'ajustar_stock', description: 'Suma o resta unidades al stock de un producto del inventario.', parameters: { type: 'object', properties: { producto: { type: 'string' }, cantidad: { type: 'integer', description: 'Positivo suma, negativo resta' } }, required: ['producto', 'cantidad'] } } },
  { type: 'function', function: { name: 'crear_producto', description: 'Crea un producto nuevo en el inventario.', parameters: { type: 'object', properties: { nombre: { type: 'string' }, precio: { type: 'number' }, categoria: { type: 'string' }, stock: { type: 'integer' }, es_menu: { type: 'boolean', description: 'true si es ítem de menú del restaurante' } }, required: ['nombre', 'precio'] } } },
  { type: 'function', function: { name: 'registrar_venta', description: 'Registra una venta en el POS (descuenta stock y genera factura).', parameters: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { producto: { type: 'string' }, cantidad: { type: 'integer' } }, required: ['producto'] } }, metodo: { type: 'string', description: 'efectivo | tarjeta | nequi | transferencia' } }, required: ['items'] } } },
];
const STAT_TOOLS = toOpenAITools(MERCHANT_TOOLS as any);
const ALL_TOOLS = [...ACTION_TOOLS, ...STAT_TOOLS];

const SYSTEM = `Eres el copiloto del comercio dentro de DAIMUZ (modo Chat Daimuz). El comerciante te habla en lenguaje natural y tú:
- Le das ESTADÍSTICAS y ANÁLISIS de su negocio (mis_ventas, mis_pedidos_pendientes, mi_stock_critico, mis_citas); combina varias para resúmenes con conclusiones accionables.
- OPERAS módulos: mesas (listar_mesas, ver_menu, ver_cuenta, abrir_mesa, tomar_pedido, enviar_cocina, cobrar_mesa) e inventario (ajustar_stock). Propón UNA acción a la vez.
Nunca inventes datos, mesas ni productos. Responde breve, en español, con tono cercano y añade una observación corta cuando des números.`;

// ─────────── Helpers ───────────
async function listTables(tenantId: string) {
  const [rows] = (await pool.query(
    `SELECT t.id, t.number, t.status,
            (SELECT id FROM rb_orders o WHERE o.table_id = t.id AND o.status NOT IN ('cerrada','cancelada') ORDER BY o.created_at DESC LIMIT 1) AS order_id,
            (SELECT total FROM rb_orders o WHERE o.table_id = t.id AND o.status NOT IN ('cerrada','cancelada') ORDER BY o.created_at DESC LIMIT 1) AS total
       FROM rb_tables t WHERE t.tenant_id = ? AND t.is_active = 1 ORDER BY t.number`, [tenantId])) as any;
  return rows;
}
async function resolveTable(tenantId: string, mesa: string) {
  const m = String(mesa).trim().replace(/^mesa\s*/i, '');
  const [rows] = (await pool.query('SELECT id, number, status FROM rb_tables WHERE tenant_id = ? AND is_active = 1 AND number = ? LIMIT 1', [tenantId, m])) as any;
  return rows[0] || null;
}
async function resolveProduct(tenantId: string, name: string) {
  const [rows] = (await pool.query('SELECT id, name, stock, sale_price FROM products WHERE tenant_id = ? AND name LIKE ? ORDER BY name LIMIT 1', [tenantId, `%${String(name).trim()}%`])) as any;
  return rows[0] || null;
}
async function openOrderId(tenantId: string, tableId: string): Promise<string | null> {
  const [rows] = (await pool.query(`SELECT id FROM rb_orders WHERE tenant_id = ? AND table_id = ? AND status NOT IN ('cerrada','cancelada') ORDER BY created_at DESC LIMIT 1`, [tenantId, tableId])) as any;
  return rows[0]?.id || null;
}
async function orderTotal(orderId: string): Promise<number> {
  const [[o]] = (await pool.query('SELECT total FROM rb_orders WHERE id = ?', [orderId])) as any;
  return Number(o?.total || 0);
}
async function userInfo(userId: string): Promise<{ name: string }> {
  const [u] = (await pool.query('SELECT name FROM users WHERE id = ? LIMIT 1', [userId])) as any;
  return { name: u[0]?.name || 'Usuario' };
}

async function runRead(name: string, args: any, tenantId: string): Promise<string> {
  if (name === 'listar_mesas') {
    const t = await listTables(tenantId);
    if (!t.length) return 'No hay mesas configuradas.';
    return t.map((r: any) => `Mesa ${r.number}: ${r.order_id ? `ocupada, total $${Number(r.total || 0).toLocaleString('es-CO')}` : 'libre'}`).join('\n');
  }
  if (name === 'ver_menu') {
    const menu = await restbarService.getMenu(tenantId);
    if (!menu.length) return 'El menú está vacío.';
    return menu.slice(0, 60).map((m: any) => `${m.name} — $${Number(m.price).toLocaleString('es-CO')}${m.availableInMenu ? '' : ' (AGOTADO)'}`).join('\n');
  }
  if (name === 'ver_cuenta') {
    const table = await resolveTable(tenantId, args?.mesa || '');
    if (!table) return `No existe la mesa "${args?.mesa}".`;
    const orderId = await openOrderId(tenantId, table.id);
    if (!orderId) return `La Mesa ${table.number} no tiene pedido abierto.`;
    const [items] = (await pool.query(`SELECT menu_item_name AS name, quantity, status FROM rb_order_items WHERE order_id = ? AND status <> 'cancelado'`, [orderId])) as any;
    if (!items.length) return `La Mesa ${table.number} no tiene productos.`;
    return `Pedido Mesa ${table.number}:\n` + items.map((i: any) => `${i.quantity}× ${i.name} (${i.status})`).join('\n');
  }
  return 'Herramienta no disponible.';
}

function actionLabel(tool: string, args: any): string {
  if (tool === 'abrir_mesa') return `Abrir la Mesa ${args?.mesa}`;
  if (tool === 'enviar_cocina') return `Enviar a cocina lo pendiente de la Mesa ${args?.mesa}`;
  if (tool === 'cobrar_mesa') return `Cobrar la Mesa ${args?.mesa}${args?.metodo ? ` con ${args.metodo}` : ''}`;
  if (tool === 'ajustar_stock') { const c = Number(args?.cantidad || 0); return `${c >= 0 ? 'Sumar' : 'Restar'} ${Math.abs(c)} al stock de "${args?.producto}"`; }
  if (tool === 'crear_producto') return `Crear producto "${args?.nombre}" a $${Number(args?.precio || 0).toLocaleString('es-CO')}`;
  if (tool === 'registrar_venta') { const items = Array.isArray(args?.items) ? args.items : []; return `Registrar venta (${args?.metodo || 'efectivo'}): ` + items.map((i: any) => `${i.cantidad || 1}× ${i.producto}`).join(', '); }
  if (tool === 'tomar_pedido') {
    const items = Array.isArray(args?.items) ? args.items : [];
    return `Agregar a la Mesa ${args?.mesa}: ` + items.map((i: any) => `${i.cantidad || 1}× ${i.producto}`).join(', ');
  }
  return 'Acción';
}

// ─────────── LLM OpenAI-compatible (OpenAI / Groq) ───────────
type Keys = { openaiKey: string; groqKey: string; defaultProvider: string; openaiBaseUrl: string; openaiModel: string; geminiKey: string };
async function llmCall(messages: any[], keys: Keys) {
  const useGroq = keys.defaultProvider === 'groq' || (!keys.openaiKey && !!keys.groqKey);
  const url = useGroq ? 'https://api.groq.com/openai/v1/chat/completions' : (keys.openaiBaseUrl + '/chat/completions');
  const model = useGroq ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile') : keys.openaiModel;
  const apiKey = useGroq ? keys.groqKey : keys.openaiKey;
  if (!apiKey) throw new Error('NO_OPENAI_COMPAT');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, tools: ALL_TOOLS, tool_choice: 'auto', temperature: 0.3, max_tokens: 600 }),
  });
  if (!r.ok) throw new Error(`AI error ${r.status}: ${await r.text()}`);
  return (await r.json()) as any;
}

// ─────────── Gemini (function-calling, 2 rondas máx) ───────────
function uppercaseTypes(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const out: any = Array.isArray(schema) ? [] : {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && typeof v === 'string') out[k] = v.toUpperCase();
    else out[k] = uppercaseTypes(v);
  }
  return out;
}
const GEMINI_DECLS = ALL_TOOLS.map(t => ({ name: t.function.name, description: t.function.description, parameters: uppercaseTypes(t.function.parameters) }));

async function geminiGenerate(geminiKey: string, contents: any[], withTools: boolean) {
  const body: any = { system_instruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 600 } };
  if (withTools) body.tools = [{ function_declarations: GEMINI_DECLS }];
  const r = await fetch(`${GEMINI_URL}?key=${geminiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Gemini error ${r.status}: ${await r.text()}`);
  return (await r.json()) as any;
}
async function runGemini(geminiKey: string, history: any[], message: string, tenantId: string): Promise<{ reply: string; pendingAction: any }> {
  const contents = [
    ...history.map((m: any) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] })),
    { role: 'user', parts: [{ text: message }] },
  ];
  const d1 = await geminiGenerate(geminiKey, contents, true);
  const parts = d1.candidates?.[0]?.content?.parts || [];
  const fc = parts.find((p: any) => p.functionCall)?.functionCall;
  if (!fc) {
    const text = parts.find((p: any) => p.text)?.text;
    return { reply: text || 'No entendí, ¿puedes reformular?', pendingAction: null };
  }
  const name = fc.name; const args = fc.args || {};
  if (WRITE_TOOLS.has(name)) {
    const label = actionLabel(name, args);
    return { reply: `${label}. ¿Confirmas?`, pendingAction: { tool: name, args, label } };
  }
  if (READ_TOOLS.has(name) || MERCHANT_NAMES.has(name)) {
    const result = MERCHANT_NAMES.has(name) ? await execMerchant(name, tenantId) : await runRead(name, args, tenantId);
    const contents2 = [...contents, { role: 'user', parts: [{ text: `Datos (${name}):\n${result}\n\nResponde breve al comerciante con una observación útil.` }] }];
    const d2 = await geminiGenerate(geminiKey, contents2, false);
    const text = d2.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    return { reply: text || result, pendingAction: null };
  }
  return { reply: 'No pude procesar esa solicitud.', pendingAction: null };
}

// ─────────── POST /restbar : conversación ───────────
router.post('/restbar', authenticate, authorize(...ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const message = String(req.body?.message || '').trim();
    if (!message) return bad(res, 'Escribe un mensaje');
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
    const keys = await getAIKeys() as any;

    if (keys.defaultProvider === 'gemini') {
      if (!keys.geminiKey) return bad(res, 'No hay una clave de Gemini configurada.', 400);
      const out = await runGemini(keys.geminiKey, history, message, tenantId);
      return ok(res, out);
    }

    const messages: any[] = [
      { role: 'system', content: SYSTEM },
      ...history.map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })),
      { role: 'user', content: message },
    ];
    for (let i = 0; i < 5; i++) {
      const data = await llmCall(messages, keys);
      const choice = data.choices?.[0];
      const toolCall = choice?.message?.tool_calls?.[0];
      if (!toolCall) return ok(res, { reply: choice?.message?.content || 'No entendí, ¿puedes reformular?', pendingAction: null });
      const name = toolCall.function?.name;
      let args: any = {};
      try { args = JSON.parse(toolCall.function?.arguments || '{}'); } catch { /* sin args */ }
      if (WRITE_TOOLS.has(name)) {
        const label = actionLabel(name, args);
        return ok(res, { reply: `${label}. ¿Confirmas?`, pendingAction: { tool: name, args, label } });
      }
      if (READ_TOOLS.has(name) || MERCHANT_NAMES.has(name)) {
        const result = MERCHANT_NAMES.has(name) ? await execMerchant(name, tenantId) : await runRead(name, args, tenantId);
        messages.push({ role: 'assistant', content: null, tool_calls: [toolCall] });
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        continue;
      }
      return ok(res, { reply: 'No pude procesar esa solicitud.', pendingAction: null });
    }
    return ok(res, { reply: 'Necesito que me lo digas de otra forma 🙂', pendingAction: null });
  } catch (e: any) {
    if (e?.message === 'NO_OPENAI_COMPAT') return bad(res, 'No hay una clave OpenAI/Groq configurada para el modo Chat Daimuz.', 400);
    bad(res, e?.message || 'Error del asistente', 500);
  }
});

// ─────────── POST /restbar/execute : ejecuta la acción confirmada ───────────
router.post('/restbar/execute', authenticate, authorize(...ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const tool = String(req.body?.tool || '');
    const args = req.body?.args || {};
    if (!WRITE_TOOLS.has(tool)) return bad(res, 'Acción no permitida');
    const me = await userInfo(req.user!.userId!);

    // ── Inventario ──
    if (tool === 'ajustar_stock') {
      const prod = await resolveProduct(tenantId, args?.producto || '');
      if (!prod) return bad(res, `No encontré el producto "${args?.producto}"`);
      const delta = parseInt(String(args?.cantidad || 0), 10);
      if (!delta) return bad(res, 'Indica una cantidad distinta de 0');
      const next = Math.max(0, Number(prod.stock) + delta);
      await productsService.updateStock(prod.id, next);
      return ok(res, { message: `Stock de "${prod.name}": ${prod.stock} → ${next}.`, refresh: 'inventory' });
    }
    if (tool === 'crear_producto') {
      const nombre = String(args?.nombre || '').trim();
      const precio = Number(args?.precio || 0);
      if (!nombre) return bad(res, 'Falta el nombre del producto');
      if (!(precio > 0)) return bad(res, 'El precio debe ser mayor a 0');
      const sku = nombre.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) + '-' + Math.floor(1000 + Math.random() * 8999);
      const data: any = { name: nombre, category: String(args?.categoria || 'General'), salePrice: precio, sku, stock: Math.max(0, parseInt(String(args?.stock || 0), 10)) };
      if (args?.es_menu) { data.isMenuItem = true; data.availableInMenu = true; }
      await productsService.create(tenantId, data);
      return ok(res, { message: `Producto "${nombre}" creado ($${precio.toLocaleString('es-CO')}, SKU ${sku}).`, refresh: 'inventory' });
    }
    if (tool === 'registrar_venta') {
      const items = Array.isArray(args?.items) ? args.items : [];
      if (!items.length) return bad(res, 'No indicaste productos');
      const valid = ['efectivo', 'tarjeta', 'nequi', 'transferencia'];
      const metodo = valid.includes(String(args?.metodo)) ? String(args.metodo) : 'efectivo';
      const saleItems: any[] = []; const missing: string[] = []; let total = 0;
      for (const it of items) {
        const q = Math.max(1, parseInt(String(it.cantidad || 1), 10));
        const prod = await resolveProduct(tenantId, it.producto || '');
        if (!prod) { missing.push(it.producto); continue; }
        saleItems.push({ productId: prod.id, quantity: q });
        total += Number(prod.sale_price) * q;
      }
      if (!saleItems.length) return bad(res, `No encontré: ${missing.join(', ')}`);
      const sale = await salesService.create(tenantId, { items: saleItems, paymentMethod: metodo as any, amountPaid: total } as any);
      let msg = `Venta registrada${(sale as any)?.invoiceNumber ? ` (${(sale as any).invoiceNumber})` : ''}: $${total.toLocaleString('es-CO')} (${metodo}).`;
      if (missing.length) msg += ` No encontré: ${missing.join(', ')}.`;
      return ok(res, { message: msg, refresh: 'sales' });
    }

    // ── Restbar ──
    const table = await resolveTable(tenantId, args?.mesa || '');
    if (!table) return bad(res, `No existe la mesa "${args?.mesa}"`);

    async function ensureOrder(): Promise<string> {
      let id = await openOrderId(tenantId, table.id);
      if (!id) { await restbarService.createOrder(tenantId, req.user!.userId!, me.name, { tableId: table.id }); id = await openOrderId(tenantId, table.id); }
      return id!;
    }

    if (tool === 'abrir_mesa') {
      const id = await ensureOrder();
      return ok(res, { message: `Mesa ${table.number} abierta.`, orderId: id, refresh: 'restbar' });
    }
    if (tool === 'tomar_pedido') {
      const items = Array.isArray(args?.items) ? args.items : [];
      if (!items.length) return bad(res, 'No indicaste productos');
      const menu = await restbarService.getMenu(tenantId);
      const orderId = await ensureOrder();
      const added: string[] = []; const missing: string[] = [];
      for (const it of items) {
        const q = Math.max(1, parseInt(String(it.cantidad || 1), 10));
        const found = menu.find((m: any) => String(m.name).toLowerCase().includes(String(it.producto || '').toLowerCase()));
        if (!found) { missing.push(it.producto); continue; }
        await restbarService.addItem(tenantId, orderId, { menuItemId: found.id, quantity: q });
        added.push(`${q}× ${found.name}`);
      }
      let msg = added.length ? `Agregado a Mesa ${table.number}: ${added.join(', ')}.` : 'No se agregó nada.';
      if (missing.length) msg += ` No encontré: ${missing.join(', ')}.`;
      return ok(res, { message: msg, orderId, refresh: 'restbar' });
    }
    if (tool === 'enviar_cocina') {
      const orderId = await openOrderId(tenantId, table.id);
      if (!orderId) return bad(res, `La Mesa ${table.number} no tiene pedido`);
      await restbarService.sendToKitchen(tenantId, orderId);
      return ok(res, { message: `Pedido de la Mesa ${table.number} enviado a cocina.`, orderId, refresh: 'restbar' });
    }
    if (tool === 'cobrar_mesa') {
      const orderId = await openOrderId(tenantId, table.id);
      if (!orderId) return bad(res, `La Mesa ${table.number} no tiene pedido abierto`);
      const valid = ['efectivo', 'tarjeta', 'nequi', 'transferencia'];
      const metodo = valid.includes(String(args?.metodo)) ? String(args.metodo) : 'efectivo';
      const total = await orderTotal(orderId);
      await restbarService.processPayment(tenantId, orderId, req.user!.userId!, me.name, { paymentMethod: metodo as any, amountPaid: total });
      return ok(res, { message: `Mesa ${table.number} cobrada: $${total.toLocaleString('es-CO')} (${metodo}).`, refresh: 'restbar' });
    }
    return bad(res, 'Acción no soportada');
  } catch (e: any) { bad(res, e?.message || 'No se pudo ejecutar la acción', 500); }
});

export default router;
