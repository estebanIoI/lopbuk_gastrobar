-- ============================================================
-- MIGRACIÓN v3.9 — Variantes + Precios por Volumen + Proveedores
-- ============================================================
-- Fecha: 2026-06-07
-- Descripción: Agregaaaa soporte para variantes de producto (color/talla/material)
-- con stock independiente, precios escalonados (tiers), proveedores,
-- y movimientos de inventario como fuente de verdad.
-- ============================================================

-- Helper para ADD COLUMN IF NOT EXISTS (MySQL no lo soporta nativo)
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DELIMITER //
CREATE PROCEDURE add_column_if_not_exists(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @s = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_definition);
    PREPARE stmt FROM @s;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

-- ============================================================
-- 1. PROVEEDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  tenant_id     VARCHAR(36)  NOT NULL,
  name          VARCHAR(255) NOT NULL,
  contact_info  TEXT,
  phone         VARCHAR(50),
  email         VARCHAR(255),
  payment_terms TEXT,
  is_active     TINYINT(1)   DEFAULT 1,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_suppliers_tenant (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. RELACIÓN N:N PROVEEDOR-PRODUCTO
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_products (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  supplier_id     VARCHAR(36)  NOT NULL,
  product_id      VARCHAR(36)  NOT NULL,
  supplier_sku    VARCHAR(100),
  cost_price      DECIMAL(12,2) DEFAULT 0,
  lead_time_days  INT          DEFAULT 0,
  is_preferred    TINYINT(1)   DEFAULT 0,
  is_active       TINYINT(1)   DEFAULT 1,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sp_supplier (supplier_id),
  INDEX idx_sp_product (product_id),
  INDEX idx_sp_supplier_product (supplier_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. VARIANTES DE PRODUCTO
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  tenant_id       VARCHAR(36)  NOT NULL,
  product_id      VARCHAR(36)  NOT NULL,
  sku             VARCHAR(100) NOT NULL,
  barcode         VARCHAR(100),
  color           VARCHAR(100),
  size            VARCHAR(50),
  material        VARCHAR(100),
  stock           INT          DEFAULT 0,
  reserved_stock  INT          DEFAULT 0,
  min_stock       INT          DEFAULT 0,
  cost_price      DECIMAL(12,2) DEFAULT 0,
  price_override  DECIMAL(12,2),
  supplier_id     VARCHAR(36),
  images          JSON,
  sort_order      INT          DEFAULT 0,
  is_active       TINYINT(1)   DEFAULT 1,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pv_product (product_id),
  INDEX idx_pv_tenant_product (tenant_id, product_id),
  INDEX idx_pv_supplier (supplier_id),
  INDEX idx_pv_sku (tenant_id, sku),
  UNIQUE KEY uk_pv_sku_tenant (sku, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. PRECIOS ESCALONADOS (TIERS)
-- ============================================================
CREATE TABLE IF NOT EXISTS variant_price_tiers (
  id                VARCHAR(36)  NOT NULL PRIMARY KEY,
  tenant_id         VARCHAR(36)  NOT NULL,
  variant_id        VARCHAR(36)  NOT NULL,
  min_qty           INT          NOT NULL DEFAULT 1,
  price             DECIMAL(12,2) NOT NULL,
  tenant_margin_pct DECIMAL(5,2) DEFAULT 0,
  is_active         TINYINT(1)   DEFAULT 1,
  created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vpt_variant (variant_id),
  INDEX idx_vpt_variant_minqty (variant_id, tenant_id, min_qty),
  INDEX idx_vpt_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. MOVIMIENTOS DE INVENTARIO (fuente de verdad universal)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  tenant_id       VARCHAR(36)  NOT NULL,
  variant_id      VARCHAR(36),
  product_id      VARCHAR(36)  NOT NULL,
  type            ENUM('entrada','salida','ajuste','merma','transferencia','reserva','liberacion') NOT NULL,
  quantity        INT          NOT NULL,
  reason          TEXT         NOT NULL,
  reference_type  VARCHAR(50),
  reference_id    VARCHAR(36),
  created_by      VARCHAR(36),
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_im_variant (variant_id),
  INDEX idx_im_product (product_id),
  INDEX idx_im_tenant (tenant_id),
  INDEX idx_im_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. COLUMNAS CONGELADAS EN order_items
-- ============================================================
CALL add_column_if_not_exists('order_items', 'variant_id',    'VARCHAR(36) AFTER product_id');
CALL add_column_if_not_exists('order_items', 'cost_price',    'DECIMAL(12,2) AFTER price');
CALL add_column_if_not_exists('order_items', 'margin_pct',    'DECIMAL(5,2) AFTER cost_price');
CALL add_column_if_not_exists('order_items', 'margin_amount', 'DECIMAL(12,2) AFTER margin_pct');

-- ============================================================
-- 7. COLUMNAS CONGELADAS EN sale_items
-- ============================================================
CALL add_column_if_not_exists('sale_items', 'variant_id',    'VARCHAR(36) AFTER product_id');
CALL add_column_if_not_exists('sale_items', 'cost_price',    'DECIMAL(12,2) AFTER price');
CALL add_column_if_not_exists('sale_items', 'margin_pct',    'DECIMAL(5,2) AFTER cost_price');
CALL add_column_if_not_exists('sale_items', 'margin_amount', 'DECIMAL(12,2) AFTER margin_pct');

-- ============================================================
-- 8. base_price EN products
-- ============================================================
CALL add_column_if_not_exists('products', 'base_price', 'DECIMAL(12,2) AFTER price');
UPDATE products SET base_price = price WHERE base_price IS NULL;

-- ============================================================
-- 9. LIMPIEZA
-- ============================================================
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
