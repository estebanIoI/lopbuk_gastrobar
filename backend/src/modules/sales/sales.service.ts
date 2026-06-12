import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { Sale, SaleItem, PaymentMethod, SaleStatus, PaginatedResponse } from '../../common/types';
import { AppError } from '../../common/middleware';
import { TAX_RATE } from '../../utils';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { financesService } from '../finances/finances.service';

interface SaleRow extends RowDataPacket {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  amount_paid: number;
  change_amount: number;
  mixed_efectivo_amount: number | null;
  mixed_second_method: string | null;
  mixed_second_amount: number | null;
  seller_id: string | null;
  seller_name: string;
  sede_id: string | null;
  status: SaleStatus;
  credit_status: 'pendiente' | 'parcial' | 'pagado' | null;
  due_date: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SaleItemRow extends RowDataPacket {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface InvoiceRow extends RowDataPacket {
  current_number: number;
  prefix: string;
}

interface ProductStockRow extends RowDataPacket {
  id: string;
  stock: number;
  name: string;
}

export interface SaleFilters {
  status?: SaleStatus;
  paymentMethod?: PaymentMethod;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  sellerId?: string;
  sedeId?: string;
  todayOnly?: boolean;
}

export interface ProductReportItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  subtotal: number;
}

export interface SedeReportData {
  sedeId: string | null;
  sedeName: string | null;
  salesCount: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  byPaymentMethod: Record<string, { count: number; total: number; mixedEfectivo?: number; mixedSecondMethod?: string; mixedSecond?: number }>;
  products: ProductReportItem[];
}

export interface DailyReportData {
  date: string;
  sedes: SedeReportData[];
  totalSales: number;
  grandSubtotal: number;
  grandTax: number;
  grandDiscount: number;
  grandTotal: number;
}

export interface CreateSaleItem {
  productId: string;
  variantId?: string;   // Si viene → usar stock/precio de variante
  quantity: number;
  discount?: number;
  customAmount?: number;
  unitPrice?: number;   // Precio personalizado desde facturación (override del precio de venta)
}

export interface CreateSaleData {
  items: CreateSaleItem[];
  paymentMethod: PaymentMethod;
  amountPaid: number;
  mixedEfectivoAmount?: number;
  mixedSecondMethod?: string;
  mixedSecondAmount?: number;
  globalDiscount?: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  sellerId: string;
  sellerName: string;
  sedeId?: string;
  creditDays?: number;
  notes?: string;
  applyTax?: boolean;
  vehicleId?: string;
  totalWeightKg?: number;
}

export class SalesService {
  private mapSale(row: SaleRow, items?: SaleItem[]): Sale {
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id || undefined,
      customerName: row.customer_name || undefined,
      customerPhone: row.customer_phone || undefined,
      customerEmail: row.customer_email || undefined,
      items: items || [],
      subtotal: Number(row.subtotal),
      tax: Number(row.tax),
      discount: Number(row.discount),
      total: Number(row.total),
      paymentMethod: row.payment_method,
      amountPaid: Number(row.amount_paid),
      change: Number(row.change_amount),
      mixedEfectivoAmount: row.mixed_efectivo_amount != null ? Number(row.mixed_efectivo_amount) : undefined,
      mixedSecondMethod: row.mixed_second_method || undefined,
      mixedSecondAmount: row.mixed_second_amount != null ? Number(row.mixed_second_amount) : undefined,
      sellerId: row.seller_id || undefined,
      sellerName: row.seller_name,
      sedeId: row.sede_id || undefined,
      status: row.status,
      creditStatus: row.credit_status || undefined,
      dueDate: row.due_date || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapSaleItem(row: SaleItemRow): SaleItem {
    return {
      id: row.id,
      saleId: row.sale_id,
      productId: row.product_id,
      productName: row.product_name,
      productSku: row.product_sku,
      quantity: row.quantity,
      unitPrice: Number(row.unit_price),
      discount: Number(row.discount),
      subtotal: Number(row.subtotal),
    };
  }

  private async generateInvoiceNumber(connection: PoolConnection, tenantId: string): Promise<string> {
    // Auto-create the sequence row if it doesn't exist for this tenant
    await connection.execute(
      'INSERT IGNORE INTO invoice_sequence (tenant_id, prefix, current_number) VALUES (?, ?, 0)',
      [tenantId, 'FAC']
    );

    const [rows] = await connection.execute<InvoiceRow[]>(
      'SELECT current_number, prefix FROM invoice_sequence WHERE tenant_id = ? FOR UPDATE',
      [tenantId]
    );

    const currentNumber = rows[0].current_number + 1;
    const prefix = rows[0].prefix;

    await connection.execute(
      'UPDATE invoice_sequence SET current_number = ? WHERE tenant_id = ?',
      [currentNumber, tenantId]
    );

    return `${prefix}-${currentNumber.toString().padStart(5, '0')}`;
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 10,
    filters?: SaleFilters
  ): Promise<PaginatedResponse<Sale>> {
    const offset = (page - 1) * limit;
    const conditions: string[] = ['tenant_id = ?'];
    const values: (string | number | Date)[] = [tenantId];

    if (filters?.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }

    if (filters?.paymentMethod) {
      conditions.push('payment_method = ?');
      values.push(filters.paymentMethod);
    }

    if (filters?.startDate) {
      conditions.push('created_at >= ?');
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push('created_at <= ?');
      values.push(filters.endDate);
    }

    if (filters?.search) {
      conditions.push('(invoice_number LIKE ? OR customer_name LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm);
    }

    if (filters?.sellerId) {
      conditions.push('seller_id = ?');
      values.push(filters.sellerId);
    }

    if (filters?.sedeId) {
      conditions.push('sede_id = ?');
      values.push(filters.sedeId);
    }

    if (filters?.todayOnly) {
      // Compare in Colombia timezone (UTC-5) to avoid date mismatch for late-night sales
      const colombiaToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const colombiaStart = new Date(colombiaToday + 'T05:00:00Z'); // midnight Colombia = UTC 05:00
      const colombiaEnd = new Date(colombiaStart.getTime() + 24 * 60 * 60 * 1000);
      conditions.push('created_at >= ? AND created_at < ?');
      values.push(colombiaStart, colombiaEnd);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [countResult] = await db.execute<CountRow[]>(
      `SELECT COUNT(*) as total FROM sales ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    const [rows] = await db.execute<SaleRow[]>(
      `SELECT * FROM sales ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...values, String(limit), String(offset)]
    );

    // Cargar items para cada venta
    const salesWithItems: Sale[] = [];
    for (const row of rows) {
      const [itemRows] = await db.execute<SaleItemRow[]>(
        'SELECT * FROM sale_items WHERE sale_id = ?',
        [row.id]
      );
      salesWithItems.push(this.mapSale(row, itemRows.map(this.mapSaleItem)));
    }

    return {
      data: salesWithItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<Sale> {
    const [rows] = await db.execute<SaleRow[]>(
      'SELECT * FROM sales WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('Venta no encontrada', 404);
    }

    const [itemRows] = await db.execute<SaleItemRow[]>(
      'SELECT * FROM sale_items WHERE sale_id = ?',
      [id]
    );

    const items = itemRows.map(this.mapSaleItem);

    return this.mapSale(rows[0], items);
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Sale> {
    const [rows] = await db.execute<SaleRow[]>(
      'SELECT * FROM sales WHERE invoice_number = ?',
      [invoiceNumber]
    );

    if (rows.length === 0) {
      throw new AppError('Venta no encontrada', 404);
    }

    const [itemRows] = await db.execute<SaleItemRow[]>(
      'SELECT * FROM sale_items WHERE sale_id = ?',
      [rows[0].id]
    );

    const items = itemRows.map(this.mapSaleItem);

    return this.mapSale(rows[0], items);
  }

  async create(tenantId: string, data: CreateSaleData): Promise<Sale> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Validacion especial para fiado: cliente es obligatorio
      if (data.paymentMethod === 'fiado' && !data.customerId) {
        throw new AppError('El cliente es obligatorio para ventas a credito', 400);
      }

      // Generar numero de factura
      const invoiceNumber = await this.generateInvoiceNumber(connection, tenantId);

      // Validar productos y calcular totales
      let subtotal = 0;
      let totalDiscount = 0;
      const itemsToInsert: Array<{
        id: string;
        productId: string;
        variantId?: string;
        productName: string;
        productSku: string;
        variantLabel?: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        subtotal: number;
        frozenCost?: number;
        frozenMarginPct?: number;
        frozenMarginAmount?: number;
      }> = [];

      for (const item of data.items) {
        // ── Si viene variant_id → flujo variante ─────────────────────────────
        if (item.variantId) {
          // Obtener variante + producto base
          const [varRows] = await connection.execute<RowDataPacket[]>(
            `SELECT pv.*, p.name AS product_name, COALESCE(p.base_price, p.sale_price) AS base_price
             FROM product_variants pv
             LEFT JOIN products p ON p.id = pv.product_id
             WHERE pv.id = ? AND pv.tenant_id = ? AND pv.is_active = 1 FOR UPDATE`,
            [item.variantId, tenantId]
          );
          if (varRows.length === 0) throw new AppError(`Variante ${item.variantId} no encontrada`, 404);
          const variant = varRows[0] as any;

          // Resolver precio via tiers (o usar unitPrice si viene override)
          let unitPrice: number;
          let frozenMarginPct = 0;
          if (item.unitPrice) {
            unitPrice = item.unitPrice;
          } else {
            const [tiers] = await connection.execute<RowDataPacket[]>(
              `SELECT price, tenant_margin_pct FROM variant_price_tiers
               WHERE variant_id = ? AND tenant_id = ? AND min_qty <= ? AND is_active = 1
               ORDER BY min_qty DESC LIMIT 1`,
              [item.variantId, tenantId, item.quantity]
            );
            if (tiers.length > 0) {
              unitPrice = Number((tiers[0] as any).price);
              frozenMarginPct = Number((tiers[0] as any).tenant_margin_pct);
            } else {
              unitPrice = variant.price_override != null
                ? Number(variant.price_override)
                : Number(variant.base_price ?? 0);
            }
          }

          const frozenCost = variant.cost_price != null ? Number(variant.cost_price) : undefined;
          const itemTotal     = unitPrice * item.quantity;
          const itemDiscount  = itemTotal * ((item.discount || 0) / 100);
          const itemSubtotal  = itemTotal - itemDiscount;
          const frozenMarginAmount = frozenCost != null
            ? (unitPrice - frozenCost) * item.quantity
            : undefined;

          subtotal      += itemSubtotal;
          totalDiscount += itemDiscount;

          const variantLabel = [variant.color, variant.size].filter(Boolean).join(' / ') || undefined;

          itemsToInsert.push({
            id: uuidv4(),
            productId: variant.product_id,
            variantId: item.variantId,
            productName: variant.product_name || 'Producto',
            productSku: variant.sku,
            variantLabel,
            quantity: item.quantity,
            unitPrice,
            discount: item.discount || 0,
            subtotal: itemSubtotal,
            frozenCost,
            frozenMarginPct,
            frozenMarginAmount,
          });

          // Descontar stock de variante — UPDATE atómico
          const [stockResult] = await connection.execute<ResultSetHeader>(
            'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND tenant_id = ? AND stock >= ?',
            [item.quantity, item.variantId, tenantId, item.quantity]
          );
          if (stockResult.affectedRows === 0) {
            throw new AppError(`Stock insuficiente para variante ${variantLabel || item.variantId}`, 400);
          }

          // Registrar movimiento
          await connection.execute(
            `INSERT INTO inventory_movements
               (id, tenant_id, variant_id, product_id, type, quantity, reason, reference_type)
             VALUES (?, ?, ?, ?, 'salida', ?, 'Venta', 'sale')`,
            [uuidv4(), tenantId, item.variantId, variant.product_id, item.quantity]
          );

          continue; // saltar el flujo de producto plano
        }
        // ── Fin flujo variante ───────────────────────────────────────────────

        const [productRows] = await connection.execute<ProductStockRow[]>(
          'SELECT id, stock, name FROM products WHERE id = ? FOR UPDATE',
          [item.productId]
        );

        if (productRows.length === 0) {
          throw new AppError(`Producto ${item.productId} no encontrado`, 404);
        }

        const product = productRows[0];

        // Verificar si es un producto compuesto (tiene receta/BOM)
        let recipeRows: RowDataPacket[] = [];
        try {
          const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT pr.ingredient_id, pr.quantity, p.purchase_price
             FROM product_recipes pr
             JOIN products p ON p.id = pr.ingredient_id
             WHERE pr.product_id = ?`,
            [item.productId]
          );
          recipeRows = rows;
        } catch {
          // Table product_recipes may not exist yet
        }

        // Identificar ingrediente escalable y calcular cantidades extra si hay customAmount
        let scalableIngredientId: string | null = null;
        let extraScalableQty = 0;

        if (recipeRows.length > 0 && item.customAmount) {
          // Encontrar ingrediente escalable (el de mayor qty*precio, con quantity > 1)
          let maxCostValue = 0;
          for (const ing of recipeRows) {
            const qty = Number(ing.quantity);
            if (qty > 1) {
              const costValue = qty * Number(ing.purchase_price);
              if (costValue > maxCostValue) {
                maxCostValue = costValue;
                scalableIngredientId = ing.ingredient_id;
              }
            }
          }

          if (scalableIngredientId) {
            const scalableIng = recipeRows.find(r => r.ingredient_id === scalableIngredientId)!;

            // Fórmula directa (igual al sistema anterior):
            // gramos_extracto = (monto_cliente - costos_fijos) / precio_por_gramo
            // costos_fijos = suma de todos los ingredientes NO escalables
            let nonScalableCost = 0;
            for (const ing of recipeRows) {
              if (ing.ingredient_id !== scalableIngredientId) {
                nonScalableCost += Number(ing.quantity) * Number(ing.purchase_price);
              }
            }

            // customAmount SIEMPRE es el precio base (sin IVA). El IVA se suma encima.
            const effectiveAmount = item.customAmount;

            // Total de ingrediente escalable según lo que paga el cliente
            const totalScalableQty = (effectiveAmount - nonScalableCost) / Number(scalableIng.purchase_price);
            // Extra = total calculado menos la cantidad base de la receta
            extraScalableQty = totalScalableQty - Number(scalableIng.quantity);

            // Validar monto mínimo: customAmount es siempre base, comparar contra costo base
            const minAmount = Math.round(nonScalableCost + Number(scalableIng.purchase_price));

            if (item.customAmount < minAmount) {
              throw new AppError(
                `El monto personalizado ($${item.customAmount}) no alcanza para cubrir los costos mínimos ($${minAmount})`,
                400
              );
            }
          }
        }

        // Si tiene receta, validar stock de INSUMOS. Si no, validar stock del PRODUCTO.
        if (recipeRows.length > 0) {
          // Validar stock de ingredientes
          for (const ingredient of recipeRows) {
            let requiredQty = Number(ingredient.quantity) * item.quantity;
            // Sumar cantidad extra para el ingrediente escalable
            if (ingredient.ingredient_id === scalableIngredientId) {
              requiredQty += extraScalableQty * item.quantity;
            }
            const [ingStockRows] = await connection.execute<ProductStockRow[]>(
              'SELECT stock, name FROM products WHERE id = ? FOR UPDATE',
              [ingredient.ingredient_id]
            );

            if (ingStockRows.length === 0) {
              throw new AppError(`Insumo no encontrado para el producto compuesto`, 404);
            }

            if (ingStockRows[0].stock < requiredQty) {
              throw new AppError(`Stock insuficiente de insumo ${ingStockRows[0].name} para armar ${product.name}`, 400);
            }
          }
        } else {
          // Validacion normal
          if (product.stock < item.quantity) {
            throw new AppError(`Stock insuficiente para ${product.name}`, 400);
          }
        }

        // Obtener precio del producto
        const [priceRows] = await connection.execute<RowDataPacket[]>(
          'SELECT sale_price, sku FROM products WHERE id = ?',
          [item.productId]
        );

        // customAmount SIEMPRE es el precio base. El IVA se calcula sobre el subtotal total.
        let unitPrice: number;
        if (item.customAmount && recipeRows.length > 0) {
          unitPrice = item.customAmount;
        } else {
          unitPrice = Number(priceRows[0].sale_price);
        }

        const itemTotal = unitPrice * item.quantity;
        const itemDiscount = itemTotal * ((item.discount || 0) / 100);
        const itemSubtotal = itemTotal - itemDiscount;

        subtotal += itemSubtotal;
        totalDiscount += itemDiscount;

        itemsToInsert.push({
          id: uuidv4(),
          productId: item.productId,
          productName: product.name,
          productSku: priceRows[0].sku,
          quantity: item.quantity,
          unitPrice,
          discount: item.discount || 0,
          subtotal: itemSubtotal,
        });

        // DESCONTAR STOCK
        if (recipeRows.length > 0) {
          // Descontar INSUMOS (Logica BOM/Kit)
          for (const ingredient of recipeRows) {
            let requiredQty = Number(ingredient.quantity) * item.quantity;
            // Sumar cantidad extra para el ingrediente escalable
            if (ingredient.ingredient_id === scalableIngredientId) {
              requiredQty += extraScalableQty * item.quantity;
            }
            requiredQty = Math.round(requiredQty * 1000) / 1000; // Redondear a 3 decimales

            const [ingStockRows] = await connection.execute<ProductStockRow[]>(
              'SELECT stock FROM products WHERE id = ?',
              [ingredient.ingredient_id]
            );
            const currentIngStock = ingStockRows[0].stock;

            await connection.execute(
              'UPDATE products SET stock = stock - ? WHERE id = ?',
              [requiredQty, ingredient.ingredient_id]
            );

            // Registrar movimiento de insumo
            await connection.execute(
              `INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id)
                   VALUES (?, ?, ?, 'venta', ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                tenantId,
                ingredient.ingredient_id,
                requiredQty,
                currentIngStock,
                currentIngStock - requiredQty,
                `Prod. Auto ${invoiceNumber}`, // Produccion Automatica
                null,
                data.sellerId,
              ]
            );
          }
        } else {
          // Descontar PRODUCTO FINAL (Logica Normal)
          await connection.execute(
            'UPDATE products SET stock = stock - ? WHERE id = ?',
            [item.quantity, item.productId]
          );

          // Registrar movimiento de stock
          await connection.execute(
            `INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id)
               VALUES (?, ?, ?, 'venta', ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              tenantId,
              item.productId,
              item.quantity,
              product.stock,
              product.stock - item.quantity,
              `Venta ${invoiceNumber}`,
              null,
              data.sellerId,
            ]
          );
        }
      }

      const tax = data.applyTax ? Math.round(subtotal * TAX_RATE * 100) / 100 : 0;
      const globalDisc = Math.round((data.globalDiscount || 0) * 100) / 100;
      const total = Math.round((subtotal + tax - globalDisc) * 100) / 100;
      totalDiscount += globalDisc;

      // Para fiado: amountPaid = 0, change = 0
      let amountPaid = data.amountPaid;
      let change = 0;
      let creditStatus: string | null = null;

      let dueDate: string | null = null;

      if (data.paymentMethod === 'fiado') {
        amountPaid = 0;
        change = 0;
        creditStatus = 'pendiente';
        // Calcular fecha de vencimiento desde la fecha de creación del fiado
        const days = data.creditDays || 30;
        const due = new Date();
        due.setDate(due.getDate() + days);
        dueDate = due.toISOString().split('T')[0];
      } else {
        // Redondear a 2 decimales para evitar errores por centavos
        const roundedTotal = Math.round(total * 100) / 100;
        change = Math.round((amountPaid - roundedTotal) * 100) / 100;
        if (change < 0) {
          throw new AppError(`El monto pagado es insuficiente. Total: $${roundedTotal}, Pagado: $${amountPaid}`, 400);
        }
      }

      const saleId = uuidv4();

      // Check for active cash session to link the sale
      const [activeSessionRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM cash_sessions WHERE status = ? AND tenant_id = ? LIMIT 1',
        ['abierta', tenantId]
      );
      const cashSessionId = activeSessionRows.length > 0 ? activeSessionRows[0].id : null;

      // Insertar venta
      await connection.execute<ResultSetHeader>(
        `INSERT INTO sales (id, tenant_id, invoice_number, customer_id, customer_name, customer_phone, customer_email,
          subtotal, tax, discount, total, payment_method, amount_paid, change_amount,
          mixed_efectivo_amount, mixed_second_method, mixed_second_amount,
          seller_id, seller_name, sede_id, cash_session_id, credit_status, due_date, notes,
          vehicle_id, total_weight_kg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          tenantId,
          invoiceNumber,
          data.customerId || null,
          data.customerName || null,
          data.customerPhone || null,
          data.customerEmail || null,
          subtotal,
          tax,
          totalDiscount,
          total,
          data.paymentMethod,
          amountPaid,
          change,
          data.paymentMethod === 'mixto' ? (data.mixedEfectivoAmount ?? null) : null,
          data.paymentMethod === 'mixto' ? (data.mixedSecondMethod ?? null) : null,
          data.paymentMethod === 'mixto' ? (data.mixedSecondAmount ?? null) : null,
          data.sellerId,
          data.sellerName,
          data.sedeId || null,
          cashSessionId,
          creditStatus,
          dueDate,
          data.applyTax ? (data.notes ? `FACTURA_ELECTRONICA | ${data.notes}` : 'FACTURA_ELECTRONICA') : (data.notes || null),
          data.vehicleId || null,
          data.totalWeightKg || null,
        ]
      );

      // Insertar items
      for (const item of itemsToInsert) {
        await connection.execute(
          `INSERT INTO sale_items
             (id, tenant_id, sale_id, product_id, variant_id, product_name, product_sku,
              quantity, unit_price, discount, subtotal,
              cost_price, margin_pct, margin_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id, tenantId, saleId,
            item.productId, item.variantId ?? null,
            item.productName, item.productSku,
            item.quantity, item.unitPrice, item.discount, item.subtotal,
            item.frozenCost ?? null,
            item.frozenMarginPct ?? null,
            item.frozenMarginAmount ?? null,
          ]
        );
      }

      await connection.commit();

      // Registrar ingreso en finanzas (fire-and-forget, no bloquea la venta)
      // Se omite para fiado porque el dinero no se recibió aún
      if (data.paymentMethod !== 'fiado') {
        financesService.autoRecord({
          tenantId,
          type: 'ingreso',
          categoryName: 'Ventas',
          description: `Venta ${invoiceNumber}${data.customerName ? ` — ${data.customerName}` : ''}`,
          amount: total,
          paymentMethod: data.paymentMethod,
          sourceType: 'sale',
          sourceId: saleId,
          createdById: data.sellerId,
          createdByName: data.sellerName,
        });
      }

      return this.findById(saleId);
    } catch (error) {
      await connection.rollback();
      console.error('[SalesService.create] Error:', error instanceof AppError ? error.message : error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async cancel(id: string, userId: string, tenantId?: string): Promise<Sale> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [saleRows] = await connection.execute<SaleRow[]>(
        tenantId
          ? 'SELECT * FROM sales WHERE id = ? AND tenant_id = ? FOR UPDATE'
          : 'SELECT * FROM sales WHERE id = ? FOR UPDATE',
        tenantId ? [id, tenantId] : [id]
      );

      if (saleRows.length === 0) {
        throw new AppError('Venta no encontrada', 404);
      }

      const sale = saleRows[0];

      if (sale.status === 'anulada') {
        throw new AppError('La venta ya esta anulada', 400);
      }

      // Obtener items de la venta
      const [itemRows] = await connection.execute<SaleItemRow[]>(
        'SELECT * FROM sale_items WHERE sale_id = ?',
        [id]
      );

      // Restaurar stock
      for (const item of itemRows) {
        const [productRows] = await connection.execute<ProductStockRow[]>(
          'SELECT stock FROM products WHERE id = ? FOR UPDATE',
          [item.product_id]
        );

        const currentStock = productRows[0].stock;

        await connection.execute(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );

        // Registrar movimiento de stock
        await connection.execute(
          `INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id)
           VALUES (?, ?, ?, 'devolucion', ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            tenantId || null,
            item.product_id,
            item.quantity,
            currentStock,
            currentStock + item.quantity,
            `Anulacion ${sale.invoice_number}`,
            id,
            userId,
          ]
        );
      }

      // Actualizar estado de la venta
      await connection.execute(
        'UPDATE sales SET status = ? WHERE id = ?',
        ['anulada', id]
      );

      await connection.commit();

      return this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getRecentSales(tenantId: string, limit = 5): Promise<Sale[]> {
    const [rows] = await db.execute<SaleRow[]>(
      'SELECT * FROM sales WHERE status = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ?',
      ['completada', tenantId, String(limit)]
    );

    return rows.map((row) => this.mapSale(row));
  }

  async getVendedoresPerformance(tenantId: string, from?: string, to?: string, sellerId?: string): Promise<RowDataPacket[]> {
    const conditions: string[] = ['s.tenant_id = ?', "s.status = 'completada'"];
    const params: (string | Date)[] = [tenantId];

    if (from) {
      conditions.push('s.created_at >= ?');
      params.push(new Date(from + 'T00:00:00'));
    }
    if (to) {
      conditions.push('s.created_at <= ?');
      params.push(new Date(to + 'T23:59:59'));
    }
    if (sellerId) {
      conditions.push('s.seller_id = ?');
      params.push(sellerId);
    }

    const where = conditions.join(' AND ');

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         s.seller_id,
         s.seller_name,
         COUNT(s.id)                                                                   AS total_ventas,
         COALESCE(SUM(s.total), 0)                                                     AS total_monto,
         COALESCE(AVG(s.total), 0)                                                     AS promedio_venta,
         COALESCE(SUM(CASE WHEN s.payment_method = 'efectivo'      THEN s.total ELSE 0 END), 0) AS total_efectivo,
         COALESCE(SUM(CASE WHEN s.payment_method = 'tarjeta'       THEN s.total ELSE 0 END), 0) AS total_tarjeta,
         COALESCE(SUM(CASE WHEN s.payment_method = 'transferencia' THEN s.total ELSE 0 END), 0) AS total_transferencia,
         COALESCE(SUM(CASE WHEN s.payment_method = 'fiado'         THEN s.total ELSE 0 END), 0) AS total_fiado,
         COALESCE(SUM(agg.qty), 0)                                                     AS total_items
       FROM sales s
       LEFT JOIN (
         SELECT sale_id, SUM(quantity) AS qty
         FROM sale_items
         GROUP BY sale_id
       ) agg ON agg.sale_id = s.id
       WHERE ${where}
       GROUP BY s.seller_id, s.seller_name
       ORDER BY total_monto DESC`,
      params
    );

    return rows;
  }

  async getVendedorSales(tenantId: string, sellerId: string, from?: string, to?: string, page = 1, limit = 20): Promise<{ data: Sale[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const conditions: string[] = ['s.tenant_id = ?', 's.seller_id = ?', "s.status = 'completada'"];
    const params: (string | Date | number)[] = [tenantId, sellerId];

    if (from) {
      conditions.push('s.created_at >= ?');
      params.push(new Date(from + 'T00:00:00'));
    }
    if (to) {
      conditions.push('s.created_at <= ?');
      params.push(new Date(to + 'T23:59:59'));
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    const [countRows] = await db.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM sales s WHERE ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await db.execute<SaleRow[]>(
      `SELECT s.* FROM sales s WHERE ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );

    return {
      data: rows.map((r) => this.mapSale(r)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStats(tenantId: string): Promise<{ total: number; completedTotal: number; cancelledTotal: number }> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'completada' THEN total ELSE 0 END), 0) as completedTotal,
        COALESCE(SUM(CASE WHEN status = 'anulada' THEN total ELSE 0 END), 0) as cancelledTotal
       FROM sales WHERE tenant_
       FROM sales WHERE tenant_id = ?
       AND status != 'anulada'`,
      [tenantId]
    );
    const row = (rows as RowDataPacket[])[0];
    return {
      total: Number(row.total),
      completedTotal: Number(row.completedTotal),
      cancelledTotal: Number(row.cancelledTotal),
    };
  }

  /**
   * Reporte de cierre diario: agrega las ventas completadas del día (horario
   * Colombia, UTC-5) por sede, método de pago y producto.
   */
  async getDailyReport(tenantId: string, date: string): Promise<DailyReportData> {
    // Ventana del día en horario Colombia (medianoche local = 05:00 UTC)
    const start = new Date(date + 'T05:00:00Z');
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    // Nombres de sede para etiquetar el reporte
    const [sedeRows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name FROM sedes WHERE tenant_id = ?',
      [tenantId]
    );
    const sedeNames = new Map<string, string>();
    for (const s of sedeRows as RowDataPacket[]) sedeNames.set(s.id, s.name);

    // Ventas completadas del día
    const [rows] = await db.execute<SaleRow[]>(
      `SELECT * FROM sales
       WHERE tenant_id = ? AND status = 'completada'
         AND created_at >= ? AND created_at < ?
       ORDER BY created_at ASC`,
      [tenantId, start, end]
    );

    const sedeMap = new Map<string, SedeReportData>();
    const keyOf = (sedeId?: string) => sedeId ?? '__sin_sede__';

    for (const row of rows) {
      const [itemRows] = await db.execute<SaleItemRow[]>(
        'SELECT * FROM sale_items WHERE sale_id = ?',
        [row.id]
      );
      const sale = this.mapSale(row, itemRows.map(this.mapSaleItem));
      const k = keyOf(sale.sedeId);
      let sede = sedeMap.get(k);
      if (!sede) {
        sede = {
          sedeId: sale.sedeId ?? null,
          sedeName: sale.sedeId ? (sedeNames.get(sale.sedeId) ?? null) : null,
          salesCount: 0, subtotal: 0, tax: 0, discount: 0, total: 0,
          byPaymentMethod: {}, products: [],
        };
        sedeMap.set(k, sede);
      }
      sede.salesCount += 1;
      sede.subtotal += sale.subtotal;
      sede.tax += sale.tax;
      sede.discount += sale.discount;
      sede.total += sale.total;

      // Desglose por método de pago
      const pm = sede.byPaymentMethod[sale.paymentMethod] ?? { count: 0, total: 0 };
      pm.count += 1;
      pm.total += sale.total;
      if ((sale.paymentMethod as string) === 'mixto') {
        pm.mixedEfectivo = (pm.mixedEfectivo ?? 0) + (sale.mixedEfectivoAmount ?? 0);
        if (sale.mixedSecondMethod) pm.mixedSecondMethod = sale.mixedSecondMethod;
        pm.mixedSecond = (pm.mixedSecond ?? 0) + (sale.mixedSecondAmount ?? 0);
      }
      sede.byPaymentMethod[sale.paymentMethod] = pm;

      // Desglose por producto
      for (const it of sale.items ?? []) {
        let p = sede.products.find(pp => pp.productId === it.productId);
        if (!p) {
          p = { productId: it.productId, productName: it.productName, productSku: it.productSku, quantity: 0, subtotal: 0 };
          sede.products.push(p);
        }
        p.quantity += it.quantity;
        p.subtotal += it.subtotal;
      }
    }

    const sedes = Array.from(sedeMap.values());
    return {
      date,
      sedes,
      totalSales: rows.length,
      grandSubtotal: sedes.reduce((acc, x) => acc + x.subtotal, 0),
      grandTax: sedes.reduce((acc, x) => acc + x.tax, 0),
      grandDiscount: sedes.reduce((acc, x) => acc + x.discount, 0),
      grandTotal: sedes.reduce((acc, x) => acc + x.total, 0),
    };
  }
}

export const salesService = new SalesService();
