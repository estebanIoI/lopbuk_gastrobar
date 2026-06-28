-- ============================================
-- MIGRACIÓN 001: Módulo Flota (Fleet)
-- Ferretería - Gestión de vehículos de despacho
-- ============================================

USE stockpro_db;

-- 1. Agregar rol 'despachador' a users
ALTER TABLE users
    MODIFY COLUMN role ENUM(
        'superadmin', 'comerciante', 'vendedor', 'cliente',
        'repartidor', 'auxiliar_bodega', 'administrador_rb',
        'cajero', 'mesero', 'cocinero', 'bartender', 'despachador'
    ) NOT NULL DEFAULT 'vendedor';

-- ============================================
-- TABLA: fleet_vehicles (Vehículos de la flota)
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL COMMENT 'Nombre del vehículo (ej: Camión 1, Moto Roja)',
    plate VARCHAR(20) NULL COMMENT 'Placa del vehículo',
    type ENUM('planta', 'ligera', 'moto') NOT NULL DEFAULT 'ligera'
        COMMENT 'planta=carga pesada, ligera=carga media, moto=domicilio liviano',
    max_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 500.00 COMMENT 'Capacidad máxima de carga en kg',
    status ENUM('disponible', 'en_ruta', 'mantenimiento', 'inactivo') NOT NULL DEFAULT 'disponible',
    year INT NULL COMMENT 'Año del vehículo',
    brand VARCHAR(50) NULL COMMENT 'Marca del vehículo',
    model VARCHAR(50) NULL COMMENT 'Modelo del vehículo',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_fleet_tenant (tenant_id),
    INDEX idx_fleet_status (status),
    INDEX idx_fleet_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: fleet_maintenance (Mantenimientos de vehículos)
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_maintenance (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    vehicle_id VARCHAR(36) NOT NULL,
    type ENUM('preventivo', 'correctivo', 'revision') NOT NULL DEFAULT 'preventivo',
    description TEXT NOT NULL COMMENT 'Descripción del mantenimiento',
    scheduled_date DATE NULL COMMENT 'Fecha programada',
    completed_date DATE NULL COMMENT 'Fecha en que se completó',
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

-- ============================================
-- EXTENSIÓN: storefront_orders
-- Agregar campos de flota y despacho
-- ============================================
ALTER TABLE storefront_orders
    ADD COLUMN vehicle_id VARCHAR(36) NULL
        COMMENT 'Vehículo asignado para despacho' AFTER delivery_delivered_at,
    ADD COLUMN dispatch_status ENUM('pendiente','en_pista','cargado','despachado','entregado')
        NOT NULL DEFAULT 'pendiente'
        COMMENT 'Estado de despacho en pista' AFTER vehicle_id,
    ADD COLUMN total_weight_kg DECIMAL(10,3) NULL
        COMMENT 'Peso total del pedido en kg (calculado al crear)' AFTER dispatch_status,
    ADD COLUMN dispatch_notes TEXT NULL
        COMMENT 'Notas del despachador' AFTER total_weight_kg,
    ADD COLUMN dispatched_at TIMESTAMP NULL
        COMMENT 'Fecha/hora en que el vehículo salió de la pista' AFTER dispatch_notes,
    ADD INDEX idx_order_vehicle (vehicle_id),
    ADD INDEX idx_order_dispatch_status (dispatch_status);

-- FK separada para evitar error si fleet_vehicles no existe aún
ALTER TABLE storefront_orders
    ADD CONSTRAINT fk_order_fleet_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE SET NULL;

-- ============================================
-- EXTENSIÓN: sales (POS)
-- Agregar campos de flota para ventas presenciales con despacho
-- ============================================
ALTER TABLE sales
    ADD COLUMN vehicle_id VARCHAR(36) NULL
        COMMENT 'Vehículo asignado si requiere despacho' AFTER sede_id,
    ADD COLUMN dispatch_status ENUM('pendiente','en_pista','cargado','despachado','entregado')
        NOT NULL DEFAULT 'pendiente' AFTER vehicle_id,
    ADD COLUMN total_weight_kg DECIMAL(10,3) NULL
        COMMENT 'Peso total de la venta en kg' AFTER dispatch_status,
    ADD INDEX idx_sales_vehicle (vehicle_id);

ALTER TABLE sales
    ADD CONSTRAINT fk_sale_fleet_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE SET NULL;

-- ============================================
-- EXTENSIÓN: products
-- Agregar weight_unit para ferretería (el campo weight ya existe)
-- Se agrega un campo separado para el tipo de unidad del peso de ferretería
-- ============================================
ALTER TABLE products
    ADD COLUMN hardware_weight_unit ENUM('kg', 'ton', 'lb', 'g') NULL DEFAULT 'kg'
        COMMENT 'Unidad de peso para productos de ferretería' AFTER weight;
