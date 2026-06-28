-- ============================================================
-- Migración: agregar include_in_cost a product_recipes
-- Compatible con MySQL 5.7+ y 8.0+
-- Ejecutar UNA sola vez en producción.
-- Es seguro re-ejecutar: si la columna ya existe, no hace nada.
-- ============================================================
USE stockpro_db;

SET @db   = DATABASE();
SET @tbl  = 'product_recipes';
SET @col  = 'include_in_cost';

-- Construye ALTER solo si la columna NO existe en INFORMATION_SCHEMA
SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME   = @tbl
        AND COLUMN_NAME  = @col
    ) = 0,
    CONCAT(
      'ALTER TABLE `', @tbl, '`',
      ' ADD COLUMN `', @col, '` TINYINT(1) NOT NULL DEFAULT 1'
    ),
    'SELECT ''[skip] columna include_in_cost ya existe'''
  )
);

PREPARE _stmt FROM @sql;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;
