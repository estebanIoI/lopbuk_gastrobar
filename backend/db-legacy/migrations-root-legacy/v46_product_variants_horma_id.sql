-- ============================================================
-- v4.6 — product_variants: horma_id POR VARIANTE (no solo por producto)
-- [2026-06-19]  100% idempotente. Seguro de re-ejecutar.
-- Permite que un mismo producto (ej. "Estampado DTF") tenga variantes
-- repartidas en VARIAS hormas distintas (Oversize Fit, Camiseta Clásica, ...),
-- cada una con su propio color y talla.
-- El backend también auto-migra esta columna (variants.service.ts → ensureTables),
-- así que correr este script a mano es opcional.
-- ============================================================

SET @c1 = (SELECT COUNT(1) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variants' AND COLUMN_NAME = 'horma_id');
SET @s1 = IF(@c1 = 0,
  "ALTER TABLE product_variants ADD COLUMN horma_id VARCHAR(36) NULL COMMENT 'Horma de ESTA variante' AFTER preorder_count",
  'SELECT 1');
PREPARE st FROM @s1; EXECUTE st; DEALLOCATE PREPARE st;

SET @c2 = (SELECT COUNT(1) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variants' AND INDEX_NAME = 'idx_pv_horma');
SET @s2 = IF(@c2 = 0, 'ALTER TABLE product_variants ADD INDEX idx_pv_horma (horma_id)', 'SELECT 1');
PREPARE st FROM @s2; EXECUTE st; DEALLOCATE PREPARE st;

-- ── Backfill opcional ────────────────────────────────────────
-- Si el producto ya tenía UNA horma asignada (products.horma_id), copia ese valor
-- a las variantes existentes que todavía no tienen horma_id propio. Las variantes
-- nuevas que crees a partir de hoy en hormas distintas deben enviar su propio horma_id.
UPDATE product_variants pv
JOIN products p ON p.id = pv.product_id
SET pv.horma_id = p.horma_id
WHERE pv.horma_id IS NULL AND p.horma_id IS NOT NULL;

-- ============================================================
-- VERIFICACIÓN
--   SELECT pv.sku, pv.color, pv.size, h.name AS horma
--     FROM product_variants pv LEFT JOIN hormas h ON h.id = pv.horma_id
--     WHERE pv.product_id = '<id-del-producto>';
-- ============================================================
