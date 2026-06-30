# ⏳ Backlog — Pendientes

> Actualiza según prioridades. P1 = crítico, P2 = importante, P3 = mejora.

### 🧩 [2026-06-30] Productos Digitales (ex "Cartilla Inga") — Fase A hecha; faltan B + C
Renombrado el catálogo público **"Cartilla Inga" → "Productos Digitales"** (`CatalogoCartillas.tsx`, solo display; la ruta sigue `/cartilla-inga`).

**✅ Fase A — Encapsular archivos (PDF/Excel/ZIP/TXT/MD…):**
- Tabla `cartilla_archivos` (migración `0006_graceful_scrambler`). 
- Backend: `cartillas.service` (`listarArchivos`/`crearArchivo`/`eliminarArchivo`) + rutas staff (`GET/POST /admin/cartillas/:id/archivos`, `DELETE /admin/archivos/:id`). En `obtenerCartillaPublica` los archivos vienen con metadata siempre y `url` **solo si hay acceso** (gratis o comprado); si no, `locked:true`.
- Admin (`cartilla-management.tsx`): botón 📎 por cartilla → `ArchivosManager` (sube a Cloudinary `auto/upload` → soporta raw, lista, elimina).
- Comprador (`CartillaPage.tsx`): `ArchivosPanel` en el muro de pago (teaser bloqueado "Incluye N archivos") + `FloatingDescargables` (widget flotante de descargas sobre la experiencia cuando hay acceso).
- tsc 0 errores (front+back).
- **Caveat:** el upload preset de Cloudinary debe permitir `raw`/`auto` (algunos son image-only). Si falla subir un PDF, hay que habilitar raw en el preset.

**✅ Fase B — Compra por Wompi (reemplaza Stripe):**
- `payments.service`: nuevo `context:'cartilla'` + caso en `createCheckout` (monto y tenant resueltos **server-side** desde `cartilla_compras`, contextId = compra.id) + caso en `onApproved` → `confirmarCompra(compraId)`.
- `cartillas.service`: `comprarCartilla` con método ≠ 'manual' crea un **Web Checkout de Wompi** (`crearWompiCheckout`) en vez de Stripe; guarda la `referencia`. (`crearStripeCheckout` quedó sin uso.)
- Frontend muro de pago: botón "**Comprar y pagar con Wompi**" → `comprar(slug,'wompi')` → redirige al `checkoutUrl`.

**✅ Fase C — Acceso tras compra (cerrada):** el loop completo: comprar → `cartilla_compras` 'pendiente' + checkout Wompi → pago → webhook `onApproved('cartilla')` → `confirmarCompra` marca 'pagado' → `tieneAcceso=true` → desbloquea contenido de módulos (ya gateado, `service:171`) **y** archivos descargables (Fase A). No requiere migración nueva (`cartilla_compras` ya existía).

**🟢 PRODUCTOS DIGITALES COMPLETO (rename + A + B + C). Solo queda deploy + probar el pago real en Wompi.**
> Refinamiento opcional: timing redirect-vs-webhook — si el comprador vuelve antes de que llegue el webhook, ve el muro hasta refrescar. Mejora: poll del estado de la transacción al volver de Wompi.

### ✅ [2026-06-29] Comisión de plataforma (8%/12%) — COMPLETA (falta aplicar migraciones + deploy)
Modelo **comisión** (no cambia el precio al cliente; registra la tajada de la plataforma).
- **Config:** `tenants.platform_margin_pct` (NULL=inactiva, 8/12=activa). Setter en `tenant.update()`; UI superadmin → editar comercio → "Comisión de plataforma" (Inactiva/8%/12%).
- **Aplicación (ambos canales):** columna dedicada `sale_items.platform_margin_pct`, congelada por ítem en POS (`sales.service`) **y** en pedidos del storefront (`orders.routes` settlement). No pisa `margin_pct` (que mantiene su significado por-canal). Para reportes de comisión de plataforma → usar `sale_items.platform_margin_pct`.
- **Migraciones a aplicar:** `0004_green_elektra` (`tenants.platform_margin_pct`) + `0005_familiar_silver_fox` (`sale_items.platform_margin_pct`). Las aplica el deploy (`migrate.js`) o a mano:
  ```sql
  ALTER TABLE `tenants` ADD `platform_margin_pct` decimal(5,2);
  ALTER TABLE `sale_items` ADD `platform_margin_pct` decimal(5,2);
  ```
