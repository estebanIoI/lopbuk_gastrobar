-- ============================================================
-- Migración: allow_contraentrega y online_discount_enabled en store_info
-- Compatible con MySQL 5.7+ y 8.0+
-- Ejecutar UNA sola vez en producción.
-- Es seguro re-ejecutar: si la columna ya existe, no hace nada.
-- ============================================================
USE stockpro_db;

SET @db  = DATABASE();
SET @tbl = 'store_info';

-- allow_contraentrega
SET @col = 'allow_contraentrega';
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1 = permite pago contraentrega en checkout, 0 = solo métodos de pago en línea'''),
  'SELECT ''[skip] allow_contraentrega ya existe'''
));
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- online_discount_enabled
SET @col = 'online_discount_enabled';
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = descuento activo para pagos en línea'''),
  'SELECT ''[skip] online_discount_enabled ya existe'''
));
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
