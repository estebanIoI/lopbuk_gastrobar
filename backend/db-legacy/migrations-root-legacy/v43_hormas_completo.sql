-- ============================================================
-- v4.3 — HORMAS: TODO EN UNO (estructura + datos + colores + peso)
-- [2026-06-19]  100% idempotente. Seguro de re-ejecutar.
-- Reemplaza v40 / v41 / v42. Solo necesitas cambiar el slug del tenant (PASO 2).
-- ============================================================

-- ── PASO 1: estructura (tablas + columnas) ──────────────────
CREATE TABLE IF NOT EXISTS hormas (
  id          VARCHAR(36)   NOT NULL PRIMARY KEY,
  tenant_id   VARCHAR(36)   NOT NULL,
  name        VARCHAR(150)  NOT NULL,
  slug        VARCHAR(150)  NOT NULL,
  base_cost   DECIMAL(12,2) NOT NULL DEFAULT 0,
  base_price  DECIMAL(12,2) NOT NULL DEFAULT 0,
  weight_grams INT          NULL,
  size_chart  JSON,
  has_sleeves TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order  INT           NOT NULL DEFAULT 0,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_horma_slug_tenant (tenant_id, slug),
  INDEX idx_hormas_tenant (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS horma_colors (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY,
  tenant_id  VARCHAR(36)  NOT NULL,
  horma_id   VARCHAR(36)  NOT NULL,
  color      VARCHAR(100) NOT NULL,
  hex        VARCHAR(9),
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (horma_id) REFERENCES hormas(id) ON DELETE CASCADE,
  UNIQUE KEY uk_horma_color (horma_id, color),
  INDEX idx_hc_tenant (tenant_id),
  INDEX idx_hc_horma (horma_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Columna weight_grams en hormas (por si la tabla ya existía sin ella)
SET @c1 = (SELECT COUNT(1) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='hormas' AND COLUMN_NAME='weight_grams');
SET @s1 = IF(@c1=0, 'ALTER TABLE hormas ADD COLUMN weight_grams INT NULL AFTER base_price', 'SELECT 1');
PREPARE st FROM @s1; EXECUTE st; DEALLOCATE PREPARE st;

-- Columna horma_id en products (FK lógica opcional)
SET @c2 = (SELECT COUNT(1) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='products' AND COLUMN_NAME='horma_id');
SET @s2 = IF(@c2=0, 'ALTER TABLE products ADD COLUMN horma_id VARCHAR(36) NULL', 'SELECT 1');
PREPARE st FROM @s2; EXECUTE st; DEALLOCATE PREPARE st;

SET @c3 = (SELECT COUNT(1) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_horma');
SET @s3 = IF(@c3=0, 'ALTER TABLE products ADD INDEX idx_products_horma (horma_id)', 'SELECT 1');
PREPARE st FROM @s3; EXECUTE st; DEALLOCATE PREPARE st;

-- ── PASO 2: tenant (Lopbuk) ─────────────────────────────────
SET @tid = 'dc218d96-8a46-40f6-8a0d-b04ce6763d89';

-- ── PASO 3: las 6 hormas (medidas + peso) ───────────────────
-- INSERT IGNORE por UNIQUE(tenant_id, slug): no duplica si ya existen.
-- Peso: Clásica 160g; Overline/Americana/Acidwash/Esqueleto 230g; Oversize Fit sin dato (NULL).
INSERT IGNORE INTO hormas (id, tenant_id, name, slug, base_cost, base_price, weight_grams, has_sleeves, sort_order, size_chart)
SELECT * FROM (
  SELECT
    MD5(CONCAT(@tid, ':oversize-fit')) AS id, @tid AS tenant_id, 'Oversize Fit' AS name, 'oversize-fit' AS slug,
    36000 AS base_cost, 72000 AS base_price, NULL AS weight_grams, 1 AS has_sleeves, 1 AS sort_order,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',51,'largo',70,'manga',24),
      'M',  JSON_OBJECT('ancho',53,'largo',71,'manga',25),
      'L',  JSON_OBJECT('ancho',56,'largo',74,'manga',26),
      'XL', JSON_OBJECT('ancho',58,'largo',76,'manga',27),
      'XXL',JSON_OBJECT('ancho',62,'largo',80,'manga',30)) AS size_chart
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':oversize-americana')), @tid, 'Oversize Americana', 'oversize-americana',
    42000, 84000, 230, 1, 2,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',58,'largo',75,'manga',24),
      'M',  JSON_OBJECT('ancho',60,'largo',76,'manga',26),
      'L',  JSON_OBJECT('ancho',62,'largo',78,'manga',28),
      'XL', JSON_OBJECT('ancho',65,'largo',80,'manga',30),
      'XXL',JSON_OBJECT('ancho',68,'largo',82,'manga',32))
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':camiseta-overline')), @tid, 'Camiseta Overline', 'camiseta-overline',
    42000, 84000, 230, 1, 3,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',58,'largo',75,'manga',24),
      'M',  JSON_OBJECT('ancho',60,'largo',76,'manga',26),
      'L',  JSON_OBJECT('ancho',62,'largo',78,'manga',28),
      'XL', JSON_OBJECT('ancho',65,'largo',80,'manga',30),
      'XXL',JSON_OBJECT('ancho',68,'largo',82,'manga',32))
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':oversize-acidwash')), @tid, 'Oversize Acidwash', 'oversize-acidwash',
    51000, 102000, 230, 1, 4,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',56,'largo',72,'manga',26),
      'M',  JSON_OBJECT('ancho',58,'largo',74,'manga',28),
      'L',  JSON_OBJECT('ancho',60,'largo',76,'manga',30),
      'XL', JSON_OBJECT('ancho',64,'largo',78,'manga',32),
      'XXL',JSON_OBJECT('ancho',66,'largo',80,'manga',34))
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':esqueleto-acidwash')), @tid, 'Esqueleto Acidwash', 'esqueleto-acidwash',
    44000, 88000, 230, 0, 5,
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',56,'largo',72),
      'M',  JSON_OBJECT('ancho',58,'largo',74),
      'L',  JSON_OBJECT('ancho',60,'largo',76),
      'XL', JSON_OBJECT('ancho',64,'largo',78),
      'XXL',JSON_OBJECT('ancho',66,'largo',80))
  UNION ALL SELECT
    MD5(CONCAT(@tid, ':camiseta-clasica')), @tid, 'Camiseta Clásica', 'camiseta-clasica',
    28000, 56000, 160, 1, 6,
    -- NOTA: manga ESTIMADA (20-24cm) — confirmar con patronaje real
    JSON_OBJECT(
      'S',  JSON_OBJECT('ancho',48,'largo',68,'manga',20),
      'M',  JSON_OBJECT('ancho',52,'largo',71,'manga',21),
      'L',  JSON_OBJECT('ancho',56,'largo',74,'manga',22),
      'XL', JSON_OBJECT('ancho',58,'largo',77,'manga',23),
      'XXL',JSON_OBJECT('ancho',62,'largo',82,'manga',24))
) AS seed
WHERE @tid IS NOT NULL;

