import { Router, Request, Response } from 'express'
import pool from '../../config/database'
import { authenticate, authorize } from '../../common/middleware'

const router: ReturnType<typeof Router> = Router()
router.use(authenticate)
router.use(authorize('superadmin'))

// DDL congelado: order_status_history vive en el baseline (0000) y
// storefront_orders.assigned_to en la migración 0002. Prohibido DDL en runtime — ver CLAUDE.md.

// Valid status transitions (state machine)
const VALID_TRANSITIONS: Record<string, string[]> = {
  pendiente:  ['confirmado', 'cancelado'],
  confirmado: ['preparando', 'cancelado'],
  preparando: ['enviado',    'cancelado'],
  enviado:    ['entregado',  'cancelado'],
  entregado:  [],
  cancelado:  [],
}

// ─── GET /api/superadmin/orders/tenants ─────────────────────────────────────
// Lista mínima de tenants para el filtro de comercio en la UI
router.get('/orders/tenants', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name FROM tenants WHERE status = 'activo' ORDER BY name"
    ) as any
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener comercios' })
  }
})

// ─── GET /api/superadmin/orders ───────────────────────────────────────────────
// Bandeja unificada cross-tenant con filtros y paginación
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const {
      tenant_id, status, assigned, search,
      date_from, date_to,
      page = '1', limit = '30',
    } = req.query as Record<string, string>

    const pageNum  = Math.max(1, parseInt(page, 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)))
    const offset   = (pageNum - 1) * limitNum

    const conditions: string[] = []
    const params: unknown[] = []

    if (tenant_id) { conditions.push('o.tenant_id = ?'); params.push(tenant_id) }
    if (status)    { conditions.push('o.status = ?');    params.push(status) }

    if (assigned === 'me') {
      conditions.push('o.assigned_to = ?')
      params.push((req as any).user.id)
    } else if (assigned === 'unassigned') {
      conditions.push('o.assigned_to IS NULL')
    }

    if (search) {
      conditions.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)')
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (date_from) { conditions.push('DATE(o.created_at) >= ?'); params.push(date_from) }
    if (date_to)   { conditions.push('DATE(o.created_at) <= ?'); params.push(date_to) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [rows] = await pool.query(
      `SELECT o.id, o.order_number, o.tenant_id,
              o.customer_name, o.customer_phone, o.customer_email,
              o.total, o.subtotal, o.shipping_cost, o.discount,
              o.status, o.payment_method,
              o.assigned_to, o.created_at, o.updated_at,
              o.address, o.municipality, o.department, o.neighborhood, o.notes,
              si.name AS commerce_name, si.logo_url AS commerce_logo,
              u.name AS assigned_name
       FROM storefront_orders o
       LEFT JOIN store_info si ON si.tenant_id = o.tenant_id
       LEFT JOIN users u ON u.id = o.assigned_to
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    ) as any

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM storefront_orders o ${where}`,
      params
    ) as any

    const total = Number((countRows as any[])[0]?.total ?? 0)

    res.json({ success: true, data: { orders: rows, total, page: pageNum, limit: limitNum } })
  } catch (err) {
    console.error('[superadmin-orders] list error:', err)
    res.status(500).json({ success: false, error: 'Error al obtener pedidos' })
  }
})

// ─── GET /api/superadmin/orders/summary ──────────────────────────────────────
// Polling endpoint: conteos por estado + ID del último pedido creado
router.get('/orders/summary', async (_req: Request, res: Response) => {
  try {
    const [statusRows] = await pool.query(
      'SELECT status, COUNT(*) AS count FROM storefront_orders GROUP BY status'
    ) as any

    const counts: Record<string, number> = {
      pendiente: 0, confirmado: 0, preparando: 0,
      enviado: 0, entregado: 0, cancelado: 0,
    }
    for (const row of statusRows as any[]) {
      if (row.status in counts) counts[row.status] = Number(row.count)
    }

    const [latestRows] = await pool.query(
      'SELECT id FROM storefront_orders ORDER BY created_at DESC LIMIT 1'
    ) as any
    const latestId = (latestRows as any[])[0]?.id ?? null

    res.json({ success: true, data: { counts, latestId } })
  } catch (err) {
    console.error('[superadmin-orders] summary error:', err)
    res.status(500).json({ success: false, error: 'Error al obtener resumen' })
  }
})

