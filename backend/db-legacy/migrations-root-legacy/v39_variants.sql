-- ============================================================
-- MIGRACIÓN v3.9 — Variantes + Precios por Volumen + Proveedores
-- [2026-06-09] — Versión definitiva alineada con el backend
-- ============================================================

-- Helper reutilizable para ADD COLUMN IF NOT EXISTS
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DELIMITER //
CREATE PROCEDURE add_column_if_not_exists(
  IN p_table  VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_def    TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- ============================================================
-- 1. PROVEEDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  tenant_id     VARCHAR(36)   NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  contact_info  TEXT,
  phone         VARCHAR(50),
  email         VARCHAR(255),
  payment_terms TEXT,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_suppliers_tenant (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. RELACIÓN N:N PROVEEDOR-PRODUCTO
-- ============================================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. VARIANTES DE PRODUCTO
-- ============================================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. PRECIOS ESCALONADOS (TIERS)
-- ============================================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. MOVIMIENTOS DE INVENTARIO (fuente de verdad universal)
-- ============================================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. base_price EN products
-- ============================================================
CALL add_column_if_not_exists('products', 'base_price', 'DECIMAL(12,2) AFTER sale_price');
UPDATE products SET base_price = sale_price WHERE base_price IS NULL;

-- ============================================================
-- 7. COLUMNAS EN sale_items
-- ============================================================
CALL add_column_if_not_exists('sale_items', 'variant_id',    'VARCHAR(36) AFTER product_id');
CALL add_column_if_not_exists('sale_items', 'cost_price',    'DECIMAL(12,2) AFTER subtotal');
CALL add_column_if_not_exists('sale_items', 'margin_pct',    'DECIMAL(5,2) AFTER cost_price');
CALL add_column_if_not_exists('sale_items', 'margin_amount', 'DECIMAL(12,2) AFTER margin_pct');

-- ============================================================
-- 8. COLUMNAS EN order_items
-- ============================================================
CALL add_column_if_not_exists('order_items', 'variant_id',    'VARCHAR(36) AFTER product_id');
CALL add_column_if_not_exists('order_items', 'cost_price',    'DECIMAL(12,2) AFTER subtotal');
CALL add_column_if_not_exists('order_items', 'margin_pct',    'DECIMAL(5,2) AFTER cost_price');
CALL add_column_if_not_exists('order_items', 'margin_amount', 'DECIMAL(12,2) AFTER margin_pct');

-- ============================================================
-- 9. variant_id EN storefront_order_items
-- ============================================================
CALL add_column_if_not_exists('storefront_order_items', 'variant_id', 'VARCHAR(36) AFTER product_id');

-- ============================================================
-- 10. LIMPIEZA
-- ============================================================
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

-- ============================================================
-- FIN — 100% idempotente. Seguro de re-ejecutar.
-- ============================================================
