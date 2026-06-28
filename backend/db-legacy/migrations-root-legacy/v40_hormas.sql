-- ============================================================
-- MIGRACIÓN v4.0 — Hormas (silueta/plantilla de producto)
-- [2026-06-19] — Extiende v3.9 variants. 100% idempotente.
-- Doc: daimuz/brain/horma-architecture.md
-- ============================================================

-- Helper reutilizable para ADD COLUMN IF NOT EXISTS
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DELIMITER //
CREATE PROCEDURE add_column_if_not_exists(
  IN p_table  VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_def    TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- ============================================================
-- 1. HORMAS (silueta / plantilla)
-- ============================================================
CREATE TABLE IF NOT EXISTS hormas (
  id          VARCHAR(36)   NOT NULL PRIMARY KEY,
  tenant_id   VARCHAR(36)   NOT NULL,
  name        VARCHAR(150)  NOT NULL,
  slug        VARCHAR(150)  NOT NULL,
  base_cost   DECIMAL(12,2) NOT NULL DEFAULT 0,   -- costo base (lo que NOS cuesta)
  base_price  DECIMAL(12,2) NOT NULL DEFAULT 0,   -- precio de venta base (fallback)
  size_chart  JSON,                               -- medidas por talla { S:{ancho,largo,manga}, ... }
  has_sleeves TINYINT(1)    NOT NULL DEFAULT 1,    -- 0 = esqueleto (sin manga)
  sort_order  INT           NOT NULL DEFAULT 0,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_horma_slug_tenant (tenant_id, slug),
  INDEX idx_hormas_tenant (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. COLORES PERMITIDOS POR HORMA (paleta)
-- ============================================================
CREATE TABLE IF NOT EXISTS horma_colors (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY,
  tenant_id  VARCHAR(36)  NOT NULL,
  horma_id   VARCHAR(36)  NOT NULL,
  color      VARCHAR(100) NOT NULL,
  hex        VARCHAR(9),                          -- opcional, consume colorimetría
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (horma_id) REFERENCES hormas(id) ON DELETE CASCADE,
  UNIQUE KEY uk_horma_color (horma_id, color),
  INDEX idx_hc_tenant (tenant_id),
  INDEX idx_hc_horma (horma_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. horma_id EN products (FK opcional → herencia de precio/costo)
-- ============================================================
CALL add_column_if_not_exists('products', 'horma_id', 'VARCHAR(36) NULL AFTER base_price');
-- Índice para joins por horma (idempotente vía procedimiento inline)
SET @idx_exists = (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_horma'
);
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE products ADD INDEX idx_products_horma (horma_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 4. LIMPIEZA
-- ============================================================
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

-- ============================================================
-- 5. SEED — las 6 hormas iniciales
-- ------------------------------------------------------------
-- Multi-tenant: definir el tenant destino antes de ejecutar.
-- Reemplazar el valor de @tid por el tenant_id real.
-- INSERT IGNORE + UNIQUE(tenant_id, slug) => seguro de re-ejecutar.
-- ============================================================
SET @tid = 'REEMPLAZAR_TENANT_ID';

-- IDs estables derivados del slug para que el seed sea reentrante
SET @h1 = MD5(CONCAT(@tid, ':oversize-fit'));
SET @h2 = MD5(CONCAT(@tid, ':oversize-americana'));
SET @h3 = MD5(CONCAT(@tid, ':camiseta-overline'));
SET @h4 = MD5(CONCAT(@tid, ':oversize-acidwash'));
SET @h5 = MD5(CONCAT(@tid, ':esqueleto-acidwash'));
SET @h6 = MD5(CONCAT(@tid, ':camiseta-clasica'));

INSERT IGNORE INTO hormas (id, tenant_id, name, slug, base_cost, base_price, has_sleeves, sort_order, size_chart) VALUES
(@h1, @tid, 'Oversize Fit',       'oversize-fit',       36000, 72000,  1, 1,
  JSON_OBJECT(
    'S',  JSON_OBJECT('ancho',51,'largo',70,'manga',24),
    'M',  JSON_OBJECT('ancho',53,'largo',71,'manga',25),
    'L',  JSON_OBJECT('ancho',56,'largo',74,'manga',26),
    'XL', JSON_OBJECT('ancho',58,'largo',76,'manga',27),
    'XXL',JSON_OBJECT('ancho',62,'largo',80,'manga',30))),
(@h2, @tid, 'Oversize Americana', 'oversize-americana', 42000, 84000,  1, 2,
  JSON_OBJECT(
    'S',  JSON_OBJECT('ancho',58,'largo',75,'manga',24),
    'M',  JSON_OBJECT('ancho',60,'largo',76,'manga',26),
    'L',  JSON_OBJECT('ancho',62,'largo',78,'manga',28),
    'XL', JSON_OBJECT('ancho',65,'largo',80,'manga',30),
    'XXL',JSON_OBJECT('ancho',68,'largo',82,'manga',32))),
(@h3, @tid, 'Camiseta Overline',  'camiseta-overline',  42000, 84000,  1, 3,
  JSON_OBJECT(
    'S',  JSON_OBJECT('ancho',58,'largo',75,'manga',24),
    'M',  JSON_OBJECT('ancho',60,'largo',76,'manga',26),
    'L',  JSON_OBJECT('ancho',62,'largo',78,'manga',28),
    'XL', JSON_OBJECT('ancho',65,'largo',80,'manga',30),
    'XXL',JSON_OBJECT('ancho',68,'largo',82,'manga',32))),
(@h4, @tid, 'Oversize Acidwash',  'oversize-acidwash',  51000, 102000, 1, 4,
  JSON_OBJECT(
    'S',  JSON_OBJECT('ancho',56,'largo',72,'manga',26),
    'M',  JSON_OBJECT('ancho',58,'largo',74,'manga',28),
    'L',  JSON_OBJECT('ancho',60,'largo',76,'manga',30),
    'XL', JSON_OBJECT('ancho',64,'largo',78,'manga',32),
    'XXL',JSON_OBJECT('ancho',66,'largo',80,'manga',34))),
(@h5, @tid, 'Esqueleto Acidwash', 'esqueleto-acidwash', 44000, 88000,  0, 5,
  JSON_OBJECT(
    'S',  JSON_OBJECT('ancho',56,'largo',72),
    'M',  JSON_OBJECT('ancho',58,'largo',74),
    'L',  JSON_OBJECT('ancho',60,'largo',76),
    'XL', JSON_OBJECT('ancho',64,'largo',78),
    'XXL',JSON_OBJECT('ancho',66,'largo',80))),
(@h6, @tid, 'Camiseta Clásica',   'camiseta-clasica',   28000, 56000,  1, 6,
  -- NOTA: manga ESTIMADA (20-24cm), confirmar con patronaje real
  JSON_OBJECT(
    'S',  JSON_OBJECT('ancho',48,'largo',68,'manga',20),
    'M',  JSON_OBJECT('ancho',52,'largo',71,'manga',21),
    'L',  JSON_OBJECT('ancho',56,'largo',74,'manga',22),
    'XL', JSON_OBJECT('ancho',58,'largo',77,'manga',23),
    'XXL',JSON_OBJECT('ancho',62,'largo',82,'manga',24)));

-- Paletas de color por horma
-- Oversize Fit / Americana / Overline → misma paleta (5)
INSERT IGNORE INTO horma_colors (id, tenant_id, horma_id, color, sort_order) VALUES
(MD5(CONCAT(@h1,':negro')),     @tid, @h1, 'Negro',      1),
(MD5(CONCAT(@h1,':blanco')),    @tid, @h1, 'Blanco',     2),
(MD5(CONCAT(@h1,':v-botella')), @tid, @h1, 'V. Botella', 3),
(MD5(CONCAT(@h1,':vainilla')),  @tid, @h1, 'Vainilla',   4),
(MD5(CONCAT(@h1,':rojo')),      @tid, @h1, 'Rojo',       5),
(MD5(CONCAT(@h2,':negro')),     @tid, @h2, 'Negro',      1),
(MD5(CONCAT(@h2,':blanco')),    @tid, @h2, 'Blanco',     2),
(MD5(CONCAT(@h2,':v-botella')), @tid, @h2, 'V. Botella', 3),
(MD5(CONCAT(@h2,':vainilla')),  @tid, @h2, 'Vainilla',   4),
(MD5(CONCAT(@h2,':rojo')),      @tid, @h2, 'Rojo',       5),
(MD5(CONCAT(@h3,':negro')),     @tid, @h3, 'Negro',      1),
(MD5(CONCAT(@h3,':blanco')),    @tid, @h3, 'Blanco',     2),
(MD5(CONCAT(@h3,':v-botella')), @tid, @h3, 'V. Botella', 3),
(MD5(CONCAT(@h3,':vainilla')),  @tid, @h3, 'Vainilla',   4),
(MD5(CONCAT(@h3,':rojo')),      @tid, @h3, 'Rojo',       5);

-- Acidwash (oversize y esqueleto) → misma paleta (6)
INSERT IGNORE INTO horma_colors (id, tenant_id, horma_id, color, sort_order) VALUES
(MD5(CONCAT(@h4,':negro')), @tid, @h4, 'Negro', 1),
(MD5(CONCAT(@h4,':gris')),  @tid, @h4, 'Gris',  2),
(MD5(CONCAT(@h4,':pardo')), @tid, @h4, 'Pardo', 3),
(MD5(CONCAT(@h4,':verde')), @tid, @h4, 'Verde', 4),
(MD5(CONCAT(@h4,':lila')),  @tid, @h4, 'Lila',  5),
(MD5(CONCAT(@h4,':azul')),  @tid, @h4, 'Azul',  6),
(MD5(CONCAT(@h5,':negro')), @tid, @h5, 'Negro', 1),
(MD5(CONCAT(@h5,':gris')),  @tid, @h5, 'Gris',  2),
(MD5(CONCAT(@h5,':pardo')), @tid, @h5, 'Pardo', 3),
(MD5(CONCAT(@h5,':verde')), @tid, @h5, 'Verde', 4),
(MD5(CONCAT(@h5,':lila')),  @tid, @h5, 'Lila',  5),
(MD5(CONCAT(@h5,':azul')),  @tid, @h5, 'Azul',  6);

-- Camiseta Clásica → paleta amplia (16)
INSERT IGNORE INTO horma_colors (id, tenant_id, horma_id, color, sort_order) VALUES
(MD5(CONCAT(@h6,':negro')),       @tid, @h6, 'Negro',       1),
(MD5(CONCAT(@h6,':blanco')),      @tid, @h6, 'Blanco',      2),
(MD5(CONCAT(@h6,':gris-jaspe')),  @tid, @h6, 'Gris Jaspe',  3),
(MD5(CONCAT(@h6,':rosado')),      @tid, @h6, 'Rosado',      4),
(MD5(CONCAT(@h6,':camel')),       @tid, @h6, 'Camel',       5),
(MD5(CONCAT(@h6,':nude')),        @tid, @h6, 'Nude',        6),
(MD5(CONCAT(@h6,':vainilla')),    @tid, @h6, 'Vainilla',    7),
(MD5(CONCAT(@h6,':lila')),        @tid, @h6, 'Lila',        8),
(MD5(CONCAT(@h6,':v-militar')),   @tid, @h6, 'V. Militar',  9),
(MD5(CONCAT(@h6,':v-botella')),   @tid, @h6, 'V. Botella',  10),
(MD5(CONCAT(@h6,':v-cali')),      @tid, @h6, 'V. Cali',     11),
(MD5(CONCAT(@h6,':v-pistacho')),  @tid, @h6, 'V. Pistacho', 12),
(MD5(CONCAT(@h6,':azul-navy')),   @tid, @h6, 'Azul Navy',   13),
(MD5(CONCAT(@h6,':azul-rey')),    @tid, @h6, 'Azul Rey',    14),
(MD5(CONCAT(@h6,':azul-agua')),   @tid, @h6, 'Azul Agua',   15),
(MD5(CONCAT(@h6,':azul-medio')),  @tid, @h6, 'Azul Medio',  16);

-- ============================================================
-- FIN — Recordar setear @tid antes de correr el SEED.
-- ============================================================
