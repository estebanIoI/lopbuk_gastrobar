-- ============================================================
-- v4.2 — Peso (gramos) por horma + actualización de las existentes
-- [2026-06-19]  Idempotente.
-- ============================================================

-- ── PASO 1: columna weight_grams (idempotente) ──────────────
SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hormas' AND COLUMN_NAME = 'weight_grams'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE hormas ADD COLUMN weight_grams INT NULL AFTER base_price',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── PASO 2: elige el tenant ─────────────────────────────────
--   Para ver tu slug:  SELECT id, name, slug FROM tenants;
SET @tid = (SELECT id FROM tenants WHERE slug = 'CAMBIA_ESTE_SLUG' LIMIT 1);
-- Si solo tienes un tenant, comenta la línea de arriba y usa:
-- SET @tid = (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1);

-- ── PASO 3: pesos por horma ─────────────────────────────────
-- (Oversize Fit no se incluye: no se especificó peso.)
UPDATE hormas SET weight_grams = 160 WHERE tenant_id = @tid AND slug = 'camiseta-clasica';
UPDATE hormas SET weight_grams = 230 WHERE tenant_id = @tid AND slug = 'camiseta-overline';
UPDATE hormas SET weight_grams = 230 WHERE tenant_id = @tid AND slug = 'oversize-acidwash';
UPDATE hormas SET weight_grams = 230 WHERE tenant_id = @tid AND slug = 'oversize-americana';
UPDATE hormas SET weight_grams = 230 WHERE tenant_id = @tid AND slug = 'esqueleto-acidwash';

-- ============================================================
-- Verifica:  SELECT name, weight_grams FROM hormas WHERE tenant_id = @tid;
-- ============================================================
