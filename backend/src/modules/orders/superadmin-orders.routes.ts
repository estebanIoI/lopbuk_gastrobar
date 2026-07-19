import { Router, Request, Response } from 'express'
import pool from '../../config/database'
import { authenticate, authorize, AuthRequest } from '../../common/middleware'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { encrypt, decrypt } from '../../utils/crypto'

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
      "SELECT id, name, slug, business_type AS businessType FROM tenants WHERE status = 'activo' ORDER BY name"
    ) as any
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener comercios' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// REPARTIDORES DE PLATAFORMA (courier) — un repartidor sin comercio fijo que
// atiende un grupo de comercios asignados por el superadmin (courier_tenants).
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/superadmin/couriers — repartidores de plataforma + nº de comercios
router.get('/couriers', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      // F6: calidad del repartidor a la vista. avgStars es NULL si nunca lo han
      // calificado — la UI debe mostrar "sin calificaciones", no un 0 inventado.
      `SELECT u.id, u.name, u.email, u.phone, u.is_active AS isActive,
              (SELECT COUNT(*) FROM courier_tenants ct WHERE ct.courier_user_id = u.id) AS tenantsCount,
              (SELECT ROUND(AVG(cr.stars), 2) FROM courier_ratings cr
                WHERE cr.courier_user_id = u.id) AS avgStars,
              (SELECT COUNT(cr.stars) FROM courier_ratings cr
                WHERE cr.courier_user_id = u.id) AS ratingsCount,
              (SELECT COUNT(*) FROM courier_ratings cr
                WHERE cr.courier_user_id = u.id AND cr.reported = 1
                  AND cr.reviewed_at IS NULL) AS openReports
       FROM users u
       WHERE u.role = 'repartidor' AND u.tenant_id IS NULL
       ORDER BY openReports DESC, u.name`
    ) as any
    // AVG sobre DECIMAL llega como string ("2.00") por mysql2; el cliente lo tipa
    // como number. Se normaliza aquí para que ambos extremos coincidan.
    res.json({
      success: true,
      data: (rows as any[]).map(r => ({
        ...r,
        avgStars: r.avgStars != null ? Number(r.avgStars) : null,
        ratingsCount: Number(r.ratingsCount || 0),
        openReports: Number(r.openReports || 0),
      })),
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener repartidores' })
  }
})

// POST /api/superadmin/couriers — crear repartidor de plataforma (tenant_id NULL)
router.post('/couriers', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body as { name?: string; email?: string; password?: string; phone?: string }
    if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
      res.status(400).json({ success: false, error: 'Nombre, email y contraseña (mín. 6) requeridos' })
      return
    }
    const [dup] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]) as any
    if (dup.length) { res.status(400).json({ success: false, error: 'Ese email ya está registrado' }); return }
    const id = uuidv4()
    const hashed = await bcrypt.hash(password, 10)
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, password, name, role, phone, can_login, is_active)
       VALUES (?, NULL, ?, ?, ?, 'repartidor', ?, 1, 1)`,
      [id, email.trim().toLowerCase(), hashed, name.trim(), phone?.trim() || null]
    )
    res.status(201).json({ success: true, data: { id, name: name.trim(), email: email.trim().toLowerCase() } })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al crear repartidor' })
  }
})

// GET /api/superadmin/couriers/:id/tenants — comercios asignados a un repartidor
router.get('/couriers/:id/tenants', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.name, t.business_type AS businessType
       FROM courier_tenants ct JOIN tenants t ON t.id = ct.tenant_id
       WHERE ct.courier_user_id = ?
       ORDER BY t.name`,
      [req.params.id]
    ) as any
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener comercios del repartidor' })
  }
})

// PUT /api/superadmin/couriers/:id/tenants — reemplaza la lista de comercios asignados
router.put('/couriers/:id/tenants', async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection()
  try {
    const courierId = req.params.id
    const tenantIds: string[] = Array.isArray(req.body?.tenantIds)
      ? [...new Set(req.body.tenantIds.map((x: any) => String(x).trim()).filter(Boolean) as string[])] : []

    // Validar que sea un repartidor de plataforma
    const [uRows] = await conn.query("SELECT id FROM users WHERE id = ? AND role = 'repartidor' AND tenant_id IS NULL", [courierId]) as any
    if (!uRows.length) { res.status(404).json({ success: false, error: 'Repartidor no encontrado' }); return }

    await conn.beginTransaction()
    await conn.query('DELETE FROM courier_tenants WHERE courier_user_id = ?', [courierId])
    for (const tid of tenantIds) {
      await conn.query(
        'INSERT INTO courier_tenants (id, courier_user_id, tenant_id, assigned_by) VALUES (?, ?, ?, ?)',
        [uuidv4(), courierId, tid, req.user!.userId]
      )
    }
    await conn.commit()
    res.json({ success: true, data: { assigned: tenantIds.length } })
  } catch (err) {
    await conn.rollback().catch(() => {})
    res.status(500).json({ success: false, error: 'Error al asignar comercios' })
  } finally {
    conn.release()
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG DE MAPAS (seguimiento en vivo) — proveedor + API key (opcional)
// La key se guarda CIFRADA en platform_settings y NUNCA se expone al cliente.
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/superadmin/maps-config — provider + si hay key (sin exponerla)
router.get('/maps-config', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('maps_provider','maps_api_key')"
    ) as any
    const map: Record<string, string> = {}
    for (const r of rows) map[r.setting_key] = r.setting_value
    res.json({ success: true, data: { provider: map['maps_provider'] || 'none', hasKey: !!map['maps_api_key'] } })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al leer la config de mapas' })
  }
})

