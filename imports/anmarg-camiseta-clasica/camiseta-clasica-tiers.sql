-- ============================================================
-- TIERS POR VOLUMEN — Camiseta Clásica (AnMarg)
-- ============================================================
-- Ejecutar UNA SOLA VEZ, DESPUÉS de importar el CSV
-- (imports/anmarg-camiseta-clasica/camiseta-clasica-anmarg.csv).
--
-- El importador (import.service.ts) ya crea el tier base
-- (min_qty = 1 → $56.000) para cada variante. Este script agrega
-- los escalones mayoristas para TODAS las variantes del producto.
--
-- Modelo:  costo proveedor = $28.000 · venta retail = $56.000
--   1+   $56.000   (tier base, lo crea el importador)
--   6+   $52.000   margen $24.000
--   12+  $48.000   margen $20.000
--   24+  $44.000   margen $16.000
--
-- tenant_margin_pct = 0 (es producto propio del comercio, no hay
-- comisión de plataforma). Ajusta los precios a tu estrategia.
-- ============================================================

-- 1) Define tu tenant. Reemplaza el valor.
SET @tenant = 'TU_TENANT_ID';

-- 2) Resuelve el producto por nombre (tal como quedó al importar).
SET @pid = (
  SELECT id FROM products
  WHERE tenant_id = @tenant AND LOWER(name) = 'camiseta clasica'
  LIMIT 1
);

-- Aborta si no se encontró el producto (evita insertar tiers huérfanos).
SELECT IF(@pid IS NULL,
  'ERROR: no se encontró el producto "Camiseta Clasica" para este tenant. Importa el CSV primero.',
  CONCAT('OK: producto = ', @pid)) AS check_producto;

-- 3) Inserta los escalones por volumen para cada variante activa.
INSERT INTO variant_price_tiers (id, tenant_id, variant_id, min_qty, price, tenant_margin_pct, is_active)
SELECT UUID(), @tenant, v.id, 6, 52000, 0, 1
FROM product_variants v
WHERE v.tenant_id = @tenant AND v.product_id = @pid AND v.is_active = 1;

INSERT INTO variant_price_tiers (id, tenant_id, variant_id, min_qty, price, tenant_margin_pct, is_active)
SELECT UUID(), @tenant, v.id, 12, 48000, 0, 1
FROM product_variants v
WHERE v.tenant_id = @tenant AND v.product_id = @pid AND v.is_active = 1;

INSERT INTO variant_price_tiers (id, tenant_id, variant_id, min_qty, price, tenant_margin_pct, is_active)
SELECT UUID(), @tenant, v.id, 24, 44000, 0, 1
FROM product_variants v
WHERE v.tenant_id = @tenant AND v.product_id = @pid AND v.is_active = 1;

-- 4) Verificación: debe dar 4 tiers por variante (1, 6, 12, 24).
SELECT v.sku, COUNT(t.id) AS tiers
FROM product_variants v
LEFT JOIN variant_price_tiers t
  ON t.variant_id = v.id AND t.tenant_id = @tenant AND t.is_active = 1
WHERE v.tenant_id = @tenant AND v.product_id = @pid AND v.is_active = 1
GROUP BY v.id, v.sku
ORDER BY v.sku;
