# ⏳ Backlog — Pendientes

> Actualiza según prioridades. P1 = crítico, P2 = importante, P3 = mejora.

## 🔴 P1 — Crítico

### 🐛 [2026-06-25] Onboarding rompe: `Data truncated for column 'goal'` (prod) — PENDIENTE

**Síntoma (logs prod `daimuz_backend`):**
```
WARN_DATA_TRUNCATED (errno 1265): Data truncated for column 'goal' at row 1
  at upsertPerfil (rutina.service.js:89) → completeOnboarding (rutina.service.js:361) → rutina.routes.js:121
SQL: INSERT INTO rutina_perfil (... goal ...) VALUES (...) ON DUPLICATE KEY UPDATE ...
```
El usuario NO puede completar el onboarding (POST `/rutina/onboarding` falla).

**Causa raíz (confirmada):** desajuste de esquema. La columna está definida como **ENUM corto** en `backend/migrations/add_lifestyle_rutina_and_gym_modules.sql:40`:
```sql
goal ENUM('bajar_peso','subir_masa','mantener','salud_general') NULL,
```
…pero el wizard de onboarding envía objetivos que **no están en ese ENUM**: `perder_grasa`, `ganar_musculo`, `recomposicion`, `rendimiento`, `volver_entrenar` (ver `GOAL_KCAL_DELTA` y `GOAL_LABEL` en `rutina.service.ts` / `MissionControl.tsx`). En MySQL strict mode, insertar un valor fuera del ENUM → `WARN_DATA_TRUNCATED` → error 1265. **Es el MISMO patrón que el fix de `sex`** (ENUM→VARCHAR) del 2026-06-22.

**Fix propuesto (idempotente, al boot, espejo del fix de `sex` en `index.ts:1222`):**
```ts
// junto al ALTER de sex (index.ts ~1222)
try { await poolOb.query(`ALTER TABLE rutina_perfil MODIFY COLUMN goal VARCHAR(30) NULL`); }
catch (e: any) { console.warn('[migration] goal→varchar:', e?.message); }
```
`VARCHAR(30)` cubre el valor más largo (`volver_entrenar` = 15). Alternativa más estricta: ampliar el ENUM con todos los valores del wizard, pero VARCHAR es más a prueba de futuro (igual que se hizo con `sex`). Tras el ALTER, redeploy. **Verificar** que ningún otro consumidor de `goal` asuma el set viejo del ENUM (no debería: `progress.service` solo lo lee).

**Acción:** aplicar el ALTER idempotente + redeploy. Confirmar onboarding completo con objetivo "Recomposición"/"Ganar músculo"/"Bajar grasa".

### 🐛 [2026-06-25] Comunidad: `Unknown column 'device_id'` en community_reactions — PENDIENTE (análisis)

**Síntoma:** `Error al obtener el feed: Unknown column 'device_id' in 'where clause'` (errno 1054) en `community.routes.js userReactions`:
```sql
SELECT post_id, type FROM community_reactions WHERE device_id = '...' AND type = 'like' AND post_id IN (...)
```
**Causa raíz (probable):** migración faltante/no corrida en esta BD — la tabla `community_reactions` no tiene la columna `device_id` que el query espera (reacciones por dispositivo para usuarios anónimos). Pendiente: localizar la migración que añade `device_id` (o crearla idempotente: `ALTER TABLE community_reactions ADD COLUMN device_id VARCHAR(64) NULL` + índice) y asegurar que corra al boot. Degradar defensivamente el `userReactions` (try/catch → `[]`) para que el feed no rompa si falta la columna. Bug independiente del de onboarding (módulo `community`).

### 🔒 [2026-06-29] Blindaje de precios server-side — Nivel 2 (resto del storefront) — PENDIENTE

**Contexto:** El flujo de creación de órdenes (`/orders/public` y las 3 pasarelas: MercadoPago, ADDI, Sistecrédito) calculaba el subtotal **confiando 100% en el `unitPrice` que manda el frontend** (`items.reduce(... item.unitPrice ...)`). Cualquiera puede interceptar el request y mandar `unitPrice: 1` → cobro manipulable. Viola la regla de la propia visión: *"Tu pricing NO debe depender del frontend… SIEMPRE en backend"*.

**✅ Nivel 1 hecho (esta sesión):** se blindó el **precio por volumen de variantes** (tiers mayoristas). Nuevo `variantsService.resolveOrderPrices(tenantId, items)` recalcula el precio de cada ítem CON variante desde `variant_price_tiers` (agrupa por producto = mix & match, preserva extras de modificadores, impone el piso del tier). Aplicado en los **4 endpoints** que crean órdenes en `orders.routes.ts`. Ítems CON variante ya no son manipulables.

