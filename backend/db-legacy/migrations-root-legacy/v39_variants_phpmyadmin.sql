-- ============================================================
-- MIGRACIÓN v3.9 — Variantes + Precios + Proveedores
-- Alineada con inventarioEsteban_v3_multitenant.sql (producción)
-- ============================================================
-- INSTRUCCIÓN PHPMYADMIN:
--   1. Selecciona la BD daimuz_lopbuk
--   2. Cambia el campo "Delimitador" de ";" a "//"
--   3. Pega este script y ejecuta
--   4. Vuelve el Delimitador a ";"
-- ============================================================

-- ── Tablas nuevas ────────────────────────────────────────────
-- suppliers YA EXISTE en producción → CREATE TABLE IF NOT EXISTS la saltará

CREATE TABLE IF NOT EXISTS supplier_products (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  tenant_id      VARCHAR(36)   NOT NULL,
  supplier_id    VARCHAR(36)   NOT NULL,
  product_id     VARCHAR(36)   NOT NULL,
  supplier_sku   VARCHAR(100),
  supplier_price DECIMAL(12,2) DEFAULT 0,
  lead_time_days INT           DEFAULT 0,
  is_preferred   TINYINT(1)    NOT NULL DEFAULT 0,
  is_active      TINYINT(1)    NOT NULL DEFAULT 1,
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX uk_supplier_product (supplier_id, product_id),
  INDEX idx_sp_tenant (tenant_id),
  INDEX idx_sp_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci //

CREATE TABLE IF NOT EXISTS product_variants (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  tenant_id      VARCHAR(36)   NOT NULL,
  product_id     VARCHAR(36)   NOT NULL,
  supplier_id    VARCHAR(36),
  sku            VARCHAR(100)  NOT NULL,
  barcode        VARCHAR(100),
  color          VARCHAR(100),
  size           VARCHAR(100),
  material       VARCHAR(100),
  stock          INT           NOT NULL DEFAULT 0,
  reserved_stock INT           NOT NULL DEFAULT 0,
  min_stock      INT           NOT NULL DEFAULT 0,
  cost_price     DECIMAL(12,2) DEFAULT 0,
  price_override DECIMAL(12,2),
  images         JSON,
  sort_order     INT           NOT NULL DEFAULT 0,
  is_active      TINYINT(1)    NOT NULL DEFAULT 1,
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uk_pv_sku_tenant (sku, tenant_id),
  INDEX idx_pv_tenant_product (tenant_id, product_id),
  INDEX idx_pv_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci //

CREATE TABLE IF NOT EXISTS variant_price_tiers (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  tenant_id         VARCHAR(36)   NOT NULL,
  variant_id        VARCHAR(36)   NOT NULL,
  min_qty           INT           NOT NULL DEFAULT 1,
  price             DECIMAL(12,2) NOT NULL,
  tenant_margin_pct DECIMAL(5,2)  NOT NULL DEFAULT 0,
  is_active         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  UNIQUE KEY uk_variant_qty (variant_id, min_qty),
  INDEX idx_vpt_variant_minqty (variant_id, tenant_id, min_qty),
  INDEX idx_vpt_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci //

CREATE TABLE IF NOT EXISTS inventory_movements (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  tenant_id      VARCHAR(36)   NOT NULL,
  variant_id     VARCHAR(36),
  product_id     VARCHAR(36)   NOT NULL,
  type           ENUM('entrada','salida','ajuste','merma','transferencia','reserva','liberacion') NOT NULL,
  quantity       INT           NOT NULL,
  reason         TEXT          NOT NULL,
  reference_type VARCHAR(50),
  reference_id   VARCHAR(36),
  created_by     VARCHAR(36),
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_im_variant (variant_id),
  INDEX idx_im_product (product_id),
  INDEX idx_im_tenant (tenant_id),
  INDEX idx_im_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci //

-- ── Un solo procedure que hace todos los ALTER TABLE ─────────

DROP PROCEDURE IF EXISTS run_v39_alters //

CREATE PROCEDURE run_v39_alters()
BEGIN
  -- suppliers.contact_info
  -- (en prod existe contact_name; el backend usa contact_info → agregar columna)
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'suppliers' AND COLUMN_NAME = 'contact_info') THEN
    ALTER TABLE suppliers ADD COLUMN contact_info TEXT AFTER name;
  END IF;

  -- products.base_price
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'base_price') THEN
    ALTER TABLE products ADD COLUMN base_price DECIMAL(12,2) AFTER sale_price;
    UPDATE products SET base_price = sale_price WHERE base_price IS NULL;
  END IF;

  -- sale_items: variant_id + columnas de congelación
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_items' AND COLUMN_NAME = 'variant_id') THEN
    ALTER TABLE sale_items ADD COLUMN variant_id VARCHAR(36) AFTER product_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_items' AND COLUMN_NAME = 'cost_price') THEN
    ALTER TABLE sale_items
      ADD COLUMN cost_price    DECIMAL(12,2) AFTER subtotal,
      ADD COLUMN margin_pct    DECIMAL(5,2)  AFTER cost_price,
      ADD COLUMN margin_amount DECIMAL(12,2) AFTER margin_pct;
  END IF;

  -- order_items: solo si la tabla existe (no existe en el schema base de producción)
  IF EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'variant_id') THEN
      ALTER TABLE order_items ADD COLUMN variant_id VARCHAR(36) AFTER product_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'cost_price') THEN
      ALTER TABLE order_items
        ADD COLUMN cost_price    DECIMAL(12,2) AFTER subtotal,
        ADD COLUMN margin_pct    DECIMAL(5,2)  AFTER cost_price,
        ADD COLUMN margin_amount DECIMAL(12,2) AFTER margin_pct;
    END IF;
  END IF;

  -- storefront_order_items.variant_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storefront_order_items' AND COLUMN_NAME = 'variant_id') THEN
    ALTER TABLE storefront_order_items ADD COLUMN variant_id VARCHAR(36) AFTER product_id;
  END IF;
END //

CALL run_v39_alters() //

DROP PROCEDURE IF EXISTS run_v39_alters //

-- ============================================================
-- FIN — Vuelve el Delimitador a ";"
-- ============================================================
