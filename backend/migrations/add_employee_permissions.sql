-- ============================================================
-- Migración: permissions (RBAC) en employee_cargos
-- Compatible con MySQL 5.7+ y 8.0+
-- Ejecutar UNA sola vez en producción.
-- Es seguro re-ejecutar: si la columna ya existe, no hace nada.
-- ============================================================
USE stockpro_db;

SET @db  = DATABASE();
SET @tbl = 'employee_cargos';
SET @col = 'permissions';

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` JSON NULL COMMENT ''Permisos granulares del cargo: ["ventas","inventario",...]'''),
  'SELECT ''[skip] permissions ya existe'''
));
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
