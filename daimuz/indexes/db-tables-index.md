# 🗄️ DB Tables Index — Lopbuk

> MySQL · Multi-tenant · Todo tiene `tenant_id` · Soft delete: `is_active = 0`  
> PK: `id` VARCHAR(36) UUID · Timestamps: `created_at`, `updated_at`

## Tablas de Negocio

| Tabla | Módulo | Descripción |
|---|---|---|
| `users` | auth | Usuarios con rol y tenant |
| `tenants` | tenants | Negocios registrados en la plataforma |
| `tenant_modules` | tenants | Módulos activados por tenant |
| `sedes` | sedes | Sucursales del tenant |
| `products` | inventory | Productos base (name, base_price, SKU — stock vive en variantes) |
| `product_variants` | variants | Variantes color/talla: stock, SKU, cost_price, supplier_id |
| `variant_price_tiers` | variants | Precios escalonados por min_qty (price, margin_pct) |
| `categories` | products | Categorías de productos |
| `stock_movements` | inventory | Kardex completo (ahora con variant_id nullable) |
| `sales` | sales | Cabecera de ventas |
| `sale_items` | sales | Ítems de cada venta (precios congelados) |
| `cash_sessions` | cash-sessions | Sesiones de caja (apertura/cierre) |
| `cash_movements` | cash-sessions | Movimientos durante la sesión |
| `orders` | orders | Pedidos (mesa + delivery) |
| `order_items` | orders | Ítems de cada pedido |
| `customers` | customers | CRM de clientes (`is_active`, `deleted_at`, `anonymized_at`) |
| `consent_records` | privacy | 🔐 Consentimientos Ley 1581 (inmutable, solo INSERT) |
| `product_templates` | product-templates | 🧩 Plantillas JSON de página de producto (draft/published/archived) |
| `dispatch_routes` | fleet | 🚛 Rutas agrupadas de despacho (vehículo+conductor+paradas) |
| `fleet_vehicle_expenses` | fleet | 🚛 Gastos reales por vehículo (combustible/peajes/repuestos) |
| `data_subject_requests` | privacy | 🔐 Solicitudes habeas data (SLA 10 días hábiles) |
| `credits` | credits | Fiados/créditos |
| `credit_payments` | credits | Pagos de créditos |
| `purchases` | purchases | Órdenes de compra |
| `purchase_items` | purchases | Ítems de compra |
| `recipes` | recipes | Recetas con nombre y precio |
| `recipe_ingredients` | recipes | Ingredientes de cada receta (BOM) |
| `waste_records` | merma | Registros de merma |
| `par_levels` | merma | Niveles PAR por producto |
| `tables` | restbar | Mesas del local |
| `restbar_orders` | restbar | Comandas en mesa |
| `restbar_order_items` | restbar | Ítems de cada comanda |
| `reservations` | restbar | Reservas de mesas |
| `rb_gastos` | restbar-finanzas | Gastos variables del gastrobar (auto-timestamp) |
| `rb_ingresos_diarios` | restbar-finanzas | Ingresos diarios (upsert por tenant+fecha) |
| `rb_gastos_fijos` | restbar-finanzas | Gastos fijos recurrentes (quincenal/semanal/mensual) |
| `deliveries` | delivery | Asignaciones de delivery |
| `fleet_vehicles` | delivery | Vehículos de la flota |
| `drivers` | delivery | Conductores |
| `storefront_orders` | storefront | Pedidos desde tienda online (+ `assigned_to` VARCHAR 36 para operador asignado) |
| `storefront_order_items` | storefront | Ítems de pedidos online |
| `order_status_history` | storefront | Auditoría de transiciones de estado de pedidos (from→to, nota, operador) |
| `suppliers` | suppliers | Proveedores del tenant |
| `supplier_products` | suppliers | Relación N:N productos-proveedores (cost_price, lead_time) |
| `inventory_movements` | variants | Kardex universal (fuente de verdad del stock) |
| `finances` | finances | Movimientos del flujo de caja |
| `subscriptions` | subscriptions | Suscripciones SaaS de tenants |
| `subscription_plans` | subscriptions | Planes disponibles |
| `chatbot_config` | agent | Configuración del agente IA por tenant |
| `chatbot_conversations` | agent | Sesiones de conversación |
| `chatbot_messages` | agent | Mensajes del historial del agente |
| `media_library` | media | Imágenes en Cloudinary |