**⏳ Nivel 2 (pendiente) — el resto del pricing sigue confiando en el frontend:**
- [ ] **Productos SIN variante:** su `unitPrice` no se valida contra `products.sale_price` en la BD.
- [ ] **Ofertas (`is_on_offer`/`offer_price`):** el precio de oferta llega del frontend, no se reverifica que la oferta esté activa ni el monto.
- [ ] **Drops:** el `finalPrice`/`globalDiscount` del drop no se recalcula server-side.
- [ ] **Cupones:** el `discount` aplicado llega en el body; reverificar el cupón (vigencia, %, tope) en backend al crear la orden.
- [ ] **Modificadores (adiciones):** el `priceDelta` de cada opción debería resolverse desde la BD, no confiarse del front.

**Enfoque sugerido:** extender el patrón de `resolveOrderPrices` a un resolvedor de pedido completo que, dado `{productId, variantId, qty, offerClaimed, dropId, couponCode, modifiers[]}`, devuelva el precio autoritativo por ítem desde la BD, e ignore por completo el precio del frontend (que pasa a ser solo presentación). Riesgo: medio (toca el checkout de toda la tienda) → hacer con tests por cada capa de descuento.

### 🚚 [2026-06-29] Delivery OS — construido a medias, falta migración + prueba + deploy — PENDIENTE

**Contexto:** Se construyó el "DAIMUZ Delivery Infrastructure™" — Centro de Operaciones de Delivery (`/delivery-os`): validación de cobertura/zonas (point-in-polygon sin PostGIS), chat repartidor↔comercio en tiempo real (Socket.IO), tracking de disponibilidad/GPS de repartidores y mapa de operaciones (Leaflet). Código **en disco y cableado**, pero **NO funcional** hasta generar la migración.

**✅ Hecho (código en disco):**
- Backend: `modules/delivery/coverage.routes.ts` (POST `/coverage/check` público + CRUD `/coverage/zones`), `delivery-chat.routes.ts` (salas/mensajes/leídos/active-rooms), `delivery-chat.socket.ts` (`__deliveryIO`, eventos join/typing/courier-location/join-ops), extensiones a `delivery.routes.ts` (PUT `/availability`, PUT `/location`, GET `/ops-stats`, `/active-couriers`, `/active-orders-map`).
- Rutas montadas en `index.ts` (`/coverage`, `/delivery-chat`, `initDeliveryChatSocket(io)`).
- Frontend: `app/delivery-os/page.tsx` (full-screen ops center, 3 tabs: Operations/Zones/Chat, auth guard, auto-refresh 30s) + `components/delivery-chat.tsx`.
- Las 4 tablas definidas en `db/schema/schema.ts`: `delivery_zones`, `delivery_chat_rooms`, `delivery_chat_messages`, `courier_availability`.

**🔴 BLOQUEADOR — la migración NUNCA se generó:**
Las 4 tablas están en `schema.ts` pero **no existen en ninguna migración** (`0000`–`0002` no las contienen). Como el DDL de runtime está congelado y el deploy corre `node dist/db/migrate.js`, **las tablas no se crearán en prod → todos los endpoints de Delivery OS fallarán con "table doesn't exist"**.
- [ ] `cd backend && npm run db:generate` → genera `0003_*.sql` con las 4 tablas. **Revisar el SQL** antes de aplicar.
- [ ] `npm run migrate` en dev para crearlas localmente.

**⏳ Resto pendiente:**
- [ ] Probar el loop end-to-end en navegador dev: abrir `/delivery-os`, crear una zona, ver el mapa, abrir el chat de un pedido y enviar/recibir mensajes en tiempo real, marcar repartidor online + actualizar GPS → verlo en el mapa de ops.
- [ ] Verificar `tsc --noEmit` front+back de los archivos nuevos.
- [ ] Merge `esteban` → `main` + **Deploy en Komodo** (la migración `0003` corre al boot vía `migrate.js`).

### LEGEND — conectar entitlements a features (próxima sesión)

Módulo Consumer Plans / LEGEND implementado G1–G8 (2026-06-21). **Pendiente:** usar `consumerPlansService.hasEntitlement(userId, key)` para gatear features reales según el grant activo:
- `routine_ai` → asistente IA de rutina/nutrición.
- `discounts` / `smart_combos` → descuentos y combos para usuarios LEGEND.
- `premium_theme` → ya aplicado (tema dorado del panel).
- `coach_priority` / `content_vault` → reservados para el marketplace de entrenadores.