- tsc 0 errores (front+back).

### ✅ [2026-06-29] Fix: preventa no aparecía hasta recargar
El detalle abierto desde una sección (destacados/novedades/ofertas) usaba el producto con flags incompletos (`isPresale=0`), mostrando "Agotado" hasta recargar (la recarga abre por deep-link `?product=` desde la lista principal, ya correcta). `openProductModal` ahora resuelve SIEMPRE la versión canónica de `products` por id. Causa de fondo (secundaria): varias queries de sección hardcodean `0 as isPresale` — el fix de frontend lo cubre; limpiar esas queries queda como mejora opcional.

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

### 🔒 [2026-06-29] Blindaje de precios server-side — Nivel 1 + 2 COMPLETOS (deploy pendiente)

**Contexto:** El flujo de creación de órdenes (`/orders/public` y las 3 pasarelas: MercadoPago, ADDI, Sistecrédito) calculaba el subtotal **confiando 100% en el `unitPrice` que manda el frontend** (`items.reduce(... item.unitPrice ...)`). Cualquiera puede interceptar el request y mandar `unitPrice: 1` → cobro manipulable. Viola la regla de la propia visión: *"Tu pricing NO debe depender del frontend… SIEMPRE en backend"*.

**✅ Nivel 1 hecho:** se blindó el **precio por volumen de variantes** (tiers mayoristas). `variantsService.resolveOrderPrices` recalcula el precio de cada ítem CON variante desde `variant_price_tiers` (mix & match, preserva extras, impone piso del tier).

**✅ Nivel 2 hecho (2026-06-29) — 4 de 5 capas:** nuevo módulo puro testeable `orders/order-pricing.ts` (19 tests con `node:test`, todos verdes) + capa de DB `orders/order-pricing.service.ts`:
- [x] **Productos SIN variante:** `unitPrice` se reimpone desde `products.sale_price` (piso autoritativo, preserva extras del front).
- [x] **Ofertas:** usa `offer_price` solo si `is_on_offer=1` y la ventana `offer_start/end` está vigente; si no, ignora el precio de oferta del front.
- [x] **Drops:** `sale_price × (1 − COALESCE(custom_discount, global_discount)/100)` solo si el producto está en un `store_drops` activo (ventana vigente). Drop > oferta > base.
- [x] **Cupones:** el `discount` del body **se ignora**; se recalcula server-side desde `discount_coupons` (vigencia, max_uses, min_purchase, %/fijo, tope al subtotal) contra el subtotal autoritativo.
- Integrado en los **4 endpoints** de creación de orden (`/public` + MP + ADDI + Sistecrédito) vía `orderPricingService.resolveItemPrices` + `resolveCouponDiscount`. tsc 0 errores en archivos nuevos/tocados.

**✅ Nivel 2 — 5ª capa hecha (2026-06-29): modificadores.**
- [x] **Frontend:** `ProductoCarrito.modifierOptionIds` (IDs de las opciones elegidas, derivados de `t1Sel`). `landing-page.tsx` los guarda en el ítem del carrito y los envía en los **5 payloads** de pedido (`/public` tenantItems + MP + ADDI + Sistecrédito + Wompi).
- [x] **Backend:** `order-pricing.ts` → `sumModifierDeltas(selectedIds, productId, resolved)` (puro, valida que cada opción pertenezca al producto del ítem — ignora opciones ajenas/inventadas). `order-pricing.service.fetchModifierOptions` lee `product_modifier_options ⋈ product_modifier_groups` (priceDelta + product_id, activas, del tenant).
- [x] **Ruta dual (sin regresión):** ítems CON `modifierOptionIds` → `baseAutoritativo + Σ deltas reales` (ignora el precio del front por completo; `variantsService.resolveOrderPrices(..., includeFrontendExtra=false)` da el tier puro). Ítems SIN IDs (clientes viejos / Theme2 aún sin actualizar) → fallback al comportamiento previo (`max(base, front)`), preservando el extra del front sin regresión.
- [x] Validadores `body('items.*.modifierOptionIds').optional().isArray()` en los 4 endpoints. tsc 0 errores en archivos nuevos/tocados; **23 tests verdes** (`node:test`).