## Schema: Modelo de Variantes

```sql
-- products (refinado — durante migración, columnas legacy coexisten)
products (
  id, tenant_id,
  name, articulo, description,
  base_price,         -- precio base (fallback si variante no tiene price_override)
  -- columnas legacy (mantener hasta Sprint-4 para backward compat):
  sku, barcode,       -- → se migran a product_variants
  price,              -- → se reemplaza por base_price
  cost,               -- → se migra a product_variants.cost_price
  stock,              -- → se migra a product_variants.stock
  stock_minimo,       -- → se migra a product_variants.stock_minimo
  category_id,
  product_type, brand, model,
  image_url, image_urls JSON,
  published_in_store, available_for_delivery,
  is_preorder, preorder_window_end, preorder_ship_start,
  is_on_offer, offer_price, offer_label, offer_start, offer_end,
  weight_kg, sede_id,
  is_active, created_at, updated_at
)
```

## Tablas Nuevas: Variantes

```sql
product_variants (
  id               VARCHAR(36) PK,
  tenant_id        VARCHAR(36) NOT NULL,
  product_id       VARCHAR(36) NOT NULL,    -- FK → products.id
  sku              VARCHAR(100) NOT NULL,
  barcode          VARCHAR(100) NULL,
  color            VARCHAR(100) NULL,       -- primer atributo (ej: "Negro", "Marfil")
  size             VARCHAR(100) NULL,       -- segundo atributo (ej: "S", "M", "L")
  material         VARCHAR(100) NULL,       -- tercer atributo opcional
  stock            DECIMAL(12,3) NOT NULL DEFAULT 0,   -- NUNCA < 0 (fuente de verdad)
  reserved_stock   DECIMAL(12,3) NOT NULL DEFAULT 0,   -- reservado por checkout en progreso
  min_stock        DECIMAL(12,3) NOT NULL DEFAULT 0,   -- umbral alerta reorden
  cost_price       DECIMAL(12,2) NULL,       -- precio del proveedor
  price_override   DECIMAL(12,2) NULL,       -- si difiere del producto base
  supplier_id      VARCHAR(36) NULL,         -- FK → suppliers
  images           JSON NULL,               -- fotos específicas de la variante
  sort_order       INT DEFAULT 0,
  is_active        TINYINT(1) DEFAULT 1,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sku_tenant (sku, tenant_id),
  KEY idx_product (product_id, tenant_id),
  KEY idx_supplier (supplier_id)
);

variant_price_tiers (
  id                  VARCHAR(36) PK,
  tenant_id           VARCHAR(36) NOT NULL,   -- redundante deliberado: filtrado sin JOIN
  variant_id          VARCHAR(36) NOT NULL,   -- FK → product_variants.id
  min_qty             INT UNSIGNED NOT NULL,   -- SOLO min_qty, sin max_qty — evita gaps
  price               DECIMAL(12,2) NOT NULL,  -- precio público en este escalón
  tenant_margin_pct   DECIMAL(5,2) DEFAULT 0,  -- comisión de la plataforma
  is_active           TINYINT(1) DEFAULT 1,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_variant_qty (variant_id, min_qty),
  KEY idx_variant (variant_id, tenant_id, min_qty)
);

suppliers (
  id             VARCHAR(36) PK,
  tenant_id      VARCHAR(36) NOT NULL,
  name           VARCHAR(255) NOT NULL,
  contact_info   JSON NULL,
  payment_terms  VARCHAR(100) NULL,
  is_active      TINYINT(1) DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

supplier_products (
  id              VARCHAR(36) PK,
  tenant_id       VARCHAR(36) NOT NULL,
  supplier_id     VARCHAR(36) NOT NULL,
  product_id      VARCHAR(36) NOT NULL,
  supplier_sku    VARCHAR(100) NULL,
  supplier_price  DECIMAL(12,2) NULL,
  lead_time_days  INT UNSIGNED NULL,
  is_preferred    TINYINT(1) DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_supplier_product (supplier_id, product_id)
);
```

## Columnas Congeladas en Tablas de Ventas/Pedidos

> ⚠️ Cada venta CONGELA los datos de la variante en el momento exacto de la compra.
> NUNCA leer `variant_price_tiers` para reportes históricos — los datos congelados
> son la fuente de verdad financiera.

