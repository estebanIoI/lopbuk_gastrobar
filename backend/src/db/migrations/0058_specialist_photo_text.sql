-- 0058 — Amplía service_specialists.photo_url a TEXT.
-- Motivo: las URLs de CDN muy largas (ej. Facebook: scontent...fbcdn.net con _nc_/oh/oe)
-- superan los 500 chars y MySQL lanzaba "Data too long for column 'photo_url'" → 500 al
-- crear/actualizar un especialista. TEXT admite URLs de cualquier tamaño.
-- IDEMPOTENTE: solo modifica si aún no es TEXT.

SET @is_text := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_specialists'
    AND COLUMN_NAME = 'photo_url' AND DATA_TYPE = 'text');
SET @sql := IF(@is_text = 0, 'ALTER TABLE `service_specialists` MODIFY `photo_url` TEXT NULL', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
