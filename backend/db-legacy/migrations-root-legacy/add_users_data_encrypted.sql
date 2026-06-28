-- ============================================================
-- Migración: data_encrypted en users (marcador de cifrado AES-256)
-- Compatible con MySQL 5.7+ y 8.0+
-- Ejecutar UNA sola vez en producción.
-- Es seguro re-ejecutar: si la columna ya existe, no hace nada.
-- ============================================================
USE stockpro_db;

SET @db  = DATABASE();
SET @tbl = 'users';
SET @col = 'data_encrypted';

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = campos sensibles cifrados con AES-256'''),
  'SELECT ''[skip] data_encrypted ya existe'''
));
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
