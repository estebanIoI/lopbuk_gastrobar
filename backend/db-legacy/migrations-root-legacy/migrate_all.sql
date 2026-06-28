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
-- SECCIÓN 12: MÓDULO FLOTA (fleet_vehicles, fleet_maintenance,
--             columnas en storefront_orders, sales, products, users)
-- ============================================================

-- 12.1 Tabla: fleet_vehicles
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    plate VARCHAR(20) NULL,
    type ENUM('planta', 'ligera', 'moto') NOT NULL DEFAULT 'ligera',
    max_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    status ENUM('disponible', 'en_ruta', 'mantenimiento', 'inactivo') NOT NULL DEFAULT 'disponible',
    year INT NULL,
    brand VARCHAR(50) NULL,
    model VARCHAR(50) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_fleet_tenant (tenant_id),
    INDEX idx_fleet_status (status),
    INDEX idx_fleet_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.2 Tabla: fleet_maintenance
CREATE TABLE IF NOT EXISTS fleet_maintenance (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    vehicle_id VARCHAR(36) NOT NULL,
    type ENUM('preventivo', 'correctivo', 'revision') NOT NULL DEFAULT 'preventivo',
    description TEXT NOT NULL,
    scheduled_date DATE NULL,
    completed_date DATE NULL,
    cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('pendiente', 'en_proceso', 'completado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    notes TEXT NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_maintenance_tenant (tenant_id),
    INDEX idx_maintenance_vehicle (vehicle_id),
    INDEX idx_maintenance_scheduled (scheduled_date),
    INDEX idx_maintenance_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.3 products.hardware_weight_unit
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'products' AND COLUMN_NAME = 'hardware_weight_unit') = 0,
  'ALTER TABLE products ADD COLUMN hardware_weight_unit ENUM(''kg'',''ton'',''lb'',''g'') NULL DEFAULT ''kg'' COMMENT ''Unidad de peso para ferretería'' AFTER weight',
  'SELECT ''[skip] products.hardware_weight_unit ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.4 storefront_orders.vehicle_id
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'storefront_orders' AND COLUMN_NAME = 'vehicle_id') = 0,
  'ALTER TABLE storefront_orders ADD COLUMN vehicle_id VARCHAR(36) NULL COMMENT ''Vehículo asignado para despacho''',
  'SELECT ''[skip] storefront_orders.vehicle_id ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.5 storefront_orders.dispatch_status
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'storefront_orders' AND COLUMN_NAME = 'dispatch_status') = 0,
  'ALTER TABLE storefront_orders ADD COLUMN dispatch_status ENUM(''pendiente'',''en_pista'',''cargado'',''despachado'',''entregado'') NOT NULL DEFAULT ''pendiente''',
  'SELECT ''[skip] storefront_orders.dispatch_status ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.6 storefront_orders.total_weight_kg
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'storefront_orders' AND COLUMN_NAME = 'total_weight_kg') = 0,
  'ALTER TABLE storefront_orders ADD COLUMN total_weight_kg DECIMAL(10,3) NULL COMMENT ''Peso total del pedido en kg''',
  'SELECT ''[skip] storefront_orders.total_weight_kg ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.7 storefront_orders.dispatch_notes
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'storefront_orders' AND COLUMN_NAME = 'dispatch_notes') = 0,
  'ALTER TABLE storefront_orders ADD COLUMN dispatch_notes TEXT NULL',
  'SELECT ''[skip] storefront_orders.dispatch_notes ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.8 storefront_orders.dispatched_at
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'storefront_orders' AND COLUMN_NAME = 'dispatched_at') = 0,
  'ALTER TABLE storefront_orders ADD COLUMN dispatched_at TIMESTAMP NULL',
  'SELECT ''[skip] storefront_orders.dispatched_at ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.9 FK storefront_orders -> fleet_vehicles (solo si fleet_vehicles existe y FK no existe)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'storefront_orders'
     AND CONSTRAINT_NAME = 'fk_order_fleet_vehicle') = 0,
  'ALTER TABLE storefront_orders ADD CONSTRAINT fk_order_fleet_vehicle FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE SET NULL',
  'SELECT ''[skip] FK fk_order_fleet_vehicle ya existe'''
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.10 Índice storefront_orders.vehicle_id
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'storefront_orders' AND INDEX_NAME = 'idx_order_vehicle') = 0,
  'CREATE INDEX idx_order_vehicle ON storefront_orders(vehicle_id)',
  'SELECT ''[skip] índice idx_order_vehicle ya existe'''
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.11 sales.vehicle_id
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'vehicle_id') = 0,
  'ALTER TABLE sales ADD COLUMN vehicle_id VARCHAR(36) NULL COMMENT ''Vehículo asignado si requiere despacho''',
  'SELECT ''[skip] sales.vehicle_id ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.12 sales.dispatch_status
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'dispatch_status') = 0,
  'ALTER TABLE sales ADD COLUMN dispatch_status ENUM(''pendiente'',''en_pista'',''cargado'',''despachado'',''entregado'') NOT NULL DEFAULT ''pendiente''',
  'SELECT ''[skip] sales.dispatch_status ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.13 sales.total_weight_kg
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'total_weight_kg') = 0,
  'ALTER TABLE sales ADD COLUMN total_weight_kg DECIMAL(10,3) NULL COMMENT ''Peso total de la venta en kg''',
  'SELECT ''[skip] sales.total_weight_kg ya existe'''
));
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- 12.14 users.role — agregar rol despachador
ALTER TABLE users MODIFY COLUMN role ENUM(
    'superadmin','comerciante','vendedor','cliente','repartidor',
    'auxiliar_bodega','administrador_rb','cajero','mesero',
    'cocinero','bartender','despachador'
) NOT NULL DEFAULT 'vendedor';

