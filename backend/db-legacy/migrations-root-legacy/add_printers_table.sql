-- ============================================================
-- Migración: tabla printers (impresoras por tenant)
-- Compatible con MySQL 5.7+ y 8.0+
-- Ejecutar UNA sola vez en producción.
-- Es seguro re-ejecutar: CREATE TABLE IF NOT EXISTS.
-- ============================================================
USE stockpro_db;

CREATE TABLE IF NOT EXISTS printers (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  connection_type ENUM('lan','usb','bluetooth') NOT NULL DEFAULT 'lan',
  ip VARCHAR(45) NULL,
  port INT NOT NULL DEFAULT 9100,
  paper_width SMALLINT NOT NULL DEFAULT 80,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  assigned_module ENUM('caja','cocina','bar','factura') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_printers_tenant (tenant_id),
  INDEX idx_printers_module (tenant_id, assigned_module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
