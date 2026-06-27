-- ============================================================
-- v4.4 — HORMAS: agrega campo "sexo" (Unisex / Hombre / Mujer)
-- [2026-06-19]  100% idempotente. Seguro de re-ejecutar.
-- El backend también auto-migra esta columna (hormas.service.ts → ensureTables),
-- así que correr este script a mano es opcional.
-- ============================================================

SET @c1 = (SELECT COUNT(1) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hormas' AND COLUMN_NAME = 'sexo');
SET @s1 = IF(@c1 = 0,
  "ALTER TABLE hormas ADD COLUMN sexo ENUM('unisex','hombre','mujer') NOT NULL DEFAULT 'unisex' AFTER has_sleeves",
  'SELECT 1');
PREPARE st FROM @s1; EXECUTE st; DEALLOCATE PREPARE st;

-- ============================================================
-- VERIFICACIÓN
--   SELECT name, sexo FROM hormas ORDER BY sort_order;
-- ============================================================
