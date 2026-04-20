-- ============================================================
-- MIGRACIÓN CONSOLIDADA — stockpro_db (lopbuk_gastrobar)
-- Combina TODAS las migraciones individuales (base + gastrobar)
-- Segura para re-ejecutar: cada paso verifica existencia antes
-- Compatible con MySQL 5.7+ y 8.0+
-- ============================================================
USE stockpro_db;

SET @db = DATABASE();

-- ============================================================
-- SECCIÓN 1: TABLAS NUEVAS
-- ============================================================

-- 1.1 Tabla: sedes
CREATE TABLE IF NOT EXISTS sedes (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_sedes_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.2 Tabla: printers
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

-- 1.3 Tabla: store_custom_sections
CREATE TABLE IF NOT EXISTS store_custom_sections (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     VARCHAR(36)   NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  slug          VARCHAR(255)  NOT NULL,
  html_content  LONGTEXT      NOT NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_tenant_slug (tenant_id, slug),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.4 Tabla: portfolio_config
CREATE TABLE IF NOT EXISTS portfolio_config (
  id                   INT PRIMARY KEY DEFAULT 1
                       COMMENT 'Singleton — siempre un solo registro',
  hero_title           VARCHAR(255) NOT NULL DEFAULT 'DAIMUZ',
  hero_subtitle        TEXT,
  hero_image_url       TEXT,
  brand_description    TEXT,
  show_pricing         TINYINT(1) NOT NULL DEFAULT 1,
  show_featured_stores TINYINT(1) NOT NULL DEFAULT 1,
  featured_tenant_ids  JSON COMMENT 'Array de tenant IDs a destacar',
  contact_email        VARCHAR(255),
  contact_whatsapp     VARCHAR(50),
  contact_instagram    VARCHAR(255),
  accent_color         VARCHAR(30) NOT NULL DEFAULT '#6366f1',
  is_published         TINYINT(1) NOT NULL DEFAULT 1,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Configuración del portafolio público';

-- ============================================================
-- SECCIÓN 2: COLUMNAS EN products
-- ============================================================

-- 2.1 products.sede_id
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sede_id') = 0,
  'ALTER TABLE `products` ADD COLUMN `sede_id` VARCHAR(36) NULL COMMENT ''Sede a la que pertenece el producto (NULL = todas las sedes)''',
  'SELECT ''[skip] products.sede_id ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- SECCIÓN 3: COLUMNAS EN sales
-- ============================================================

-- 3.1 sales.sede_id
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'sede_id') = 0,
  'ALTER TABLE `sales` ADD COLUMN `sede_id` VARCHAR(36) NULL DEFAULT NULL',
  'SELECT ''[skip] sales.sede_id ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 3.2 Índice sales.idx_sales_sede_id
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND INDEX_NAME = 'idx_sales_sede_id') = 0,
  'CREATE INDEX idx_sales_sede_id ON sales(sede_id)',
  'SELECT ''[skip] índice idx_sales_sede_id ya existe'''
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 3.3 sales.mixed_efectivo_amount
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'mixed_efectivo_amount') = 0,
  'ALTER TABLE sales ADD COLUMN mixed_efectivo_amount DECIMAL(12,2) NULL AFTER change_amount',
  'SELECT "mixed_efectivo_amount ya existe en sales"'
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 3.4 sales.mixed_second_method
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'mixed_second_method') = 0,
  'ALTER TABLE sales ADD COLUMN mixed_second_method VARCHAR(30) NULL AFTER mixed_efectivo_amount',
  'SELECT "mixed_second_method ya existe en sales"'
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 3.5 sales.mixed_second_amount
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'mixed_second_amount') = 0,
  'ALTER TABLE sales ADD COLUMN mixed_second_amount DECIMAL(12,2) NULL AFTER mixed_second_method',
  'SELECT "mixed_second_amount ya existe en sales"'
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- SECCIÓN 4: COLUMNAS EN store_info
-- ============================================================

-- 4.1 store_info.product_card_style
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'product_card_style') = 0,
  'ALTER TABLE `store_info` ADD COLUMN `product_card_style` VARCHAR(20) NULL DEFAULT ''style1'' COMMENT ''Estilo de tarjeta de producto: style1 o style2''',
  'SELECT ''[skip] store_info.product_card_style ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.2 store_info.allow_contraentrega
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'allow_contraentrega') = 0,
  'ALTER TABLE `store_info` ADD COLUMN `allow_contraentrega` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1 = permite pago contraentrega en checkout, 0 = solo métodos de pago en línea''',
  'SELECT ''[skip] store_info.allow_contraentrega ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.3 store_info.online_discount_enabled
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'online_discount_enabled') = 0,
  'ALTER TABLE `store_info` ADD COLUMN `online_discount_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = descuento activo para pagos en línea''',
  'SELECT ''[skip] store_info.online_discount_enabled ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.4 store_info.age_gate_enabled
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'age_gate_enabled') = 0,
  'ALTER TABLE store_info ADD COLUMN age_gate_enabled TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''[skip] store_info.age_gate_enabled ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.5 store_info.age_gate_description
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'age_gate_description') = 0,
  'ALTER TABLE store_info ADD COLUMN age_gate_description TEXT DEFAULT NULL',
  'SELECT ''[skip] store_info.age_gate_description ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.6 store_info.contact_page_enabled
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_enabled') = 0,
  'ALTER TABLE store_info ADD COLUMN contact_page_enabled TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''[skip] store_info.contact_page_enabled ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.7 store_info.contact_page_title
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_title') = 0,
  'ALTER TABLE store_info ADD COLUMN contact_page_title VARCHAR(255) DEFAULT NULL',
  'SELECT ''[skip] store_info.contact_page_title ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.8 store_info.contact_page_description
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_description') = 0,
  'ALTER TABLE store_info ADD COLUMN contact_page_description TEXT DEFAULT NULL',
  'SELECT ''[skip] store_info.contact_page_description ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.9 store_info.contact_page_image
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_image') = 0,
  'ALTER TABLE store_info ADD COLUMN contact_page_image VARCHAR(500) DEFAULT NULL',
  'SELECT ''[skip] store_info.contact_page_image ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.10 store_info.contact_page_products
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_products') = 0,
  'ALTER TABLE store_info ADD COLUMN contact_page_products TEXT DEFAULT NULL',
  'SELECT ''[skip] store_info.contact_page_products ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 4.11 store_info.contact_page_links
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_links') = 0,
  'ALTER TABLE store_info ADD COLUMN contact_page_links TEXT DEFAULT NULL',
  'SELECT ''[skip] store_info.contact_page_links ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- SECCIÓN 5: COLUMNAS EN employee_cargos
