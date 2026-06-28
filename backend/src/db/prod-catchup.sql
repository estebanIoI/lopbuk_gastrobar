-- ============================================================================
--  prod-catchup.sql — Rellena los gaps de esquema en una PROD existente ANTES
--  de desplegar la versión con el DDL de runtime congelado.
--
--  ¿Por qué? Hasta ahora el backend creaba tablas/columnas en runtime (ensureTable).
--  Eso se congeló: el esquema vive en el baseline Drizzle. Si tu prod es más vieja
--  y le falta algo (p.ej. la feature hormas, o columnas que el schema viejo no creó
--  por cláusulas AFTER fallidas), la app congelada daría 500. Este script agrega lo
--  que falte, de forma IDEMPOTENTE (se puede correr varias veces sin romper).
--
--  CUÁNDO correrlo: UNA vez, contra la BD de prod, ANTES (o junto al) primer deploy.
--  CUÁNDO NO: si tu prod ya viene corriendo el `main` actual (con hormas) — ya tiene
--             todo; o si prod es una BD nueva (el baseline la crea completa).
--
--  Cómo:  mysql -u <user> -p <DATABASE> < src/db/prod-catchup.sql
--  (Luego el deploy auto-marca el baseline y aplica migraciones futuras.)
-- ============================================================================

-- Helper idempotente: ADD COLUMN solo si no existe (MySQL 8 no tiene IF NOT EXISTS).
DROP PROCEDURE IF EXISTS _catchup_add_col;
DELIMITER //
CREATE PROCEDURE _catchup_add_col(IN p_table VARCHAR(64), IN p_col VARCHAR(64), IN p_def TEXT)
BEGIN
  IF (SELECT COUNT(*) FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_col) = 0
     AND (SELECT COUNT(*) FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table) = 1 THEN
    SET @s = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_col, '` ', p_def);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

-- ── Feature hormas (siluetas de calzado) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS hormas (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  base_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  size_chart JSON,
  has_sleeves TINYINT(1) NOT NULL DEFAULT 1,
  sexo ENUM('unisex','hombre','mujer') NOT NULL DEFAULT 'unisex',
  composition VARCHAR(150) NULL,
  weight_grams INT NULL,
  shelf JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_horma_slug_tenant (tenant_id, slug),
  INDEX idx_hormas_tenant (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS horma_colors (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  horma_id VARCHAR(36) NOT NULL,
  color VARCHAR(100) NOT NULL,
  hex VARCHAR(9),
  shelf JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_horma_color (horma_id, color),
  INDEX idx_hc_tenant (tenant_id),
  INDEX idx_hc_horma (horma_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL _catchup_add_col('products', 'horma_id', "VARCHAR(36) NULL");
CALL _catchup_add_col('product_variants', 'horma_id', "VARCHAR(36) NULL COMMENT 'Horma de ESTA variante'");

-- ── Columnas que el schema_FULL viejo no creaba (AFTER fallidos) ─────────────
CALL _catchup_add_col('products', 'base_price', "DECIMAL(12,2) NULL");
CALL _catchup_add_col('sales', 'dispatch_notes', "TEXT NULL");
CALL _catchup_add_col('sales', 'dispatched_at', "TIMESTAMP NULL");

-- ── storefront_orders.assigned_to (la creaba ensureTable, congelado) ─────────
-- El panel superadmin de pedidos hace JOIN sobre esta columna → sin ella da 500.
CALL _catchup_add_col('storefront_orders', 'assigned_to', "VARCHAR(36) NULL");

DROP PROCEDURE IF EXISTS _catchup_add_col;
