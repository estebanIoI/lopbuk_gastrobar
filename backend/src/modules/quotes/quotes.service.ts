/**
 * Cotizaciones (ferretería F2) — el cliente cotiza su proyecto y el sistema
 * lo acompaña hasta la venta:
 *
 *   borrador → enviada → aceptada → facturada
 *                  ↘ cancelada / vencida (lazy, al listar)
 *
 * - Totales SIEMPRE server-side desde products (unitPrice negociable por ítem).
 * - Aceptar RESERVA stock (products.reserved_stock + sede_stock.reserved_stock
 *   de la sede de la cotización) — la mercancía del proyecto no se vende dos veces.
 * - Convertir crea la venta real vía salesService.create (1 clic) liberando la
 *   reserva primero; la venta descuenta total + desglose de sede como cualquier venta.
 * - Cancelar/vencer libera la reserva.
 */
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pool from '../../config/database';
import { AppError } from '../../common/middleware';
import { salesService } from '../sales/sales.service';

export interface QuoteItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;   // precio negociado; por defecto sale_price del producto
  discount?: number;    // descuento por línea (valor absoluto)
}

export interface QuoteItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

interface QuoteData {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  sedeId?: string;
  items: QuoteItemInput[];
  validUntil?: string;
  deliveryPromise?: string;
  notes?: string;
  status?: 'borrador' | 'enviada';
}

const RESERVING = 'aceptada';
const EDITABLE = ['borrador', 'enviada'];