-- ============================================================

-- 5.1 employee_cargos.permissions
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'employee_cargos' AND COLUMN_NAME = 'permissions') = 0,
  'ALTER TABLE `employee_cargos` ADD COLUMN `permissions` JSON NULL COMMENT ''Permisos granulares del cargo: ["ventas","inventario",...]''',
  'SELECT ''[skip] employee_cargos.permissions ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- SECCIÓN 6: COLUMNAS EN users
-- ============================================================

-- 6.1 users.data_encrypted
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'data_encrypted') = 0,
  'ALTER TABLE `users` ADD COLUMN `data_encrypted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = campos sensibles cifrados con AES-256''',
  'SELECT ''[skip] users.data_encrypted ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 6.2 users.phone (expandir a TEXT para cifrado)
SET @sql = (SELECT IF(
  (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone') != 'text',
  'ALTER TABLE users MODIFY phone TEXT NULL',
  'SELECT ''[skip] users.phone ya es TEXT'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- SECCIÓN 7: COLUMNAS EN cash_sessions
-- ============================================================

-- 7.1 cash_sessions.total_credit_payments_efectivo
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cash_sessions' AND COLUMN_NAME = 'total_credit_payments_efectivo') = 0,
  'ALTER TABLE cash_sessions ADD COLUMN total_credit_payments_efectivo DECIMAL(12,2) NULL DEFAULT 0 AFTER total_fiado_sales',
  'SELECT ''[skip] cash_sessions.total_credit_payments_efectivo ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 7.2 cash_sessions.total_credit_payments_tarjeta
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cash_sessions' AND COLUMN_NAME = 'total_credit_payments_tarjeta') = 0,
  'ALTER TABLE cash_sessions ADD COLUMN total_credit_payments_tarjeta DECIMAL(12,2) NULL DEFAULT 0 AFTER total_credit_payments_efectivo',
  'SELECT ''[skip] cash_sessions.total_credit_payments_tarjeta ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 7.3 cash_sessions.total_credit_payments_transfer
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cash_sessions' AND COLUMN_NAME = 'total_credit_payments_transfer') = 0,
  'ALTER TABLE cash_sessions ADD COLUMN total_credit_payments_transfer DECIMAL(12,2) NULL DEFAULT 0 AFTER total_credit_payments_tarjeta',
  'SELECT ''[skip] cash_sessions.total_credit_payments_transfer ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- SECCIÓN 8: COLUMNAS EN purchase_invoice_items
-- ============================================================

-- 8.1 purchase_invoice_items.sale_price
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_invoice_items' AND COLUMN_NAME = 'sale_price') = 0,
  'ALTER TABLE purchase_invoice_items ADD COLUMN sale_price DECIMAL(12,2) NULL AFTER unit_cost',
  'SELECT "sale_price ya existe en purchase_invoice_items"'
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- SECCIÓN 9: COLUMNAS EN purchase_invoices
-- ============================================================

-- 9.1 purchase_invoices.mixed_efectivo_amount
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_invoices' AND COLUMN_NAME = 'mixed_efectivo_amount') = 0,
  'ALTER TABLE purchase_invoices ADD COLUMN mixed_efectivo_amount DECIMAL(12,2) NULL AFTER payment_method',
  'SELECT "mixed_efectivo_amount ya existe en purchase_invoices"'
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 9.2 purchase_invoices.mixed_transferencia_amount
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_invoices' AND COLUMN_NAME = 'mixed_transferencia_amount') = 0,
  'ALTER TABLE purchase_invoices ADD COLUMN mixed_transferencia_amount DECIMAL(12,2) NULL AFTER mixed_efectivo_amount',
  'SELECT "mixed_transferencia_amount ya existe en purchase_invoices"'
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- SECCIÓN 10: COLUMNAS EN product_recipes
-- ============================================================

-- 10.1 product_recipes.include_in_cost
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'product_recipes' AND COLUMN_NAME = 'include_in_cost') = 0,
  'ALTER TABLE `product_recipes` ADD COLUMN `include_in_cost` TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT ''[skip] product_recipes.include_in_cost ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- SECCIÓN 11: COLUMNAS EN tenants
-- ============================================================

-- 11.1 tenants.trial_ends_at
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'trial_ends_at') = 0,
  'ALTER TABLE tenants ADD COLUMN trial_ends_at DATETIME NULL DEFAULT NULL COMMENT ''7-day trial expiry; NULL means no active trial''',
  'SELECT ''[skip] tenants.trial_ends_at ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ============================================================
-- FIN DE MIGRACIÓN CONSOLIDADA
-- ============================================================
