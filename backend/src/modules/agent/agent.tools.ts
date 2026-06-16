import pool from '../../config/database';
import { reservationsService } from '../restbar/reservations.service';
import { v4 as uuidv4 } from 'uuid';

export interface ToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  userMessage: string;
}

// ──────────────────────────────────────────────────
// Gemini function declarations
// ──────────────────────────────────────────────────

export const RESERVATION_TOOL_DECLARATIONS = [
  {
    name: 'verificar_disponibilidad_reserva',
    description:
      'Consulta los horarios disponibles para reservar una mesa en una fecha específica. ' +
      'Llama esta función cuando el cliente quiera hacer una reserva y pregunte por disponibilidad.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fecha: {
          type: 'STRING',
          description: 'Fecha en formato YYYY-MM-DD. Ejemplo: 2025-06-15',
        },
        personas: {
          type: 'INTEGER',
          description: 'Número de personas para la reserva',
        },
      },
      required: ['fecha', 'personas'],
    },
  },
  {
    name: 'crear_reserva',
    description:
      'Crea una reserva de mesa. ' +
      'Llama SOLO cuando el cliente ya confirmó: nombre completo, teléfono, fecha, ' +
      'hora específica (de las opciones disponibles) y número de personas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nombre:   { type: 'STRING', description: 'Nombre completo del cliente' },
        telefono: { type: 'STRING', description: 'Teléfono del cliente' },
        fecha:    { type: 'STRING', description: 'Fecha YYYY-MM-DD' },
        hora:     { type: 'STRING', description: 'Hora HH:MM de las opciones disponibles' },
        personas: { type: 'INTEGER', description: 'Número de personas' },
        ocasion:  { type: 'STRING', description: 'Ocasión especial (opcional): Cumpleaños, Aniversario...' },
        notas:    { type: 'STRING', description: 'Peticiones especiales del cliente (opcional)' },
      },
      required: ['nombre', 'telefono', 'fecha', 'hora', 'personas'],
    },
  },
];

export const LEAD_TOOL_DECLARATION = {
  name: 'registrar_interes_cliente',
  description:
    'Registra el nombre y teléfono de un cliente interesado para que el negocio haga seguimiento. ' +
    'Úsalo cuando el cliente deje sus datos de contacto o pida que lo llamen.',
  parameters: {
    type: 'OBJECT',
    properties: {
      nombre:   { type: 'STRING', description: 'Nombre del cliente' },
      telefono: { type: 'STRING', description: 'Teléfono del cliente' },
      interes:  { type: 'STRING', description: 'Qué producto, servicio o tema consultó' },
    },
    required: ['nombre', 'telefono', 'interes'],
  },
};

export const ORDER_TOOL_DECLARATION = {
  name: 'registrar_pedido',
  description:
    'Registra un pedido de productos del menú para domicilio o para llevar. ' +
    'Úsalo cuando el cliente quiera pedir uno o más platos/productos del menú para que se los entreguen o recogerlos.',
  parameters: {
    type: 'OBJECT',
    properties: {
      nombre:    { type: 'STRING', description: 'Nombre completo del cliente' },
      telefono:  { type: 'STRING', description: 'Teléfono de contacto para coordinar el pedido' },
      items:     { type: 'STRING', description: 'Lista de productos con cantidades que desea pedir. Ej: "2x Hamburguesa clásica, 1x Papas fritas"' },
      tipo:      { type: 'STRING', description: 'Tipo de pedido: "domicilio" o "para_llevar"' },
      direccion: { type: 'STRING', description: 'Dirección de entrega. Requerido cuando tipo es "domicilio"' },
      notas:     { type: 'STRING', description: 'Instrucciones especiales o notas del pedido (opcional)' },
    },
    required: ['nombre', 'telefono', 'items', 'tipo'],
  },
};

// ──────────────────────────────────────────────────
// Dispatcher
// ──────────────────────────────────────────────────