// PUT /api/superadmin/maps-config — { provider, apiKey? }
router.put('/maps-config', async (req: Request, res: Response) => {
  try {
    const provider = ['none', 'google', 'mapbox'].includes(req.body?.provider) ? req.body.provider : 'none'
    const apiKey: string | undefined = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : undefined
    await pool.query(
      "INSERT INTO platform_settings (setting_key, setting_value) VALUES ('maps_provider', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
      [provider, provider]
    )
    if (provider === 'none') {
      await pool.query("DELETE FROM platform_settings WHERE setting_key = 'maps_api_key'")
    } else if (apiKey) {
      const enc = encrypt(apiKey)
      await pool.query(
        "INSERT INTO platform_settings (setting_key, setting_value) VALUES ('maps_api_key', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [enc, enc]
      )
    }
    res.json({ success: true, data: { provider, hasKey: provider !== 'none' && (!!apiKey || undefined) } })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al guardar la config de mapas' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// LINKS DE CAMPAÑA (share links) — para historias IG/TikTok
// El superadmin genera links que redirigen a un producto, una tienda o una
// colección filtrada (solo restaurantes / comercios elegidos).
// ═══════════════════════════════════════════════════════════════════════════

// Normaliza y valida la config según el tipo
function normalizeShareConfig(type: string, config: any): any | null {
  if (type === 'product') {
    if (!config?.slug || !config?.productId) return null
    return { slug: String(config.slug).trim(), productId: String(config.productId).trim() }
  }
  if (type === 'store') {
    if (!config?.slug) return null
    return { slug: String(config.slug).trim() }
  }
  if (type === 'collection') {
    const businessTypes = Array.isArray(config?.businessTypes) ? [...new Set(config.businessTypes.map((x: any) => String(x).trim()).filter(Boolean))] : []
    const tenantIds = Array.isArray(config?.tenantIds) ? [...new Set(config.tenantIds.map((x: any) => String(x).trim()).filter(Boolean))] : []
    if (!businessTypes.length && !tenantIds.length) return null
    return { businessTypes, tenantIds }
  }
  return null
}

// GET /api/superadmin/share-links — lista con clics
router.get('/share-links', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, code, type, config, title, clicks, is_active AS isActive, created_at AS createdAt FROM share_links ORDER BY created_at DESC'
    ) as any
    const data = rows.map((r: any) => ({ ...r, config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config }))
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al listar links' })
  }
})

// POST /api/superadmin/share-links — crear
router.post('/share-links', async (req: AuthRequest, res: Response) => {
  try {
    const { type, title } = req.body as { type?: string; title?: string }
    if (!['product', 'store', 'collection'].includes(type || '')) { res.status(400).json({ success: false, error: 'Tipo inválido' }); return }
    const config = normalizeShareConfig(type!, req.body?.config)
    if (!config) { res.status(400).json({ success: false, error: 'Configuración incompleta para ese tipo' }); return }

    // Código corto único (8 chars base36)
    let code = ''
    for (let attempt = 0; attempt < 6; attempt++) {
      const c = Math.random().toString(36).slice(2, 10)
      const [dup] = await pool.query('SELECT id FROM share_links WHERE code = ? LIMIT 1', [c]) as any
      if (!dup.length) { code = c; break }
    }
    if (!code) { res.status(500).json({ success: false, error: 'No se pudo generar el código' }); return }

    const id = uuidv4()
    await pool.query(
      'INSERT INTO share_links (id, code, type, config, title, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, code, type, JSON.stringify(config), title?.trim() || null, req.user!.userId]
    )
    res.status(201).json({ success: true, data: { id, code, type, config, title: title?.trim() || null, clicks: 0, isActive: 1 } })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al crear el link' })
  }
})

