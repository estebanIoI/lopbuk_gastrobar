# 🛣️ Endpoints Index — Ultra-compacto

> Base URL: `http://localhost:3001/api`  
> Auth: `Authorization: Bearer <JWT>` o httpOnly cookie  
> Respuesta: `{ success: true, data: ... }` / `{ success: false, error: "..." }`

```
AUTH
  POST  /auth/login              email+password → JWT + cookie
  POST  /auth/google             idToken Google → JWT + cookie
  POST  /auth/logout             limpia cookie
  GET   /auth/me                 usuario actual

USERS
  GET   /users                   lista del tenant
  POST  /users                   crea usuario
  PUT   /users/:id               actualiza
  PUT   /users/:id/role          cambia rol
  DELETE /users/:id              desactiva (soft)

TENANTS (superadmin)
  GET   /tenants                 lista todos
  POST  /tenants                 crea tenant
  PUT   /tenants/:id             actualiza config
  PATCH /tenants/:id/status      activa / suspende / cancela (soft-delete) tenant
  GET   /tenants/:id/modules     módulos activos
  PUT   /tenants/:id/modules     activa/desactiva módulos

SUPERADMIN — Centro de Pedidos + Analítica  (solo superadmin)
  GET   /superadmin/orders                       cross-tenant: ?tenant_id, status, assigned, search, date_from, date_to, page, limit
  GET   /superadmin/orders/summary               conteos { pendiente, confirmado, preparando, enviado, entregado, cancelado }
  GET   /superadmin/orders/tenants               lista mínima {id, name} tenants activos (para filtro de comercio en UI)
  GET   /superadmin/orders/:id/items             ítems del pedido + historial de estados (order_status_history)
  GET   /superadmin/orders/:id/drivers           repartidores activos del tenant del pedido (para asignación rápida)
  PATCH /superadmin/orders/:id/status            { status, note } → transición de estado + auditoría
  PATCH /superadmin/orders/:id/assign            { unassign?, assigneeId? } → asigna req.user o repartidor específico; devuelve assigned_name
  GET   /superadmin/events                       SSE stream: { counts, latestId } cada 20s + ping 30s (fallback polling /summary)
  GET   /superadmin/analytics?days=N             KPIs plataforma: revenue, orders, avgTicket, activeTenants, newTenants (actual vs período anterior)
  GET   /superadmin/analytics/heatmap?days=N     pedidos por día(0=Dom..6=Sáb) × hora(0-23) — UNION storefront_orders + sales

TENANTS (superadmin) — Ampliados Sprint 5
  PUT   /tenants/:id                             ahora acepta `slug` (con validación unicidad) + campos anteriores
  POST  /tenants/:id/activate-trial              ahora acepta body { days: number } (default 7, max 365)

PRODUCTS
  GET   /products                lista del tenant
  POST  /products                crea producto
  PUT   /products/:id            actualiza
  DELETE /products/:id           soft delete
  POST  /products/bulk           importación masiva

VARIANTS (Product Variants + Price Tiers + Import)
  GET   /products/:productId/variants                  variantes de un producto
  POST  /products/:productId/variants                  crea variante
  PUT   /variants/:id                                  actualiza variante
  DELETE /variants/:id                                 soft delete
  PATCH /variants/:id/stock                            { quantity, reason } → UPDATE atómico
  POST  /variants/resolve-price                        { variantId, qty } → { price, marginPct, source }
  GET   /variants/:id/price-tiers                      lista tiers ordenados por min_qty
  POST  /variants/:id/price-tiers                      crea tier { minQty, price, marginPct }
  PUT   /price-tiers/:id                               actualiza tier
  DELETE /variants/:id/price-tiers/:tid                elimina tier
  POST  /variants/import                               importa CSV masivo con variantes
  GET   /variants/import/template                      descarga plantilla CSV

CATEGORIES
  GET   /categories                lista del tenant (acepta ?includeHidden=true)
  POST  /categories                { id, name, description?, color? }
  PUT   /categories/:id            { name?, description?, color?, sortOrder? }
  PATCH /categories/:id/visibility toggle is_active (ocultar/mostrar)
  DELETE /categories/:id           elimina (falla si tiene productos activos)

INVENTORY
  GET   /inventory               kardex (movimientos)
  POST  /inventory/movement      { productId, quantity, type, reason }
  GET   /inventory/stock         stock actual todos los productos
  GET   /inventory/alerts        bajo stock mínimo

SUPPLIERS
  GET   /suppliers                        lista del tenant
  POST  /suppliers                        crea proveedor
  PUT   /suppliers/:id                    actualiza
  DELETE /suppliers/:id                   soft delete
  GET   /suppliers/:id/products           productos del proveedor
  POST  /suppliers/:id/products           asocia producto
  DELETE /suppliers/:id/products/:pid     desasocia producto

SALES
  GET   /sales                   historial con filtros
  GET   /sales/:id               venta con items
  POST  /sales                   registra venta
  PATCH /sales/:id/cancel        cancela (requiere razón)
  GET   /sales/summary           totales del período

CASH-SESSIONS
  GET   /cash-sessions           historial sesiones
  GET   /cash-sessions/active    sesión activa actual
  POST  /cash-sessions/open      { initialAmount, sedeId }
  POST  /cash-sessions/close     { countedAmount, notes }
  GET   /cash-sessions/:id       sesión con movimientos

ORDERS
  GET   /orders                  lista (filtrable por estado)
  GET   /orders/:id              pedido con items
  POST  /orders                  crea pedido
  PATCH /orders/:id/status       actualiza estado
  DELETE /orders/:id             cancela

RESTBAR
  GET   /restbar/tables                   estado de mesas
  POST  /restbar/tables                   crea mesa
  GET   /restbar/orders                   comandas en mesa
  POST  /restbar/orders                   crea comanda
  PATCH /restbar/orders/:id               actualiza comanda
  GET   /restbar/reservations             lista reservas
  POST  /restbar/reservations             crea reserva
  PATCH /restbar/reservations/:id/status  confirma/cancela

RESTBAR FINANZAS (solo superadmin, comerciante, administrador_rb)
  GET   /restbar/finanzas/timeline?month=YYYY-MM        feed cronológico del mes
  GET   /restbar/finanzas/gastos?from=&to=&quincena=    lista gastos variables
  POST  /restbar/finanzas/gastos                        registra gasto (auto-timestamp)
  PUT   /restbar/finanzas/gastos/:id                    edita gasto
  DELETE /restbar/finanzas/gastos/:id                   elimina gasto
  GET   /restbar/finanzas/ingresos?month=YYYY-MM        ingresos diarios del mes
  POST  /restbar/finanzas/ingresos                      upsert ingreso diario
  DELETE /restbar/finanzas/ingresos/:id                 elimina ingreso
  GET   /restbar/finanzas/gastos-fijos                  lista gastos fijos activos
  POST  /restbar/finanzas/gastos-fijos                  crea gasto fijo
  PUT   /restbar/finanzas/gastos-fijos/:id              edita gasto fijo
  DELETE /restbar/finanzas/gastos-fijos/:id             elimina gasto fijo
  GET   /restbar/finanzas/resumen?month=YYYY-MM         P&L quincenal (Q1/Q2 + global)

CUSTOMERS
  GET   /customers
  GET   /customers/:id           con historial compras
  POST  /customers
  PUT   /customers/:id
  POST  /customers/bulk
  DELETE /customers/:id          soft delete (is_active=0; borrado real → PRIVACY erase)

CHATBOT / AGENTE DE VENTAS 🤖
  GET   /chatbot/status/:slug              público: si el bot está activo + branding
  POST  /chatbot/message                   público: mensaje → { reply, suggestedProducts, suggestedReplies, lastMessageId, takeover? }
  GET   /chatbot/session-updates           público: polling del widget en takeover (?slug&sessionToken&afterId)
  GET   /chatbot/sessions                  comerciante: conversaciones con último mensaje y canal (web/wa)
  GET   /chatbot/sessions/:id/messages     comerciante: historial completo
  PATCH /chatbot/sessions/:id/takeover     comerciante: { takeover } silencia/reactiva el bot
  POST  /chatbot/sessions/:id/reply        comerciante: respuesta manual (web por polling; WhatsApp por Evolution)
  GET/PUT /chatbot/config                  comerciante: nombre, tono, FAQs, prompt extra, notificaciones

LOGÍSTICA / FLOTA (Sistema Operativo Logístico) 🚛
  GET   /fleet/routes/suggestions          agrupación por zona + vehículo/auxiliares sugeridos + sumar a ruta activa
  POST  /fleet/routes                      crear ruta (valida capacidad; sobrepeso → 400)
  GET   /fleet/routes                      rutas activas con paradas
  PATCH /fleet/routes/:id/status           cascada a pedidos + vehículo + historial + WhatsApp cliente
  PATCH /fleet/routes/:id/stops/:oid/delivered  entrega por parada (última cierra ruta)
  GET   /fleet/ops-board                   tablero: pedidos con espera, vehículos con carga, personal
  GET   /fleet/analytics                   rentabilidad por vehículo, ranking conductores, tiempos
  GET/POST /fleet/expenses                 gastos reales (combustible/peajes/repuestos; repartidor puede)
  PUT   /fleet/vehicles/:id/profile        SOAT/tecno/seguro/odómetro/consumo/mantenimiento-km
  PUT   /fleet/staff-status                estado del personal (disponible/almuerzo/incapacidad…)

PRODUCT TEMPLATES (plantillas dinámicas de producto) 🧩
  GET    /product-templates                    lista con # productos · auth
  POST   /product-templates                    crear (draft) · comerciante
  POST   /product-templates/seed-defaults      semillas Moda/Tech/Belleza
  PUT    /product-templates/:id                actualizar secciones/nombre
  PATCH  /product-templates/:id/status         draft | published | archived
  POST   /product-templates/:id/duplicate      duplicar
  DELETE /product-templates/:id                soft delete
  PATCH  /product-templates/assign             asignación masiva a productos
  PUT    /product-templates/products/:id/page-content   contenido único del producto
  GET    /storefront/product-page/:productId   PÚBLICO: secciones + page_content (caché 60s)

PRIVACY (Ley 1581 — habeas data) 🔐
  POST  /privacy/public/consents           registrar consentimiento (banner/checkout) · público, 10/min
  POST  /privacy/public/requests           solicitud de derechos del titular · público, 5/min, anti-enumeración
  GET   /privacy/requests                  solicitudes del tenant (?status=) · auth
  PATCH /privacy/requests/:id              { status, notes } atender/completar/denegar · comerciante
  GET   /privacy/customers/:id/export      derecho de acceso: JSON consolidado · comerciante, audita pii_export
  POST  /privacy/customers/:id/erase       derecho al olvido: anonimización irreversible · comerciante, audita pii_erasure

CREDITS (Fiados)
  GET   /credits                 créditos pendientes
  POST  /credits                 crea crédito
  POST  /credits/:id/payment     registra pago

PURCHASES
  GET   /purchases
  POST  /purchases               crea orden de compra
  PUT   /purchases/:id
  DELETE /purchases/:id          cancela

RECIPES
  GET   /recipes
  POST  /recipes                 con ingredientes (BOM)
  PUT   /recipes/:id
  DELETE /recipes/:id
  GET   /recipes/:id/cost        calcula food cost actual

MERMA
  GET   /merma                   lista registros
  POST  /merma                   { productId, quantity, reason, cost }
  GET   /merma/dashboard         KPIs de merma
  GET   /merma/par/levels        niveles PAR con stock_gap
  POST  /merma/par/levels        upsert nivel PAR
  DELETE /merma/par/levels/:id

GASTROBAR-OPS
  GET   /gastrobar-ops/modo-dueno    snapshot ejecutivo diario
  GET   /gastrobar-ops/food-cost     food cost % por receta
  GET   /gastrobar-ops/purchase-suggestions  sugerencias reorden por PAR
  GET   /gastrobar-ops/weekly-trend  tendencia 14 días

DASHBOARD
  GET   /dashboard/stats         KPIs principales
  GET   /dashboard/sales-chart   datos gráficas ventas
  GET   /dashboard/top-products  más vendidos
  GET   /dashboard/recent        actividad reciente
  GET   /dashboard/inventory     alertas inventario

FINANCES
  GET   /finances                movimientos financieros
  POST  /finances                registra movimiento
  GET   /finances/balance        balance actual
  GET   /finances/report         P&L

DELIVERY
  GET   /delivery/orders         pedidos delivery
  POST  /delivery/assign         asigna conductor
  PATCH /delivery/:id/status     actualiza estado

FLEET
  GET   /fleet/vehicles          lista vehículos
  POST  /fleet/vehicles          agrega vehículo
  GET   /fleet/drivers           lista conductores
  GET   /fleet/tracking          posición actual

STOREFRONT (público, sin auth)
  GET   /storefront/:slug        tienda pública
  GET   /storefront/:slug/products  productos públicos
  POST  /storefront/:slug/order  crea pedido externo

COMBOS
  GET   /combos/public?store=    público: combos activos hoy (día semana Colombia)
  GET   /combos                  comerciante: lista combos + ítems
  POST  /combos                  comerciante: crea combo
  PUT   /combos/:id              comerciante: actualiza combo + ítems
  PATCH /combos/:id              comerciante: activar/desactivar
  DELETE /combos/:id             comerciante: eliminar

SUBSCRIPTIONS
  GET   /subscriptions/plans
  GET   /subscriptions/current
  POST  /subscriptions/checkout  inicia checkout Stripe
  POST  /subscriptions/cancel

STRIPE
  POST  /stripe/webhook          eventos Stripe
  POST  /stripe/payment-intent

WHATSAPP
  POST  /whatsapp/send           envía mensaje
  GET   /whatsapp/messages       historial
  POST  /whatsapp/webhook        mensajes entrantes (Evolution API)

AGENT
  POST  /agent/chat              consulta al agente IA
  GET   /agent/history           historial conversaciones

MEDIA-LIBRARY
  GET   /media-library           lista imágenes
  POST  /media-library/upload    sube a Cloudinary
  DELETE /media-library/:id      elimina imagen

SEDES
  GET   /sedes
  POST  /sedes
  PUT   /sedes/:id
  DELETE /sedes/:id              desactiva
```

---

← [[indexes/modules-index]] | [[DAIMUZ]] | → [[indexes/db-tables-index]]
