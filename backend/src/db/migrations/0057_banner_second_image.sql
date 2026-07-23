-- 0057 — Banner: segunda imagen + velocidad de alternancia (efecto deslizante en hero1)
-- Aditiva e IDEMPOTENTE (segura de re-ejecutar). Aplicación manual / `npm run migrate`.
-- Fuente de verdad canónica: la definición Drizzle en schema.ts (storeBanners).
--   image_url_2  : segunda imagen opcional del banner. Si está, el hero1 alterna entre
--                  imagen 1 y 2 con el mismo efecto de deslizamiento que el hover de categorías.
--   swap_speed_ms: milisegundos que dura cada imagen antes de cambiar (velocidad configurable).

SET @has_img2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_banners' AND COLUMN_NAME = 'image_url_2');
SET @sql_img2 := IF(@has_img2 = 0,
  'ALTER TABLE `store_banners` ADD COLUMN `image_url_2` VARCHAR(500) NULL AFTER `image_url`',
  'SELECT 1');
PREPARE s1 FROM @sql_img2; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @has_speed := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_banners' AND COLUMN_NAME = 'swap_speed_ms');
SET @sql_speed := IF(@has_speed = 0,
  'ALTER TABLE `store_banners` ADD COLUMN `swap_speed_ms` INT NULL AFTER `image_url_2`',
  'SELECT 1');
PREPARE s2 FROM @sql_speed; EXECUTE s2; DEALLOCATE PREPARE s2;
