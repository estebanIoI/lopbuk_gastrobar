-- ============================================================================
--  baseline-mark-applied.sql
--  Marca la migración 0000 (baseline por introspección) como YA APLICADA en una
--  base de datos EXISTENTE (prod / staging / dev que ya tiene todas las tablas),
--  SIN ejecutar su DDL — para que `migrate()` no intente recrear nada.
--
--  CUÁNDO correrlo:  una sola vez, por cada BD que YA existía antes de adoptar
--                    Drizzle (sus tablas ya están creadas por el flujo viejo).
--  CUÁNDO NO:        en entornos NUEVOS/vacíos. Ahí se deja correr `migrate()`,
--                    que aplica el 0000 y crea todo desde cero.
--
--  Cómo: seleccionar primero la BD destino, p.ej.:
--        mysql -u <user> -p <DATABASE> < src/db/baseline-mark-applied.sql
--
--  El hash y el created_at provienen de src/db/migrations/meta/_journal.json y
--  del .sql del baseline (tag 0000_dizzy_mongoose). Si se regenera el
--  baseline, actualizar estos dos valores.
-- ============================================================================

-- Tabla de control de Drizzle (mismo DDL que crea el migrador mysql2).
CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
  `id`         bigint unsigned NOT NULL AUTO_INCREMENT,
  `hash`       text NOT NULL,
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registrar el baseline 0000 como aplicado, solo si aún no está.
-- El migrador decide saltar una migración cuando created_at registrado >= el
-- folderMillis de esa migración; por eso basta con esta fila.
INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
SELECT 'f07c8909a1b8dfd5907b95df024b43f29bccaf1860ed18b3b04634e3d91a5b6c', 1782617458045
WHERE NOT EXISTS (
  SELECT 1 FROM `__drizzle_migrations`
  WHERE `hash` = 'f07c8909a1b8dfd5907b95df024b43f29bccaf1860ed18b3b04634e3d91a5b6c'
);