export async function executeAgentTool(
  toolName: string,
  args: Record<string, any>,
  tenantId: string,
  sessionId: string,
): Promise<ToolResult> {
  const actionId = uuidv4();

  // Log the action (fail silently if table doesn't exist yet)
  try {
    await pool.query(
      `INSERT INTO agent_actions (id, tenant_id, session_id, channel, tool_name, tool_input)
       VALUES (?, ?, ?, 'chat', ?, ?)`,
      [actionId, tenantId, sessionId, toolName, JSON.stringify(args)],
    );
  } catch { /* migration pending */ }

  let result: ToolResult;

  switch (toolName) {
    case 'verificar_disponibilidad_reserva':
      result = await toolVerificarDisponibilidad(args, tenantId);
      break;
    case 'crear_reserva':
      result = await toolCrearReserva(args, tenantId);
      break;
    case 'registrar_interes_cliente':
      result = await toolRegistrarInteres(args, tenantId, sessionId);
      break;
    case 'registrar_pedido':
      result = await toolRegistrarPedido(args, tenantId, sessionId);
      break;
    default:
      return { success: false, error: 'Herramienta desconocida', userMessage: '' };
  }

  try {
    await pool.query(
      `UPDATE agent_actions SET tool_output = ?, success = ? WHERE id = ?`,
      [JSON.stringify(result.data || {}), result.success ? 1 : 0, actionId],
    );
  } catch { /* silent */ }

  return result;
}

// ──────────────────────────────────────────────────
// Tool: verificar_disponibilidad_reserva
// ──────────────────────────────────────────────────

async function toolVerificarDisponibilidad(
  args: Record<string, any>,
  tenantId: string,
): Promise<ToolResult> {
  try {
    const { fecha, personas } = args;
    const slots = await reservationsService.getAvailableSlots(tenantId, fecha);

    if (!slots.length) {
      return {
        success: true,
        data: { slots: [], fecha, personas },
        userMessage: `No hay horarios disponibles para el ${fecha}. Por favor elige otra fecha.`,
      };
    }

    // Check capacity for given party size on first available slot
    const tables = await reservationsService
      .getAvailableTables(tenantId, fecha, slots[0], Number(personas))
      .catch(() => []);

    return {
      success: true,
      data: { slots, fecha, personas, hasCapacity: tables.length > 0 },
      userMessage: `Horarios disponibles para el ${fecha}: ${slots.join(', ')}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: String(err),
      userMessage: 'No pude consultar la disponibilidad en este momento. Intenta más tarde.',
    };
  }
}

// ──────────────────────────────────────────────────
// Tool: crear_reserva
// ──────────────────────────────────────────────────

async function toolCrearReserva(
  args: Record<string, any>,
  tenantId: string,
): Promise<ToolResult> {
  try {
    const { nombre, telefono, fecha, hora, personas, ocasion, notas } = args;
    const guestsCount = Number(personas);

    // Auto-assign first available table
    const tables = await reservationsService
      .getAvailableTables(tenantId, fecha, hora, guestsCount)
      .catch(() => []);

    let reservation: any;

    if (tables.length > 0) {
      reservation = await reservationsService.createReservation(tenantId, {
        tableId:         tables[0].id,
        customerName:    nombre,
        customerPhone:   telefono,
        reservationDate: fecha,
        reservationTime: hora,
        guestsCount,
        occasion: ocasion || undefined,
        notes:    notas    || undefined,
      });
    } else {
      // No tables configured → create with null table_id (pending assignment)
      const conn = await (pool as any).getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(
          `INSERT INTO rb_reservation_sequence (tenant_id, prefix, current_number)
           VALUES (?, 'R', 1) ON DUPLICATE KEY UPDATE current_number = current_number + 1`,
          [tenantId],
        );
        const [seqRow] = await conn.query(
          `SELECT current_number FROM rb_reservation_sequence WHERE tenant_id = ? LIMIT 1`,
          [tenantId],
        ) as any;
        const reservationNumber = `R-${String(seqRow[0].current_number).padStart(4, '0')}`;
        const id             = uuidv4();
        const timeFormatted  = hora.length === 5 ? hora + ':00' : hora;

        await conn.query(
          `INSERT INTO rb_reservations
             (id, tenant_id, table_id, reservation_number, customer_name, customer_phone,
              reservation_date, reservation_time, guests_count, occasion, notes, status)
           VALUES (?,?,NULL,?,?,?,?,?,?,?,?,'pendiente')`,
          [id, tenantId, reservationNumber, nombre, telefono,
           fecha, timeFormatted, guestsCount, ocasion || null, notas || null],
        );
        await conn.commit();
        reservation = { id, reservationNumber, date: fecha, time: hora, guestsCount };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    if (reservation?.error) {
      return { success: false, error: reservation.error, userMessage: reservation.error };
    }

    // Notify merchant
    await pool.query(
      `INSERT INTO merchant_notifications (tenant_id, type, title, message, data)
       VALUES (?, 'new_booking', ?, ?, ?)`,
      [
        tenantId,
        `Nueva reserva: ${nombre}`,
        `${reservation.reservationNumber} — ${fecha} ${hora} — ${guestsCount} persona${guestsCount !== 1 ? 's' : ''}`,
        JSON.stringify({
          reservationId:     reservation.id,
          reservationNumber: reservation.reservationNumber,
          customerName:      nombre,
          customerPhone:     telefono,
          fecha, hora,
          personas:          guestsCount,
        }),
      ],
    );

    const plural  = guestsCount !== 1 ? 's' : '';
    const ocasStr = ocasion ? ` (${ocasion})` : '';
    return {
      success: true,
      data: {
        reservationNumber: reservation.reservationNumber,
        fecha, hora,
        personas: guestsCount,
      },
      userMessage:
        `¡Reserva confirmada! Número: **${reservation.reservationNumber}**. ` +
        `Mesa para ${guestsCount} persona${plural} el ${fecha} a las ${hora}${ocasStr}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: String(err),
      userMessage: 'Hubo un problema al crear la reserva. Por favor contáctanos directamente.',
    };
  }
}