- [x] **Tema 2 (2026-06-29):** `theme2-order-flow.tsx` también envía `modifierOptionIds` (se agregó `optionId` a `SelMod` y se deriva en el payload de `/orders/public`). Ambos temas (1 y 2) quedan blindados al 100%.

**🟢 Nivel 2 COMPLETO (5/5 capas en Tema 1 y Tema 2): productos sin variante · ofertas · drops · cupones · modificadores.** Todo el pricing del checkout se recalcula server-side. Solo queda el deploy.

### 🚚 [2026-06-29] Delivery OS — construido a medias, falta migración + prueba + deploy — PENDIENTE

**Contexto:** Se construyó el "DAIMUZ Delivery Infrastructure™" — Centro de Operaciones de Delivery (`/delivery-os`): validación de cobertura/zonas (point-in-polygon sin PostGIS), chat repartidor↔comercio en tiempo real (Socket.IO), tracking de disponibilidad/GPS de repartidores y mapa de operaciones (Leaflet). Código **en disco y cableado**, pero **NO funcional** hasta generar la migración.

**✅ Hecho (código en disco):**
- Backend: `modules/delivery/coverage.routes.ts` (POST `/coverage/check` público + CRUD `/coverage/zones`), `delivery-chat.routes.ts` (salas/mensajes/leídos/active-rooms), `delivery-chat.socket.ts` (`__deliveryIO`, eventos join/typing/courier-location/join-ops), extensiones a `delivery.routes.ts` (PUT `/availability`, PUT `/location`, GET `/ops-stats`, `/active-couriers`, `/active-orders-map`).
- Rutas montadas en `index.ts` (`/coverage`, `/delivery-chat`, `initDeliveryChatSocket(io)`).
- Frontend: `app/delivery-os/page.tsx` (full-screen ops center, 3 tabs: Operations/Zones/Chat, auth guard, auto-refresh 30s) + `components/delivery-chat.tsx`.
- Las 4 tablas definidas en `db/schema/schema.ts`: `delivery_zones`, `delivery_chat_rooms`, `delivery_chat_messages`, `courier_availability`.

**✅ Migración generada (2026-06-29):** `0003_cheerful_ozymandias.sql` crea las 4 tablas (delivery_zones + FK a tenants, delivery_chat_rooms, delivery_chat_messages, courier_availability) + sus índices. Revisada: solo CREATE TABLE, sin ALTERs a tablas existentes. El `Dockerfile:22` copia `src/db/migrations` → `dist/db/migrations`, así que el deploy (`migrate.js`) la aplica sola en la BD de prod existente (no recrea nada previo). Hash sha256 del 0003: `a4b95cce470b5fff4eeb7a6a332ea4bc3130ac896a5263ce20b601964d5e7fe8`.

**⏳ Resto pendiente:**
- [x] ~~Generar migración `0003`~~ (hecho).
- [x] ~~`tsc --noEmit` front+back de los archivos nuevos~~ (0 errores en back y front).
- [ ] Aplicar `0003`: lo ideal es **dejar que el deploy lo aplique** (push + Komodo → `migrate.js` corre 0003). Si se corre a mano en prod, marcar también el hash en `__drizzle_migrations` o el migrador del deploy fallará al re-crear las tablas.
- [ ] Probar el loop end-to-end en navegador dev: abrir `/delivery-os`, crear una zona, ver el mapa, abrir el chat de un pedido y enviar/recibir mensajes en tiempo real, marcar repartidor online + actualizar GPS → verlo en el mapa de ops.
- [ ] Merge `esteban` → `main` + **Deploy en Komodo**.

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