También: tsc front+back en Windows + **Deploy en Komodo** (migración G1 corre al boot). NO se hizo push en la sesión de implementación.

### Variantes + Precios por Volumen + Proveedores

Arquitectura completa en [[brain/variants-and-suppliers]]. Decisiones formales en [[decisions/variant-architecture]].

> **✅ Estado real (2026-06-18, integración completa):** el sistema de variantes está **implementado, integrado y auditado** (full-stack desde 2026-06-09; storefront + selección dinámica + reserva atómica + preventa + asiento + cupo desde 2026-06-18). Cerrado en esta sesión:
> - [x] **Asiento al confirmar** (pedido→venta): para variantes descuenta `product_variants.stock`, libera la reserva y congela `variant_id`/costo/margen en `sale_items` (`variants.service.settleVariantForSale`).
> - [x] **Reserva en flujos de pasarela** (MP/ADDI/Sistecrédito): reservan variante y persisten `variant_id`; liberan en sus webhooks de rechazo + `cancel-gateway`.
> - [x] **Columna `variant_id` en `storefront_order_items`** + columnas congeladas en `sale_items` (migración idempotente en `index.ts`).
> - [x] **Cupo máximo de preventa por variante** (`product_variants.preorder_limit` + `preorder_count`): enforce atómico en la reserva; campo en `variant-manager`.
> - tsc backend + frontend: **0 errores totales**.
>
> **Solo queda (operativo):**
> - [ ] Ejecutar el arranque del backend (corre las migraciones idempotentes) + cargar el producto AnMarg (`backend/imports/anmarg-camiseta-clasica/`).
> - [ ] **Deploy en Komodo**.

**Sprint 1 — Schema DB:**
- [ ] Migración: `CREATE TABLE product_variants` (tenant_id, product_id, sku UNIQUE, barcode, color, size, stock, reserved_stock, cost_price, price_override, supplier_id, is_active)
- [ ] Migración: `CREATE TABLE variant_price_tiers` (tenant_id, variant_id, min_qty, price, tenant_margin_pct, is_active)
- [ ] Migración: `CREATE TABLE inventory_movements` (tenant_id, variant_id, product_id, type, quantity, reason, cost, reference_type, reference_id, created_by)
- [ ] Migración: `ALTER TABLE sale_items ADD COLUMN` frozen columns (variant_id, frozen_product_name, frozen_sku, frozen_cost, frozen_margin_pct, frozen_margin_amount)
- [ ] Migración: `ALTER TABLE order_items ADD COLUMN` frozen columns (mismo esquema)
- [ ] Migración: `ALTER TABLE storefront_order_items ADD COLUMN` frozen columns (mismo esquema)
- [ ] Migración de datos: productos existentes con color/talla → crear variante base automática
- [ ] Migración: crear tier base (min_qty=1) para cada variante con precio actual
- [ ] Feature flag: `variants_enabled` en tenant para rollout controlado
- [ ] Índices: `(product_id, tenant_id)`, `(tenant_id, sku)` UNIQUE, `(variant_id, min_qty)`

**Sprint 2 — Backend (todos con tenant_id, AppError, { success, data }):**
- [ ] `variants.service.ts` — findByProduct, findById, create (valida SKU único), update, softDelete
- [ ] `variants.service.ts` — `adjustStock(variantId, qty, reason, tenantId)`: UPDATE atómico `SET stock = stock - ? WHERE id = ? AND stock >= ?` + verificar affectedRows + INSERT inventory_movement
- [ ] `variants.controller.ts` + `variants.routes.ts` — GET/POST/PUT/DELETE + PATCH /:id/stock
- [ ] `price-tier.service.ts` — `resolvePrice(variantId, qty, tenantId)`: `SELECT ... WHERE min_qty <= ? ORDER BY min_qty DESC LIMIT 1` + fallback a price_override/base_price
- [ ] `price-tier.service.ts` — setTiers (reemplazo atómico), deleteTier
- [ ] Endpoints tiers: GET /:id/price-tiers, POST /:id/price-tiers, DELETE /price-tiers/:id, POST /resolve-price
- [ ] `import.service.ts` — CSV con formato Handle | ProductName | Color | Size | SKU | Stock | CostPrice. Agrupa por Handle, upsert product + bulk insert variants
- [ ] Refactor `products.service.ts` — migrar columnas color/size/stock/cost legacy
- [ ] Refactor `sales.service.ts` — createSale() usa variants si variant_id presente, stock atómico
- [ ] Refactor `storefront.routes.ts` — queries con variants + price tiers
- [ ] Refactor `inventory.service.ts` — soporte inventory_movements
- [ ] Registrar rutas en `modules/index.ts`

