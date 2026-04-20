-- ============================================================
-- Migración: product_card_style en store_info
-- Compatible con MySQL 5.7+ y 8.0+
-- Ejecutar UNA sola vez en producción.
-- Es seguro re-ejecutar: si la columna ya existe, no hace nada.
-- ============================================================
USE stockpro_db;

SET @db  = DATABASE();
SET @tbl = 'store_info';
SET @col = 'product_card_style';

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` VARCHAR(20) NULL DEFAULT ''style1'' COMMENT ''Estilo de tarjeta de producto: style1 o style2'''),
  'SELECT ''[skip] product_card_style ya existe'''
));
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
