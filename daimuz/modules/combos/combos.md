# Combos por día

> Módulo que permite al comerciante crear combos de productos con precio fijo,
> activos solo en días específicos de la semana y visibles automáticamente en el
> storefront público cuando corresponde.

## Tablas DB

| Tabla | Propósito |
|---|---|
| `combos` | Combo: nombre, días activos, tamaños+precios, inclusiones, imagen, activo |
| `combo_items` | Ítems elegibles del combo (product_id) con sort_order |
| `storefront_order_items.combo_data` | JSON con comboId, sizeCount, componentIds, componentNames |

### `combos`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | varchar(36) PK | UUID |
| `tenant_id` | varchar(36) FK | Tenant |
| `name` | varchar(150) | Nombre del combo |
| `active_days` | JSON | `[0..6]` (0=Dom, 6=Sáb) — días en que se ofrece |
| `sizes` | JSON | `[{count, price}]` — ej. `[{count:2, price:45000}, {count:3, price:60000}]` |
| `includes` | text | Inclusiones (bebida, papas…) |
| `image_url` | varchar(500) | Imagen del combo |
| `sort_order` | int | Orden de display |
| `is_active` | tinyint(1) | Soft toggle |

### `combo_items`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | varchar(36) PK | UUID |
| `tenant_id` | varchar(36) FK | Tenant |
| `combo_id` | varchar(36) FK → combos | Combo padre |
| `product_id` | varchar(36) FK → products | Producto elegible |
| `sort_order` | int | Orden |

## Endpoints API

### Público (sin auth)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/combos/public?store=slug` | Combos activos HOY (día de la semana zona Colombia UTC-5), con ítems, tamaños e inclusiones |

### Comerciante (JWT requerido)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/combos` | Lista todos los combos del tenant con sus ítems |
| `POST` | `/api/combos` | Crear combo. Body: `{name, activeDays, sizes, itemIds, includes?, imageUrl?}` |
| `PUT` | `/api/combos/:id` | Actualizar campos + ítems |
| `PATCH` | `/api/combos/:id` | Activar/desactivar. Body: `{isActive}` |
| `DELETE` | `/api/combos/:id` | Eliminar combo y sus ítems |

## Reglas de negocio

1. **Precio autoritativo server-side**: `resolveComboOrderItem()` valida que el combo exista, esté activo, el tamaño sea válido y los ítems pertenezcan al combo. El precio viene de la tabla `combos.sizes`, NUNCA del frontend.

2. **Ítem de combo en pedido**: Se inserta en `storefront_order_items` con `product_id = NULL` (respeta FK). El nombre contiene el detalle: `"Combo X (x2): Producto A + Producto B"`. Los componentes se guardan en `combo_data` (JSON).

3. **Stock de componentes**: Al crear el pedido, se crean `inventory_holds` para cada componente (no para el "combo" en sí). Al entregar (`status → entregado`), se descuenta `products.stock` de cada componente y se crean `stock_movements`. Los holds se liberan al final.

4. **Días**: `bogotaWeekday()` calcula el día en zona Colombia (UTC-5). Solo se muestran combos cuyo `active_days` contenga el día actual.

5. **Soft delete**: `is_active = 0` oculta el combo. `DELETE` físico solo desde el panel del comerciante.

## Archivos clave

| Archivo | Rol |
|---|---|
| `backend/src/modules/combos/combos.routes.ts` | Endpoints CRUD + `resolveComboOrderItem()` + endpoint público |
| `backend/src/modules/orders/orders.routes.ts` | Integración de combo en pedido (líneas 289-308 creación, 1863-1898 deducción stock) |
| `frontend/components/combos-manager.tsx` | Panel comerciante: CRUD visual de combos |
| `frontend/components/combos-today.tsx` | Storefront público: sección "Combos de hoy" + modal armador |
| `frontend/components/pedidos.tsx` | Visualización de combo en detalle de pedido (badge COMBO + lista colapsable) |
| `frontend/components/theme2/theme2-order-flow.tsx` | Integración en Tema 2 |
| `backend/src/db/schema/schema.ts` | Tablas `combos`, `combo_items`, columna `combo_data` en `storefront_order_items` |
| `backend/src/db/migrations/0036_*.sql` | Migración inicial: tablas combos + combo_items |
| `backend/src/db/migrations/0037_*.sql` | Migración: columna `combo_data` en storefront_order_items |

## Migraciones

| # | Archivo | Cambio |
|---|---|---|
| 0036 | `0036_*.sql` | Tablas `combos` + `combo_items` |
| 0037 | `0037_wild_supreme_intelligence.sql` | Columna `combo_data` JSON en `storefront_order_items` |
