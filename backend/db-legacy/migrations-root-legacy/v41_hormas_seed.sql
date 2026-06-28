-- ============================================================
-- SEED v4.1 — Carga las 6 hormas base de Lopbuk + sus paletas
-- [2026-06-19]  Idempotente: seguro de re-ejecutar.
-- Requiere que existan las tablas (v40_hormas.sql o auto-migración del backend).
-- ============================================================

-- ── PASO 1: elige el tenant destino ─────────────────────────
-- Opción A (recomendada): por el slug de tu tienda.
--   Para ver tu slug:  SELECT id, name, slug FROM tenants;
SET @tid = (SELECT id FROM tenants WHERE slug = 'CAMBIA_ESTE_SLUG' LIMIT 1);

-- Opción B: si solo tienes UN tenant, comenta la línea de arriba
-- y descomenta esta (toma el primero que exista):
-- SET @tid = (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1);

-- Guarda: si @tid quedó NULL, no inserta nada (evita filas huérfanas).

-- ── PASO 2: hormas (INSERT IGNORE por UNIQUE(tenant_id, slug)) ──
INSERT IGNORE INTO hormas (id, tenant_id, name, slug, base_cost, base_price, has_sleeves, sort_order, size_chart)
SELECT * FROM (
  SELECT
    MD5(CONCAT(@tid, ':oversize-fit'))  AS id, @tid AS tenant_id, 'Oversize Fit' AS name, 'oversize-fit' AS slug,
    36000 AS base_cost, 72000 AS base_price, 1 AS has_sleeves, 1 AS sort_order,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',51,'largo',70,'manga',24),
      'M',  JSON_OBJECT('ancho',53,'largo',71,'manga',25),
      'L',  JSON_OBJECT('ancho',56,'largo',74,'manga',26),
      'XL', JSON_OBJECT('ancho',58,'largo',76,'manga',27),
      'XXL',JSON_OBJECT('ancho',62,'largo',80,'manga',30)) AS size_chart
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':oversize-americana')), @tid, 'Oversize Americana', 'oversize-americana',
    42000, 84000, 1, 2,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',58,'largo',75,'manga',24),
      'M',  JSON_OBJECT('ancho',60,'largo',76,'manga',26),
      'L',  JSON_OBJECT('ancho',62,'largo',78,'manga',28),
      'XL', JSON_OBJECT('ancho',65,'largo',80,'manga',30),
      'XXL',JSON_OBJECT('ancho',68,'largo',82,'manga',32))
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':camiseta-overline')), @tid, 'Camiseta Overline', 'camiseta-overline',
    42000, 84000, 1, 3,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',58,'largo',75,'manga',24),
      'M',  JSON_OBJECT('ancho',60,'largo',76,'manga',26),
      'L',  JSON_OBJECT('ancho',62,'largo',78,'manga',28),
      'XL', JSON_OBJECT('ancho',65,'largo',80,'manga',30),
      'XXL',JSON_OBJECT('ancho',68,'largo',82,'manga',32))
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':oversize-acidwash')), @tid, 'Oversize Acidwash', 'oversize-acidwash',
    51000, 102000, 1, 4,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',56,'largo',72,'manga',26),
      'M',  JSON_OBJECT('ancho',58,'largo',74,'manga',28),
      'L',  JSON_OBJECT('ancho',60,'largo',76,'manga',30),
      'XL', JSON_OBJECT('ancho',64,'largo',78,'manga',32),
      'XXL',JSON_OBJECT('ancho',66,'largo',80,'manga',34))
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':esqueleto-acidwash')), @tid, 'Esqueleto Acidwash', 'esqueleto-acidwash',
    44000, 88000, 0, 5,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',56,'largo',72),
      'M',  JSON_OBJECT('ancho',58,'largo',74),
      'L',  JSON_OBJECT('ancho',60,'largo',76),
      'XL', JSON_OBJECT('ancho',64,'largo',78),
      'XXL',JSON_OBJECT('ancho',66,'largo',80))
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':camiseta-clasica')), @tid, 'Camiseta Clásica', 'camiseta-clasica',
    28000, 56000, 1, 6,
    -- NOTA: manga ESTIMADA (20-24cm) — confirmar con patronaje real
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',48,'largo',68,'manga',20),
      'M',  JSON_OBJECT('ancho',52,'largo',71,'manga',21),
      'L',  JSON_OBJECT('ancho',56,'largo',74,'manga',22),
      'XL', JSON_OBJECT('ancho',58,'largo',77,'manga',23),
      'XXL',JSON_OBJECT('ancho',62,'largo',82,'manga',24))
) AS seed
WHERE @tid IS NOT NULL;