// ─── PATCH /api/superadmin/orders/:id/status ─────────────────────────────────
// State machine: solo transiciones válidas; registra historial
router.patch('/orders/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status, note } = req.body
    const user = (req as any).user

    if (!status) {
      res.status(400).json({ success: false, error: 'El estado es requerido' })
      return
    }

    const [rows] = await pool.query(
      'SELECT id, status, tenant_id FROM storefront_orders WHERE id = ?',
      [id]
    ) as any
    const order = (rows as any[])[0]
    if (!order) {
      res.status(404).json({ success: false, error: 'Pedido no encontrado' })
      return
    }

    const allowed = VALID_TRANSITIONS[order.status as string] ?? []
    if (!allowed.includes(status)) {
      res.status(422).json({
        success: false,
        error: `Transición inválida: '${order.status}' → '${status}'`,
      })
      return
    }

    await pool.query(
      'UPDATE storefront_orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    )

    try {
      await pool.query(
        `INSERT INTO order_status_history
           (order_id, tenant_id, from_status, to_status, changed_by, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, order.tenant_id, order.status, status, user.id, note ?? null]
      )
    } catch { /* tabla aún no migrada */ }

    res.json({ success: true, data: { id, status } })
  } catch (err) {
    console.error('[superadmin-orders] status error:', err)
    res.status(500).json({ success: false, error: 'Error al actualizar estado' })
  }
})

// ─── PATCH /api/superadmin/orders/:id/assign ─────────────────────────────────
// Asigna el pedido al operador o a un repartidor específico (assigneeId en body)
router.patch('/orders/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const user = (req as any).user
    const unassign   = req.body?.unassign === true
    const assigneeId = req.body?.assigneeId as string | undefined

    const [rows] = await pool.query(
      'SELECT id FROM storefront_orders WHERE id = ?',
      [id]
    ) as any
    if (!(rows as any[])[0]) {
      res.status(404).json({ success: false, error: 'Pedido no encontrado' })
      return
    }

    const newAssignee = unassign ? null : (assigneeId ?? user.id as string)
    await pool.query(
      'UPDATE storefront_orders SET assigned_to = ?, updated_at = NOW() WHERE id = ?',
      [newAssignee, id]
    )

    // Return assignee name for immediate UI update
    let assignedName: string | null = null
    if (newAssignee) {
      const [uRows] = await pool.query('SELECT name FROM users WHERE id = ?', [newAssignee]) as any
      assignedName = (uRows as any[])[0]?.name ?? null
    }

    res.json({ success: true, data: { id, assigned_to: newAssignee, assigned_name: assignedName } })
  } catch (err) {
    console.error('[superadmin-orders] assign error:', err)
    res.status(500).json({ success: false, error: 'Error al asignar pedido' })
  }
})

// ─── GET /api/superadmin/orders/:id/drivers ──────────────────────────────────
// Repartidores activos del tenant del pedido (para asignación rápida)
router.get('/orders/:id/drivers', async (req: Request, res: Response) => {
  try {
    const [orderRows] = await pool.query(
      'SELECT tenant_id FROM storefront_orders WHERE id = ?',
      [req.params.id]
    ) as any
    if (!(orderRows as any[])[0]) {
      res.status(404).json({ success: false, error: 'Pedido no encontrado' })
      return
    }
    const tenantId = (orderRows as any[])[0].tenant_id
    const [drivers] = await pool.query(
      "SELECT id, name, email, phone FROM users WHERE tenant_id = ? AND role = 'repartidor' AND is_active = 1 ORDER BY name",
      [tenantId]
    ) as any
    res.json({ success: true, data: drivers })
  } catch (err) {
    console.error('[superadmin-orders] drivers error:', err)
    res.status(500).json({ success: false, error: 'Error al obtener repartidores' })
  }
})

// ─── GET /api/superadmin/orders/:id/items ────────────────────────────────────
// Items del pedido para el drawer de detalle
router.get('/orders/:id/items', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const [items] = await pool.query(
      `SELECT id, product_name, product_image, quantity, unit_price, total_price, size, color
       FROM storefront_order_items WHERE order_id = ?`,
      [id]
    ) as any

    let history: any[] = []
    try {
      const [hist] = await pool.query(
        `SELECT h.from_status, h.to_status, h.note, h.created_at, u.name AS changed_by_name
         FROM order_status_history h
         LEFT JOIN users u ON u.id = h.changed_by
         WHERE h.order_id = ?
         ORDER BY h.created_at ASC`,
        [id]
      ) as any
      history = hist as any[]
    } catch { /* tabla aún no migrada */ }

    res.json({ success: true, data: { items, history } })
  } catch (err) {
    console.error('[superadmin-orders] items error:', err)
    res.status(500).json({ success: false, error: 'Error al obtener detalle del pedido' })
  }
})

// ─── GET /api/superadmin/events ──────────────────────────────────────────────
// SSE stream: emite order summary cada 20 s (reemplaza el polling del cliente)
router.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
  res.flushHeaders()

  // Tell client to retry after 5 s if connection drops
  res.write('retry: 5000\n\n')

  const sendSummary = async () => {
    try {
      const [statusRows] = await pool.query(
        'SELECT status, COUNT(*) AS count FROM storefront_orders GROUP BY status'
      ) as any
      const counts: Record<string, number> = {
        pendiente: 0, confirmado: 0, preparando: 0,
        enviado: 0, entregado: 0, cancelado: 0,
      }
      for (const row of statusRows as any[]) {
        if (row.status in counts) counts[row.status] = Number(row.count)
      }
      const [latestRows] = await pool.query(
        'SELECT id FROM storefront_orders ORDER BY created_at DESC LIMIT 1'
      ) as any
      const latestId = (latestRows as any[])[0]?.id ?? null
      res.write(`data: ${JSON.stringify({ counts, latestId })}\n\n`)
    } catch { /* ignore — client will reconnect */ }
  }

  sendSummary()
  const interval = setInterval(sendSummary, 20_000)

  // Keep-alive ping every 30 s to prevent proxy timeouts
  const ping = setInterval(() => { try { res.write(': ping\n\n') } catch { /* closed */ } }, 30_000)

  req.on('close', () => {
    clearInterval(interval)
    clearInterval(ping)
  })
})

// ─── GET /api/superadmin/analytics ───────────────────────────────────────────
// KPIs de plataforma: revenue, pedidos, ticket medio, tenants activos
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string || '30', 10)))

    // ── Current period ────────────────────────────────────────────────────
    const [[curSf]] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
       FROM storefront_orders
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND status != 'cancelado'`,
      [days]
    ) as any
    const [[curPos]] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
       FROM sales
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND status = 'completada'`,
      [days]
    ) as any

    const currentRevenue = Number(curSf.revenue) + Number(curPos.revenue)
    const currentOrders  = Number(curSf.orders)  + Number(curPos.orders)

    // ── Previous period (same length before current) ──────────────────────
    const [[prevSf]] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
       FROM storefront_orders
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND created_at <  DATE_SUB(NOW(), INTERVAL ? DAY)
         AND status != 'cancelado'`,
      [days * 2, days]
    ) as any
    const [[prevPos]] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
       FROM sales
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND created_at <  DATE_SUB(NOW(), INTERVAL ? DAY)
         AND status = 'completada'`,
      [days * 2, days]
    ) as any

    const prevRevenue = Number(prevSf.revenue) + Number(prevPos.revenue)
    const prevOrders  = Number(prevSf.orders)  + Number(prevPos.orders)

    // ── Active tenants ────────────────────────────────────────────────────
    const [[tenantRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tenants WHERE status = 'activo'`
    ) as any

    // ── New tenants in period ─────────────────────────────────────────────
    const [[newTRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tenants
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    ) as any

    // ── Top tenant by revenue (storefront only, simpler) ──────────────────
    const [topRows] = await pool.query(
      `SELECT t.name AS tenantName, COALESCE(SUM(o.total), 0) AS revenue
       FROM storefront_orders o
       JOIN tenants t ON t.id = o.tenant_id
       WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND o.status != 'cancelado'
       GROUP BY o.tenant_id, t.name
       ORDER BY revenue DESC LIMIT 1`,
      [days]
    ) as any

    const topTenant = (topRows as any[])[0]
    const avgTicket = currentOrders > 0 ? Math.round(currentRevenue / currentOrders) : 0

    res.json({
      success: true,
      data: {
        currentRevenue, prevRevenue,
        currentOrders, prevOrders,
        avgTicket,
        activeTenants: Number(tenantRow.total),
        newTenants:    Number(newTRow.total),
        topTenantName:    topTenant?.tenantName    ?? null,
        topTenantRevenue: Number(topTenant?.revenue ?? 0),
        days,
      },
    })
  } catch (err) {
    console.error('[superadmin-analytics] error:', err)
    res.status(500).json({ success: false, error: 'Error al obtener analytics' })
  }
})