class QuotesService {
  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Construye los ítems con precios reales de la BD y calcula totales. */
  private async buildItems(tenantId: string, inputs: QuoteItemInput[]): Promise<{ items: QuoteItem[]; subtotal: number; discount: number; total: number }> {
    const valid = (inputs || []).filter(i => i.productId && Number(i.quantity) > 0);
    if (!valid.length) throw new AppError('La cotización debe tener al menos un producto', 400);

    const ids = valid.map(i => i.productId);
    const [products] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, sale_price AS salePrice, stock FROM products WHERE tenant_id = ? AND id IN (?)`,
      [tenantId, ids]
    );
    const byId = new Map(products.map(p => [p.id, p]));

    const items: QuoteItem[] = [];
    let subtotal = 0;
    let discount = 0;
    for (const input of valid) {
      const product = byId.get(input.productId);
      if (!product) throw new AppError(`Producto no encontrado: ${input.productId}`, 404);
      const quantity = Number(input.quantity);
      const unitPrice = input.unitPrice !== undefined && input.unitPrice !== null
        ? Number(input.unitPrice)
        : Number(product.salePrice);
      if (unitPrice < 0) throw new AppError('Precio inválido', 400);
      const lineDiscount = Math.max(0, Number(input.discount) || 0);
      const lineSubtotal = Math.max(0, unitPrice * quantity - lineDiscount);
      items.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice,
        discount: lineDiscount,
        subtotal: lineSubtotal,
      });
      subtotal += unitPrice * quantity;
      discount += lineDiscount;
    }
    return { items, subtotal, discount, total: subtotal - discount };
  }

  private parseItems(raw: any): QuoteItem[] {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  }

  private async generateQuoteNumber(tenantId: string): Promise<string> {
    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM quotes WHERE tenant_id = ?', [tenantId]
    ) as any;
    return `COT-${String(Number(row.n) + 1).padStart(5, '0')}`;
  }

  /** Reserva/libera el stock de una cotización (products + sede_stock de su sede). */
  private async applyReservation(tenantId: string, quote: any, direction: 1 | -1): Promise<void> {
    const items = this.parseItems(quote.items);
    for (const item of items) {
      if (direction === 1) {
        // Reservar: valida disponibilidad global (stock - reservado)
        const [result] = await pool.query<ResultSetHeader>(
          `UPDATE products SET reserved_stock = reserved_stock + ?
            WHERE id = ? AND tenant_id = ? AND stock - reserved_stock >= ?`,
          [item.quantity, item.productId, tenantId, item.quantity]
        );
        if (result.affectedRows === 0) {
          throw new AppError(`Stock insuficiente para reservar "${item.productName}" (solicitado: ${item.quantity})`, 400);
        }
      } else {
        await pool.query(
          `UPDATE products SET reserved_stock = GREATEST(0, reserved_stock - ?) WHERE id = ? AND tenant_id = ?`,
          [item.quantity, item.productId, tenantId]
        );
      }
      if (quote.sede_id) {
        await pool.query(
          direction === 1
            ? `UPDATE sede_stock SET reserved_stock = reserved_stock + ? WHERE tenant_id = ? AND sede_id = ? AND product_id = ?`
            : `UPDATE sede_stock SET reserved_stock = GREATEST(0, reserved_stock - ?) WHERE tenant_id = ? AND sede_id = ? AND product_id = ?`,
          [item.quantity, tenantId, quote.sede_id, item.productId]
        );
      }
    }
  }

  /** Vencimiento lazy: marca vencidas las cotizaciones cuya validez pasó y libera reservas. */
  private async expireStale(tenantId: string): Promise<void> {
    const [stale] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM quotes
        WHERE tenant_id = ? AND status IN ('borrador','enviada','aceptada')
          AND valid_until IS NOT NULL AND valid_until < CURDATE()`,
      [tenantId]
    );
    for (const quote of stale) {
      if (quote.status === RESERVING) {
        await this.applyReservation(tenantId, quote, -1).catch(() => {});
      }
      await pool.query(`UPDATE quotes SET status = 'vencida' WHERE id = ?`, [quote.id]);
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(tenantId: string, userId: string, userName: string, data: QuoteData) {
    const { items, subtotal, discount, total } = await this.buildItems(tenantId, data.items);
    const id = uuidv4();
    const quoteNumber = await this.generateQuoteNumber(tenantId);
    const status = data.status === 'enviada' ? 'enviada' : 'borrador';
    await pool.query<ResultSetHeader>(
      `INSERT INTO quotes (id, tenant_id, quote_number, customer_id, customer_name, customer_phone, customer_email,
                           seller_id, seller_name, sede_id, items, subtotal, discount, tax, total, status,
                           valid_until, delivery_promise, notes, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenantId, quoteNumber,
        data.customerId || null, data.customerName || null, data.customerPhone || null, data.customerEmail || null,
        userId, userName, data.sedeId || null,
        JSON.stringify(items), subtotal, discount, total, status,
        data.validUntil || null, data.deliveryPromise || null, data.notes || null,
        status === 'enviada' ? new Date() : null,
      ]
    );
    return { id, quoteNumber, status, subtotal, discount, total, items };
  }

  async update(tenantId: string, quoteId: string, data: QuoteData) {
    const quote = await this.findById(tenantId, quoteId);
    if (!EDITABLE.includes(quote.status)) {
      throw new AppError(`Solo se pueden editar cotizaciones en borrador o enviadas (actual: ${quote.status})`, 400);
    }
    const { items, subtotal, discount, total } = await this.buildItems(tenantId, data.items);
    await pool.query(
      `UPDATE quotes SET customer_id = ?, customer_name = ?, customer_phone = ?, customer_email = ?,
              sede_id = ?, items = ?, subtotal = ?, discount = ?, total = ?,
              valid_until = ?, delivery_promise = ?, notes = ?
        WHERE id = ? AND tenant_id = ?`,
      [
        data.customerId ?? quote.customer_id, data.customerName ?? quote.customer_name,
        data.customerPhone ?? quote.customer_phone, data.customerEmail ?? quote.customer_email,
        data.sedeId ?? quote.sede_id, JSON.stringify(items), subtotal, discount, total,
        data.validUntil ?? quote.valid_until, data.deliveryPromise ?? quote.delivery_promise,
        data.notes ?? quote.notes, quoteId, tenantId,
      ]
    );
    return this.findById(tenantId, quoteId);
  }

  async findById(tenantId: string, quoteId: string): Promise<any> {
    const [[quote]] = await pool.query<RowDataPacket[]>(
      `SELECT q.*, s.name AS sedeName FROM quotes q
         LEFT JOIN sedes s ON s.id = q.sede_id
        WHERE q.id = ? AND q.tenant_id = ?`,
      [quoteId, tenantId]
    ) as any;
    if (!quote) throw new AppError('Cotización no encontrada', 404);
    quote.items = this.parseItems(quote.items);
    return quote;
  }

  async list(tenantId: string, filters: { status?: string; search?: string } = {}) {
    await this.expireStale(tenantId);
    const params: any[] = [tenantId];
    let where = 'q.tenant_id = ?';
    if (filters.status) { where += ' AND q.status = ?'; params.push(filters.status); }
    if (filters.search) {
      where += ' AND (q.quote_number LIKE ? OR q.customer_name LIKE ? OR q.customer_phone LIKE ?)';
      const like = `%${filters.search}%`;
      params.push(like, like, like);
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT q.id, q.quote_number AS quoteNumber, q.customer_name AS customerName,
              q.customer_phone AS customerPhone, q.seller_name AS sellerName,
              q.sede_id AS sedeId, s.name AS sedeName, q.items,
              q.subtotal, q.discount, q.total, q.status,
              q.valid_until AS validUntil, q.delivery_promise AS deliveryPromise,
              q.notes, q.sale_id AS saleId, q.sent_at AS sentAt, q.accepted_at AS acceptedAt,
              q.created_at AS createdAt
         FROM quotes q
         LEFT JOIN sedes s ON s.id = q.sede_id
        WHERE ${where}
        ORDER BY q.created_at DESC
        LIMIT 200`,
      params
    );
    return rows.map(r => ({ ...r, items: this.parseItems(r.items), subtotal: Number(r.subtotal), discount: Number(r.discount), total: Number(r.total) }));
  }

  // ── Cascada de estados ─────────────────────────────────────────────────────

  async setStatus(tenantId: string, quoteId: string, newStatus: string) {
    const quote = await this.findByIdRaw(tenantId, quoteId);
    const allowed: Record<string, string[]> = {
      borrador: ['enviada', 'aceptada', 'cancelada'],
      enviada: ['aceptada', 'cancelada'],
      aceptada: ['cancelada'],
    };
    if (!allowed[quote.status]?.includes(newStatus)) {
      throw new AppError(`No se puede pasar de "${quote.status}" a "${newStatus}"`, 400);
    }

    if (newStatus === RESERVING) {
      await this.applyReservation(tenantId, quote, 1);
      await pool.query(`UPDATE quotes SET status = 'aceptada', accepted_at = NOW() WHERE id = ?`, [quoteId]);
    } else if (newStatus === 'cancelada') {
      if (quote.status === RESERVING) await this.applyReservation(tenantId, quote, -1);
      await pool.query(`UPDATE quotes SET status = 'cancelada' WHERE id = ?`, [quoteId]);
    } else if (newStatus === 'enviada') {
      await pool.query(`UPDATE quotes SET status = 'enviada', sent_at = NOW() WHERE id = ?`, [quoteId]);
    }
    return { id: quoteId, status: newStatus };
  }

  /** Convertir a venta (1 clic): libera la reserva y factura por salesService. */
  async convertToSale(
    tenantId: string, quoteId: string,
    payment: { paymentMethod: string; amountPaid?: number; applyTax?: boolean },
    seller: { id: string; name: string }
  ) {
    const quote = await this.findByIdRaw(tenantId, quoteId);
    if (!['borrador', 'enviada', 'aceptada'].includes(quote.status)) {
      throw new AppError(`Esta cotización no se puede facturar (estado: ${quote.status})`, 400);
    }
    const items = this.parseItems(quote.items);

    // Liberar reserva antes de vender (la venta descuenta stock real)
    if (quote.status === RESERVING) {
      await this.applyReservation(tenantId, quote, -1);
    }

    try {
      const sale = await salesService.create(tenantId, {
        items: items.map((i: QuoteItem) => ({
          productId: i.productId,
          quantity: i.quantity,
          discount: i.discount || 0,
          unitPrice: i.unitPrice,
        })),
        paymentMethod: (payment.paymentMethod || 'efectivo') as any,
        amountPaid: payment.amountPaid ?? Number(quote.total),
        customerId: quote.customer_id || undefined,
        customerName: quote.customer_name || undefined,
        customerPhone: quote.customer_phone || undefined,
        sellerId: seller.id,
        sellerName: seller.name,
        sedeId: quote.sede_id || undefined,
        applyTax: payment.applyTax,
        notes: `Cotización ${quote.quote_number}`,
      } as any);

      await pool.query(
        `UPDATE quotes SET status = 'facturada', sale_id = ? WHERE id = ?`,
        [sale.id, quoteId]
      );
      return { quoteId, saleId: sale.id, invoiceNumber: (sale as any).invoiceNumber, total: (sale as any).total };
    } catch (err) {
      // La venta falló: re-reservar para no perder el apartado del cliente
      if (quote.status === RESERVING) {
        await this.applyReservation(tenantId, quote, 1).catch(() => {});
      }
      throw err;
    }
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────

  async stats(tenantId: string) {
    await this.expireStale(tenantId);
    const [[month]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total,
              SUM(status = 'facturada') AS converted,
              SUM(status = 'aceptada') AS accepted,
              SUM(status IN ('enviada','borrador')) AS open_,
              SUM(status = 'vencida') AS expired,
              COALESCE(SUM(CASE WHEN status = 'facturada' THEN total ELSE 0 END), 0) AS convertedValue,
              COALESCE(SUM(CASE WHEN status IN ('borrador','enviada','aceptada') THEN total ELSE 0 END), 0) AS pipelineValue
         FROM quotes
        WHERE tenant_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [tenantId]
    ) as any;
    const total = Number(month.total) || 0;
    const converted = Number(month.converted) || 0;
    return {
      month: {
        total,
        converted,
        accepted: Number(month.accepted) || 0,
        open: Number(month.open_) || 0,
        expired: Number(month.expired) || 0,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
        convertedValue: Number(month.convertedValue) || 0,
        pipelineValue: Number(month.pipelineValue) || 0,
      },
    };
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────────

  /** Envía el resumen de la cotización por WhatsApp (transaccional: el cliente la pidió). */
  async sendWhatsApp(tenantId: string, quoteId: string, storeName: string) {
    const quote = await this.findByIdRaw(tenantId, quoteId);
    const phone = String(quote.customer_phone || '').replace(/\D/g, '');
    if (phone.length < 7) throw new AppError('La cotización no tiene un teléfono válido', 400);

    const [cfg] = await pool.query<RowDataPacket[]>(
      'SELECT evolution_instance FROM chatbot_config WHERE tenant_id = ? LIMIT 1', [tenantId]
    ) as any;
    const instance = cfg?.[0]?.evolution_instance;
    if (!instance) throw new AppError('WhatsApp no está conectado en este comercio', 400);

    const items = this.parseItems(quote.items);
    const fmt = (n: number) => `$${Number(n).toLocaleString('es-CO')}`;
    const lines = items.map((i: QuoteItem) => `• ${i.productName} × ${i.quantity} — ${fmt(i.subtotal)}`).join('\n');
    const validez = quote.valid_until ? `\n📅 Válida hasta: ${String(quote.valid_until).slice(0, 10)}` : '';
    const entrega = quote.delivery_promise ? `\n🚚 Entrega estimada: ${String(quote.delivery_promise).slice(0, 10)}` : '';
    const text =
      `🧾 *Cotización ${quote.quote_number}* — ${storeName}\n\n${lines}\n\n` +
      `*Total: ${fmt(quote.total)}*${validez}${entrega}\n\n` +
      `Responde este mensaje para confirmar tu pedido. ¡Gracias!`;

    const { sendTextMessage } = await import('../whatsapp/whatsapp.service');
    await sendTextMessage(instance, phone, text);

    if (quote.status === 'borrador') {
      await pool.query(`UPDATE quotes SET status = 'enviada', sent_at = NOW() WHERE id = ?`, [quoteId]);
    }
    return { sent: true, to: phone };
  }

  private async findByIdRaw(tenantId: string, quoteId: string): Promise<any> {
    const [[quote]] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM quotes WHERE id = ? AND tenant_id = ?', [quoteId, tenantId]
    ) as any;
    if (!quote) throw new AppError('Cotización no encontrada', 404);
    return quote;
  }
}

export default new QuotesService();