-- ── PASO 3: paletas de color ────────────────────────────────
-- El horma_id se RESUELVE por (tenant_id, slug), así funciona aunque la horma
-- haya sido creada antes con otro id (ej: por la UI). INSERT IGNORE evita duplicados.
INSERT IGNORE INTO horma_colors (id, tenant_id, horma_id, color, sort_order)
SELECT MD5(CONCAT(h.id, ':', c.color)), @tid, h.id, c.color, c.sort_order
FROM hormas h
JOIN (
  -- Oversize Fit / Americana / Overline → misma paleta (5)
            SELECT 'oversize-fit'       AS slug, 'Negro'      AS color, 1 AS sort_order
  UNION ALL SELECT 'oversize-fit',       'Blanco',      2
  UNION ALL SELECT 'oversize-fit',       'V. Botella',  3
  UNION ALL SELECT 'oversize-fit',       'Vainilla',    4
  UNION ALL SELECT 'oversize-fit',       'Rojo',        5
  UNION ALL SELECT 'oversize-americana', 'Negro',       1
  UNION ALL SELECT 'oversize-americana', 'Blanco',      2
  UNION ALL SELECT 'oversize-americana', 'V. Botella',  3
  UNION ALL SELECT 'oversize-americana', 'Vainilla',    4
  UNION ALL SELECT 'oversize-americana', 'Rojo',        5
  UNION ALL SELECT 'camiseta-overline',  'Negro',       1
  UNION ALL SELECT 'camiseta-overline',  'Blanco',      2
  UNION ALL SELECT 'camiseta-overline',  'V. Botella',  3
  UNION ALL SELECT 'camiseta-overline',  'Vainilla',    4
  UNION ALL SELECT 'camiseta-overline',  'Rojo',        5
  -- Acidwash (oversize y esqueleto) → misma paleta (6)
  UNION ALL SELECT 'oversize-acidwash',  'Negro',       1
  UNION ALL SELECT 'oversize-acidwash',  'Gris',        2
  UNION ALL SELECT 'oversize-acidwash',  'Pardo',       3
  UNION ALL SELECT 'oversize-acidwash',  'Verde',       4
  UNION ALL SELECT 'oversize-acidwash',  'Lila',        5
  UNION ALL SELECT 'oversize-acidwash',  'Azul',        6
  UNION ALL SELECT 'esqueleto-acidwash', 'Negro',       1
  UNION ALL SELECT 'esqueleto-acidwash', 'Gris',        2
  UNION ALL SELECT 'esqueleto-acidwash', 'Pardo',       3
  UNION ALL SELECT 'esqueleto-acidwash', 'Verde',       4
  UNION ALL SELECT 'esqueleto-acidwash', 'Lila',        5
  UNION ALL SELECT 'esqueleto-acidwash', 'Azul',        6
  -- Camiseta Clásica → paleta amplia (16)
  UNION ALL SELECT 'camiseta-clasica',   'Negro',       1
  UNION ALL SELECT 'camiseta-clasica',   'Blanco',      2
  UNION ALL SELECT 'camiseta-clasica',   'Gris Jaspe',  3
  UNION ALL SELECT 'camiseta-clasica',   'Rosado',      4
  UNION ALL SELECT 'camiseta-clasica',   'Camel',       5
  UNION ALL SELECT 'camiseta-clasica',   'Nude',        6
  UNION ALL SELECT 'camiseta-clasica',   'Vainilla',    7
  UNION ALL SELECT 'camiseta-clasica',   'Lila',        8
  UNION ALL SELECT 'camiseta-clasica',   'V. Militar',  9
  UNION ALL SELECT 'camiseta-clasica',   'V. Botella',  10
  UNION ALL SELECT 'camiseta-clasica',   'V. Cali',     11
  UNION ALL SELECT 'camiseta-clasica',   'V. Pistacho', 12
  UNION ALL SELECT 'camiseta-clasica',   'Azul Navy',   13
  UNION ALL SELECT 'camiseta-clasica',   'Azul Rey',    14
  UNION ALL SELECT 'camiseta-clasica',   'Azul Agua',   15
  UNION ALL SELECT 'camiseta-clasica',   'Azul Medio',  16
) AS c ON c.slug = h.slug
WHERE h.tenant_id = @tid AND @tid IS NOT NULL;

-- ============================================================
-- FIN. Verifica con:
--   SELECT name, base_cost, base_price, has_sleeves FROM hormas WHERE tenant_id = @tid;
--   SELECT h.name, COUNT(*) colores FROM horma_colors hc
--     JOIN hormas h ON h.id = hc.horma_id WHERE hc.tenant_id = @tid GROUP BY h.name;
-- ============================================================
