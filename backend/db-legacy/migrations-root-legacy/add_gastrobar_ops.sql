-- ============================================================
-- GASTROBAR OPS: Merma + PAR Levels
-- Idempotent migration — safe to run multiple times
-- ============================================================

CREATE TABLE IF NOT EXISTS waste_records (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  tenant_id      VARCHAR(36)   NOT NULL,
  product_id     VARCHAR(36)   NULL,
  product_name   VARCHAR(200)  NOT NULL,
  quantity       DECIMAL(10,3) NOT NULL,
  unit           VARCHAR(20)   NOT NULL DEFAULT 'unidad',
  waste_type     ENUM('natural','operativa','administrativa','vencimiento') NOT NULL DEFAULT 'operativa',
  reason         ENUM('quemado','vencido','mal_corte','devolucion','consumo_interno','robo','cortesia','sobreporcion','dano','otro') NOT NULL DEFAULT 'otro',
  cost_value     DECIMAL(12,2) NOT NULL DEFAULT 0,
  area           ENUM('cocina','bar','general')  NOT NULL DEFAULT 'cocina',
  responsible_id   VARCHAR(36)  NULL,
  responsible_name VARCHAR(100) NULL,
  notes          TEXT          NULL,
  photo_url      VARCHAR(500)  NULL,
  recorded_by      VARCHAR(36)  NOT NULL,
  recorded_by_name VARCHAR(100) NOT NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_date (tenant_id, created_at),
  INDEX idx_product     (product_id),
  INDEX idx_type        (waste_type),
  INDEX idx_area        (area)
);

CREATE TABLE IF NOT EXISTS par_levels (
  id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
  tenant_id           VARCHAR(36)   NOT NULL,
  product_id          VARCHAR(36)   NOT NULL,
  daily_usage         DECIMAL(10,3) NOT NULL DEFAULT 0  COMMENT 'Uso diario promedio (unidades)',
  days_between_orders INT           NOT NULL DEFAULT 1  COMMENT 'Días entre compras',
  safety_stock        DECIMAL(10,3) NOT NULL DEFAULT 0  COMMENT 'Stock de seguridad',
  area                ENUM('cocina','bar','general') NOT NULL DEFAULT 'cocina',
  notes               TEXT          NULL,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_product (tenant_id, product_id),
  INDEX idx_tenant (tenant_id)
);
