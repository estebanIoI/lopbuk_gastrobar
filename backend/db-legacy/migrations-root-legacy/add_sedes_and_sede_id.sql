-- ============================================================
-- Migración: tabla sedes + sede_id en products y sales
-- Compatible con MySQL 5.7+ y 8.0+
-- Ejecutar UNA sola vez en producción.
-- Es seguro re-ejecutar: IF NOT EXISTS / INFORMATION_SCHEMA protegen cada paso.
-- ============================================================
USE stockpro_db;

-- Tabla sedes
CREATE TABLE IF NOT EXISTS sedes (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_sedes_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sede_id en products
SET @db  = DATABASE();

SET @col = 'sede_id';

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'products' AND COLUMN_NAME = @col) = 0,
  'ALTER TABLE `products` ADD COLUMN `sede_id` VARCHAR(36) NULL COMMENT ''Sede a la que pertenece el producto (NULL = todas las sedes)''',
  'SELECT ''[skip] products.sede_id ya existe'''
));
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- sede_id en sales
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND COLUMN_NAME = @col) = 0,
  'ALTER TABLE `sales` ADD COLUMN `sede_id` VARCHAR(36) NULL DEFAULT NULL',
  'SELECT ''[skip] sales.sede_id ya existe'''
));
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- Índice en sales.sede_id (IF NOT EXISTS requiere MySQL 8.0.11+; para 5.7 se ignora si falla)
SET @idx_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND INDEX_NAME = 'idx_sales_sede_id'
);
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_sales_sede_id ON sales(sede_id)',
  'SELECT ''[skip] índice idx_sales_sede_id ya existe'''
);
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