-- ============================================================
-- SECCIÓN 13: MÓDULO DE RESERVAS DE MESAS (RestBar)
-- ============================================================

-- 13.1 Configuración de reservas en tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_whatsapp VARCHAR(50) NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_open_time TIME NOT NULL DEFAULT '12:00:00';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_close_time TIME NOT NULL DEFAULT '22:00:00';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_slot_minutes INT NOT NULL DEFAULT 60;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_max_advance_days INT NOT NULL DEFAULT 30;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_min_advance_hours INT NOT NULL DEFAULT 2;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_occasions JSON NULL;

-- 13.2 Tabla de reservas
CREATE TABLE IF NOT EXISTS rb_reservations (
    id                  VARCHAR(36) PRIMARY KEY,
    tenant_id           VARCHAR(36) NOT NULL,
    table_id            VARCHAR(36) NULL,
    reservation_number  VARCHAR(20) NOT NULL,
    customer_name       VARCHAR(255) NOT NULL,
    customer_phone      VARCHAR(50) NOT NULL,
    customer_email      VARCHAR(255) NULL,
    reservation_date    DATE NOT NULL,
    reservation_time    TIME NOT NULL,
    guests_count        INT NOT NULL DEFAULT 2,
    occasion            VARCHAR(100) NULL,
    notes               TEXT NULL,
    pre_order_items     JSON NULL,
    pre_order_notes     TEXT NULL,
    status              ENUM('pendiente','confirmada','cancelada','completada','no_show') NOT NULL DEFAULT 'pendiente',
    rejection_reason    TEXT NULL,
    notified_whatsapp   TINYINT(1) NOT NULL DEFAULT 0,
    confirmed_at        TIMESTAMP NULL,
    cancelled_at        TIMESTAMP NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id)  REFERENCES rb_tables(id) ON DELETE SET NULL,
    INDEX idx_rb_res_tenant_status      (tenant_id, status),
    INDEX idx_rb_res_date               (tenant_id, reservation_date),
    INDEX idx_rb_res_table_date         (table_id, reservation_date),
    INDEX idx_rb_res_tenant_date_status (tenant_id, reservation_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13.3 Secuencia de numeración de reservas
CREATE TABLE IF NOT EXISTS rb_reservation_sequence (
    id             INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id      VARCHAR(36) NOT NULL,
    prefix         VARCHAR(10) NOT NULL DEFAULT 'R',
    current_number INT NOT NULL DEFAULT 0,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_rb_res_seq (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECCIÓN 14: AJUSTES DE RENDIMIENTO v3.3
-- ============================================================

-- 14.1 Índices compuestos en sales
ALTER TABLE sales
    ADD INDEX IF NOT EXISTS idx_sales_tenant_date (tenant_id, created_at),
    ADD INDEX IF NOT EXISTS idx_sales_tenant_status_date (tenant_id, status, created_at),
    ADD INDEX IF NOT EXISTS idx_sales_tenant_customer (tenant_id, customer_id);

-- 14.2 Índice compuesto en sale_items
ALTER TABLE sale_items
    ADD INDEX IF NOT EXISTS idx_sale_items_tenant_product (tenant_id, product_id);

-- 14.3 Índice compuesto en stock_movements
ALTER TABLE stock_movements
    ADD INDEX IF NOT EXISTS idx_stock_tenant_date (tenant_id, created_at);

-- 14.4 storefront_orders: índices compuestos con tenant_id
ALTER TABLE storefront_orders
    ADD INDEX IF NOT EXISTS idx_order_tenant_status (tenant_id, status),
    ADD INDEX IF NOT EXISTS idx_order_tenant_date (tenant_id, created_at);

-- 14.5 products: índices compuestos para storefront
ALTER TABLE products
    ADD INDEX IF NOT EXISTS idx_products_store (tenant_id, published_in_store),
    ADD INDEX IF NOT EXISTS idx_products_offer (tenant_id, is_on_offer),
    ADD INDEX IF NOT EXISTS idx_products_expiry (tenant_id, expiry_date),
    ADD INDEX IF NOT EXISTS idx_products_delivery (tenant_id, delivery_type);

-- 14.6 audit_log: índices compuestos
ALTER TABLE audit_log
    ADD INDEX IF NOT EXISTS idx_audit_tenant_date (tenant_id, created_at),
    ADD INDEX IF NOT EXISTS idx_audit_tenant_action (tenant_id, action);

-- 14.7 service_bookings: índice compuesto con tenant_id
ALTER TABLE service_bookings
    ADD INDEX IF NOT EXISTS idx_bookings_tenant_date (tenant_id, booking_date);

-- 14.8 Rellena sequences de RestBar para tenants existentes
INSERT IGNORE INTO rb_order_sequence (tenant_id, prefix, current_number)
    SELECT id, 'C', 0 FROM tenants;

INSERT IGNORE INTO rb_reservation_sequence (tenant_id, prefix, current_number)
    SELECT id, 'R', 0 FROM tenants;

INSERT IGNORE INTO store_announcement_bar (tenant_id, text, is_active)
    SELECT id, '', FALSE FROM tenants;

INSERT IGNORE INTO store_order_bump (tenant_id, is_enabled)
    SELECT id, FALSE FROM tenants;

INSERT IGNORE INTO chatbot_config (tenant_id, is_enabled)
    SELECT id, 0 FROM tenants;

-- ============================================================
-- SECCIÓN 15: MÓDULO PRE-ORDEN
-- Permite marcar productos como pre-orden con ventana temporal
-- y fecha estimada de envío
-- ============================================================

-- 15.1 products: campos de pre-orden
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_preorder          TINYINT(1)  NOT NULL DEFAULT 0
        COMMENT '1 = producto en pre-orden (no requiere stock para comprar)',
    ADD COLUMN IF NOT EXISTS preorder_window_end  DATETIME    NULL
        COMMENT 'Hasta cuándo acepta pre-órdenes (NULL = sin fecha límite)',
    ADD COLUMN IF NOT EXISTS preorder_ship_start  DATE        NULL
        COMMENT 'Inicio del rango de envío estimado',
    ADD COLUMN IF NOT EXISTS preorder_ship_end    DATE        NULL
        COMMENT 'Fin del rango de envío estimado',
    ADD COLUMN IF NOT EXISTS preorder_badge_text  VARCHAR(60) NOT NULL DEFAULT 'Pre-orden'
        COMMENT 'Texto del badge en la tienda',
    ADD COLUMN IF NOT EXISTS preorder_policy_text TEXT        NULL
        COMMENT 'Aviso legal / política de pre-orden mostrado al cliente';

-- Índice compuesto para el storefront (productos preorden activos)
ALTER TABLE products
    ADD INDEX IF NOT EXISTS idx_products_preorder (tenant_id, is_preorder);

-- 15.2 storefront_order_items: congela la promesa de envío al momento de compra
ALTER TABLE storefront_order_items
    ADD COLUMN IF NOT EXISTS is_preorder         TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = ítem era pre-orden al momento de comprar',
    ADD COLUMN IF NOT EXISTS preorder_ship_start DATE       NULL
        COMMENT 'Inicio del rango de envío prometido al cliente',
    ADD COLUMN IF NOT EXISTS preorder_ship_end   DATE       NULL
        COMMENT 'Fin del rango de envío prometido al cliente';

-- ============================================================
-- SECCIÓN 16: MÓDULO LIKES DE MENÚ PÚBLICO (v3.5)
-- Permite a clientes del menú digital dar "me gusta" a platillos.
-- El comerciante ve métricas de favoritos en el módulo RestBar.
-- ============================================================

DROP PROCEDURE IF EXISTS sp_migrate_menu_likes;
DELIMITER //
CREATE PROCEDURE sp_migrate_menu_likes()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_likes'
    ) THEN
        CREATE TABLE menu_likes (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT         NOT NULL
                COMMENT 'ID del producto/platillo',
            tenant_id  VARCHAR(36) NOT NULL
                COMMENT 'Tenant al que pertenece el platillo',
            device_id  VARCHAR(64) NOT NULL
                COMMENT 'Fingerprint del dispositivo del cliente (localStorage)',
            created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_device_product (device_id, product_id),
            INDEX idx_ml_product (product_id),
            INDEX idx_ml_tenant  (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Likes de clientes en el menú digital público';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_menu_likes();
DROP PROCEDURE IF EXISTS sp_migrate_menu_likes;

-- ============================================================
-- SECCIÓN 17: MÓDULO TAPICERÍA — ÓRDENES DE TRABAJO (v3.7)
-- ============================================================

DROP PROCEDURE IF EXISTS sp_migrate_workorders;
DELIMITER //
CREATE PROCEDURE sp_migrate_workorders()
BEGIN

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'tenants'
          AND COLUMN_NAME  = 'module_workorders'
    ) THEN
        ALTER TABLE tenants
          ADD COLUMN module_workorders TINYINT(1) NOT NULL DEFAULT 0
          COMMENT 'Módulo Tapicería/Órdenes de Trabajo habilitado';
    END IF;

    CREATE TABLE IF NOT EXISTS work_order_sequence (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id      VARCHAR(36) NOT NULL,
        prefix         VARCHAR(10) NOT NULL DEFAULT 'OT',
        current_number INT         NOT NULL DEFAULT 0,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE INDEX idx_wo_seq_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS work_orders (
        id               VARCHAR(36)   PRIMARY KEY,
        tenant_id        VARCHAR(36)   NOT NULL,
        order_number     VARCHAR(20)   NOT NULL,
        customer_id      VARCHAR(36)   NULL,
        customer_name    VARCHAR(255)  NOT NULL,
        customer_phone   VARCHAR(50)   NULL,
        item_description VARCHAR(500)  NOT NULL,
        item_type        VARCHAR(100)  NOT NULL DEFAULT 'vehiculo',
        job_type         VARCHAR(100)  NOT NULL DEFAULT 'tapizado_completo',
        fabric_description VARCHAR(300) NULL,
        quoted_price     DECIMAL(12,2) NOT NULL DEFAULT 0,
        advance_paid     DECIMAL(12,2) NOT NULL DEFAULT 0,
        received_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        promised_at      DATE          NULL,
        delivered_at     TIMESTAMP     NULL,
        status           ENUM('recibido','cotizado','aprobado','en_proceso','listo','entregado','cancelado')
                         NOT NULL DEFAULT 'recibido',
        notes            TEXT          NULL,
        assigned_to      VARCHAR(36)   NULL,
        sale_id          VARCHAR(36)   NULL,
        photos_in        JSON          NULL,
        photos_out       JSON          NULL,
        created_by       VARCHAR(36)   NULL,
        created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id)   REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id)   ON DELETE SET NULL,
        FOREIGN KEY (created_by)  REFERENCES users(id)   ON DELETE SET NULL,
        UNIQUE INDEX idx_wo_number        (tenant_id, order_number),
        INDEX        idx_wo_tenant_status (tenant_id, status),
        INDEX        idx_wo_promised      (tenant_id, promised_at),
        INDEX        idx_wo_customer      (tenant_id, customer_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS work_order_materials (
        id            INT           PRIMARY KEY AUTO_INCREMENT,
        tenant_id     VARCHAR(36)   NOT NULL,
        work_order_id VARCHAR(36)   NOT NULL,
        product_id    VARCHAR(36)   NULL,
        product_name  VARCHAR(255)  NOT NULL,
        quantity      DECIMAL(10,3) NOT NULL DEFAULT 1,
        unit          VARCHAR(50)   NOT NULL DEFAULT 'unidad',
        unit_cost     DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
        notes         TEXT          NULL,
        created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        INDEX idx_wo_mat_order (work_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS work_order_payments (
        id             INT           PRIMARY KEY AUTO_INCREMENT,
        tenant_id      VARCHAR(36)   NOT NULL,
        work_order_id  VARCHAR(36)   NOT NULL,
        amount         DECIMAL(12,2) NOT NULL,
        payment_method ENUM('efectivo','tarjeta','transferencia','nequi','otro')
                       NOT NULL DEFAULT 'efectivo',
        notes          TEXT          NULL,
        received_by    VARCHAR(36)   NULL,
        created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (received_by)   REFERENCES users(id)       ON DELETE SET NULL,
        INDEX idx_wo_pay_order  (work_order_id),
        INDEX idx_wo_pay_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

END //
DELIMITER ;
CALL sp_migrate_workorders();
DROP PROCEDURE IF EXISTS sp_migrate_workorders;

-- ============================================================
-- FIN DE MIGRACIÓN CONSOLIDADA
-- ============================================================
