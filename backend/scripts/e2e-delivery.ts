/**
 * E2E — flujo completo de domicilio de plataforma (tema 2).
 * Crea datos de prueba, recorre el flujo por HTTP real como lo haría cada actor,
 * y limpia todo al final. Cualquier ✗ es un error real del flujo.
 */
import 'dotenv/config'
import pool from './src/config/database'
import { config } from './src/config'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

const API = 'http://localhost:3001/api'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log(`${c ? '  ✓' : '  ✗ FALLO'} ${m}`) }
const step = (n: string) => console.log(`\n── ${n} ──`)

const created = { tenantId: '', courierId: '', productId: '', orderId: '', ratingId: '', roomId: '', saId: '' }

async function main() {
  step('SETUP · datos de prueba')

  // Comercio con tienda en modo plataforma
  const [tn] = await pool.query(
    "SELECT t.id, t.slug FROM tenants t JOIN store_info s ON s.tenant_id=t.id WHERE t.status='activo' LIMIT 1") as any
  const tenantId = tn[0].id, slug = tn[0].slug
  const [[siPrev]] = await pool.query(
    'SELECT delivery_mode, platform_delivery_fee FROM store_info WHERE tenant_id=?', [tenantId]) as any
  await pool.query(
    "UPDATE store_info SET delivery_mode='plataforma', platform_delivery_fee=6000, delivery_auto_broadcast=1 WHERE tenant_id=?",
    [tenantId])
  console.log(`  comercio: ${slug} → modo plataforma, domicilio $6.000`)

  // Producto de prueba
  const productId = randomUUID(); created.productId = productId
  await pool.query(
    `INSERT INTO products (id, tenant_id, name, sku, category, entry_date,
       purchase_price, sale_price, stock, reserved_stock)
     VALUES (?, ?, 'E2E Hamburguesa', ?, 'E2E', CURDATE(), 12000, 25000, 100, 0)`,
    [productId, tenantId, 'E2E-' + Date.now()])
  console.log('  producto: E2E Hamburguesa $25.000')

  // Repartidor de plataforma
  const courierId = randomUUID(); created.courierId = courierId
  await pool.query(
    `INSERT INTO users (id, tenant_id, name, email, password, role, is_active, phone)
     VALUES (?, NULL, 'Carlos E2E', ?, ?, 'repartidor', 1, '3011112222')`,
    [courierId, `e2e-courier-${Date.now()}@test.local`, await bcrypt.hash(randomUUID(), 4)])
  await pool.query('INSERT INTO courier_tenants (id, courier_user_id, tenant_id) VALUES (?,?,?)', [randomUUID(), courierId, tenantId])
  console.log('  repartidor: Carlos E2E, asignado al comercio')

  const [sa] = await pool.query("SELECT id,email,name FROM users WHERE role='superadmin' LIMIT 1") as any
  const sign = (id: string, role: string, tid: string | null, email = 'x@x.co', name = 'x') =>
    jwt.sign({ userId: id, id, email, name, role, tenantId: tid }, config.jwt.secret, { expiresIn: '1h' } as any)
  const CH = { 'Content-Type': 'application/json', Authorization: `Bearer ${sign(courierId, 'repartidor', null)}` }
  const SH = { 'Content-Type': 'application/json', Authorization: `Bearer ${sign(sa[0].id, 'superadmin', null, sa[0].email, sa[0].name)}` }
  const J = { 'Content-Type': 'application/json' }

  try {
    // ─────────────────────────────────────────────────────────────
    step('1 · El repartidor se pone EN LÍNEA')
    let r = await fetch(`${API}/delivery/availability`, {
      method: 'PUT', headers: CH, body: JSON.stringify({ isOnline: true, lat: 4.6510, lng: -74.0550 }) })
    ok(r.status === 200, `PUT /delivery/availability → ${r.status}`)

    step('2 · El cliente abre el checkout del tema 2')
    r = await fetch(`${API}/storefront/delivery-availability/${slug}`)
    let j: any = await r.json()
    ok(j.data?.enabled === true, `la tienda ofrece domicilio de plataforma (tarifa $${j.data?.fee})`)
    ok(j.data?.couriersOnline === 1, `ve ${j.data?.couriersOnline} repartidor(es) disponible(s)`)

    step('3 · El cliente confirma el pedido (payload real del tema 2)')
    const orderBody = {
      customerName: 'Ana Gómez', customerPhone: '3009998877',
      address: 'Calle 45 #12-30, portón azul', notes: 'Sin cebolla',
      items: [{ productId, productName: 'E2E Hamburguesa', quantity: 2, unitPrice: 25000 }],
      tenantId, paymentMethod: 'efectivo',
      deliveryLatitude: 4.6600, deliveryLongitude: -74.0600,
      requestCourier: true, acceptsDataPolicy: true,
    }
    r = await fetch(`${API}/orders/public`, { method: 'POST', headers: J, body: JSON.stringify(orderBody) })
    j = await r.json()
    ok(r.status === 201, `POST /orders/public → ${r.status} ${r.status !== 201 ? JSON.stringify(j) : ''}`)
    const orderId = j.data?.orderId; created.orderId = orderId
    const trackingToken = j.data?.trackingToken
    ok(!!orderId, `pedido creado: #${j.data?.orderNumber}`)
    ok(!!trackingToken, 'devuelve token de seguimiento (para ver "Buscando repartidor…")')

    // Regresión: sin consentimiento debe rechazar
    r = await fetch(`${API}/orders/public`, {
      method: 'POST', headers: J, body: JSON.stringify({ ...orderBody, acceptsDataPolicy: undefined }) })
    ok(r.status === 400, `sin aceptar política de datos → 400 (fue ${r.status})`)

    step('4 · El cliente ve "Buscando repartidor…"')
    r = await fetch(`${API}/storefront/tracking/${trackingToken}`); j = await r.json()
    ok(j.data?.delivery?.state === 'buscando', `estado = "${j.data?.delivery?.state}"`)
    ok(j.data?.delivery?.courierName === null, 'aún no se expone ningún repartidor')

    step('5 · El pedido se difunde al repartidor')
    r = await fetch(`${API}/delivery/available`, { headers: CH }); j = await r.json()
    ok(j.data?.some((o: any) => o.id === orderId), `aparece en "Disponibles" (${j.data?.length} pedido(s))`)

    step('6 · El repartidor acepta')
    r = await fetch(`${API}/delivery/accept/${orderId}`, { method: 'PUT', headers: CH })
    j = await r.json()
    ok(r.status === 200, `PUT /delivery/accept → ${r.status}`)
    // Carrera: un segundo intento debe fallar
    r = await fetch(`${API}/delivery/accept/${orderId}`, { method: 'PUT', headers: CH })
    ok(r.status === 400, `segundo intento de aceptar → 400 (fue ${r.status})`)

    step('7 · El cliente ve quién aceptó')
    r = await fetch(`${API}/storefront/tracking/${trackingToken}`); j = await r.json()
    ok(j.data?.delivery?.state === 'asignado', `estado = "${j.data?.delivery?.state}"`)
    ok(j.data?.delivery?.courierName === 'Carlos', `ve el nombre: "${j.data?.delivery?.courierName}" (solo el primero)`)
    ok(!!j.data?.delivery?.courierPhone, 'puede llamarlo mientras la entrega está viva')

    step('8 · Chat cliente ↔ repartidor')
    r = await fetch(`${API}/storefront/tracking/${trackingToken}/chat`); j = await r.json()
    ok(j.data?.available === true, 'el chat se abre tras aceptar')
    created.roomId = j.data?.roomId
    r = await fetch(`${API}/storefront/tracking/${trackingToken}/chat`, {
      method: 'POST', headers: J, body: JSON.stringify({ message: 'Es el portón azul, timbre 2' }) })
    ok(r.status === 200, `el cliente escribe → ${r.status}`)
    r = await fetch(`${API}/delivery-chat/room/${created.roomId}/messages`, {
      method: 'POST', headers: CH, body: JSON.stringify({ message: 'Voy en camino, 10 min' }) })
    ok(r.status === 200, `el repartidor responde → ${r.status}`)
    r = await fetch(`${API}/storefront/tracking/${trackingToken}/chat`); j = await r.json()
    ok(j.data?.messages?.length === 2, `la conversación tiene ${j.data?.messages?.length} mensajes`)
    const roles = j.data?.messages?.map((m: any) => m.senderRole)
    ok(roles?.includes('cliente') && roles?.includes('repartidor'), `roles correctos: ${roles?.join(', ')}`)

    step('9 · Recorrido de la entrega')
    for (const st of ['recogido', 'en_camino']) {
      r = await fetch(`${API}/delivery/status/${orderId}`, {
        method: 'PUT', headers: CH, body: JSON.stringify({ deliveryStatus: st }) })
      ok(r.status === 200, `estado → ${st} (${r.status})`)
    }
    r = await fetch(`${API}/storefront/tracking/${trackingToken}`); j = await r.json()
    ok(j.data?.delivery?.state === 'en_camino', `el cliente ve "${j.data?.delivery?.state}"`)

    step('10 · Entrega + cierre automático del chat')
    r = await fetch(`${API}/delivery/status/${orderId}`, {
      method: 'PUT', headers: CH,
      body: JSON.stringify({ deliveryStatus: 'entregado', podReceivedBy: 'Ana Gómez' }) })
    ok(r.status === 200, `estado → entregado (${r.status})`)
    r = await fetch(`${API}/storefront/tracking/${trackingToken}/chat`); j = await r.json()
    ok(j.data?.status === 'closed', `la sala quedó "${j.data?.status}"`)
    ok(j.data?.messages?.length === 2, 'el historial sigue legible (solo lectura)')
    r = await fetch(`${API}/storefront/tracking/${trackingToken}/chat`, {
      method: 'POST', headers: J, body: JSON.stringify({ message: 'hola?' }) })
    ok(r.status === 409, `escribir tras entregar → 409 (fue ${r.status})`)

    step('11 · El cliente califica y reporta')
    r = await fetch(`${API}/storefront/tracking/${trackingToken}/courier-rating`, {
      method: 'POST', headers: J,
      body: JSON.stringify({ stars: 2, comment: 'Llegó tarde', reported: true, reportReason: 'tarde' }) })
    ok(r.status === 200, `POST courier-rating → ${r.status}`)
    r = await fetch(`${API}/storefront/tracking/${trackingToken}/courier-rating`, {
      method: 'POST', headers: J, body: JSON.stringify({ stars: 5 }) })
    ok(r.status === 409, `intentar calificar dos veces → 409 (fue ${r.status})`)
    r = await fetch(`${API}/storefront/tracking/${trackingToken}`); j = await r.json()
    ok(j.data?.delivery?.rated === true, 'el seguimiento ya no vuelve a pedir calificación')
    ok(j.data?.delivery?.courierPhone === null, 'tras entregar deja de exponerse el teléfono')

    step('12 · El repartidor ve su calificación')
    r = await fetch(`${API}/delivery/my-rating`, { headers: CH }); j = await r.json()
    ok(j.data?.average === 2, `promedio real = ${j.data?.average} sobre ${j.data?.ratings} calificación(es)`)
    ok(j.data?.reports === 1, `reportes = ${j.data?.reports}`)

    step('13 · El superadmin modera el reporte')
    r = await fetch(`${API}/superadmin/courier-reports?status=pendientes`, { headers: SH }); j = await r.json()
    const rep = j.data?.reports?.find((x: any) => x.courierId === courierId)
    created.ratingId = rep?.id
    ok(!!rep, 'el reporte llega al panel del superadmin')
    ok(rep?.reportReason === 'tarde' && rep?.courierName === 'Carlos E2E', `motivo="${rep?.reportReason}" repartidor="${rep?.courierName}"`)
    r = await fetch(`${API}/superadmin/courier-reports/${rep?.id}/review`, { method: 'POST', headers: SH, body: '{}' })
    ok(r.status === 200, `marcar revisado → ${r.status}`)
    r = await fetch(`${API}/superadmin/couriers`, { headers: SH }); j = await r.json()
    const card = j.data?.find((x: any) => x.id === courierId)
    ok(card?.avgStars === 2, `la ficha del repartidor muestra ${card?.avgStars}★ (${card?.ratingsCount})`)
    ok(card?.openReports === 0, `reportes abiertos tras revisar = ${card?.openReports}`)

    step('14 · El pedido cerró bien')
    const [[fin]] = await pool.query(
      `SELECT status, delivery_status, pod_received_by, courier_requested FROM storefront_orders WHERE id=?`, [orderId]) as any
    ok(fin.status === 'entregado' && fin.delivery_status === 'entregado', `status=${fin.status} / delivery=${fin.delivery_status}`)
    ok(fin.pod_received_by === 'Ana Gómez', `prueba de entrega: recibido por ${fin.pod_received_by}`)
    ok(fin.courier_requested === 1, 'quedó marcado como pedido con repartidor de plataforma')
  } finally {
    step('LIMPIEZA')
    if (created.roomId) {
      await pool.query('DELETE FROM delivery_chat_messages WHERE room_id=?', [created.roomId])
      await pool.query('DELETE FROM delivery_chat_rooms WHERE id=?', [created.roomId])
    }
    if (created.orderId) {
      await pool.query('DELETE FROM courier_ratings WHERE order_id=?', [created.orderId])
      await pool.query('DELETE FROM storefront_order_items WHERE order_id=?', [created.orderId])
      await pool.query('DELETE FROM order_stage_events WHERE order_id=?', [created.orderId]).catch(() => {})
      await pool.query('DELETE FROM storefront_orders WHERE id=?', [created.orderId])
    }
    await pool.query('DELETE FROM courier_availability WHERE user_id=?', [courierId])
    await pool.query('DELETE FROM courier_tenants WHERE courier_user_id=?', [courierId])
    await pool.query('DELETE FROM users WHERE id=?', [courierId])
    await pool.query('DELETE FROM products WHERE id=?', [productId])
    await pool.query('UPDATE store_info SET delivery_mode=?, platform_delivery_fee=? WHERE tenant_id=?',
      [siPrev?.delivery_mode || 'ninguno', siPrev?.platform_delivery_fee || 0, tenantId])
    console.log('  datos de prueba eliminados, tienda restaurada')
    console.log(`\n${'='.repeat(46)}\n  RESULTADO: ${pass} ✓   ${fail} ✗\n${'='.repeat(46)}`)
    await pool.end()
  }
}
main().catch(e => { console.error('ERROR FATAL:', e.message); process.exit(1) })