// PATCH /api/superadmin/share-links/:id — activar/desactivar o actualizar título
router.patch('/share-links/:id', async (req: Request, res: Response) => {
  try {
    const sets: string[] = []; const vals: any[] = []
    if ('isActive' in (req.body || {})) { sets.push('is_active = ?'); vals.push(req.body.isActive ? 1 : 0) }
    if ('title' in (req.body || {})) { sets.push('title = ?'); vals.push(String(req.body.title || '').trim() || null) }
    if (!sets.length) { res.status(400).json({ success: false, error: 'Sin cambios' }); return }
    vals.push(req.params.id)
    const [r] = await pool.query(`UPDATE share_links SET ${sets.join(', ')} WHERE id = ?`, vals) as any
    if (!r.affectedRows) { res.status(404).json({ success: false, error: 'Link no encontrado' }); return }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al actualizar el link' })
  }
})

// DELETE /api/superadmin/share-links/:id
router.delete('/share-links/:id', async (req: Request, res: Response) => {
  try {
    const [r] = await pool.query('DELETE FROM share_links WHERE id = ?', [req.params.id]) as any
    if (!r.affectedRows) { res.status(404).json({ success: false, error: 'Link no encontrado' }); return }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al eliminar el link' })
  }
})

// PATCH /api/superadmin/couriers/:id — activar/desactivar repartidor
router.patch('/couriers/:id', async (req: Request, res: Response) => {
  try {
    const isActive = req.body?.isActive ? 1 : 0
    const [r] = await pool.query(
      "UPDATE users SET is_active = ?, can_login = ? WHERE id = ? AND role = 'repartidor' AND tenant_id IS NULL",
      [isActive, isActive, req.params.id]
    ) as any
    if (!r.affectedRows) { res.status(404).json({ success: false, error: 'Repartidor no encontrado' }); return }
    res.json({ success: true, data: { isActive: !!isActive } })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al actualizar repartidor' })
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

// ═══════════════════════════════════════════════════════════════════════════
// F6 · Moderación de reportes de repartidores
// El cliente reporta desde el seguimiento (F5); aquí el superadmin los revisa.
// Marcar como revisado NO borra el reporte: queda el historial con quién y cuándo.
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/superadmin/courier-reports?status=pendientes|revisados|todos
router.get('/courier-reports', async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || 'pendientes')
    const where = status === 'revisados' ? 'AND cr.reviewed_at IS NOT NULL'
      : status === 'todos' ? ''
      : 'AND cr.reviewed_at IS NULL'

    const [rows] = await pool.query(
      `SELECT cr.id, cr.stars, cr.comment, cr.report_reason AS reportReason,
              cr.created_at AS createdAt, cr.reviewed_at AS reviewedAt,
              rv.name AS reviewedByName,
              u.id AS courierId, u.name AS courierName, u.phone AS courierPhone,
              t.name AS tenantName,
              o.order_number AS orderNumber, o.total,
              o.delivery_delivered_at AS deliveredAt
         FROM courier_ratings cr
         LEFT JOIN users u ON u.id = cr.courier_user_id
         LEFT JOIN users rv ON rv.id = cr.reviewed_by
         LEFT JOIN tenants t ON t.id = cr.tenant_id
         LEFT JOIN storefront_orders o ON o.id = cr.order_id
        WHERE cr.reported = 1 ${where}
        ORDER BY cr.created_at DESC
        LIMIT 200`
    ) as any

    // Contador de pendientes para el badge de la pestaña
    const [[pend]] = await pool.query(
      'SELECT COUNT(*) AS n FROM courier_ratings WHERE reported = 1 AND reviewed_at IS NULL'
    ) as any

    res.json({ success: true, data: { reports: rows, pending: Number(pend?.n || 0) } })
  } catch (err) {
    console.error('Courier reports error:', err)
    res.status(500).json({ success: false, error: 'Error al obtener los reportes' })
  }
})

// POST /api/superadmin/courier-reports/:id/review — marcar revisado (o reabrir)
router.post('/courier-reports/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    const reopen = req.body?.reopen === true
    const [upd] = await pool.query(
      reopen
        ? 'UPDATE courier_ratings SET reviewed_at = NULL, reviewed_by = NULL WHERE id = ? AND reported = 1'
        : 'UPDATE courier_ratings SET reviewed_at = NOW(), reviewed_by = ? WHERE id = ? AND reported = 1',
      reopen ? [req.params.id] : [req.user!.userId, req.params.id]
    ) as any

    if (!upd || upd.affectedRows === 0) {
      res.status(404).json({ success: false, error: 'Reporte no encontrado' })
      return
    }
    res.json({ success: true, data: { reviewed: !reopen } })
  } catch (err) {
    console.error('Review report error:', err)
    res.status(500).json({ success: false, error: 'Error al actualizar el reporte' })
  }
})

export default router