**Sprint 3 — Frontend POS + Storefront:**
- [ ] `variant-selector.tsx` — chips color/talla después de elegir producto en POS
- [ ] POS: actualizar precio automático al cambiar cantidad (resolvePrice)
- [ ] Storefront: mostrar variantes con `stock - reserved_stock > 0`
- [ ] Storefront: chips de color seleccionables con disponibilidad visual
- [ ] Storefront: badge automático "Mejor precio desde N uds."
- [ ] Storefront: recalcular precio en tiempo real al cambiar cantidad
- [ ] `price-tier-manager.tsx` — admin puede crear/editar/eliminar tiers por variante
- [ ] `lib/types.ts` — Variant, PriceTier interfaces
- [ ] `lib/api.ts` — métodos para variants + tiers
- [ ] `lib/store.ts` — variant state en Zustand

**Sprint 4 — Panel Proveedor + Admin:**
- [ ] Vista proveedor: productos activos, stock por variante, ventas generadas
- [ ] Admin: configurar margen (tenant_margin_pct) por tier
- [ ] Panel de importación CSV en frontend
- [ ] Reportes: utilidad real por producto (price - cost_price)
- [ ] Dashboard: KPIs por variante (más vendido por color/talla)

**Migración legacy:**
- [ ] Productos existentes con color/talla → crear variantes automáticamente
- [ ] Migrar `stock_movements` legacy a `inventory_movements` donde corresponda
- [ ] Remover columnas obsoletas de products (después de validar que nada las usa)

### Infraestructura
- [ ] Configurar Evolution API en Dokploy y conectar con backend
  - Crear servicio Compose en Dokploy → repo devalexcode/shell-evolution-api
  - Completar `.env` backend: EVOLUTION_API_URL, EVOLUTION_API_KEY, API_BASE_URL

## 🟡 P2 — Importante

### Agente IA
- [ ] **Fase 3 — Voz IA (Vapi)**
  - Crear `backend/src/modules/voice/vapi.routes.ts`
  - Crear `backend/src/modules/voice/vapi.service.ts`
  - Migración SQL: voice_enabled, vapi_phone_id, vapi_assistant_id en chatbot_config
  - Agregar VAPI_API_KEY al .env
  - Registrar ruta en index.ts

- [ ] **Fase 4 — Panel Admin del Agente**
  - `frontend/app/agente/page.tsx` con tabs
  - `AgentConfig.tsx` — configuración web / WhatsApp / voz
  - `AgentConversations.tsx` — sesiones + botón "Tomar control"
  - `AgentActions.tsx` — historial de tool calls
  - `AgentAnalytics.tsx` — KPIs 30 días

### Otros módulos
- [ ] **Módulo Ferretería** — plan completo de 9 fases acordado → ver [[modules/ferreteria/ferreteria]]
  - Fase 1: DB (fleet_vehicles, fleet_maintenance, extensiones storefront_orders y sales)
  - Fase 2: Backend módulo `fleet` con asignación por peso
  - Fases 3–9: frontend (panel despachador, driver, inventario, storefront, POS, gestión flota)
- [ ] Completar flujos del módulo inmobiliaria
- [ ] Mejorar UX del módulo tapicería/workorders

## 🟢 P3 — Mejoras

- [ ] **Fase 5 — n8n automatizaciones**
  - Confirmaciones automáticas de reserva por WhatsApp
  - Cobros automáticos a créditos vencidos
  - Seguimiento de leads no convertidos
- [ ] Exportación avanzada de reportes (Excel nativo)
- [ ] Notificaciones push para pedidos nuevos
- [ ] Dashboard de superadmin con métricas globales SaaS
- [ ] Sistema de onboarding interactivo por tipo de negocio

## 💡 Ideas / Futuro

- [ ] **Fase 6 — Gemini Live + Qdrant** (voz en tiempo real por WebSocket)
- [ ] Integración con contabilidad (Siigo, Alegra)
- [x] ~~Módulo de nómina básica~~ → **YA EXISTE**: módulo `vendedores` con comisiones, metas y `payroll_records`
- [ ] App cliente nativa (iOS/Android)
- [ ] Integración con plataformas de delivery (Rappi, iFood)
- [ ] Plataforma SaaS de agentes IA para vender como servicio mensual

---

← [[context/current-sprint]] | [[DAIMUZ]] | → [[context/environment]]