-- ── PASO 4: asegura peso aunque las hormas ya existieran ─────
UPDATE hormas SET weight_grams = 160 WHERE tenant_id=@tid AND slug='camiseta-clasica'   AND weight_grams IS NULL;
UPDATE hormas SET weight_grams = 230 WHERE tenant_id=@tid AND slug='camiseta-overline'  AND weight_grams IS NULL;
UPDATE hormas SET weight_grams = 230 WHERE tenant_id=@tid AND slug='oversize-acidwash'  AND weight_grams IS NULL;
UPDATE hormas SET weight_grams = 230 WHERE tenant_id=@tid AND slug='oversize-americana' AND weight_grams IS NULL;
UPDATE hormas SET weight_grams = 230 WHERE tenant_id=@tid AND slug='esqueleto-acidwash' AND weight_grams IS NULL;

-- ── PASO 5: paletas de color ────────────────────────────────
-- horma_id se resuelve por (tenant_id, slug): funciona aunque la horma
-- se haya creado antes con otro id. INSERT IGNORE evita duplicados.
INSERT IGNORE INTO horma_colors (id, tenant_id, horma_id, color, sort_order)
SELECT MD5(CONCAT(h.id, ':', c.color)), @tid, h.id, c.color, c.sort_order
FROM hormas h
JOIN (
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
-- VERIFICACIÓN
--   SELECT name, base_cost, base_price, weight_grams, has_sleeves
--     FROM hormas WHERE tenant_id = @tid ORDER BY sort_order;
--   SELECT h.name, COUNT(*) AS colores
--     FROM horma_colors hc JOIN hormas h ON h.id = hc.horma_id
--     WHERE hc.tenant_id = @tid GROUP BY h.name;
-- ============================================================
