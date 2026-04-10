import { db } from '../../config';
import { DashboardMetrics, Sale } from '../../common/types';
import { RowDataPacket } from 'mysql2';

interface MetricsRow extends RowDataPacket {
  total_products: number;
  total_inventory_value: number;
  low_stock_products: number;
  out_of_stock_products: number;
  daily_sales: number | null;
  weekly_sales: number | null;
  monthly_sales: number | null;
}

interface TopProductRow extends RowDataPacket {
  id: string;
  name: string;
  category: string;
  total_sold: number;
  total_revenue: number;
}

interface CategorySalesRow extends RowDataPacket {
  category: string;
  total_quantity: number;
  total_revenue: number;
}

interface SaleRow extends RowDataPacket {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: string;
  amount_paid: number;
  change_amount: number;
  seller_name: string;
  status: string;
  created_at: Date;
}

interface WeeklySalesRow extends RowDataPacket {
  date: string;
  total: number;
  count: number;
  fiado_total: number;
  fiado_count: number;
}

export class DashboardService {
  async getMetrics(tenantId: string): Promise<DashboardMetrics> {
    // Obtener metricas basicas
    const [metricsRows] = await db.execute<MetricsRow[]>(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE tenant_id = ?) AS total_products,
        (SELECT COALESCE(SUM(stock * sale_price), 0) FROM products WHERE tenant_id = ?) AS total_inventory_value,
        (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND stock <= reorder_point AND stock > 0) AS low_stock_products,
        (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND stock = 0) AS out_of_stock_products,
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE tenant_id = ? AND status = 'completada' AND payment_method != 'fiado' AND DATE(created_at) = CURDATE())
          + (SELECT COALESCE(SUM(cp.amount), 0) FROM credit_payments cp INNER JOIN sales s2 ON cp.sale_id = s2.id WHERE s2.tenant_id = ? AND DATE(cp.created_at) = CURDATE()) AS daily_sales,
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE tenant_id = ? AND status = 'completada' AND payment_method != 'fiado' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY))
          + (SELECT COALESCE(SUM(cp.amount), 0) FROM credit_payments cp INNER JOIN sales s2 ON cp.sale_id = s2.id WHERE s2.tenant_id = ? AND cp.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS weekly_sales,
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE tenant_id = ? AND status = 'completada' AND payment_method != 'fiado' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()))
          + (SELECT COALESCE(SUM(cp.amount), 0) FROM credit_payments cp INNER JOIN sales s2 ON cp.sale_id = s2.id WHERE s2.tenant_id = ? AND MONTH(cp.created_at) = MONTH(CURDATE()) AND YEAR(cp.created_at) = YEAR(CURDATE())) AS monthly_sales
    `, [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId]);

    const metrics = metricsRows[0];

    // Obtener top productos vendidos
    const [topProductsRows] = await db.execute<TopProductRow[]>(`
      SELECT
        p.id,
        p.name,
        p.category,
        COALESCE(SUM(si.quantity), 0) AS total_sold,
        COALESCE(SUM(si.subtotal), 0) AS total_revenue
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completada'
      WHERE p.tenant_id = ?
      GROUP BY p.id
      ORDER BY total_sold DESC
      LIMIT 5
    `, [tenantId]);

    // Obtener ventas por categoria
    const [categoryRows] = await db.execute<CategorySalesRow[]>(`
      SELECT
        p.category,
        COALESCE(SUM(si.quantity), 0) AS total_quantity,
        COALESCE(SUM(si.subtotal), 0) AS total_revenue
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completada'
      WHERE p.tenant_id = ?
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `, [tenantId]);

    // Obtener ventas recientes
    const [recentSalesRows] = await db.execute<SaleRow[]>(`
      SELECT id, invoice_number, customer_name, subtotal, tax, discount, total,
             payment_method, amount_paid, change_amount, seller_name, status, created_at
      FROM sales
      WHERE tenant_id = ? AND status = 'completada'
      ORDER BY created_at DESC
      LIMIT 5
    `, [tenantId]);

    const recentSales: Sale[] = recentSalesRows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerName: row.customer_name || undefined,
      subtotal: Number(row.subtotal),
      tax: Number(row.tax),
      discount: Number(row.discount),
      total: Number(row.total),
      paymentMethod: row.payment_method as 'efectivo' | 'tarjeta' | 'transferencia',
      amountPaid: Number(row.amount_paid),
      change: Number(row.change_amount),
      sellerName: row.seller_name,
      status: row.status as 'completada' | 'anulada',
      createdAt: row.created_at,
      updatedAt: row.created_at,
    }));

    return {
      totalProducts: metrics.total_products,
      totalInventoryValue: Number(metrics.total_inventory_value),
      dailySales: Number(metrics.daily_sales) || 0,
      weeklySales: Number(metrics.weekly_sales) || 0,
      monthlySales: Number(metrics.monthly_sales) || 0,
      lowStockProducts: metrics.low_stock_products,
      outOfStockProducts: metrics.out_of_stock_products,
      topSellingProducts: topProductsRows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        totalSold: Number(row.total_sold),
        totalRevenue: Number(row.total_revenue),
      })),
      salesByCategory: categoryRows.map((row) => ({
        category: row.category,
        totalQuantity: Number(row.total_quantity),
        totalRevenue: Number(row.total_revenue),
      })),
      recentSales,
    };
  }

  async getSalesTrend(tenantId: string, days = 7): Promise<Array<{ date: string; total: number; count: number; fiadoTotal: number; fiadoCount: number }>> {
    const dateFilter = days > 0
      ? 'AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
      : '';
    const creditDateFilter = days > 0
      ? 'AND cp.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
      : '';

    const params: (string | number)[] = days > 0
      ? [tenantId, days, tenantId, days, tenantId, days]
      : [tenantId, tenantId, tenantId];

    const [rows] = await db.execute<WeeklySalesRow[]>(`
      SELECT
        date,
        SUM(CASE WHEN is_fiado = 0 THEN total ELSE 0 END) AS total,
        SUM(CASE WHEN is_fiado = 0 THEN cnt ELSE 0 END) AS count,
        SUM(CASE WHEN is_fiado = 1 THEN total ELSE 0 END) AS fiado_total,
        SUM(CASE WHEN is_fiado = 1 THEN cnt ELSE 0 END) AS fiado_count
      FROM (
        SELECT DATE(created_at) AS date, total, 1 AS cnt, 0 AS is_fiado
        FROM sales
        WHERE tenant_id = ? AND status = 'completada' AND payment_method != 'fiado'
          ${dateFilter}
        UNION ALL
        SELECT DATE(cp.created_at) AS date, cp.amount AS total, 0 AS cnt, 0 AS is_fiado
        FROM credit_payments cp
        INNER JOIN sales s2 ON cp.sale_id = s2.id
        WHERE s2.tenant_id = ? ${creditDateFilter}
        UNION ALL
        SELECT DATE(created_at) AS date, total, 1 AS cnt, 1 AS is_fiado
        FROM sales
        WHERE tenant_id = ? AND status = 'completada' AND payment_method = 'fiado'
          ${dateFilter}
      ) combined
      GROUP BY date
      ORDER BY date ASC
    `, params);

    return rows.map((row) => ({
      date: String(row.date).split('T')[0],
      total: Number(row.total),
      count: Number(row.count),
      fiadoTotal: Number(row.fiado_total),
      fiadoCount: Number(row.fiado_count),
    }));
  }

  async getMonthlyRevenueCosts(tenantId: string, months = 6): Promise<Array<{ month: string; revenue: number; costs: number }>> {
    interface MonthlyRow extends RowDataPacket {
      month_label: string;
      revenue: number;
      costs: number;
    }

    const [rows] = await db.execute<MonthlyRow[]>(`
      SELECT
        DATE_FORMAT(m.month_start, '%Y-%m') AS month_label,
        COALESCE(rev.sale_revenue, 0) + COALESCE(cp_rev.credit_revenue, 0) AS revenue,
        COALESCE(costs.total_cost, 0) AS costs
      FROM (
        SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n MONTH), '%Y-%m-01') AS month_start
        FROM (
          SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
        ) nums
        WHERE n < ?
      ) m
      LEFT JOIN (
        SELECT
          DATE_FORMAT(s.created_at, '%Y-%m') AS sale_month,
          SUM(CASE WHEN s.payment_method != 'fiado' THEN s.total ELSE 0 END) AS sale_revenue
        FROM sales s
        WHERE s.tenant_id = ? AND s.status = 'completada'
        GROUP BY sale_month
      ) rev ON rev.sale_month = DATE_FORMAT(m.month_start, '%Y-%m')
      LEFT JOIN (
        SELECT
          DATE_FORMAT(cp.created_at, '%Y-%m') AS payment_month,
          SUM(cp.amount) AS credit_revenue
        FROM credit_payments cp
        INNER JOIN sales s2 ON cp.sale_id = s2.id
        WHERE s2.tenant_id = ?
        GROUP BY payment_month
      ) cp_rev ON cp_rev.payment_month = DATE_FORMAT(m.month_start, '%Y-%m')
      LEFT JOIN (
        SELECT
          DATE_FORMAT(s.created_at, '%Y-%m') AS sale_month,
          SUM(si.quantity * p.purchase_price) AS total_cost
        FROM sales s
        INNER JOIN sale_items si ON s.id = si.sale_id
        INNER JOIN products p ON si.product_id = p.id
        WHERE s.tenant_id = ? AND s.status = 'completada'
        GROUP BY sale_month
      ) costs ON costs.sale_month = DATE_FORMAT(m.month_start, '%Y-%m')
      ORDER BY m.month_start ASC
    `, [months, tenantId, tenantId, tenantId]);

    const monthNames: Record<string, string> = {
      '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
      '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
      '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
    };

    return rows.map(row => {
      const mm = String(row.month_label).split('-')[1];
      return {
        month: monthNames[mm] || mm,
        revenue: Number(row.revenue),
        costs: Number(row.costs),
      };
    });
  }

  async getStoreInfo(tenantId: string): Promise<{
    name: string;
    address: string;
    phone: string;
    taxId: string;
    email: string;
    invoiceLogo: string;
    invoiceGreeting: string;
    invoicePolicy: string;
    invoiceCopies: 1 | 2;
  } | null> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT name, address, phone, tax_id, email, invoice_logo, invoice_greeting, invoice_policy, invoice_copies FROM store_info WHERE tenant_id = ? LIMIT 1',
      [tenantId]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      name: rows[0].name || '',
      address: rows[0].address || '',
      phone: rows[0].phone || '',
      taxId: rows[0].tax_id || '',
      email: rows[0].email || '',
      invoiceLogo: rows[0].invoice_logo || '',
      invoiceGreeting: rows[0].invoice_greeting || '¡Gracias por su compra!',
      invoicePolicy: rows[0].invoice_policy || '',
      invoiceCopies: (Number(rows[0].invoice_copies) === 2 ? 2 : 1) as 1 | 2,
    };
  }

  async updateStoreInfo(tenantId: string, data: {
    name?: string;
    address?: string;
    phone?: string;
    taxId?: string;
    email?: string;
    invoiceLogo?: string;
    invoiceGreeting?: string;
    invoicePolicy?: string;
    invoiceCopies?: 1 | 2;
  }): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];

    const fieldMap: Record<string, string> = {
      name: 'name',
      address: 'address',
      phone: 'phone',
      taxId: 'tax_id',
      email: 'email',
      invoiceLogo: 'invoice_logo',
      invoiceGreeting: 'invoice_greeting',
      invoicePolicy: 'invoice_policy',
      invoiceCopies: 'invoice_copies',
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = ?`);
        values.push(value);
      }
    }

    if (updates.length > 0) {
      values.push(tenantId);
      await db.execute(
        `UPDATE store_info SET ${updates.join(', ')} WHERE tenant_id = ?`,
        values
      );
    }
  }
}

export const dashboardService = new DashboardService();