// ──────────────────────────────────────────────────
// Tool: registrar_interes_cliente
// ──────────────────────────────────────────────────

async function toolRegistrarInteres(
  args: Record<string, any>,
  tenantId: string,
  sessionId: string,
): Promise<ToolResult> {
  try {
    const { nombre, telefono, interes } = args;

    // Update session with customer contact info
    await pool.query(
      `UPDATE chatbot_sessions SET customer_name = ?, customer_phone = ? WHERE id = ?`,
      [nombre, telefono, sessionId],
    );

    // Notify merchant
    await pool.query(
      `INSERT INTO merchant_notifications (tenant_id, type, title, message, data)
       VALUES (?, 'chatbot_lead', ?, ?, ?)`,
      [
        tenantId,
        `Nuevo lead: ${nombre}`,
        `${nombre} (${telefono}) — ${interes}`,
        JSON.stringify({ customerName: nombre, customerPhone: telefono, interest: interes, sessionId }),
      ],
    );

    return {
      success: true,
      data: { nombre, telefono, interes },
      userMessage:
        `Perfecto, ${nombre}. Tus datos han sido registrados. ` +
        `Un asesor te contactará pronto al ${telefono}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: String(err),
      userMessage: 'Tus datos han sido anotados. Te contactaremos pronto.',
    };
  }
}

// ──────────────────────────────────────────────────
// Tool: registrar_pedido
// ──────────────────────────────────────────────────

async function toolRegistrarPedido(
  args: Record<string, any>,
  tenantId: string,
  sessionId: string,
): Promise<ToolResult> {
  try {
    const { nombre, telefono, items, tipo, direccion, notas } = args;

    await pool.query(
      `UPDATE chatbot_sessions SET customer_name = ?, customer_phone = ? WHERE id = ?`,
      [nombre, telefono, sessionId],
    );

    // Parsear el texto de items ("2x Hamburguesa, 1 Papas") y casar con productos reales.
    const segments = String(items || '').split(/,|\by\b|\n|;/).map((s: string) => s.trim()).filter(Boolean);
    const lines: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }> = [];
    const unmatched: string[] = [];
    let subtotal = 0;
    for (const seg of segments) {
      const m = seg.match(/^(\d+)\s*[xX]?\s*(.+)$/);
      const qty = m ? Math.max(1, parseInt(m[1], 10)) : 1;
      const namePart = (m ? m[2] : seg).trim();
      const [prows] = (await pool.query(
        'SELECT id, name, sale_price FROM products WHERE tenant_id = ? AND name LIKE ? ORDER BY name LIMIT 1',
        [tenantId, `%${namePart}%`],
      )) as any;
      const p = prows[0];
      if (p) { const price = Number(p.sale_price); lines.push({ productId: p.id, productName: p.name, quantity: qty, unitPrice: price }); subtotal += price * qty; }
      else unmatched.push(seg);
    }

    const orderId = uuidv4();
    const orderNumber = 'CH' + Date.now().toString(36).toUpperCase().slice(-7);
    const tipoLabel = tipo === 'domicilio' ? 'Domicilio' : 'Para llevar';
    const noteParts = [`Pedido por chat (${tipoLabel})`];
    if (notas) noteParts.push(`Nota: ${notas}`);
    if (unmatched.length) noteParts.push(`Sin match: ${unmatched.join(', ')}`);
    const finalNotes = noteParts.join(' | ');

    // Crear el pedido REAL en el módulo de pedidos (storefront_orders) + sus líneas.
    await pool.query(
      `INSERT INTO storefront_orders
         (id, tenant_id, order_number, customer_name, customer_phone, address, notes, subtotal, shipping_cost, discount, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'pendiente')`,
      [orderId, tenantId, orderNumber, nombre, telefono, tipo === 'domicilio' ? (direccion || null) : null, finalNotes, subtotal, subtotal],
    );
    for (const l of lines) {
      await pool.query(
        `INSERT INTO storefront_order_items
           (order_id, product_id, product_name, quantity, unit_price, original_price, discount_percent, total_price)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [orderId, l.productId, l.productName, l.quantity, l.unitPrice, l.unitPrice, l.unitPrice * l.quantity],
      );
    }

    // Avisar al comerciante.
    await pool.query(
      `INSERT INTO merchant_notifications (tenant_id, type, title, message, data)
       VALUES (?, 'new_order', ?, ?, ?)`,
      [
        tenantId,
        `Nuevo pedido (${tipoLabel}): ${nombre}`,
        `#${orderNumber} — ${items}${direccion ? ` → ${direccion}` : ''}${notas ? ` | Nota: ${notas}` : ''}`,
        JSON.stringify({ orderId, orderNumber, customerName: nombre, customerPhone: telefono, items, tipo, direccion: direccion || null, notas: notas || null, sessionId }),
      ],
    );

    const confirmMsg =
      `¡Pedido registrado! 🧾 Número **#${orderNumber}**${subtotal > 0 ? ` por $${subtotal.toLocaleString('es-CO')}` : ''}. ` +
      (tipo === 'domicilio'
        ? `Te contactaremos al ${telefono} para confirmar el domicilio${direccion ? ` a ${direccion}` : ''}.`
        : `Te avisamos al ${telefono} cuando esté listo.`);

    return {
      success: true,
      data: { orderId, orderNumber, total: subtotal, lines: lines.length, unmatched },
      userMessage: confirmMsg,
    };
  } catch (err) {
    return {
      success: false,
      error: String(err),
      userMessage: 'Tu pedido fue anotado. Te contactaremos para confirmarlo.',
    };
  }
}
