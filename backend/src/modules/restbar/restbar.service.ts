import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── Row interfaces ───────────────────────────────────────────────────────────

interface TableRow extends RowDataPacket {
  id: string; tenant_id: string; number: string; capacity: number;
  area: string | null; status: string; qr_code: string | null;
  notes: string | null; is_active: number;
  active_order_id: string | null; active_order_number: string | null;
  active_order_total: number | null; active_items_count: number | null;
}

interface OrderRow extends RowDataPacket {
  id: string; tenant_id: string; table_id: string; order_number: string;
  waiter_id: string; waiter_name: string; guests_count: number;
  status: string; notes: string | null; subtotal: number; tax: number;
  discount: number; total: number; sale_id: string | null;
  opened_at: Date; closed_at: Date | null;
  table_number: string; table_area: string | null;
}

interface OrderItemRow extends RowDataPacket {
  id: string; order_id: string; menu_item_id: string; menu_item_name: string;
  preparation_area: string; quantity: number; unit_price: number;
  subtotal: number; discount: number; status: string;
  guest_number: number | null; item_notes: string | null;
  sent_to_kitchen_at: Date | null; ready_at: Date | null; delivered_at: Date | null;
}

interface RecipeRow extends RowDataPacket {
  ingredient_id: string; quantity: number; ingredient_stock: number;
}

interface SequenceRow extends RowDataPacket { current_number: number; prefix: string; }
interface CountRow extends RowDataPacket { total: number; }
interface ProductRow extends RowDataPacket {
  id: string; name: string; sku: string; sale_price: number;
  preparation_area: string | null; prep_time_minutes: number | null;
  available_in_menu: number; stock: number; category: string;
  description: string | null; image_url: string | null;
}

// ─── Data transfer objects ─────────────────────────────────────────────────────

export interface CreateTableData {
  number: string; capacity?: number; area?: string; notes?: string;
}

export interface CreateOrderData {
  tableId: string; guestsCount?: number; notes?: string;
}

export interface AddItemData {
  menuItemId: string; quantity: number; itemNotes?: string; guestNumber?: number;
}

export interface UpdateItemData {
  quantity?: number; itemNotes?: string; guestNumber?: number | null;
}

export interface ProcessPaymentData {
  paymentMethod: 'efectivo' | 'tarjeta' | 'nequi' | 'transferencia' | 'mixto';
  amountPaid: number; guestNumber?: number | null;
  cashSessionId?: string; notes?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class RestbarService {

  // ── TABLES ────────────────────────────────────────────────────────────────

  async getTables(tenantId: string) {
    const [rows] = await db.execute<TableRow[]>(
      `SELECT t.*,
              o.id          AS active_order_id,
              o.order_number AS active_order_number,
              o.total       AS active_order_total,
              (SELECT COUNT(*) FROM rb_order_items oi
               WHERE oi.order_id = o.id
                 AND oi.status NOT IN ('cancelado','entregado')) AS active_items_count
       FROM rb_tables t
       LEFT JOIN rb_orders o
         ON o.table_id = t.id AND o.status NOT IN ('cerrada','cancelada')
       WHERE t.tenant_id = ? AND t.is_active = 1
       ORDER BY t.number`,
      [tenantId]
    );
    return rows.map(r => ({
      id: r.id, number: r.number, capacity: r.capacity,
      area: r.area, status: r.status, qrCode: r.qr_code, notes: r.notes,
      activeOrder: r.active_order_id
        ? {
            id: r.active_order_id,
            orderNumber: r.active_order_number,
            total: r.active_order_total ?? 0,
            itemsCount: r.active_items_count ?? 0,
          }
        : null,
    }));
  }

  async createTable(tenantId: string, data: CreateTableData) {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO rb_tables (id, tenant_id, number, capacity, area, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tenantId, data.number, data.capacity ?? 4, data.area ?? null, data.notes ?? null]
    );
    return this.getTableById(tenantId, id);
  }