### 🖼️ [2026-06-29] Optimización de carga de imágenes — Fase 1 hecha, faltan 2-4

**Problema:** las imágenes cargaban lento. Causa: ~183 `<img>` planos servían la **imagen ORIGINAL full-size** de Cloudinary (sin resize/WebP/compresión) y casi sin `loading="lazy"`. `next/image` casi no se usa (1 import).

**✅ Fase 1 (hecha):** helper `frontend/utils/img.ts` → `cldImg(url, w, h?)` inserta transform de Cloudinary (`w_…,q_auto,f_auto,dpr_auto`) en la entrega (sin re-subir; cachea en CDN de Cloudinary). No-Cloudinary/data/relativas pasan sin tocar. Cableado en las imágenes de alto volumen: tarjetas/grid de producto (Tema 1: 24 imágenes + `loading="lazy"`/`decoding="async"` en ~20 tarjetas; hero del detalle → `w_800`; thumbnails de galería → `w_200`), Tema 2 storefront + order-flow (tarjeta de producto `w_400`, thumb de modificador `w_64`). tsc 0 errores. Recorte esperado ~70-90% de bytes por imagen.

**✅ Fase 2 (hecha, 2026-06-29) — LCP:** banner hero de la tienda (`landing-page.tsx`, hero1/platformHero) → `cldImg(…, 1600)` + `loading="eager"` + `fetchPriority="high"`. Hero del detalle de producto (×2) → `fetchPriority="high"`. Carrusel del marketplace (`home-theme2.tsx`) → `cldImg(…, 1600)` + `fetchPriority` en el primer slide (el sizer invisible móvil también pasa por `cldImg` para no bajar el original). De paso, tarjetas de tienda del marketplace (cover `w_500` + logo `w_160`) con `cldImg` + lazy. tsc 0 errores.

**✅ Fase 3 (hecha, 2026-06-29) — responsive `srcSet`/`sizes`:** `cldSrcSet()` ([200,400,800]) + `sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"` en las tarjetas de producto de los 3 componentes de tienda (landing-page ×22, theme2-storefront, theme2-order-flow). Tarjetas de tienda del marketplace con `[300,500,800]` + `sizes` propio. Ahora el navegador en móvil baja el ancho de ~200px en vez de 400px. tsc 0 errores.

**✅ Fase 4 (hecha, 2026-06-29) — cobertura total del frontend:** `cldImg` aplicado a TODOS los `<img>` restantes de los 4 componentes de tienda (`landing-page`, `theme2-storefront`, `theme2-order-flow`, `home-theme2`): logos de nav/tienda (`w_200/160`), modificadores (`w_64`), ítems del carrito (`w_120`), imágenes de reseña (`w_200`), banners de drop (`w_1200`), covers de Tema 2 (`w_1200` + eager/`fetchPriority` en el hero). Verificado: **0 `<img>` de tienda sin `cldImg`** (62 usos). Solo quedan fuera los assets estáticos de marca (`BRAND.isotipo`, ya optimizados por el bundler). tsc 0 errores.

> **Decisión:** NO se bakea el transform en `imageUrl` desde el backend (la idea original de "red de seguridad"). Hacerlo capparía la resolución del hero/detalle (que necesita `w_800/1200`) a un thumbnail fijo. Como el frontend ya cubre el 100% de las vistas de tienda con sizing por contexto, la red de seguridad backend es innecesaria y contraproducente.

**🟢 OPTIMIZACIÓN DE IMÁGENES COMPLETA (Fases 1-4).** Recorte esperado ~70-90% de bytes por imagen (resize + WebP/AVIF + `q_auto`), lazy-load del contenido fuera de pantalla, LCP priorizado, y `srcSet` responsive para móvil. Solo queda el deploy.


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
