-- ============================================================
-- v4.5 — HORMAS: agrega campo "composition" (ej: "100% Algodón")
-- [2026-06-19]  100% idempotente. Seguro de re-ejecutar.
-- El backend también auto-migra esta columna (hormas.service.ts → ensureTables),
-- así que correr este script a mano es opcional.
-- ============================================================

SET @c1 = (SELECT COUNT(1) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hormas' AND COLUMN_NAME = 'composition');
SET @s1 = IF(@c1 = 0,
  'ALTER TABLE hormas ADD COLUMN composition VARCHAR(150) NULL AFTER weight_grams',
  'SELECT 1');
PREPARE st FROM @s1; EXECUTE st; DEALLOCATE PREPARE st;

-- ============================================================
-- VERIFICACIÓN
--   SELECT name, weight_grams, composition FROM hormas ORDER BY sort_order;
-- ============================================================