  async updateTable(tenantId: string, id: string, data: Partial<CreateTableData> & { isActive?: boolean }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.number !== undefined)    { fields.push('number = ?');    values.push(data.number); }
    if (data.capacity !== undefined)  { fields.push('capacity = ?');  values.push(data.capacity); }
    if (data.area !== undefined)      { fields.push('area = ?');      values.push(data.area); }
    if (data.notes !== undefined)     { fields.push('notes = ?');     values.push(data.notes); }
    if (data.isActive !== undefined)  { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
    if (fields.length === 0) throw new AppError('Nada que actualizar', 400);
    values.push(id, tenantId);
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE rb_tables SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );
    if (result.affectedRows === 0) throw new AppError('Mesa no encontrada', 404);
    return this.getTableById(tenantId, id);
  }

  async updateTableStatus(tenantId: string, id: string, status: string) {
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE rb_tables SET status = ? WHERE id = ? AND tenant_id = ?`,
      [status, id, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Mesa no encontrada', 404);
    return this.getTableById(tenantId, id);
  }

  async deleteTable(tenantId: string, id: string) {
    const [active] = await db.execute<CountRow[]>(
      `SELECT COUNT(*) as total FROM rb_orders
       WHERE table_id = ? AND tenant_id = ? AND status NOT IN ('cerrada','cancelada')`,
      [id, tenantId]
    );
    if (active[0].total > 0) throw new AppError('La mesa tiene comandas activas. Ciérralas antes de eliminar.', 409);
    const [result] = await db.execute<ResultSetHeader>(
      `DELETE FROM rb_tables WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Mesa no encontrada', 404);
  }

  private async getTableById(tenantId: string, id: string) {
    const [rows] = await db.execute<TableRow[]>(
      `SELECT * FROM rb_tables WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Mesa no encontrada', 404);
    return rows[0];
  }

  // ── MENU ──────────────────────────────────────────────────────────────────

  async getMenu(tenantId: string) {
    const [rows] = await db.execute<ProductRow[]>(
      `SELECT p.id, p.name, p.sku, p.sale_price, p.preparation_area,
              p.prep_time_minutes, p.available_in_menu, p.stock,
              p.category, p.description, p.image_url,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category AND c.tenant_id = p.tenant_id
       WHERE p.tenant_id = ? AND p.is_menu_item = 1
       ORDER BY c.name, p.name`,
      [tenantId]
    );
    return rows.map(r => ({
      id: r.id, name: r.name, sku: r.sku, price: Number(r.sale_price),
      preparationArea: r.preparation_area, prepTimeMinutes: r.prep_time_minutes,
      availableInMenu: r.available_in_menu === 1,
      stock: r.stock, category: (r as any).category_name ?? r.category,
      description: r.description, imageUrl: r.image_url,
    }));
  }

  async toggleMenuAvailability(tenantId: string, id: string) {
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE products
       SET available_in_menu = NOT available_in_menu
       WHERE id = ? AND tenant_id = ? AND is_menu_item = 1`,
      [id, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Ítem de menú no encontrado', 404);
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT available_in_menu FROM products WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    return { id, availableInMenu: (rows[0] as any).available_in_menu === 1 };
  }

  /** Calcula cuántos platos se pueden hacer con el stock actual de cada ingrediente */
  async getMenuItemYield(tenantId: string, menuItemId: string) {
    const [recipes] = await db.execute<RecipeRow[]>(
      `SELECT pr.ingredient_id, pr.quantity, p.stock AS ingredient_stock, p.name AS ingredient_name,
              p.weight_unit
       FROM product_recipes pr
       JOIN products p ON p.id = pr.ingredient_id
       WHERE pr.tenant_id = ? AND pr.product_id = ?`,
      [tenantId, menuItemId]
    );
    if (recipes.length === 0) return { menuItemId, yieldCount: null, limitedBy: null };

    let minYield = Infinity;
    let limitedBy = '';
    for (const r of recipes) {
      const possible = Math.floor(Number(r.ingredient_stock) / Number(r.quantity));
      if (possible < minYield) {
        minYield = possible;
        limitedBy = (r as any).ingredient_name;
      }
    }
    return {
      menuItemId,
      yieldCount: minYield === Infinity ? null : minYield,
      limitedBy,
      ingredients: recipes.map(r => ({
        ingredientId: r.ingredient_id,
        name: (r as any).ingredient_name,
        stockAvailable: Number(r.ingredient_stock),
        quantityPerDish: Number(r.quantity),
        possibleDishes: Math.floor(Number(r.ingredient_stock) / Number(r.quantity)),
      })),
    };
  }

  async getMenuCatalog(tenantId: string) {
    const [rows] = await db.execute<ProductRow[]>(
      `SELECT p.id, p.name, p.sku, p.sale_price, p.category,
              p.is_menu_item, p.available_in_menu, p.preparation_area,
              p.prep_time_minutes, p.stock, p.description, p.image_url,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category AND c.tenant_id = p.tenant_id
       WHERE p.tenant_id = ?
       ORDER BY p.is_menu_item DESC, c.name, p.name`,
      [tenantId]
    );
    return rows.map(r => ({
      id: r.id, name: r.name, sku: r.sku, price: Number(r.sale_price),
      category: (r as any).category_name ?? r.category,
      isMenuItem: (r as any).is_menu_item === 1,
      availableInMenu: r.available_in_menu === 1,
      preparationArea: r.preparation_area,
      prepTimeMinutes: r.prep_time_minutes,
      stock: r.stock, description: r.description, imageUrl: r.image_url,
    }));
  }

  async updateMenuSettings(tenantId: string, id: string, data: {
    isMenuItem: boolean; preparationArea?: string | null; prepTimeMinutes?: number | null;
  }) {
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE products
       SET is_menu_item = ?, preparation_area = ?, prep_time_minutes = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        data.isMenuItem ? 1 : 0,
        data.isMenuItem ? (data.preparationArea ?? 'cocina') : null,
        data.isMenuItem ? (data.prepTimeMinutes ?? null) : null,
        id, tenantId,
      ]
    );
    if (result.affectedRows === 0) throw new AppError('Producto no encontrado', 404);
    return { id, isMenuItem: data.isMenuItem };
  }

  // ── ORDERS ────────────────────────────────────────────────────────────────

  async getOrders(tenantId: string, status?: string) {
    const whereStatus = status ? `AND o.status = '${status}'` : `AND o.status NOT IN ('cerrada','cancelada')`;
    const [rows] = await db.execute<OrderRow[]>(
      `SELECT o.*, t.number AS table_number, t.area AS table_area
       FROM rb_orders o
       JOIN rb_tables t ON t.id = o.table_id
       WHERE o.tenant_id = ? ${whereStatus}
       ORDER BY o.opened_at DESC`,
      [tenantId]
    );
    return rows.map(this.mapOrder);
  }

  async getOrderById(tenantId: string, orderId: string) {
    const [orders] = await db.execute<OrderRow[]>(
      `SELECT o.*, t.number AS table_number, t.area AS table_area
       FROM rb_orders o
       JOIN rb_tables t ON t.id = o.table_id
       WHERE o.id = ? AND o.tenant_id = ?`,
      [orderId, tenantId]
    );
    if (orders.length === 0) throw new AppError('Comanda no encontrada', 404);

    const [items] = await db.execute<OrderItemRow[]>(
      `SELECT * FROM rb_order_items WHERE order_id = ? ORDER BY created_at`,
      [orderId]
    );

    return {
      ...this.mapOrder(orders[0]),
      items: items.map(this.mapOrderItem),
    };
  }

  async createOrder(tenantId: string, waiterId: string, waiterName: string, data: CreateOrderData) {
    // Verify table exists and is libre
    const [tables] = await db.execute<RowDataPacket[]>(
      `SELECT id, status FROM rb_tables WHERE id = ? AND tenant_id = ? AND is_active = 1`,
      [data.tableId, tenantId]
    );
    if (tables.length === 0) throw new AppError('Mesa no encontrada', 404);
    if (tables[0].status === 'ocupada') throw new AppError('La mesa ya tiene una comanda abierta', 409);

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Get/create order sequence
      await connection.execute(
        `INSERT INTO rb_order_sequence (tenant_id, prefix, current_number) VALUES (?, 'C', 0)
         ON DUPLICATE KEY UPDATE current_number = current_number`,
        [tenantId]
      );
      await connection.execute(
        `UPDATE rb_order_sequence SET current_number = current_number + 1 WHERE tenant_id = ?`,
        [tenantId]
      );
      const [seqRows] = await connection.execute<SequenceRow[]>(
        `SELECT prefix, current_number FROM rb_order_sequence WHERE tenant_id = ?`,
        [tenantId]
      );
      const seq = seqRows[0];
      const orderNumber = `${seq.prefix}-${String(seq.current_number).padStart(4, '0')}`;

      const orderId = uuidv4();
      await connection.execute(
        `INSERT INTO rb_orders (id, tenant_id, table_id, order_number, waiter_id, waiter_name, guests_count, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, tenantId, data.tableId, orderNumber, waiterId, waiterName,
         data.guestsCount ?? 1, data.notes ?? null]
      );

      await connection.execute(
        `UPDATE rb_tables SET status = 'ocupada' WHERE id = ? AND tenant_id = ?`,
        [data.tableId, tenantId]
      );

      await connection.commit();
      return this.getOrderById(tenantId, orderId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async cancelOrder(tenantId: string, orderId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id, table_id FROM rb_orders WHERE id = ? AND tenant_id = ? AND status NOT IN ('cerrada','cancelada')`,
      [orderId, tenantId]
    );
    if (rows.length === 0) throw new AppError('Comanda no encontrada o ya cerrada', 404);
    const tableId = rows[0].table_id;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE rb_orders SET status = 'cancelada' WHERE id = ? AND tenant_id = ?`,
        [orderId, tenantId]
      );
      await connection.execute(
        `UPDATE rb_tables SET status = 'libre' WHERE id = ? AND tenant_id = ?`,
        [tableId, tenantId]
      );
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async updateOrderNotes(tenantId: string, orderId: string, notes: string | null) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM rb_orders WHERE id = ? AND tenant_id = ? AND status NOT IN ('cerrada','cancelada')`,
      [orderId, tenantId]
    );
    if (rows.length === 0) throw new AppError('Comanda no encontrada o ya cerrada', 404);
    await db.execute(`UPDATE rb_orders SET notes = ? WHERE id = ? AND tenant_id = ?`, [notes, orderId, tenantId]);
    return this.getOrderById(tenantId, orderId);
  }

  async addItem(tenantId: string, orderId: string, data: AddItemData) {
    // Verify order is open
    const [orders] = await db.execute<RowDataPacket[]>(
      `SELECT status FROM rb_orders WHERE id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );
    if (orders.length === 0) throw new AppError('Comanda no encontrada', 404);
    if (!['abierta', 'en_proceso'].includes(orders[0].status))
      throw new AppError('No se pueden agregar ítems a una comanda cerrada o entregada', 409);

    // Verify menu item
    const [products] = await db.execute<ProductRow[]>(
      `SELECT id, name, sale_price, preparation_area, available_in_menu
       FROM products WHERE id = ? AND tenant_id = ? AND is_menu_item = 1`,
      [data.menuItemId, tenantId]
    );
    if (products.length === 0) throw new AppError('Ítem de menú no encontrado', 404);
    if (!products[0].available_in_menu) throw new AppError('El ítem no está disponible en este momento', 409);

    const p = products[0];
    const itemId = uuidv4();
    const unitPrice = Number(p.sale_price);
    const subtotal = unitPrice * data.quantity;

    await db.execute(
      `INSERT INTO rb_order_items
         (id, tenant_id, order_id, menu_item_id, menu_item_name, preparation_area,
          quantity, unit_price, subtotal, item_notes, guest_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, tenantId, orderId, p.id, p.name, p.preparation_area ?? 'cocina',
       data.quantity, unitPrice, subtotal, data.itemNotes ?? null, data.guestNumber ?? null]
    );

    await this.recalcOrderTotals(orderId, tenantId);
    return this.getOrderById(tenantId, orderId);
  }

  async updateItem(tenantId: string, orderId: string, itemId: string, data: UpdateItemData) {
    const [items] = await db.execute<OrderItemRow[]>(
      `SELECT oi.*, o.status AS order_status
       FROM rb_order_items oi
       JOIN rb_orders o ON o.id = oi.order_id
       WHERE oi.id = ? AND oi.order_id = ? AND oi.tenant_id = ?`,
      [itemId, orderId, tenantId]
    );
    if (items.length === 0) throw new AppError('Ítem no encontrado', 404);
    if (items[0].status === 'entregado') throw new AppError('No se puede modificar un ítem ya entregado', 409);

    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.quantity !== undefined) {
      const subtotal = Number(items[0].unit_price) * data.quantity;
      fields.push('quantity = ?', 'subtotal = ?');
      values.push(data.quantity, subtotal);
    }
    if (data.itemNotes !== undefined)   { fields.push('item_notes = ?');   values.push(data.itemNotes); }
    if (data.guestNumber !== undefined) { fields.push('guest_number = ?'); values.push(data.guestNumber); }
    if (fields.length === 0) throw new AppError('Nada que actualizar', 400);
    values.push(itemId);
    await db.execute(`UPDATE rb_order_items SET ${fields.join(', ')} WHERE id = ?`, values);
    await this.recalcOrderTotals(orderId, tenantId);
    return this.getOrderById(tenantId, orderId);
  }

  async removeItem(tenantId: string, orderId: string, itemId: string) {
    const [items] = await db.execute<RowDataPacket[]>(
      `SELECT status FROM rb_order_items WHERE id = ? AND order_id = ? AND tenant_id = ?`,
      [itemId, orderId, tenantId]
    );
    if (items.length === 0) throw new AppError('Ítem no encontrado', 404);
    if (items[0].status === 'en_preparacion')
      throw new AppError('El ítem ya está en preparación', 409);
    await db.execute(`DELETE FROM rb_order_items WHERE id = ? AND tenant_id = ?`, [itemId, tenantId]);
    await this.recalcOrderTotals(orderId, tenantId);
    return this.getOrderById(tenantId, orderId);
  }

  async sendToKitchen(tenantId: string, orderId: string) {
    const [orders] = await db.execute<RowDataPacket[]>(
      `SELECT status FROM rb_orders WHERE id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );
    if (orders.length === 0) throw new AppError('Comanda no encontrada', 404);
    if (!['abierta', 'en_proceso'].includes(orders[0].status))
      throw new AppError('La comanda no está en estado válido para enviar', 409);

    await db.execute(
      `UPDATE rb_order_items
       SET status = 'pendiente', sent_to_kitchen_at = NOW()
       WHERE order_id = ? AND tenant_id = ? AND status = 'pendiente' AND sent_to_kitchen_at IS NULL`,
      [orderId, tenantId]
    );
    await db.execute(
      `UPDATE rb_orders SET status = 'en_proceso' WHERE id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );
    return this.getOrderById(tenantId, orderId);
  }

  // ── KITCHEN / BAR DISPLAY ─────────────────────────────────────────────────

  async getAreaDisplay(tenantId: string, area: 'cocina' | 'bar') {
    const areaFilter = area === 'cocina'
      ? `AND oi.preparation_area IN ('cocina','ambos')`
      : `AND oi.preparation_area IN ('bar','ambos')`;

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         o.id AS order_id, o.order_number, o.notes AS order_notes,
         o.waiter_name, o.opened_at,
         t.number AS table_number, t.area AS table_area,
         oi.id AS item_id, oi.menu_item_name, oi.quantity,
         oi.item_notes, oi.status AS item_status,
         oi.sent_to_kitchen_at, oi.preparation_area
       FROM rb_order_items oi
       JOIN rb_orders o ON o.id = oi.order_id
       JOIN rb_tables t ON t.id = o.table_id
       WHERE oi.tenant_id = ?
         AND oi.status IN ('pendiente','en_preparacion')
         AND oi.sent_to_kitchen_at IS NOT NULL
         AND o.status NOT IN ('cerrada','cancelada')
         ${areaFilter}
       ORDER BY oi.sent_to_kitchen_at ASC, o.opened_at ASC`,
      [tenantId]
    );

    // Agrupar por comanda
    const orderMap = new Map<string, any>();
    for (const row of rows) {
      if (!orderMap.has(row.order_id)) {
        orderMap.set(row.order_id, {
          orderId: row.order_id, orderNumber: row.order_number,
          tableNumber: row.table_number, tableArea: row.table_area,
          waiterName: row.waiter_name, openedAt: row.opened_at,
          orderNotes: row.order_notes, items: [],
        });
      }
      orderMap.get(row.order_id).items.push({
        itemId: row.item_id, name: row.menu_item_name, quantity: row.quantity,
        notes: row.item_notes, status: row.item_status,
        preparationArea: row.preparation_area, sentAt: row.sent_to_kitchen_at,
      });
    }
    return Array.from(orderMap.values());
  }

  async updateItemStatus(tenantId: string, itemId: string, status: string) {
    const validStatuses = ['en_preparacion', 'listo', 'entregado', 'cancelado'];
    if (!validStatuses.includes(status)) throw new AppError('Estado inválido', 400);

    const timestampField: Record<string, string> = {
      listo: ', ready_at = NOW()',
      entregado: ', delivered_at = NOW()',
    };
    const extra = timestampField[status] ?? '';

    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE rb_order_items SET status = ? ${extra} WHERE id = ? AND tenant_id = ?`,
      [status, itemId, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Ítem no encontrado', 404);

    // Verificar si todos los ítems de la comanda están listos
    const [item] = await db.execute<RowDataPacket[]>(
      `SELECT order_id FROM rb_order_items WHERE id = ?`, [itemId]
    );
    if (item.length > 0) await this.checkOrderReadiness(tenantId, item[0].order_id);

    return { itemId, status };
  }

  // ── PAYMENT ───────────────────────────────────────────────────────────────

  // ── GUEST BREAKDOWN ────────────────────────────────────────────────────────

  async getGuestBreakdown(tenantId: string, orderId: string) {
    const order = await this.getOrderById(tenantId, orderId);
    const activeItems = order.items.filter((i: any) => i.status !== 'cancelado' && i.status !== 'entregado');

    // Parse stored guest names from order notes JSON
    let guestNames: Record<number, string> = {};
    try {
      const parsed = JSON.parse(order.notes ?? '{}');
      if (parsed.guests) {
        for (const g of parsed.guests) guestNames[g.number] = g.name;
      }
    } catch { /* no guest names stored */ }

    // Group items by guest_number (null = mesa general)
    const groups: Record<string, any> = {};
    for (const item of activeItems) {
      const key = item.guestNumber != null ? String(item.guestNumber) : 'general';
      if (!groups[key]) {
        groups[key] = {
          guestNumber: item.guestNumber ?? null,
          guestName: item.guestNumber != null ? (guestNames[item.guestNumber] ?? `Comensal ${item.guestNumber}`) : 'Mesa general',
          items: [],
          subtotal: 0,
        };
      }
      groups[key].items.push(item);
      groups[key].subtotal += item.subtotal;
    }

    // Already-paid guest_numbers from rb_payments
    const [payments] = await db.execute<RowDataPacket[]>(
      `SELECT guest_number FROM rb_payments WHERE order_id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );
    const paidKeys = new Set(payments.map((p: any) => p.guest_number == null ? 'general' : String(p.guest_number)));

    return {
      orderId,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      total: order.total,
      guests: Object.values(groups).map((g: any) => ({ ...g, paid: paidKeys.has(g.guestNumber == null ? 'general' : String(g.guestNumber)) })),
      allPaid: Object.values(groups).every((g: any) => paidKeys.has(g.guestNumber == null ? 'general' : String(g.guestNumber))),
    };
  }

  async processPayment(
    tenantId: string,
    orderId: string,
    cashierId: string,
    cashierName: string,
    data: ProcessPaymentData
  ) {
    const order = await this.getOrderById(tenantId, orderId);
    if (['cerrada', 'cancelada'].includes(order.status))
      throw new AppError('La comanda ya está cerrada o cancelada', 409);

    // Determine which items to bill in this payment
    const isGuestPayment = data.guestNumber != null;
    const billableItems = order.items.filter((i: any) => {
      if (i.status === 'cancelado' || i.status === 'entregado') return false; // already paid/cancelled
      if (isGuestPayment) return i.guestNumber === data.guestNumber;
      return true; // full-table: pay everything remaining
    });

    if (billableItems.length === 0)
      throw new AppError('No hay ítems pendientes de pago para este comensal', 400);

    // Check this guest hasn't already been paid
    if (isGuestPayment) {
      const [prevPay] = await db.execute<RowDataPacket[]>(
        `SELECT id FROM rb_payments WHERE order_id = ? AND tenant_id = ? AND guest_number = ?`,
        [orderId, tenantId, data.guestNumber]
      );
      if ((prevPay as any[]).length > 0)
        throw new AppError('Este comensal ya tiene un pago registrado', 409);
    }

    const subtotal = billableItems.reduce((s: number, i: any) => s + i.subtotal, 0);
    const amount   = Math.round(subtotal * 100) / 100;
    const changeAmount = Math.max(0, data.amountPaid - amount);

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const paymentId = uuidv4();

      // 1. Registrar pago en rb_payments
      await connection.execute(
        `INSERT INTO rb_payments
           (id, tenant_id, order_id, guest_number, payment_method, amount, amount_paid, change_amount,
            cashier_id, cashier_name, cash_session_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, tenantId, orderId, data.guestNumber ?? null, data.paymentMethod,
         amount, data.amountPaid, changeAmount, cashierId, cashierName,
         data.cashSessionId ?? null, data.notes ?? null]
      );

      // 2. Generar número de factura
      await connection.execute(
        `INSERT INTO invoice_sequence (tenant_id, prefix, current_number) VALUES (?, 'FAC', 0)
         ON DUPLICATE KEY UPDATE current_number = current_number`,
        [tenantId]
      );
      await connection.execute(
        `UPDATE invoice_sequence SET current_number = current_number + 1 WHERE tenant_id = ?`,
        [tenantId]
      );
      const [invSeq] = await connection.execute<RowDataPacket[]>(
        `SELECT prefix, current_number FROM invoice_sequence WHERE tenant_id = ?`, [tenantId]
      );
      const invoiceNumber = `${invSeq[0].prefix}-${String(invSeq[0].current_number).padStart(6, '0')}`;

      // 3. Crear venta en sales (solo por los ítems de este pago)
      const saleId = uuidv4();
      const pmMap: Record<string, string> = {
        efectivo: 'efectivo', tarjeta: 'tarjeta',
        transferencia: 'transferencia', nequi: 'transferencia', mixto: 'mixto',
      };
      await connection.execute(
        `INSERT INTO sales
           (id, tenant_id, invoice_number, subtotal, tax, discount, total,
            payment_method, amount_paid, change_amount, seller_id, seller_name,
            cash_session_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completada')`,
        [saleId, tenantId, invoiceNumber, amount, 0, 0,
         amount, pmMap[data.paymentMethod] ?? 'efectivo', data.amountPaid,
         changeAmount, cashierId, cashierName, data.cashSessionId ?? null]
      );

      // 4. Crear sale_items + descontar inventario + marcar ítems como 'entregado'
      for (const item of billableItems) {
        await connection.execute(
          `INSERT INTO sale_items
             (id, tenant_id, sale_id, product_id, product_name, product_sku, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), tenantId, saleId, item.menuItemId, item.menuItemName,
           item.menuItemId, item.quantity, item.unitPrice, item.subtotal]
        );

        // Descontar inventario por receta
        const [recipes] = await connection.execute<RowDataPacket[]>(
          `SELECT pr.ingredient_id, pr.quantity AS recipe_qty, p.stock
           FROM product_recipes pr
           JOIN products p ON p.id = pr.ingredient_id
           WHERE pr.product_id = ? AND pr.tenant_id = ?`,
          [item.menuItemId, tenantId]
        );
        for (const recipe of recipes) {
          const deduct = Number(recipe.recipe_qty) * item.quantity;
          const prevStock = Number(recipe.stock);
          const newStock = Math.max(0, prevStock - deduct);
          await connection.execute(
            `UPDATE products SET stock = ? WHERE id = ? AND tenant_id = ?`,
            [newStock, recipe.ingredient_id, tenantId]
          );
          await connection.execute(
            `INSERT INTO stock_movements
               (id, tenant_id, product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id)
             VALUES (?, ?, ?, 'venta', ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), tenantId, recipe.ingredient_id, deduct, prevStock, newStock,
             `Venta comanda ${order.orderNumber}`, saleId, cashierId]
          );
        }

        // Marcar ítem como 'entregado' = pagado
        await connection.execute(
          `UPDATE rb_order_items SET status = 'entregado' WHERE id = ? AND tenant_id = ?`,
          [item.id, tenantId]
        );
      }

      // 5. Registrar en finance_transactions
      const [finCat] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM finance_categories
         WHERE tenant_id = ? AND name = 'Ventas' AND type = 'ingreso' LIMIT 1`,
        [tenantId]
      );
      if (finCat.length > 0) {
        await connection.execute(
          `INSERT INTO finance_transactions
             (id, tenant_id, type, category_id, category_name, description, amount,
              transaction_date, payment_method, source_type, source_id,
              created_by, created_by_name)
           VALUES (?, ?, 'ingreso', ?, 'Ventas', ?, ?, CURDATE(), ?, 'sale', ?, ?, ?)`,
          [uuidv4(), tenantId, finCat[0].id,
           `Venta comanda ${order.orderNumber} - Mesa ${order.tableNumber}`,
           amount, (['efectivo','tarjeta','transferencia','nequi','daviplata','cheque'].includes(data.paymentMethod) ? data.paymentMethod : 'otro'),
           saleId, cashierId, cashierName]
        );
      }

      // 6. Verificar si quedan ítems sin pagar — si no, cerrar comanda y liberar mesa
      const [remaining] = await connection.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM rb_order_items
         WHERE order_id = ? AND status NOT IN ('cancelado','entregado')`,
        [orderId]
      );
      const allDone = (remaining as any[])[0].total === 0;

      if (allDone) {
        await connection.execute(
          `UPDATE rb_orders SET status = 'cerrada', sale_id = ?, closed_at = NOW()
           WHERE id = ? AND tenant_id = ?`,
          [saleId, orderId, tenantId]
        );
        await connection.execute(
          `UPDATE rb_tables SET status = 'libre' WHERE id = ? AND tenant_id = ?`,
          [order.tableId, tenantId]
        );
      }

      await connection.commit();
      return { paymentId, saleId, invoiceNumber, changeAmount, orderId, closed: allDone, amount };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  // ── REPORTS ───────────────────────────────────────────────────────────────

  async getDailySummary(tenantId: string, date?: string) {
    const targetDate = date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         COUNT(DISTINCT o.id)                    AS total_orders,
         COUNT(DISTINCT CASE WHEN o.status = 'cerrada' THEN o.id END) AS closed_orders,
         COALESCE(SUM(CASE WHEN o.status = 'cerrada' THEN o.total END), 0) AS revenue,
         COUNT(DISTINCT t.id)                    AS occupied_tables,
         (SELECT COUNT(*) FROM rb_tables WHERE tenant_id = ? AND is_active = 1) AS total_tables
       FROM rb_orders o
       LEFT JOIN rb_tables t ON t.id = o.table_id AND t.status = 'ocupada'
       WHERE o.tenant_id = ? AND DATE(o.opened_at) = ?`,
      [tenantId, tenantId, targetDate]
    );

    const [topItems] = await db.execute<RowDataPacket[]>(
      `SELECT oi.menu_item_name, SUM(oi.quantity) AS qty_sold
       FROM rb_order_items oi
       JOIN rb_orders o ON o.id = oi.order_id
       WHERE oi.tenant_id = ? AND DATE(o.opened_at) = ? AND oi.status != 'cancelado'
       GROUP BY oi.menu_item_id, oi.menu_item_name
       ORDER BY qty_sold DESC
       LIMIT 5`,
      [tenantId, targetDate]
    );

    return {
      date: targetDate,
      totalOrders: rows[0].total_orders,
      closedOrders: rows[0].closed_orders,
      revenue: Number(rows[0].revenue),
      occupiedTables: rows[0].occupied_tables,
      totalTables: rows[0].total_tables,
      topItems: topItems.map(r => ({ name: r.menu_item_name, qtySold: r.qty_sold })),
    };
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private async recalcOrderTotals(orderId: string, tenantId: string) {
    await db.execute(
      `UPDATE rb_orders o
       SET subtotal = (
             SELECT COALESCE(SUM(subtotal * (1 - discount/100)), 0)
             FROM rb_order_items WHERE order_id = o.id AND status != 'cancelado'
           ),
           total = subtotal
       WHERE id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );
  }

  private async checkOrderReadiness(tenantId: string, orderId: string) {
    const [pending] = await db.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM rb_order_items
       WHERE order_id = ? AND status NOT IN ('listo','entregado','cancelado')`,
      [orderId]
    );
    if (pending[0].total === 0) {
      await db.execute(
        `UPDATE rb_orders SET status = 'lista' WHERE id = ? AND tenant_id = ? AND status = 'en_proceso'`,
        [orderId, tenantId]
      );
    }
  }

  private mapOrder(r: OrderRow) {
    return {
      id: r.id, orderNumber: r.order_number, tableId: r.table_id,
      tableNumber: r.table_number, tableArea: r.table_area,
      waiterId: r.waiter_id, waiterName: r.waiter_name,
      guestsCount: r.guests_count, status: r.status, notes: r.notes,
      subtotal: Number(r.subtotal), tax: Number(r.tax),
      discount: Number(r.discount), total: Number(r.total),
      saleId: r.sale_id, openedAt: r.opened_at, closedAt: r.closed_at,
    };
  }

  private mapOrderItem(r: OrderItemRow) {
    return {
      id: r.id, menuItemId: r.menu_item_id, menuItemName: r.menu_item_name,
      preparationArea: r.preparation_area, quantity: r.quantity,
      unitPrice: Number(r.unit_price), subtotal: Number(r.subtotal),
      discount: Number(r.discount), status: r.status,
      guestNumber: r.guest_number, itemNotes: r.item_notes,
      sentToKitchenAt: r.sent_to_kitchen_at,
      readyAt: r.ready_at, deliveredAt: r.delivered_at,
    };
  }
}

export const restbarService = new RestbarService();