// ─── GET /api/superadmin/analytics/heatmap ───────────────────────────────────
// Conteo de pedidos por día-de-semana × hora para heatmap
router.get('/analytics/heatmap', async (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string || '30', 10)))

    // Combine storefront orders + POS sales (DAYOFWEEK: 1=Sun, so -1 → 0=Sun..6=Sat)
    const [rows] = await pool.query(
      `SELECT dayOfWeek, hour, SUM(orderCount) AS orderCount
       FROM (
         SELECT
           DAYOFWEEK(created_at) - 1 AS dayOfWeek,
           HOUR(created_at)          AS hour,
           COUNT(*)                  AS orderCount
         FROM storefront_orders
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND status != 'cancelado'
         GROUP BY dayOfWeek, hour
         UNION ALL
         SELECT
           DAYOFWEEK(created_at) - 1 AS dayOfWeek,
           HOUR(created_at)          AS hour,
           COUNT(*)                  AS orderCount
         FROM sales
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND status = 'completada'
         GROUP BY dayOfWeek, hour
       ) combined
       GROUP BY dayOfWeek, hour
       ORDER BY dayOfWeek, hour`,
      [days, days]
    ) as any

    const cells = (rows as any[]).map(r => ({
      dayOfWeek:  Number(r.dayOfWeek),
      hour:       Number(r.hour),
      orderCount: Number(r.orderCount),
    }))
    const maxCount = cells.reduce((m, c) => Math.max(m, c.orderCount), 0)

    res.json({ success: true, data: { cells, maxCount, days } })
  } catch (err) {
    console.error('[superadmin-analytics/heatmap] error:', err)
    res.status(500).json({ success: false, error: 'Error al obtener heatmap' })
  }
})

export default router
