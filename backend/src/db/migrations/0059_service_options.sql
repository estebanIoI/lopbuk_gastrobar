-- 0059 — Modalidades de servicio ("opciones"): un servicio puede ofrecer varias
-- modalidades (ej. Uñas → Gelish $250, Esculturales $360…) que el cliente elige al agendar.
--   services.options            JSON  → array de { id, name, price, durationMinutes }
--   service_bookings.selected_option JSON → snapshot de la modalidad elegida en la reserva
-- IDEMPOTENTE (segura de re-ejecutar). Aplicación manual / `npm run migrate`.

SET @has_opt := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services' AND COLUMN_NAME = 'options');
SET @sql_opt := IF(@has_opt = 0, 'ALTER TABLE `services` ADD COLUMN `options` JSON NULL AFTER `specialist_ids`', 'SELECT 1');
PREPARE s1 FROM @sql_opt; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @has_sel := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_bookings' AND COLUMN_NAME = 'selected_option');
SET @sql_sel := IF(@has_sel = 0, 'ALTER TABLE `service_bookings` ADD COLUMN `selected_option` JSON NULL AFTER `addons`', 'SELECT 1');
PREPARE s2 FROM @sql_sel; EXECUTE s2; DEALLOCATE PREPARE s2;