```sql
-- sale_items: congela datos de la variante al momento de la venta
ALTER TABLE sale_items ADD COLUMN (
  variant_id         VARCHAR(36) NULL,
  frozen_product_name VARCHAR(255) NULL,       -- nombre del producto al vender
  frozen_variant_label VARCHAR(100) NULL,      -- "Negro / M"
  frozen_sku         VARCHAR(100) NULL,         -- SKU de la variante al vender
  frozen_cost        DECIMAL(12,2) NULL,        -- cost_price congelado
  frozen_margin_pct  DECIMAL(5,2) NULL,         -- tenant_margin_pct congelado
  frozen_margin_amount DECIMAL(12,2) NULL       -- margen absoluto congelado
);

-- order_items: mismo patrón
ALTER TABLE order_items ADD COLUMN (
  variant_id         VARCHAR(36) NULL,
  frozen_product_name VARCHAR(255) NULL,
  frozen_variant_label VARCHAR(100) NULL,
  frozen_sku         VARCHAR(100) NULL,
  frozen_cost        DECIMAL(12,2) NULL,
  frozen_margin_pct  DECIMAL(5,2) NULL,
  frozen_margin_amount DECIMAL(12,2) NULL
);

-- storefront_order_items: mismo patrón
ALTER TABLE storefront_order_items ADD COLUMN (
  variant_id         VARCHAR(36) NULL,
  frozen_product_name VARCHAR(255) NULL,
  frozen_variant_label VARCHAR(100) NULL,
  frozen_sku         VARCHAR(100) NULL,
  frozen_cost        DECIMAL(12,2) NULL,
  frozen_margin_pct  DECIMAL(5,2) NULL,
  frozen_margin_amount DECIMAL(12,2) NULL
);

-- stock_movements legacy: referencia opcional a variante
ALTER TABLE stock_movements ADD COLUMN variant_id VARCHAR(36) NULL;
```

## Columnas Superadmin en `storefront_orders`

```sql
-- Columna agregada por auto-migración en superadmin-orders.routes.ts (Sprint 2)
ALTER TABLE storefront_orders
  ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(36) NULL;
-- FK lógica → users.id (superadmin/operador asignado a ese pedido)
```

## Tabla `order_status_history` (Sprint 2, auto-migración)

```sql
CREATE TABLE IF NOT EXISTS order_status_history (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  order_id     VARCHAR(36)  NOT NULL,     -- FK → storefront_orders.id
  from_status  VARCHAR(50)  NULL,         -- NULL si es el primer estado
  to_status    VARCHAR(50)  NOT NULL,
  changed_by   VARCHAR(36)  NOT NULL,     -- FK → users.id (quién hizo el cambio)
  note         TEXT         NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order (order_id),
  KEY idx_changed_by (changed_by)
)
-- ⚠️ Sin tenant_id: la tabla es de auditoría y hereda el scope del pedido padre
```

## Columnas Universales

```sql
-- En TODAS las tablas de negocio
tenant_id   VARCHAR(36)  NOT NULL  -- dueño del dato, NUNCA confiar en body
id          VARCHAR(36)  NOT NULL  -- UUID v4
created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
updated_at  TIMESTAMP    ON UPDATE CURRENT_TIMESTAMP
is_active   TINYINT(1)   DEFAULT 1 -- soft delete

-- En tablas con usuario creador
created_by  VARCHAR(36)  -- FK → users.id
```

## Columnas Adicionales en `categories` (desde v3.8)

```sql
categories (
  ...
  is_active   TINYINT(1)  DEFAULT 1      -- ocultar/mostrar en POS (PATCH /:id/visibility)
  color       VARCHAR(7)  NULL           -- hex UI: '#6366f1'
  sort_order  INT         DEFAULT 0      -- orden ascendente en listas
)
```

## Columnas Críticas de stock_movements (legacy)

```sql
stock_movements (
  id, tenant_id,
  product_id,       -- FK → products.id
  variant_id,       -- FK → product_variants.id (NULL si es movimiento legacy)
  sede_id,
  type,             -- entrada | salida | ajuste | merma | transferencia
  quantity,
  reason,           -- texto obligatorio (auditoría)
  cost,
  created_by,
  created_at
)
```

---

← [[indexes/endpoints-index]] | [[DAIMUZ]] | → [[indexes/files-index]]
