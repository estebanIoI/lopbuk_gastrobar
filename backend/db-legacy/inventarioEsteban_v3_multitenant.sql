-- ============================================
-- BASE DE DATOS: StockPro Inventario Universal 3.0
-- Sistema Multi-Tenant con roles: superadmin, comerciante, vendedor
-- ============================================
-- ARQUITECTURA:
--   superadmin  → Dueño de la plataforma, gestiona comerciantes y ve todo
--   comerciante → Dueño de un negocio (tenant), gestiona su tienda
--   vendedor    → Empleado de un comerciante, opera dentro del tenant
--
-- Cada tabla de datos tiene tenant_id para aislamiento de datos
-- ============================================
--
-- HISTORIAL DE CAMBIOS INTEGRADOS:
--   v3.1 — Módulo Flota / Ferretería (ver documentación: migrations/001_fleet_module.sql)
--     · users.role: ampliado con auxiliar_bodega, administrador_rb, cajero,
--                   mesero, cocinero, bartender, despachador
--     · products: nuevo campo hardware_weight_unit (unidad de peso para ferretería)
--     · fleet_vehicles: nueva tabla — vehículos de despacho por tenant
--     · fleet_maintenance: nueva tabla — historial de mantenimientos
--     · sales: nuevos campos vehicle_id, dispatch_status, total_weight_kg
--     · storefront_orders: nuevos campos vehicle_id, dispatch_status,
--                           total_weight_kg, dispatch_notes, dispatched_at
-- ============================================

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS stockpro_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE stockpro_db;

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- TABLA: tenants (Negocios/Inquilinos)
-- Cada comerciante tiene un tenant que agrupa todos sus datos
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    business_type VARCHAR(100) NULL COMMENT 'ropa, tienda, farmacia, ferreteria, etc.',
    status ENUM('activo', 'suspendido', 'cancelado') NOT NULL DEFAULT 'activo',
    plan ENUM('basico', 'profesional', 'empresarial') NOT NULL DEFAULT 'basico',
    max_users INT NOT NULL DEFAULT 5,
    max_products INT NOT NULL DEFAULT 500,
    owner_id VARCHAR(36) NULL COMMENT 'Se actualiza despues de crear el usuario comerciante',
    bg_color VARCHAR(7) DEFAULT '#000000' COMMENT 'Color de fondo de la tienda',
    public_menu_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Menú público QR activado',
    trial_ends_at DATETIME NULL DEFAULT NULL COMMENT 'Fecha de expiración del período de prueba',
    -- Reservas online (módulo RestBar)
    reservations_enabled       TINYINT(1)  NOT NULL DEFAULT 0          COMMENT 'Reservas online activadas',
    reservations_whatsapp      VARCHAR(50) NULL                        COMMENT 'Número WhatsApp notificaciones (ej: 573001234567)',
    reservations_open_time     TIME        NOT NULL DEFAULT '12:00:00' COMMENT 'Hora de apertura para reservas',
    reservations_close_time    TIME        NOT NULL DEFAULT '22:00:00' COMMENT 'Hora de cierre para reservas',
    reservations_slot_minutes  INT         NOT NULL DEFAULT 60         COMMENT 'Duración de cada slot en minutos',
    reservations_max_advance_days  INT     NOT NULL DEFAULT 30         COMMENT 'Días máximos de anticipación',
    reservations_min_advance_hours INT     NOT NULL DEFAULT 2          COMMENT 'Horas mínimas de anticipación',
    reservations_occasions     JSON        NULL                        COMMENT '["Cumpleaños","Aniversario","Cena romántica"]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_status (status),
    INDEX idx_tenant_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: users (Usuarios del sistema)
-- Roles: superadmin, comerciante, vendedor
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NULL COMMENT 'NULL para superadmin',
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM(
        'superadmin', 'comerciante', 'vendedor', 'cliente', 'repartidor',
        'auxiliar_bodega', 'administrador_rb', 'cajero', 'mesero',
        'cocinero', 'bartender', 'despachador'
    ) NOT NULL DEFAULT 'vendedor',
    phone TEXT NULL COMMENT 'Teléfono del usuario (puede estar cifrado con AES-256)',
    avatar VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    can_login BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'FALSE = el empleado existe en el sistema pero no puede iniciar sesión (ej: empleados de aseo, bodega)',
    cargo_id VARCHAR(36) NULL COMMENT 'Cargo personalizado del empleado (FK a employee_cargos)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_users_tenant (tenant_id),
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: employee_cargos (Cargos/posiciones personalizadas por tenant)
-- El comerciante crea sus propios cargos (ej: Vendedor, Cajero, Auxiliar de Bodega)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_cargos (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_cargos_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FK circular: tenants.owner_id -> users.id
ALTER TABLE tenants ADD CONSTRAINT fk_tenant_owner
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- TABLA: platform_settings (Configuracion global de la plataforma)
-- ============================================
CREATE TABLE IF NOT EXISTS platform_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar color de fondo por defecto
INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES ('bg_color', '#000000');

-- ============================================
-- TABLA: store_info (Informacion de la tienda por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS store_info (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500) NULL,
    phone VARCHAR(50) NULL,
    tax_id VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    logo_url VARCHAR(500) NULL,
    schedule VARCHAR(500) NULL COMMENT 'Horario de atencion',
    location_map_url VARCHAR(500) NULL,
    terms_url TEXT NULL COMMENT 'Contenido de términos y condiciones (texto libre)',
    privacy_url TEXT NULL COMMENT 'Contenido de política de privacidad (texto libre)',
    shipping_terms TEXT NULL COMMENT 'Contenido de términos de envío (texto libre)',
    payment_methods TEXT NULL COMMENT 'Metodos de pago aceptados',
    social_instagram VARCHAR(255) NULL,
    social_facebook VARCHAR(255) NULL,
    social_tiktok VARCHAR(255) NULL,
    social_whatsapp VARCHAR(50) NULL,
    -- Ubicación del comercio (para filtrado por municipio)
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    department VARCHAR(100) NULL COMMENT 'Departamento del comercio (Colombia)',
    municipality VARCHAR(100) NULL COMMENT 'Municipio del comercio — filtra qué clientes ven domicilios',
    invoice_logo VARCHAR(500) NULL COMMENT 'URL del logo que aparece en la factura impresa',
    invoice_greeting VARCHAR(255) NULL DEFAULT '¡Gracias por su compra!' COMMENT 'Mensaje de agradecimiento al pie de la factura',
    invoice_policy TEXT NULL COMMENT 'Política de cambios y devoluciones al pie de la factura',
    invoice_copies TINYINT NOT NULL DEFAULT 1 COMMENT 'Copias a imprimir por factura: 1 o 2',
    -- Personalización de tienda online
    product_card_style VARCHAR(20) NULL DEFAULT 'style1' COMMENT 'Estilo de tarjeta: style1, style2',
    allow_contraentrega TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = permite pago contraentrega en checkout',
    online_discount_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = descuento online activado',
    -- Age gate
    age_gate_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = verificación de edad activada',
    age_gate_description TEXT NULL COMMENT 'Texto del aviso de verificación de edad',
    -- Página de contacto personalizada
    contact_page_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = página de contacto activa en storefront',
    contact_page_title VARCHAR(255) NULL COMMENT 'Título de la página de contacto',
    contact_page_description TEXT NULL COMMENT 'Texto de descripción de la página de contacto',
    contact_page_image VARCHAR(500) NULL COMMENT 'URL de imagen de la página de contacto',
    contact_page_products TEXT NULL COMMENT 'JSON: array de product IDs destacados en página de contacto',
    contact_page_links TEXT NULL COMMENT 'JSON: array de links en página de contacto',
    -- Módulo de información
    show_info_module TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = mostrar módulo de información en lugar de productos',
    info_module_description TEXT NULL COMMENT 'Descripción/texto libre del módulo de información',
    -- Carrito: mínimo de compra para domicilio con flota
    cart_min_purchase INT NOT NULL DEFAULT 0 COMMENT 'Monto mínimo en COP para mostrar barra de progreso y desbloquear domicilio. 0 = desactivado',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_store_tenant (tenant_id),
    INDEX idx_store_municipality (municipality)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: categories (Categorias de productos por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    image_url VARCHAR(500) NULL,
    hidden_in_store TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Visible en POS/inventario (1=activa, 0=oculta)',
    color VARCHAR(7) NULL COMMENT 'Color hex de la categoría: "#6366f1"',
    sort_order INT NOT NULL DEFAULT 0 COMMENT 'Orden de visualización ascendente',
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_category_tenant_name (tenant_id, name),
    INDEX idx_category_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: sedes (Sucursales por tenant)
-- ============================================
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

-- ============================================
-- TABLA: suppliers (Proveedores por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(200) NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    address TEXT NULL,
    city VARCHAR(100) NULL,
    country VARCHAR(100) DEFAULT 'Colombia',
    tax_id VARCHAR(50) NULL,
    payment_terms VARCHAR(100) NULL,
    notes TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_supplier_tenant (tenant_id),
    INDEX idx_supplier_name (name),
    INDEX idx_supplier_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: products (Productos - Universal, por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL COMMENT 'Nombre visible en la tienda online',
    articulo VARCHAR(255) NULL COMMENT 'Nombre interno de inventario (si es NULL se usa name)',
    category VARCHAR(50) NOT NULL,

    -- Tipo de producto
    product_type ENUM(
        'general', 'alimentos', 'bebidas', 'ropa', 'electronica',
        'farmacia', 'ferreteria', 'libreria', 'juguetes', 'cosmetica',
        'perfumes', 'deportes', 'hogar', 'mascotas', 'otros'
    ) NOT NULL DEFAULT 'general',

    -- Campos comunes
    brand VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    description TEXT NULL,
    purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    sale_price DECIMAL(12, 2) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    barcode VARCHAR(100) DEFAULT NULL,
    stock INT NOT NULL DEFAULT 0,
    reorder_point INT NOT NULL DEFAULT 5,
    supplier VARCHAR(255) NULL,
    supplier_id VARCHAR(50) NULL,
    entry_date DATE NOT NULL,
    image_url VARCHAR(500) NULL,
    image_urls JSON NULL COMMENT 'Galería de hasta 4 imágenes/GIFs del producto',
    location_in_store VARCHAR(100) NULL,
    notes TEXT NULL,
    tags JSON NULL,

    -- Campos ALIMENTOS / BEBIDAS / FARMACIA / COSMETICA / MASCOTAS
    expiry_date DATE NULL,
    batch_number VARCHAR(50) NULL,
    net_weight DECIMAL(10,3) NULL,
    weight_unit ENUM('g', 'kg', 'ml', 'l', 'oz', 'lb', 'unidad') NULL,
    sanitary_registration VARCHAR(100) NULL,
    storage_temperature VARCHAR(50) NULL,
    ingredients TEXT NULL,
    nutritional_info TEXT NULL,
    alcohol_content DECIMAL(5,2) NULL,
    allergens TEXT NULL,

    -- Campos ROPA / DEPORTES
    size VARCHAR(20) NULL,
    color VARCHAR(50) NULL,
    material VARCHAR(100) NULL,
    gender ENUM('hombre', 'mujer', 'unisex', 'niño', 'niña') NULL,
    season ENUM('verano', 'invierno', 'primavera', 'otoño', 'todo_año') NULL,
    garment_type VARCHAR(50) NULL,
    washing_instructions TEXT NULL,
    country_of_origin VARCHAR(50) NULL,

    -- Campos ELECTRONICA
    serial_number VARCHAR(100) NULL,
    warranty_months INT NULL,
    technical_specs TEXT NULL,
    voltage VARCHAR(20) NULL,
    power_watts INT NULL,
    compatibility TEXT NULL,
    includes_accessories TEXT NULL,
    product_condition ENUM('nuevo', 'reacondicionado', 'usado', 'exhibición') DEFAULT 'nuevo',

    -- Campos FARMACIA
    active_ingredient VARCHAR(200) NULL,
    concentration VARCHAR(50) NULL,
    requires_prescription BOOLEAN DEFAULT FALSE,
    administration_route VARCHAR(50) NULL,
    presentation VARCHAR(50) NULL,
    units_per_package INT NULL,
    laboratory VARCHAR(100) NULL,
    contraindications TEXT NULL,

    -- Campos FERRETERIA
    dimensions VARCHAR(50) NULL,
    weight DECIMAL(10,3) NULL,
    hardware_weight_unit ENUM('kg', 'ton', 'lb', 'g') NULL DEFAULT 'kg'
        COMMENT 'Unidad de peso para productos de ferretería',
    caliber VARCHAR(20) NULL,
    resistance VARCHAR(50) NULL,
    finish VARCHAR(50) NULL,
    recommended_use TEXT NULL,

    -- Campos LIBRERIA
    author VARCHAR(200) NULL,
    publisher VARCHAR(100) NULL,
    isbn VARCHAR(20) NULL,
    pages INT NULL,
    language VARCHAR(50) NULL,
    publication_year INT NULL,
    edition VARCHAR(50) NULL,
    book_format ENUM('pasta_dura', 'pasta_blanda', 'digital', 'audio') NULL,

    -- Campos JUGUETES
    recommended_age VARCHAR(50) NULL,
    number_of_players VARCHAR(20) NULL,
    game_type VARCHAR(50) NULL,
    requires_batteries BOOLEAN NULL,
    package_dimensions VARCHAR(50) NULL,
    package_contents TEXT NULL,
    safety_warnings TEXT NULL,

    -- Storefront / Tienda Online
    published_in_store BOOLEAN NOT NULL DEFAULT FALSE,
    available_for_delivery BOOLEAN NOT NULL DEFAULT FALSE,
    -- Tipo de entrega del producto publicado en tienda
    -- domicilio = solo visible para clientes del mismo municipio del comercio
    -- envio     = visible para todos (envío nacional)
    -- ambos     = domicilio local + envío nacional (visible para todos)
    delivery_type ENUM('domicilio','envio','ambos') NULL DEFAULT NULL
        COMMENT 'NULL=sin configurar (se muestra a todos), domicilio=solo mismo municipio, envio/ambos=todos',
    is_new_launch BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Marcado como nuevo lanzamiento en la tienda',
    launch_date DATE NULL COMMENT 'Fecha de lanzamiento del producto',

    -- Pre-orden
    is_preorder         TINYINT(1)  NOT NULL DEFAULT 0     COMMENT '1 = producto en modo pre-orden',
    preorder_window_end DATETIME    NULL                   COMMENT 'Cierre del período de pre-orden',
    preorder_ship_start DATE        NULL                   COMMENT 'Inicio estimado de envío',
    preorder_ship_end   DATE        NULL                   COMMENT 'Fin estimado de envío',
    preorder_badge_text VARCHAR(60) NOT NULL DEFAULT 'Pre-orden' COMMENT 'Texto del badge en tienda',
    preorder_policy_text TEXT       NULL                   COMMENT 'Política de pre-orden (HTML/markdown)',

    -- Ofertas
    is_on_offer BOOLEAN NOT NULL DEFAULT FALSE,
    offer_price DECIMAL(12, 2) NULL,
    offer_label VARCHAR(100) NULL COMMENT 'Etiqueta personalizada de oferta',
    offer_start DATETIME NULL,
    offer_end DATETIME NULL,

    -- Sede/Sucursal
    sede_id VARCHAR(36) NULL COMMENT 'Sede a la que pertenece el producto (NULL = todas las sedes)',

    -- Auditoria
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NULL,
    updated_by VARCHAR(50) NULL,

    -- Indices
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    UNIQUE INDEX idx_product_tenant_sku (tenant_id, sku),
    UNIQUE INDEX idx_product_tenant_barcode (tenant_id, barcode),
    INDEX idx_product_tenant (tenant_id),
    INDEX idx_category (category),
    -- Compuestos para las rutas más frecuentes del storefront y del inventario
    INDEX idx_products_store (tenant_id, published_in_store),
    INDEX idx_products_offer (tenant_id, is_on_offer),
    INDEX idx_products_expiry (tenant_id, expiry_date),
    INDEX idx_products_delivery (tenant_id, delivery_type),
    INDEX idx_products_preorder (tenant_id, is_preorder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: customers (Clientes por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    cedula VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    address VARCHAR(500) NULL,
    credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_customer_tenant_cedula (tenant_id, cedula),
    INDEX idx_customer_tenant (tenant_id),
    INDEX idx_customers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: fleet_vehicles (Vehículos de la flota)
-- Módulo Ferretería — Gestión de despacho por peso
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL COMMENT 'Nombre del vehículo (ej: Camión 1, Moto Roja)',
    plate VARCHAR(20) NULL COMMENT 'Placa del vehículo',
    type ENUM('planta', 'ligera', 'moto') NOT NULL DEFAULT 'ligera'
        COMMENT 'planta=carga pesada >500kg, ligera=carga media 50-500kg, moto=domicilio <50kg',
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
-- TABLA: sales (Ventas por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    invoice_number VARCHAR(20) NOT NULL,
    customer_id VARCHAR(36) NULL,
    customer_name VARCHAR(255) NULL,
    customer_phone VARCHAR(50) NULL,
    customer_email VARCHAR(255) NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL,
    payment_method ENUM('efectivo', 'tarjeta', 'transferencia', 'fiado', 'addi', 'sistecredito', 'mixto') NOT NULL,
    amount_paid DECIMAL(12, 2) NOT NULL,
    change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    seller_id VARCHAR(36) NULL,
    seller_name VARCHAR(255) NOT NULL,
    cash_session_id VARCHAR(36) NULL,
    status ENUM('completada', 'anulada') NOT NULL DEFAULT 'completada',
    credit_status ENUM('pendiente', 'parcial', 'pagado') DEFAULT NULL,
    due_date DATE NULL,
    notes TEXT NULL,
    -- Pago mixto
    mixed_efectivo_amount DECIMAL(12,2) NULL COMMENT 'Pago mixto: monto en efectivo',
    mixed_second_method VARCHAR(30) NULL COMMENT 'Pago mixto: segundo método (tarjeta, transferencia, nequi…)',
    mixed_second_amount DECIMAL(12,2) NULL COMMENT 'Pago mixto: monto del segundo método',
    -- Sede/Sucursal
    sede_id VARCHAR(36) NULL COMMENT 'Sede donde se realizó la venta (NULL = sede única)',
    -- Flota / Despacho (Ferretería)
    vehicle_id VARCHAR(36) NULL COMMENT 'Vehículo asignado si requiere despacho',
    dispatch_status ENUM('pendiente','en_pista','cargado','despachado','entregado') NOT NULL DEFAULT 'pendiente',
    total_weight_kg DECIMAL(10,3) NULL COMMENT 'Peso total de la venta en kg',
    -- Offline-first sync
    synced TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 = pendiente de subir a la nube',
    synced_at TIMESTAMP NULL COMMENT 'Fecha en que se sincronizó con la nube',
    origin ENUM('local','cloud') NOT NULL DEFAULT 'cloud' COMMENT 'Origen del registro: local (offline) o cloud',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
    UNIQUE INDEX idx_sale_tenant_invoice (tenant_id, invoice_number),
    INDEX idx_sales_tenant_date (tenant_id, created_at),
    INDEX idx_sales_tenant_status_date (tenant_id, status, created_at),
    INDEX idx_sales_tenant_customer (tenant_id, customer_id),
    INDEX idx_sale_tenant (tenant_id),
    INDEX idx_invoice (invoice_number),
    INDEX idx_status (status),
    INDEX idx_created (created_at),
    INDEX idx_sales_credit_status (credit_status),
    INDEX idx_sales_payment_method (payment_method),
    INDEX idx_sales_due_date (due_date),
    INDEX idx_sales_synced (synced),
    INDEX idx_sales_sede_id (sede_id),
    INDEX idx_sales_vehicle (vehicle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: sale_items (Items de cada venta)
-- ============================================
CREATE TABLE IF NOT EXISTS sale_items (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    sale_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_sale_items_tenant (tenant_id),
    INDEX idx_sale (sale_id),
    INDEX idx_product (product_id),
    INDEX idx_sale_items_tenant_product (tenant_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: product_recipes (Recetas BOM - Productos Compuestos)
-- Permite definir insumos necesarios para armar un producto terminado
-- Ejemplo: Perfume 100ML = 43 Extracto + 1 Envase 100 + 1 Caja 100
-- ============================================
CREATE TABLE IF NOT EXISTS product_recipes (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    ingredient_id VARCHAR(36) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_recipe_product (product_id),
    INDEX idx_recipe_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: stock_movements (Movimientos de stock)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    type ENUM('entrada', 'salida', 'ajuste', 'venta', 'devolucion') NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reason VARCHAR(255) NULL,
    reference_id VARCHAR(36) NULL,
    user_id VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_stock_tenant (tenant_id),
    INDEX idx_stock_product (product_id),
    INDEX idx_stock_type (type),
    INDEX idx_stock_created (created_at),
    INDEX idx_stock_tenant_date (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: purchase_invoices (Facturas de Compra a proveedores)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    invoice_number VARCHAR(100) NOT NULL,
    supplier_id VARCHAR(50) NULL,
    supplier_name VARCHAR(200) NOT NULL,
    purchase_date DATE NOT NULL,
    document_type ENUM('factura','remision','orden_compra','nota_credito') NOT NULL DEFAULT 'factura',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method ENUM('efectivo','tarjeta','transferencia','credito','nequi','daviplata','credito_proveedor','mixto') NOT NULL DEFAULT 'efectivo',
    payment_status ENUM('pagado','pendiente','parcial') NOT NULL DEFAULT 'pagado',
    due_date DATE NULL,
    file_url VARCHAR(500) NULL,
    notes TEXT NULL,
    mixed_efectivo_amount DECIMAL(12,2) NULL COMMENT 'Pago mixto: monto en efectivo',
    mixed_transferencia_amount DECIMAL(12,2) NULL COMMENT 'Pago mixto: monto en transferencia',
    created_by VARCHAR(50) NULL,
    -- Offline-first sync
    synced TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 = pendiente de subir a la nube',
    synced_at TIMESTAMP NULL COMMENT 'Fecha en que se sincronizó con la nube',
    origin ENUM('local','cloud') NOT NULL DEFAULT 'cloud' COMMENT 'Origen del registro: local (offline) o cloud',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_purchase_invoices_tenant (tenant_id),
    INDEX idx_purchase_invoices_date (purchase_date),
    INDEX idx_purchase_invoices_supplier (supplier_id),
    INDEX idx_purchase_invoices_status (tenant_id, payment_status),
    INDEX idx_purchases_synced (synced)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: purchase_invoice_items (Items de Factura de Compra)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    invoice_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    product_sku VARCHAR(100) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL,
    sale_price DECIMAL(12,2) NULL COMMENT 'Precio de venta del producto al momento de la compra',
    subtotal DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_purchase_items_invoice (invoice_id),
    INDEX idx_purchase_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: invoice_sequence (Secuencia de facturas por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_sequence (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL,
    prefix VARCHAR(10) NOT NULL DEFAULT 'FAC',
    current_number INT NOT NULL DEFAULT 0,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_invoice_seq_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: credit_payments (Abonos a creditos)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_payments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    sale_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method ENUM('efectivo', 'tarjeta', 'transferencia') NOT NULL,
    receipt_number VARCHAR(20) NULL,
    notes TEXT NULL,
    received_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_credit_payments_tenant (tenant_id),
    INDEX idx_credit_payments_sale (sale_id),
    INDEX idx_credit_payments_customer (customer_id),
    INDEX idx_credit_payments_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: payment_receipt_sequence (Secuencia de recibos por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_receipt_sequence (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL,
    prefix VARCHAR(10) NOT NULL DEFAULT 'REC',
    current_number INT NOT NULL DEFAULT 0,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_receipt_seq_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: store_locations (Ubicaciones en tienda por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS store_locations (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    zone VARCHAR(50) NULL,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_location_tenant_code (tenant_id, code),
    INDEX idx_location_tenant (tenant_id),
    INDEX idx_location_zone (zone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: product_alerts (Alertas de productos)
-- ============================================
CREATE TABLE IF NOT EXISTS product_alerts (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    alert_type ENUM('vencimiento', 'stock_bajo', 'garantia_proxima', 'reorden', 'otro') NOT NULL,
    alert_date DATE NOT NULL,
    priority ENUM('baja', 'media', 'alta', 'critica') DEFAULT 'media',
    message TEXT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(50) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_alert_tenant (tenant_id),
    INDEX idx_alert_date (alert_date, is_resolved),
    INDEX idx_alert_type (alert_type),
    INDEX idx_alert_priority (priority, is_resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: price_history (Historial de precios)
-- ============================================
CREATE TABLE IF NOT EXISTS price_history (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    old_cost_price DECIMAL(10,2) NULL,
    new_cost_price DECIMAL(10,2) NULL,
    old_sale_price DECIMAL(10,2) NULL,
    new_sale_price DECIMAL(10,2) NULL,
    reason VARCHAR(200) NULL,
    changed_by VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_price_tenant (tenant_id),
    INDEX idx_price_product_date (product_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: cash_sessions (Sesiones de caja por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS cash_sessions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    opened_by VARCHAR(36) NOT NULL,
    opened_by_name VARCHAR(255) NOT NULL,
    opening_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_by VARCHAR(36) NULL,
    closed_by_name VARCHAR(255) NULL,
    closed_at TIMESTAMP NULL,
    total_cash_sales DECIMAL(12, 2) NULL DEFAULT 0,
    total_card_sales DECIMAL(12, 2) NULL DEFAULT 0,
    total_transfer_sales DECIMAL(12, 2) NULL DEFAULT 0,
    total_fiado_sales DECIMAL(12, 2) NULL DEFAULT 0,
    total_sales_count INT NULL DEFAULT 0,
    total_change_given DECIMAL(12, 2) NULL DEFAULT 0,
    total_cash_entries DECIMAL(12, 2) NULL DEFAULT 0,
    total_cash_withdrawals DECIMAL(12, 2) NULL DEFAULT 0,
    total_credit_payments_efectivo DECIMAL(12,2) NULL DEFAULT 0 COMMENT 'Abonos a créditos recibidos en efectivo durante la sesión',
    total_credit_payments_tarjeta DECIMAL(12,2) NULL DEFAULT 0 COMMENT 'Abonos a créditos recibidos en tarjeta durante la sesión',
    total_credit_payments_transfer DECIMAL(12,2) NULL DEFAULT 0 COMMENT 'Abonos a créditos recibidos en transferencia durante la sesión',
    expected_cash DECIMAL(12, 2) NULL,
    actual_cash DECIMAL(12, 2) NULL,
    difference DECIMAL(12, 2) NULL,
    status ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
    closing_status ENUM('cuadrado', 'sobrante', 'faltante') NULL,
    observations TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_cash_session_tenant (tenant_id),
    INDEX idx_cash_session_status (status),
    INDEX idx_cash_session_opened (opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: cash_movements (Entradas/Salidas de caja)
-- ============================================
CREATE TABLE IF NOT EXISTS cash_movements (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    type ENUM('entrada', 'salida') NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    notes TEXT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_cash_movement_tenant (tenant_id),
    INDEX idx_cash_movement_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: audit_log (Registro de actividad - para superadmin)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NULL,
    user_id VARCHAR(36) NULL,
    user_email VARCHAR(255) NULL,
    action VARCHAR(100) NOT NULL COMMENT 'login, create_product, delete_sale, etc.',
    entity_type VARCHAR(50) NULL COMMENT 'product, sale, user, tenant, etc.',
    entity_id VARCHAR(36) NULL,
    details JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
    INDEX idx_audit_tenant (tenant_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_date (created_at),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_tenant_date (tenant_id, created_at),
    INDEX idx_audit_tenant_action (tenant_id, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: discount_coupons (Cupones de descuento por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS discount_coupons (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    discount_type ENUM('porcentaje', 'fijo') NOT NULL DEFAULT 'porcentaje',
    discount_value DECIMAL(12, 2) NOT NULL,
    min_purchase DECIMAL(12, 2) NULL COMMENT 'Compra mínima requerida',
    max_uses INT NULL COMMENT 'NULL = ilimitado',
    times_used INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP NULL COMMENT 'NULL = sin expiración',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_coupon_tenant_code (tenant_id, code),
    INDEX idx_coupon_tenant (tenant_id),
    INDEX idx_coupon_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: services (Catálogo de servicios por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS services (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    category VARCHAR(100) NULL,
    service_type ENUM('cita', 'asesoria', 'contacto') NOT NULL DEFAULT 'cita',
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    price_type ENUM('fijo', 'desde', 'gratis', 'cotizacion') NOT NULL DEFAULT 'fijo',
    duration_minutes INT NULL COMMENT 'Solo para tipo cita',
    image_url VARCHAR(500) NULL,
    requires_payment BOOLEAN NOT NULL DEFAULT FALSE,
    max_advance_days INT NOT NULL DEFAULT 30 COMMENT 'Días máx de anticipación para reservar',
    cancellation_hours INT NOT NULL DEFAULT 24 COMMENT 'Horas mín para cancelar',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_published BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Visible en storefront público',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_services_tenant (tenant_id),
    INDEX idx_services_published (tenant_id, is_published),
    INDEX idx_services_type (service_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: service_availability (Horarios semanales recurrentes)
-- ============================================
CREATE TABLE IF NOT EXISTS service_availability (
    id VARCHAR(50) PRIMARY KEY,
    service_id VARCHAR(50) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    day_of_week TINYINT NOT NULL COMMENT '0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT NOT NULL DEFAULT 30,
    max_simultaneous INT NOT NULL DEFAULT 1 COMMENT 'Citas paralelas por slot',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_availability_service (service_id),
    INDEX idx_availability_day (service_id, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: service_blocked_periods (Fechas/horas bloqueadas)
-- ============================================
CREATE TABLE IF NOT EXISTS service_blocked_periods (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    service_id VARCHAR(50) NULL COMMENT 'NULL = bloquea todos los servicios del tenant',
    blocked_date DATE NOT NULL,
    start_time TIME NULL COMMENT 'NULL = día completo bloqueado',
    end_time TIME NULL,
    reason VARCHAR(200) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    INDEX idx_blocked_tenant_date (tenant_id, blocked_date),
    INDEX idx_blocked_service_date (service_id, blocked_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: service_bookings (Reservas y leads de servicios)
-- ============================================
CREATE TABLE IF NOT EXISTS service_bookings (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    service_id VARCHAR(50) NOT NULL,
    service_name VARCHAR(200) NOT NULL,
    booking_type ENUM('cita', 'asesoria', 'contacto') NOT NULL,
    -- Información del cliente
    client_name VARCHAR(200) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    client_email VARCHAR(100) NULL,
    client_notes TEXT NULL,
    -- Para citas (booking_type = 'cita')
    booking_date DATE NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    -- Para asesoría (booking_type = 'asesoria')
    preferred_date_range VARCHAR(200) NULL,
    project_description TEXT NULL,
    budget_range VARCHAR(100) NULL,
    -- Estado
    status ENUM('pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio') NOT NULL DEFAULT 'pendiente',
    payment_status ENUM('sin_pago', 'pendiente', 'pagado') NOT NULL DEFAULT 'sin_pago',
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    merchant_notes TEXT NULL COMMENT 'Notas internas del comerciante',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
    INDEX idx_bookings_tenant (tenant_id),
    INDEX idx_bookings_service (service_id),
    INDEX idx_bookings_date (tenant_id, booking_date),
    INDEX idx_bookings_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: product_reviews (Reseñas de productos del storefront)
-- ============================================
CREATE TABLE IF NOT EXISTS product_reviews (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    reviewer_name VARCHAR(200) NOT NULL,
    reviewer_email VARCHAR(200) NULL,
    rating TINYINT NOT NULL DEFAULT 5 COMMENT '1-5 estrellas',
    title VARCHAR(200) NULL,
    body TEXT NULL,
    image_url_1 VARCHAR(500) NULL,
    image_url_2 VARCHAR(500) NULL,
    status ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
    reply TEXT NULL COMMENT 'Respuesta del comerciante',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_reviews_tenant (tenant_id),
    INDEX idx_reviews_product (product_id),
    INDEX idx_reviews_status (tenant_id, status),
    CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DATOS INICIALES
-- ============================================

-- 1. Usuario superadmin (sin tenant)
-- Password: superadmin123 (hash bcrypt)
INSERT INTO users (id, tenant_id, email, password, name, role, is_active) VALUES
('usr-superadmin-001', NULL, 'superadmin@stockpro.com', '$2a$10$0IZ8BSUNFt48w2LMZjmT8uc.rfa3lU4HPJqmaLfDMKpKzR/G3Hx0W', 'Super Administrador', 'superadmin', TRUE);

-- 2. Tenant demo: Tienda de Ropa
INSERT INTO tenants (id, name, slug, business_type, status, plan, max_users, max_products) VALUES
('tenant-demo-001', 'Tienda de Ropa Demo', 'tienda-ropa-demo', 'ropa', 'activo', 'profesional', 10, 1000);

-- 3. Usuario comerciante (dueño del tenant demo)
-- Password: admin123
INSERT INTO users (id, tenant_id, email, password, name, role, is_active) VALUES
('usr-comerciante-001', 'tenant-demo-001', 'comerciante@stockpro.com', '$2a$10$0IZ8BSUNFt48w2LMZjmT8uc.rfa3lU4HPJqmaLfDMKpKzR/G3Hx0W', 'Comerciante Demo', 'comerciante', TRUE);

-- Actualizar owner del tenant
UPDATE tenants SET owner_id = 'usr-comerciante-001' WHERE id = 'tenant-demo-001';

-- 4. Usuario vendedor del tenant demo
-- Password: admin123
INSERT INTO users (id, tenant_id, email, password, name, role, is_active) VALUES
('usr-vendedor-001', 'tenant-demo-001', 'vendedor@stockpro.com', '$2a$10$0IZ8BSUNFt48w2LMZjmT8uc.rfa3lU4HPJqmaLfDMKpKzR/G3Hx0W', 'Vendedor Demo', 'vendedor', TRUE);

-- 5. Info de la tienda del tenant demo
INSERT INTO store_info (tenant_id, name, address, phone, tax_id, email) VALUES
('tenant-demo-001', 'Tienda de Ropa Demo', 'Calle Principal #123, Centro Comercial Plaza', '+57 300 123 4567', '900.123.456-7', 'contacto@stockpro.com');

-- ============================================
-- VISTAS UTILES (tenant-aware)
-- ============================================

-- Vista de productos con estado de stock
CREATE OR REPLACE VIEW v_products_stock_status AS
SELECT
    p.*,
    CASE
        WHEN p.stock = 0 THEN 'agotado'
        WHEN p.stock <= p.reorder_point THEN 'bajo'
        ELSE 'suficiente'
    END AS stock_status
FROM products p;

-- Vista de ventas con detalle
CREATE OR REPLACE VIEW v_sales_detail AS
SELECT
    s.*,
    COUNT(si.id) AS total_items,
    SUM(si.quantity) AS total_quantity
FROM sales s
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id;

-- Vista de productos proximos a vencer
CREATE OR REPLACE VIEW v_products_expiring_soon AS
SELECT
    p.*,
    c.name as category_name,
    DATEDIFF(p.expiry_date, CURDATE()) as days_until_expiry
FROM products p
LEFT JOIN categories c ON p.category = c.id AND p.tenant_id = c.tenant_id
WHERE p.expiry_date IS NOT NULL
  AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
  AND p.expiry_date >= CURDATE()
ORDER BY p.expiry_date ASC;

-- Vista de productos con stock bajo
CREATE OR REPLACE VIEW v_products_low_stock AS
SELECT
    p.*,
    c.name as category_name
FROM products p
LEFT JOIN categories c ON p.category = c.id AND p.tenant_id = c.tenant_id
WHERE p.stock <= p.reorder_point
  AND p.stock >= 0
ORDER BY (p.stock - p.reorder_point) ASC;

-- Vista de saldos de clientes
-- Reescrita con LEFT JOIN para eliminar 3 subconsultas correlacionadas (O(N) → O(1))
CREATE OR REPLACE VIEW v_customer_balances AS
SELECT
    c.id AS customer_id,
    c.tenant_id,
    c.cedula,
    c.name AS customer_name,
    c.phone,
    c.email,
    c.address,
    c.credit_limit,
    c.notes,
    COALESCE(s_agg.total_credit, 0)                                    AS total_credit,
    COALESCE(cp_agg.total_paid, 0)                                     AS total_paid,
    COALESCE(s_agg.total_credit, 0) - COALESCE(cp_agg.total_paid, 0)  AS balance,
    c.created_at,
    c.updated_at
FROM customers c
LEFT JOIN (
    SELECT customer_id, SUM(total) AS total_credit
    FROM sales
    WHERE payment_method = 'fiado' AND status = 'completada'
    GROUP BY customer_id
) s_agg ON s_agg.customer_id = c.id
LEFT JOIN (
    SELECT customer_id, SUM(amount) AS total_paid
    FROM credit_payments
    GROUP BY customer_id
) cp_agg ON cp_agg.customer_id = c.id;

-- ============================================
-- VISTA PARA SUPERADMIN: Resumen de todos los tenants
-- Reescrita con LEFT JOINs agrupados para eliminar 6 subconsultas correlacionadas
-- ============================================
CREATE OR REPLACE VIEW v_tenants_summary AS
SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug,
    t.business_type,
    t.status,
    t.plan,
    t.created_at,
    u.name AS owner_name,
    u.email AS owner_email,
    COALESCE(usr_agg.total_users, 0)          AS total_users,
    COALESCE(prod_agg.total_products, 0)      AS total_products,
    COALESCE(prod_agg.inventory_value, 0)     AS inventory_value,
    COALESCE(cust_agg.total_customers, 0)     AS total_customers,
    COALESCE(sale_agg.total_sales_count, 0)   AS total_sales_count,
    COALESCE(sale_agg.total_sales_amount, 0)  AS total_sales_amount
FROM tenants t
LEFT JOIN users u ON t.owner_id = u.id
LEFT JOIN (
    SELECT tenant_id, COUNT(*) AS total_users
    FROM users
    GROUP BY tenant_id
) usr_agg ON usr_agg.tenant_id = t.id
LEFT JOIN (
    SELECT tenant_id,
           COUNT(*) AS total_products,
           SUM(stock * sale_price) AS inventory_value
    FROM products
    GROUP BY tenant_id
) prod_agg ON prod_agg.tenant_id = t.id
LEFT JOIN (
    SELECT tenant_id, COUNT(*) AS total_customers
    FROM customers
    GROUP BY tenant_id
) cust_agg ON cust_agg.tenant_id = t.id
LEFT JOIN (
    SELECT tenant_id,
           COUNT(*) AS total_sales_count,
           SUM(total) AS total_sales_amount
    FROM sales
    WHERE status = 'completada'
    GROUP BY tenant_id
) sale_agg ON sale_agg.tenant_id = t.id;

-- ============================================
-- PROCEDIMIENTOS ALMACENADOS (tenant-aware)
-- ============================================

DELIMITER //

-- Generar numero de factura por tenant
CREATE PROCEDURE sp_generate_invoice_number(IN p_tenant_id VARCHAR(36), OUT new_invoice VARCHAR(20))
BEGIN
    DECLARE current_num INT;
    DECLARE prefix_val VARCHAR(10);

    SELECT current_number, prefix INTO current_num, prefix_val
    FROM invoice_sequence
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

    SET current_num = current_num + 1;

    UPDATE invoice_sequence SET current_number = current_num WHERE tenant_id = p_tenant_id;

    SET new_invoice = CONCAT(prefix_val, '-', LPAD(current_num, 5, '0'));
END //

-- Registrar movimiento de stock por tenant
CREATE PROCEDURE sp_register_stock_movement(
    IN p_tenant_id VARCHAR(36),
    IN p_product_id VARCHAR(36),
    IN p_type VARCHAR(20),
    IN p_quantity INT,
    IN p_reason VARCHAR(255),
    IN p_reference_id VARCHAR(36),
    IN p_user_id VARCHAR(36)
)
BEGIN
    DECLARE v_previous_stock INT;
    DECLARE v_new_stock INT;
    DECLARE v_movement_id VARCHAR(36);

    SELECT stock INTO v_previous_stock FROM products WHERE id = p_product_id AND tenant_id = p_tenant_id FOR UPDATE;

    IF p_type IN ('entrada', 'devolucion') THEN
        SET v_new_stock = v_previous_stock + p_quantity;
    ELSE
        SET v_new_stock = v_previous_stock - p_quantity;
    END IF;

    IF v_new_stock < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock insuficiente';
    END IF;

    UPDATE products SET stock = v_new_stock WHERE id = p_product_id AND tenant_id = p_tenant_id;

    SET v_movement_id = UUID();

    INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id)
    VALUES (v_movement_id, p_tenant_id, p_product_id, p_type, p_quantity, v_previous_stock, v_new_stock, p_reason, p_reference_id, p_user_id);
END //

-- Top productos vendidos por tenant
CREATE PROCEDURE sp_get_top_selling_products(IN p_tenant_id VARCHAR(36), IN p_limit INT)
BEGIN
    SELECT
        p.id,
        p.name,
        p.category,
        SUM(si.quantity) AS total_sold,
        SUM(si.subtotal) AS total_revenue
    FROM products p
    JOIN sale_items si ON p.id = si.product_id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'completada' AND s.tenant_id = p_tenant_id
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT p_limit;
END //

-- Ventas por categoria por tenant
CREATE PROCEDURE sp_get_sales_by_category(IN p_tenant_id VARCHAR(36))
BEGIN
    SELECT
        p.category,
        SUM(si.quantity) AS total_quantity,
        SUM(si.subtotal) AS total_revenue
    FROM products p
    JOIN sale_items si ON p.id = si.product_id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'completada' AND s.tenant_id = p_tenant_id
    GROUP BY p.category
    ORDER BY total_revenue DESC;
END //

-- Actualizar estado de credito
CREATE PROCEDURE sp_update_credit_status(IN p_sale_id VARCHAR(36))
BEGIN
    DECLARE v_total DECIMAL(12,2);
    DECLARE v_paid DECIMAL(12,2);
    DECLARE v_new_status VARCHAR(20);

    SELECT total INTO v_total FROM sales WHERE id = p_sale_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM credit_payments WHERE sale_id = p_sale_id;

    IF v_paid >= v_total THEN
        SET v_new_status = 'pagado';
    ELSEIF v_paid > 0 THEN
        SET v_new_status = 'parcial';
    ELSE
        SET v_new_status = 'pendiente';
    END IF;

    UPDATE sales SET credit_status = v_new_status WHERE id = p_sale_id;
END //

-- Generar numero de recibo por tenant
CREATE PROCEDURE sp_generate_receipt_number(IN p_tenant_id VARCHAR(36), OUT new_receipt VARCHAR(20))
BEGIN
    DECLARE current_num INT;
    DECLARE prefix_val VARCHAR(10);

    SELECT current_number, prefix INTO current_num, prefix_val
    FROM payment_receipt_sequence
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

    SET current_num = current_num + 1;

    UPDATE payment_receipt_sequence SET current_number = current_num WHERE tenant_id = p_tenant_id;

    SET new_receipt = CONCAT(prefix_val, '-', LPAD(current_num, 5, '0'));
END //

-- Generar alertas automaticas por tenant
CREATE PROCEDURE sp_generate_product_alerts(IN p_tenant_id VARCHAR(36))
BEGIN
    -- Alertas de vencimiento (productos que vencen en 30 dias)
    INSERT INTO product_alerts (id, tenant_id, product_id, alert_type, alert_date, priority, message)
    SELECT
        UUID(),
        p_tenant_id,
        id,
        'vencimiento',
        expiry_date,
        CASE
            WHEN DATEDIFF(expiry_date, CURDATE()) <= 7 THEN 'critica'
            WHEN DATEDIFF(expiry_date, CURDATE()) <= 15 THEN 'alta'
            ELSE 'media'
        END,
        CONCAT('Producto vence en ', DATEDIFF(expiry_date, CURDATE()), ' dias')
    FROM products
    WHERE tenant_id = p_tenant_id
        AND expiry_date IS NOT NULL
        AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        AND expiry_date >= CURDATE()
        AND NOT EXISTS (
            SELECT 1 FROM product_alerts
            WHERE product_id = products.id
                AND alert_type = 'vencimiento'
                AND is_resolved = FALSE
        );

    -- Alertas de stock bajo
    INSERT INTO product_alerts (id, tenant_id, product_id, alert_type, alert_date, priority, message)
    SELECT
        UUID(),
        p_tenant_id,
        id,
        'stock_bajo',
        CURDATE(),
        CASE
            WHEN stock = 0 THEN 'critica'
            WHEN stock <= (reorder_point * 0.5) THEN 'alta'
            ELSE 'media'
        END,
        CONCAT('Stock actual: ', stock, ' (Minimo: ', reorder_point, ')')
    FROM products
    WHERE tenant_id = p_tenant_id
        AND stock <= reorder_point
        AND NOT EXISTS (
            SELECT 1 FROM product_alerts
            WHERE product_id = products.id
                AND alert_type = 'stock_bajo'
                AND is_resolved = FALSE
        );
END //

-- ============================================
-- PROCEDIMIENTO: Crear nuevo tenant con comerciante
-- Uso por superadmin para dar de alta un nuevo negocio
-- ============================================
CREATE PROCEDURE sp_create_tenant(
    IN p_tenant_name VARCHAR(255),
    IN p_tenant_slug VARCHAR(100),
    IN p_business_type VARCHAR(100),
    IN p_plan VARCHAR(20),
    IN p_owner_email VARCHAR(255),
    IN p_owner_password VARCHAR(255),
    IN p_owner_name VARCHAR(255),
    OUT p_tenant_id VARCHAR(36),
    OUT p_owner_id VARCHAR(36)
)
BEGIN
    SET p_tenant_id = UUID();
    SET p_owner_id = UUID();

    -- Crear tenant
    INSERT INTO tenants (id, name, slug, business_type, plan)
    VALUES (p_tenant_id, p_tenant_name, p_tenant_slug, p_business_type, p_plan);

    -- Crear usuario comerciante
    INSERT INTO users (id, tenant_id, email, password, name, role, is_active)
    VALUES (p_owner_id, p_tenant_id, p_owner_email, p_owner_password, p_owner_name, 'comerciante', TRUE);

    -- Vincular owner al tenant
    UPDATE tenants SET owner_id = p_owner_id WHERE id = p_tenant_id;

    -- Crear secuencias para el tenant
    INSERT INTO invoice_sequence (tenant_id, prefix, current_number) VALUES (p_tenant_id, 'FAC', 0);
    INSERT INTO payment_receipt_sequence (tenant_id, prefix, current_number) VALUES (p_tenant_id, 'REC', 0);
    INSERT INTO rb_order_sequence (tenant_id, prefix, current_number) VALUES (p_tenant_id, 'C', 0);
    INSERT INTO rb_reservation_sequence (tenant_id, prefix, current_number) VALUES (p_tenant_id, 'R', 0);

    -- Crear store_info default
    INSERT INTO store_info (tenant_id, name) VALUES (p_tenant_id, p_tenant_name);

    -- Crear configuraciones singleton para el tenant
    INSERT IGNORE INTO store_announcement_bar (tenant_id, text, is_active) VALUES (p_tenant_id, '', FALSE);
    INSERT IGNORE INTO store_order_bump (tenant_id, is_enabled) VALUES (p_tenant_id, FALSE);
    INSERT IGNORE INTO chatbot_config (tenant_id, is_enabled) VALUES (p_tenant_id, 0);
END //

DELIMITER ;

-- ============================================
-- TRIGGERS (tenant-aware)
-- ============================================

DELIMITER //

CREATE TRIGGER tr_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END //

CREATE TRIGGER tr_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END //

CREATE TRIGGER tr_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END //

DELIMITER ;

-- (índices adicionales movidos a las definiciones de tabla)

-- ============================================
-- TABLA: storefront_orders (Pedidos del storefront/tienda online)
-- ============================================
CREATE TABLE IF NOT EXISTS storefront_orders (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    order_number VARCHAR(20) NOT NULL,

    -- Datos del cliente
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255) NULL,
    customer_cedula VARCHAR(50) NULL,

    -- Datos de envío
    department VARCHAR(100) NULL,
    municipality VARCHAR(100) NULL,
    address TEXT NULL,
    neighborhood VARCHAR(255) NULL,

    -- Geolocalización
    delivery_latitude DECIMAL(10,7) NULL,
    delivery_longitude DECIMAL(10,7) NULL,

    -- Notas
    notes TEXT NULL,

    -- Totales
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,

    -- Estado
    status ENUM('pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    payment_method VARCHAR(50) NULL,

    -- Delivery / Repartidor
    delivery_driver_id VARCHAR(36) NULL,
    delivery_status ENUM('sin_asignar','asignado','recogido','en_camino','entregado') DEFAULT 'sin_asignar',
    delivery_assigned_at TIMESTAMP NULL,
    delivery_picked_at TIMESTAMP NULL,
    delivery_delivered_at TIMESTAMP NULL,

    -- Flota / Despacho (Ferretería)
    vehicle_id VARCHAR(36) NULL COMMENT 'Vehículo asignado para despacho',
    dispatch_status ENUM('pendiente','en_pista','cargado','despachado','entregado') NOT NULL DEFAULT 'pendiente',
    total_weight_kg DECIMAL(10,3) NULL COMMENT 'Peso total del pedido en kg (calculado al crear)',
    dispatch_notes TEXT NULL COMMENT 'Notas del despachador',
    dispatched_at TIMESTAMP NULL COMMENT 'Fecha/hora en que el vehículo salió de la pista',

    -- Cliente registrado (opcional)
    client_user_id VARCHAR(36) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (delivery_driver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
    INDEX idx_order_tenant (tenant_id),
    INDEX idx_order_tenant_status (tenant_id, status),
    INDEX idx_order_tenant_date (tenant_id, created_at),
    INDEX idx_order_number (order_number),
    INDEX idx_order_created (created_at),
    INDEX idx_order_driver (delivery_driver_id),
    INDEX idx_order_client (client_user_id),
    INDEX idx_order_vehicle (vehicle_id),
    INDEX idx_order_dispatch_status (dispatch_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: storefront_order_items (Items de pedidos del storefront)
-- ============================================
CREATE TABLE IF NOT EXISTS storefront_order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NULL,
    product_name VARCHAR(255) NOT NULL,
    product_image VARCHAR(500) NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    original_price DECIMAL(12,2) NULL COMMENT 'Precio original sin descuento',
    discount_percent INT DEFAULT 0 COMMENT 'Porcentaje de descuento aplicado (drop/oferta)',
    total_price DECIMAL(12,2) NOT NULL,
    size VARCHAR(20) NULL,
    color VARCHAR(50) NULL,
    -- Pre-orden (valores congelados al momento del pedido)
    is_preorder         TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = ítem comprado como pre-orden',
    preorder_ship_start DATE       NULL               COMMENT 'Fecha inicio envío prometida al comprar',
    preorder_ship_end   DATE       NULL               COMMENT 'Fecha fin envío prometida al comprar',

    FOREIGN KEY (order_id) REFERENCES storefront_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_order_item_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: store_banners (Banners editables para hero sections)
-- ============================================
CREATE TABLE IF NOT EXISTS store_banners (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL,
    position VARCHAR(20) NOT NULL COMMENT 'hero1, hero4',
    image_url VARCHAR(500) NOT NULL,
    video_url VARCHAR(500) NULL COMMENT 'URL de video (solo hero4)',
    title VARCHAR(255) NULL,
    subtitle VARCHAR(500) NULL,
    link_url VARCHAR(500) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_banner_tenant_pos (tenant_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: store_featured_products (Productos destacados hero5)
-- ============================================
CREATE TABLE IF NOT EXISTS store_featured_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_featured_tenant_product (tenant_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: store_announcement_bar (Barra de anuncio estilo Shopify)
-- ============================================
CREATE TABLE IF NOT EXISTS store_announcement_bar (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL,
    text VARCHAR(500) NOT NULL,
    link_url VARCHAR(500) NULL,
    bg_color VARCHAR(20) DEFAULT '#f59e0b',
    text_color VARCHAR(20) DEFAULT '#000000',
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_announcement_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: store_drops (Lanzamientos temporales con descuentos)
-- ============================================
CREATE TABLE IF NOT EXISTS store_drops (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NULL COMMENT 'NULL = drop global de plataforma (superadmin)',
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500) NULL,
    banner_url VARCHAR(500) NULL,
    global_discount INT DEFAULT 0 COMMENT 'Descuento % global del drop',
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_drop_tenant_active (tenant_id, is_active, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: store_drop_products (Productos de cada drop)
-- ============================================
CREATE TABLE IF NOT EXISTS store_drop_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    drop_id INT NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    custom_discount INT NULL COMMENT 'Descuento % personalizado, NULL = usa global del drop',
    FOREIGN KEY (drop_id) REFERENCES store_drops(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_drop_product (drop_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DATOS SEED: SISTEMA DE PERFUMES BOM (Productos Compuestos)
-- Permite vender perfumes por referencia (30ML, 50ML, 100ML)
-- y descontar automaticamente insumos (extracto, envase, caja)
-- ============================================

-- Categorias para perfumes e insumos
INSERT IGNORE INTO categories (id, tenant_id, name, description) VALUES
('perfumes', 'tenant-demo-001', 'Perfumes', 'Perfumes terminados por referencia'),
('insumos', 'tenant-demo-001', 'Insumos', 'Materia prima para produccion');

-- Variables para IDs deterministas
SET @tenant = 'tenant-demo-001' COLLATE utf8mb4_unicode_ci;

-- IDs de Productos Terminados (Perfumes)
SET @id_p100 = 'PERF-LW-100-ID' COLLATE utf8mb4_unicode_ci;
SET @id_p50  = 'PERF-LW-050-ID' COLLATE utf8mb4_unicode_ci;
SET @id_p30  = 'PERF-LW-030-ID' COLLATE utf8mb4_unicode_ci;

-- IDs de Insumos (Materia Prima)
SET @id_extracto = 'MAT-EXT-LW-ID' COLLATE utf8mb4_unicode_ci;
SET @id_env_100  = 'MAT-ENV-100-ID' COLLATE utf8mb4_unicode_ci;
SET @id_env_50   = 'MAT-ENV-050-ID' COLLATE utf8mb4_unicode_ci;
SET @id_env_30   = 'MAT-ENV-030-ID' COLLATE utf8mb4_unicode_ci;
SET @id_caja_100 = 'MAT-BOX-100-ID' COLLATE utf8mb4_unicode_ci;
SET @id_caja_50  = 'MAT-BOX-050-ID' COLLATE utf8mb4_unicode_ci;
SET @id_caja_30  = 'MAT-BOX-030-ID' COLLATE utf8mb4_unicode_ci;

-- Limpiar datos previos si existen (para re-ejecutar sin duplicados)
DELETE FROM product_recipes WHERE tenant_id = @tenant AND product_id IN (@id_p100, @id_p50, @id_p30);
DELETE FROM products WHERE tenant_id = @tenant AND id IN (@id_p100, @id_p50, @id_p30, @id_extracto, @id_env_100, @id_env_50, @id_env_30, @id_caja_100, @id_caja_50, @id_caja_30);

-- INSUMOS (Materia Prima) - No se venden directamente, solo se consumen via BOM
-- Extracto base - Costo unitario $1,700
INSERT INTO products (id, tenant_id, name, category, product_type, brand, purchase_price, sale_price, sku, stock, reorder_point, entry_date, description)
VALUES
(@id_extracto, @tenant, 'Extracto Larry White (Unidad Base)', 'insumos', 'otros', 'Larry White', 1700, 0, 'MAT-EXT-LW', 5000, 100, CURDATE(), 'Insumo base para perfumes - No venta directa');

-- Envases por tamaño
INSERT INTO products (id, tenant_id, name, category, product_type, brand, purchase_price, sale_price, sku, stock, reorder_point, entry_date, description) VALUES
(@id_env_100, @tenant, 'Envase Vidrio 100ML', 'insumos', 'otros', 'Generico', 1900, 0, 'MAT-ENV-100', 500, 20, CURDATE(), 'Envase para perfume 100ML'),
(@id_env_50,  @tenant, 'Envase Vidrio 50ML',  'insumos', 'otros', 'Generico', 600,  0, 'MAT-ENV-050', 500, 20, CURDATE(), 'Envase para perfume 50ML'),
(@id_env_30,  @tenant, 'Envase Vidrio 30ML',  'insumos', 'otros', 'Generico', 400,  0, 'MAT-ENV-030', 500, 20, CURDATE(), 'Envase para perfume 30ML');

-- Cajas por tamaño
INSERT INTO products (id, tenant_id, name, category, product_type, brand, purchase_price, sale_price, sku, stock, reorder_point, entry_date, description) VALUES
(@id_caja_100, @tenant, 'Caja Perfume 100ML', 'insumos', 'otros', 'Larry White', 0, 0, 'MAT-BOX-100', 500, 20, CURDATE(), 'Caja para perfume 100ML'),
(@id_caja_50,  @tenant, 'Caja Perfume 50ML',  'insumos', 'otros', 'Larry White', 0, 0, 'MAT-BOX-050', 500, 20, CURDATE(), 'Caja para perfume 50ML'),
(@id_caja_30,  @tenant, 'Caja Perfume 30ML',  'insumos', 'otros', 'Larry White', 0, 0, 'MAT-BOX-030', 500, 20, CURDATE(), 'Caja para perfume 30ML');

-- PRODUCTOS TERMINADOS (Perfumes por referencia)
-- Precios: sale_price = precio_referencia / 1.19 (para que con IVA 19% quede el precio correcto)
-- 100ML: $75,000 / 1.19 = $63,025.21
-- 50ML:  $38,000 / 1.19 = $31,932.77
-- 30ML:  $22,000 / 1.19 = $18,487.39
-- Stock = 0 porque se arman automaticamente desde insumos (BOM)
INSERT INTO products (id, tenant_id, name, category, product_type, brand, purchase_price, sale_price, sku, stock, reorder_point, entry_date, description)
VALUES
(@id_p100, @tenant, 'Perfume Larry White 100ML', 'perfumes', 'perfumes', 'Larry White', 75000, 63025.21, 'PERF-LW-100', 0, 0, CURDATE(), 'Referencia 100ML - Producto compuesto (BOM)'),
(@id_p50,  @tenant, 'Perfume Larry White 50ML',  'perfumes', 'perfumes', 'Larry White', 38000, 31932.77, 'PERF-LW-050', 0, 0, CURDATE(), 'Referencia 50ML - Producto compuesto (BOM)'),
(@id_p30,  @tenant, 'Perfume Larry White 30ML',  'perfumes', 'perfumes', 'Larry White', 22000, 18487.39, 'PERF-LW-030', 0, 0, CURDATE(), 'Referencia 30ML - Producto compuesto (BOM)');

-- RECETAS BOM (Bill of Materials)
-- Define cuantos insumos se necesitan para armar cada referencia

-- Receta 100ML: 43 Extracto + 1 Envase 100ML + 1 Caja 100ML
INSERT INTO product_recipes (id, tenant_id, product_id, ingredient_id, quantity) VALUES
(UUID(), @tenant, @id_p100, @id_extracto, 43),
(UUID(), @tenant, @id_p100, @id_env_100, 1),
(UUID(), @tenant, @id_p100, @id_caja_100, 1);

-- Receta 50ML: 22 Extracto + 1 Envase 50ML + 1 Caja 50ML
INSERT INTO product_recipes (id, tenant_id, product_id, ingredient_id, quantity) VALUES
(UUID(), @tenant, @id_p50, @id_extracto, 22),
(UUID(), @tenant, @id_p50, @id_env_50, 1),
(UUID(), @tenant, @id_p50, @id_caja_50, 1);

-- Receta 30ML: 13 Extracto + 1 Envase 30ML + 1 Caja 30ML
INSERT INTO product_recipes (id, tenant_id, product_id, ingredient_id, quantity) VALUES
(UUID(), @tenant, @id_p30, @id_extracto, 13),
(UUID(), @tenant, @id_p30, @id_env_30, 1),
(UUID(), @tenant, @id_p30, @id_caja_30, 1);

-- ============================================
-- SOPORTE GOOGLE OAuth (Login rápido con Google)
-- ============================================

-- Permitir password NULL para usuarios que se registran con Google
ALTER TABLE users MODIFY password VARCHAR(255) NULL;

-- Agregar proveedor de autenticación y ID de Google
ALTER TABLE users ADD COLUMN auth_provider ENUM('local', 'google') NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL;
ALTER TABLE users ADD INDEX idx_google_id (google_id);

-- ============================================
-- SISTEMA DE DOMICILIOS / DELIVERY
-- ============================================

-- Campos de dirección de domicilio en usuarios (clientes)
-- Nota: phone ya existe en CREATE TABLE users; se omite aquí.
ALTER TABLE users
  ADD COLUMN cedula VARCHAR(50) NULL,
  ADD COLUMN department VARCHAR(100) NULL,
  ADD COLUMN municipality VARCHAR(100) NULL,
  ADD COLUMN address TEXT NULL,
  ADD COLUMN neighborhood VARCHAR(255) NULL,
  ADD COLUMN delivery_latitude DECIMAL(10,7) NULL,
  ADD COLUMN delivery_longitude DECIMAL(10,7) NULL,
  ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- ALTER TABLE para DBs existentes (compatible MySQL 5.7+)
-- Usa procedimiento almacenado para verificar columnas antes de agregar
-- ============================================
DROP PROCEDURE IF EXISTS sp_lopbuk_migrate;

DELIMITER //
CREATE PROCEDURE sp_lopbuk_migrate()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'available_for_delivery'
    ) THEN
        ALTER TABLE products ADD COLUMN available_for_delivery BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'delivery_type'
    ) THEN
        ALTER TABLE products ADD COLUMN delivery_type ENUM('domicilio','envio','ambos') NULL DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_new_launch'
    ) THEN
        ALTER TABLE products ADD COLUMN is_new_launch BOOLEAN NOT NULL DEFAULT FALSE
            COMMENT 'Marcado como nuevo lanzamiento en la tienda';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'launch_date'
    ) THEN
        ALTER TABLE products ADD COLUMN launch_date DATE NULL
            COMMENT 'Fecha de lanzamiento del producto';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'image_url'
    ) THEN
        ALTER TABLE categories ADD COLUMN image_url VARCHAR(500) NULL
            COMMENT 'URL de imagen representativa de la categoría (Cloudinary)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'product_card_style'
    ) THEN
        ALTER TABLE store_info ADD COLUMN product_card_style VARCHAR(20) NULL DEFAULT 'style1'
            COMMENT 'Estilo de tarjeta de producto: style1 (oscuro clásico) o style2 (moderno con hover)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'allow_contraentrega'
    ) THEN
        ALTER TABLE store_info ADD COLUMN allow_contraentrega TINYINT(1) NOT NULL DEFAULT 1
            COMMENT '1 = permite pago contraentrega en checkout, 0 = solo métodos de pago en línea';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'shipping_terms'
    ) THEN
        ALTER TABLE store_info ADD COLUMN shipping_terms TEXT NULL
            COMMENT 'Contenido de términos de envío (texto libre)';
    END IF;

    -- Ampliar columnas de terms_url y privacy_url a TEXT si aún son VARCHAR
    ALTER TABLE store_info MODIFY COLUMN terms_url TEXT NULL COMMENT 'Contenido de términos y condiciones (texto libre)';
    ALTER TABLE store_info MODIFY COLUMN privacy_url TEXT NULL COMMENT 'Contenido de política de privacidad (texto libre)';

    ALTER TABLE store_drops
        MODIFY COLUMN tenant_id VARCHAR(36) NULL
        COMMENT 'NULL = drop global de plataforma (superadmin)';

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'can_login'
    ) THEN
        ALTER TABLE users ADD COLUMN can_login BOOLEAN NOT NULL DEFAULT TRUE
            COMMENT 'FALSE = el empleado existe en el sistema pero no puede iniciar sesión'
            AFTER is_active;
    END IF;

    -- purchase_invoices: nuevos campos
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_invoices' AND COLUMN_NAME = 'document_type'
    ) THEN
        ALTER TABLE purchase_invoices
            ADD COLUMN document_type ENUM('factura','remision','orden_compra','nota_credito') NOT NULL DEFAULT 'factura' AFTER purchase_date,
            ADD COLUMN discount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER subtotal,
            ADD COLUMN due_date DATE NULL AFTER payment_status,
            ADD COLUMN file_url VARCHAR(500) NULL AFTER due_date;
        ALTER TABLE purchase_invoices
            MODIFY COLUMN payment_method ENUM('efectivo','tarjeta','transferencia','credito','nequi','daviplata','credito_proveedor','mixto') NOT NULL DEFAULT 'efectivo';
    END IF;

    -- sales: ampliar payment_method ENUM con métodos modernos
    ALTER TABLE sales
        MODIFY COLUMN payment_method ENUM('efectivo','tarjeta','transferencia','fiado','addi','sistecredito','mixto') NOT NULL;
END //
DELIMITER ;

CALL sp_lopbuk_migrate();
DROP PROCEDURE IF EXISTS sp_lopbuk_migrate;

-- ============================================
-- TABLA: chatbot_config (Configuración del chatbot IA por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS chatbot_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL UNIQUE,
    is_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Activado por superadmin',
    bot_name VARCHAR(100) NOT NULL DEFAULT 'Asistente',
    bot_avatar_url VARCHAR(500) NULL,
    system_prompt TEXT NULL COMMENT 'Base de conocimiento e instrucciones para la IA',
    business_info TEXT NULL COMMENT 'Descripción del negocio, horarios, servicios',
    faqs TEXT NULL COMMENT 'Preguntas frecuentes en texto libre',
    tone ENUM('profesional','amigable','formal','casual') NOT NULL DEFAULT 'amigable',
    notify_email TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Notificar al correo del comercio cuando llegue un pedido',
    notify_whatsapp TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Notificar al WhatsApp del comercio cuando llegue un pedido',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_chatbot_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: chatbot_sessions (Sesiones de conversación)
-- ============================================
CREATE TABLE IF NOT EXISTS chatbot_sessions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    session_token VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255) NULL,
    customer_phone VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_session_token (session_token),
    INDEX idx_session_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: chatbot_messages (Historial de mensajes por sesión)
-- ============================================
CREATE TABLE IF NOT EXISTS chatbot_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    role ENUM('user','assistant') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_msg_session (session_id),
    INDEX idx_msg_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: merchant_notifications (Notificaciones para el comerciante)
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL,
    type ENUM('new_order','new_booking','chatbot_lead','new_service_booking') NOT NULL DEFAULT 'new_order',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSON NULL COMMENT 'Datos extra: order_id, customer_name, total, etc.',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_notif_tenant_read (tenant_id, is_read),
    INDEX idx_notif_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seeds platform_settings: Cloudinary y OpenAI (vacíos por defecto)
INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES ('cloudinary_cloud_name', '');
INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES ('cloudinary_upload_preset', '');
INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES ('openai_api_key', '');
-- GIF/imagen del fondo en la pantalla de login (gestionable desde el panel superadmin)
INSERT IGNORE INTO platform_settings (setting_key, setting_value) VALUES ('login_image_url', '/image/giflogin.gif');

-- ============================================
-- TABLA: store_order_bump (Configuración de Order Bump / Cross-sell por tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS store_order_bump (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(36) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mode ENUM('auto', 'manual') NOT NULL DEFAULT 'auto' COMMENT 'auto=misma categoria, manual=productos elegidos',
    title VARCHAR(255) NOT NULL DEFAULT '¿También te puede interesar?',
    max_items INT NOT NULL DEFAULT 3,
    product_ids JSON NULL COMMENT 'Array de IDs de productos para modo manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_order_bump_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Migración: video_url en store_banners
-- ============================================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_add_banner_video_url()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'store_banners' AND COLUMN_NAME = 'video_url'
    ) THEN
        ALTER TABLE store_banners ADD COLUMN video_url VARCHAR(500) NULL COMMENT 'URL de video (solo hero4)' AFTER image_url;
    END IF;
END //
DELIMITER ;
CALL sp_add_banner_video_url();
DROP PROCEDURE IF EXISTS sp_add_banner_video_url;

-- ============================================
-- Migración: accent_color en chatbot_config
-- ============================================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_add_chatbot_accent_color()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'chatbot_config' AND COLUMN_NAME = 'accent_color'
    ) THEN
        ALTER TABLE chatbot_config ADD COLUMN accent_color VARCHAR(20) DEFAULT '#f59e0b' COMMENT 'Color de acento del widget chatbot' AFTER bot_avatar_url;
    END IF;
END //
DELIMITER ;
CALL sp_add_chatbot_accent_color();
DROP PROCEDURE IF EXISTS sp_add_chatbot_accent_color;

-- ============================================
-- MÓDULO DE VENDEDORES / NÓMINA v1.0
-- Comisiones, metas, ajustes y historial de nómina
-- ============================================

-- Campos de comisión y configuración laboral en usuarios
-- (para DBs existentes: ejecutar manualmente si falla)
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_migrate_vendedores()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'commission_type') THEN
        ALTER TABLE users
            ADD COLUMN commission_type ENUM('sin_comision','porcentaje','fijo_por_venta','fijo_por_item') NOT NULL DEFAULT 'sin_comision'
                COMMENT 'Tipo de comisión del vendedor',
            ADD COLUMN commission_value DECIMAL(10,2) NOT NULL DEFAULT 0
                COMMENT 'Valor de comisión: % o monto fijo',
            ADD COLUMN salary_base DECIMAL(12,2) NOT NULL DEFAULT 0
                COMMENT 'Salario base mensual',
            ADD COLUMN monthly_goal DECIMAL(12,2) NOT NULL DEFAULT 0
                COMMENT 'Meta de ventas mensual (0 = sin meta)',
            ADD COLUMN goal_bonus DECIMAL(12,2) NOT NULL DEFAULT 0
                COMMENT 'Bono por cumplir meta mensual';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_vendedores();
DROP PROCEDURE IF EXISTS sp_migrate_vendedores;

-- ============================================
-- TABLA: payroll_adjustments (Bonos/Descuentos manuales por periodo)
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_adjustments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    seller_id VARCHAR(36) NOT NULL,
    seller_name VARCHAR(255) NOT NULL,
    period_from DATE NOT NULL COMMENT 'Inicio del periodo',
    period_to   DATE NOT NULL COMMENT 'Fin del periodo',
    type ENUM('bono','descuento') NOT NULL,
    concept VARCHAR(255) NOT NULL COMMENT 'Descripción del concepto',
    amount DECIMAL(12,2) NOT NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_adj_tenant_seller (tenant_id, seller_id),
    INDEX idx_adj_period (tenant_id, period_from, period_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: payroll_records (Nóminas generadas)
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    period_from DATE NOT NULL,
    period_to   DATE NOT NULL,
    period_label VARCHAR(100) NOT NULL COMMENT 'Ej: Marzo 2026 / Quincena 1 Mar 2026',
    seller_id VARCHAR(36) NOT NULL,
    seller_name VARCHAR(255) NOT NULL,
    -- Totales de ventas
    total_ventas INT NOT NULL DEFAULT 0,
    total_monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    -- Comisiones
    salary_base DECIMAL(12,2) NOT NULL DEFAULT 0,
    commission_type VARCHAR(50) NOT NULL DEFAULT 'sin_comision',
    commission_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    commission_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
    -- Meta
    monthly_goal DECIMAL(12,2) NOT NULL DEFAULT 0,
    goal_bonus_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
    -- Ajustes
    total_bonos DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_descuentos DECIMAL(12,2) NOT NULL DEFAULT 0,
    -- Total final
    total_pagar DECIMAL(12,2) NOT NULL DEFAULT 0,
    -- Estado
    status ENUM('borrador','pagado') NOT NULL DEFAULT 'borrador',
    notes TEXT NULL,
    generated_by VARCHAR(36) NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_payroll_tenant (tenant_id),
    INDEX idx_payroll_seller (seller_id),
    INDEX idx_payroll_period (tenant_id, period_from, period_to),
    INDEX idx_payroll_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- MÓDULO DE NOVEDADES / CONTROL DE AUSENCIAS v1.0
-- Permisos, incapacidades, vacaciones y otras novedades de empleados
-- ============================================

-- TABLA: employee_vacation_balances (Saldo de vacaciones por empleado/año)
-- En Colombia: 15 días hábiles de vacaciones por año trabajado (Ley 995 de 2005)
CREATE TABLE IF NOT EXISTS employee_vacation_balances (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    year INT NOT NULL,
    days_granted INT NOT NULL DEFAULT 15 COMMENT 'Días otorgados (default: 15 por ley colombiana)',
    days_used INT NOT NULL DEFAULT 0 COMMENT 'Días utilizados (vacaciones + permisos remunerados)',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_vacation_user_year (tenant_id, user_id, year),
    INDEX idx_vacation_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA: employee_novelties (Novedades: permisos, incapacidades, vacaciones, otros)
CREATE TABLE IF NOT EXISTS employee_novelties (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    -- Tipo de novedad
    type ENUM(
        'vacaciones',           -- Vacaciones programadas (descuenta saldo)
        'permiso_remunerado',   -- Permiso con sueldo (descuenta saldo vacaciones)
        'permiso_no_remunerado',-- Permiso sin sueldo (descuenta de nómina)
        'incapacidad',          -- Incapacidad médica (EPS cubre a partir del día 3 en Colombia)
        'calamidad',            -- Calamidad doméstica
        'licencia_maternidad',  -- Licencia de maternidad/paternidad
        'suspension',           -- Suspensión disciplinaria
        'otro'                  -- Otro evento
    ) NOT NULL,
    -- Período
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INT NOT NULL DEFAULT 1 COMMENT 'Días calendario del período',
    -- Impacto en nómina
    deducts_salary TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = descuenta de salario',
    deduct_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Monto calculado a descontar',
    -- Impacto en saldo de vacaciones
    deducts_vacation TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = descuenta del saldo de vacaciones',
    -- Descripción y soporte
    description TEXT NULL,
    attachment_url VARCHAR(500) NULL COMMENT 'Documento soporte (PDF/imagen)',
    -- Estado del trámite
    status ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
    rejection_reason VARCHAR(500) NULL,
    -- Auditoría
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_novelties_tenant (tenant_id),
    INDEX idx_novelties_user (user_id),
    INDEX idx_novelties_date (tenant_id, start_date),
    INDEX idx_novelties_type (tenant_id, type),
    INDEX idx_novelties_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Migración: show_info_module e info_module_description en store_info
-- ============================================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_add_info_module_fields()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'show_info_module'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN show_info_module TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = mostrar módulo de información en lugar de la sección de productos',
            ADD COLUMN info_module_description TEXT NULL
                COMMENT 'Descripción/texto libre para el módulo de información';
    END IF;
END //
DELIMITER ;
CALL sp_add_info_module_fields();
DROP PROCEDURE IF EXISTS sp_add_info_module_fields;

-- ============================================
-- MIGRACIONES DE SEGURIDAD v3.1
-- Requisitos: RBAC permisos, cifrado AES, refresh tokens, audit trail
-- ============================================

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_security_migrations_v31()
BEGIN

    -- -----------------------------------------------
    -- 1. RBAC: columna permissions en employee_cargos
    --    El código usa employee_cargos.permissions (JSON)
    --    para control granular de acceso por recurso.
    --    Sin esta columna el requirePermission() middleware falla silenciosamente.
    -- -----------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'employee_cargos'
          AND COLUMN_NAME = 'permissions'
    ) THEN
        ALTER TABLE employee_cargos
            ADD COLUMN permissions JSON NULL
                COMMENT 'Array de permisos del cargo: ["manage_products","view_reports",...]';
    END IF;

    -- -----------------------------------------------
    -- 2. CIFRADO AES: columna data_encrypted en users
    --    crypto.ts cifra phone, cedula, department,
    --    municipality, address, neighborhood con AES-256-CBC.
    --    Esta columna marca qué registros ya fueron cifrados
    --    para que runEncryptionMigration() sea idempotente.
    -- -----------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'data_encrypted'
    ) THEN
        ALTER TABLE users
            ADD COLUMN data_encrypted TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = campos sensibles (phone, cedula, address) cifrados con AES-256-CBC';
    END IF;

    -- -----------------------------------------------
    -- 3. CIFRADO AES: columna data_encrypted en storefront_orders
    --    Los campos customer_phone, customer_cedula, address,
    --    neighborhood, department, municipality son PII sensibles
    --    que deben cifrarse en reposo.
    -- -----------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'storefront_orders'
          AND COLUMN_NAME = 'data_encrypted'
    ) THEN
        ALTER TABLE storefront_orders
            ADD COLUMN data_encrypted TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = PII del cliente (phone, cedula, address) cifrados con AES-256-CBC';
    END IF;

    -- -----------------------------------------------
    -- 4. AUDIT LOG: columna user_agent para trazabilidad forense
    --    Permite correlacionar eventos de seguridad con dispositivos.
    -- -----------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'audit_log'
          AND COLUMN_NAME = 'user_agent'
    ) THEN
        ALTER TABLE audit_log
            ADD COLUMN user_agent VARCHAR(500) NULL
                COMMENT 'User-Agent del cliente para trazabilidad forense'
            AFTER ip_address;
    END IF;

    -- -----------------------------------------------
    -- 5. AUDIT LOG: columna severity para filtrado de eventos
    -- -----------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'audit_log'
          AND COLUMN_NAME = 'severity'
    ) THEN
        ALTER TABLE audit_log
            ADD COLUMN severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info'
                COMMENT 'Nivel de severidad del evento de seguridad'
            AFTER action;

        ALTER TABLE audit_log
            ADD INDEX idx_audit_severity (severity);
    END IF;

END //
DELIMITER ;
CALL sp_security_migrations_v31();
DROP PROCEDURE IF EXISTS sp_security_migrations_v31;

-- -----------------------------------------------
-- 6. REFRESH TOKENS: tabla para rotación segura de JWT
--    Permite emitir access tokens de corta duración (15min)
--    y renovarlos sin re-login usando un refresh token
--    de larga duración (7 días) almacenado en httpOnly cookie.
--    La columna revoked_at permite revocar tokens individuales
--    (logout, cambio de contraseña, sospecha de compromiso).
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NULL COMMENT 'NULL para superadmin',
    -- El token se almacena como SHA-256 del valor real (nunca el valor en claro)
    token_hash VARCHAR(64) NOT NULL COMMENT 'SHA-256 del refresh token',
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL COMMENT 'NULL = token válido, no nulo = revocado',
    revoke_reason ENUM('logout','password_change','admin_revoke','rotation','suspicious') NULL,
    -- Metadata para detección de anomalías
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_rt_token_hash (token_hash),
    INDEX idx_rt_user (user_id),
    INDEX idx_rt_expires (expires_at),
    INDEX idx_rt_user_valid (user_id, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Refresh tokens para renovación de JWT sin re-login';

-- Limpieza automática de tokens expirados (ejecutar como cron diario)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL;

-- -----------------------------------------------
-- 7. FAILED LOGIN ATTEMPTS: tabla para bloqueo de fuerza bruta
--    Complementa el rate limiting de express-rate-limit con
--    bloqueo persistente por cuenta (no solo por IP).
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    success TINYINT(1) NOT NULL DEFAULT 0,
    failure_reason VARCHAR(100) NULL COMMENT 'wrong_password, account_locked, tenant_suspended, etc.',
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_la_email_time (email, attempted_at),
    INDEX idx_la_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Registro de intentos de login para detección de fuerza bruta'
  ROW_FORMAT=COMPRESSED;

-- ============================================
-- TABLA: printers (Impresoras POS por tenant)
-- Soporta conexión LAN, USB y Bluetooth
-- ============================================
CREATE TABLE IF NOT EXISTS printers (
    id               VARCHAR(36)  NOT NULL,
    tenant_id        VARCHAR(36)  NOT NULL,
    name             VARCHAR(100) NOT NULL,
    connection_type  ENUM('lan','usb','bluetooth') NOT NULL DEFAULT 'usb',
    ip               VARCHAR(45)  NULL,
    port             INT          NOT NULL DEFAULT 9100,
    paper_width      TINYINT      NOT NULL DEFAULT 80,
    is_active        TINYINT(1)   NOT NULL DEFAULT 1,
    assigned_module  ENUM('caja','cocina','bar','factura') NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_printers_tenant (tenant_id),
    INDEX idx_printers_module (tenant_id, assigned_module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Impresoras POS registradas por tenant';

-- ============================================================
-- MÓDULO: restBar v1.0
-- Gestión operativa de restaurante/gastrobar
-- Mesas · Comandas · Cocina · Bar · Caja
-- ============================================================

-- 1. Extender users.role con roles de restaurante y despacho
ALTER TABLE users MODIFY COLUMN role ENUM(
    'superadmin','comerciante','vendedor','cliente','repartidor','auxiliar_bodega',
    'mesero','cocinero','cajero','bartender','administrador_rb','despachador'
) NOT NULL DEFAULT 'vendedor';

-- 2. Extender products con campos de menú (compatible MySQL 5.7)
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_migrate_restbar_products()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_menu_item'
    ) THEN
        ALTER TABLE products ADD COLUMN is_menu_item BOOLEAN NOT NULL DEFAULT FALSE
            COMMENT 'TRUE = ítem de menú visible para meseros';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_ingredient'
    ) THEN
        ALTER TABLE products ADD COLUMN is_ingredient BOOLEAN NOT NULL DEFAULT FALSE
            COMMENT 'TRUE = insumo de cocina/bar, se descuenta por receta al vender';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'preparation_area'
    ) THEN
        ALTER TABLE products ADD COLUMN preparation_area ENUM('bar','cocina','ambos') NULL
            COMMENT 'Área de preparación del plato/bebida';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'prep_time_minutes'
    ) THEN
        ALTER TABLE products ADD COLUMN prep_time_minutes INT NULL
            COMMENT 'Tiempo estimado de preparación en minutos';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'available_in_menu'
    ) THEN
        ALTER TABLE products ADD COLUMN available_in_menu BOOLEAN NOT NULL DEFAULT TRUE
            COMMENT 'Disponibilidad en tiempo real para meseros (86 el plato)';
    END IF;

    -- Índices (ignorar error si ya existen)
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_menu_item'
    ) THEN
        ALTER TABLE products ADD INDEX idx_menu_item (tenant_id, is_menu_item, available_in_menu);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_prep_area'
    ) THEN
        ALTER TABLE products ADD INDEX idx_prep_area (tenant_id, preparation_area);
    END IF;

    -- 3. Extender product_recipes con include_in_cost
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_recipes' AND COLUMN_NAME = 'include_in_cost'
    ) THEN
        ALTER TABLE product_recipes ADD COLUMN include_in_cost TINYINT(1) NOT NULL DEFAULT 1
            COMMENT '1 = incluir este ingrediente en el costo del plato';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_restbar_products();
DROP PROCEDURE IF EXISTS sp_migrate_restbar_products;

-- ============================================================
-- TABLA: rb_tables (Mesas del restaurante)
-- ============================================================
CREATE TABLE IF NOT EXISTS rb_tables (
    id         VARCHAR(36) PRIMARY KEY,
    tenant_id  VARCHAR(36) NOT NULL,
    number     VARCHAR(20) NOT NULL     COMMENT 'Número o nombre: "1", "Terraza 1", "VIP"',
    capacity   INT NOT NULL DEFAULT 4   COMMENT 'Capacidad máxima de comensales',
    area       VARCHAR(100) NULL        COMMENT 'Zona: Interior, Terraza, VIP, Bar',
    status     ENUM('libre','ocupada','reservada','inactiva') NOT NULL DEFAULT 'libre',
    qr_code    VARCHAR(500) NULL        COMMENT 'URL del QR de la mesa',
    notes      TEXT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_rb_table_number (tenant_id, number),
    INDEX idx_rb_table_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Mesas del restaurante/gastrobar';

-- ============================================================
-- TABLA: rb_orders (Comandas)
-- ============================================================
CREATE TABLE IF NOT EXISTS rb_orders (
    id           VARCHAR(36) PRIMARY KEY,
    tenant_id    VARCHAR(36) NOT NULL,
    table_id     VARCHAR(36) NOT NULL,
    order_number VARCHAR(20) NOT NULL   COMMENT 'Número legible: C-0045',
    waiter_id    VARCHAR(36) NOT NULL,
    waiter_name  VARCHAR(255) NOT NULL,
    guests_count INT NOT NULL DEFAULT 1 COMMENT 'Número de comensales en la mesa',
    status       ENUM(
                     'abierta',        -- mesero tomando pedido
                     'en_proceso',     -- ítems enviados a cocina/bar
                     'lista',          -- todos los ítems listos
                     'entregada',      -- mesero entregó todo
                     'cerrada',        -- pago procesado
                     'cancelada'
                 ) NOT NULL DEFAULT 'abierta',
    notes        TEXT NULL             COMMENT 'Notas generales de la comanda',
    subtotal     DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax          DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount     DECIMAL(12,2) NOT NULL DEFAULT 0,
    total        DECIMAL(12,2) NOT NULL DEFAULT 0,
    sale_id      VARCHAR(36) NULL      COMMENT 'FK a sales.id generado al cobrar',
    opened_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at    TIMESTAMP NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id)  REFERENCES rb_tables(id) ON DELETE RESTRICT,
    FOREIGN KEY (waiter_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (sale_id)   REFERENCES sales(id) ON DELETE SET NULL,
    UNIQUE INDEX idx_rb_order_number (tenant_id, order_number),
    INDEX idx_rb_order_table  (table_id, status),
    INDEX idx_rb_order_status (tenant_id, status),
    INDEX idx_rb_order_waiter (tenant_id, waiter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Comandas por mesa';

-- ============================================================
-- TABLA: rb_order_items (Ítems de comanda con estado individual)
-- ============================================================
CREATE TABLE IF NOT EXISTS rb_order_items (
    id                 VARCHAR(36) PRIMARY KEY,
    tenant_id          VARCHAR(36) NOT NULL,
    order_id           VARCHAR(36) NOT NULL,
    menu_item_id       VARCHAR(36) NOT NULL   COMMENT 'FK a products (is_menu_item=TRUE)',
    menu_item_name     VARCHAR(255) NOT NULL,
    preparation_area   ENUM('bar','cocina','ambos') NOT NULL
        COMMENT 'Copiado del producto al momento del pedido',
    quantity           INT NOT NULL DEFAULT 1,
    unit_price         DECIMAL(12,2) NOT NULL,
    subtotal           DECIMAL(12,2) NOT NULL,
    discount           DECIMAL(5,2) NOT NULL DEFAULT 0,
    status             ENUM(
                           'pendiente',        -- en espera de envío
                           'en_preparacion',   -- cocina/bar lo está haciendo
                           'listo',            -- listo para servir
                           'entregado',        -- mesero lo entregó
                           'cancelado'
                       ) NOT NULL DEFAULT 'pendiente',
    guest_number       TINYINT NULL DEFAULT NULL
        COMMENT 'Número de comensal asignado (1,2,3...) para dividir cuenta',
    item_notes         TEXT NULL      COMMENT 'Instrucciones: "sin cebolla", "término 3/4"',
    sent_to_kitchen_at TIMESTAMP NULL COMMENT 'Cuando se envió a cocina/bar',
    ready_at           TIMESTAMP NULL COMMENT 'Cuando el área marcó como listo',
    delivered_at       TIMESTAMP NULL COMMENT 'Cuando el mesero lo entregó',
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)    REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id)     REFERENCES rb_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_rb_item_order  (order_id),
    INDEX idx_rb_item_status (tenant_id, status),
    INDEX idx_rb_item_area   (tenant_id, preparation_area, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Ítems individuales de cada comanda con tracking de estado';

-- ============================================================
-- TABLA: rb_order_sequence (Numeración automática de comandas)
-- ============================================================
CREATE TABLE IF NOT EXISTS rb_order_sequence (
    id             INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id      VARCHAR(36) NOT NULL,
    prefix         VARCHAR(10) NOT NULL DEFAULT 'C',
    current_number INT NOT NULL DEFAULT 0,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_rb_order_seq (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Secuencia de numeración de comandas por tenant';

-- ============================================================
-- TABLA: rb_payments (Pagos de comandas — soporta cuenta dividida)
-- ============================================================
CREATE TABLE IF NOT EXISTS rb_payments (
    id              VARCHAR(36) PRIMARY KEY,
    tenant_id       VARCHAR(36) NOT NULL,
    order_id        VARCHAR(36) NOT NULL,
    guest_number    TINYINT NULL DEFAULT NULL
        COMMENT 'NULL = pago total de la mesa, N = pago del comensal N',
    payment_method  ENUM('efectivo','tarjeta','nequi','bancolombia','bbva','transferencia','mixto') NOT NULL,
    amount          DECIMAL(12,2) NOT NULL  COMMENT 'Monto a cobrar',
    amount_paid     DECIMAL(12,2) NOT NULL  COMMENT 'Monto recibido del cliente',
    change_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
    cashier_id      VARCHAR(36) NOT NULL,
    cashier_name    VARCHAR(255) NOT NULL,
    cash_session_id VARCHAR(36) NULL,
    notes           TEXT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)       REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id)        REFERENCES rb_orders(id) ON DELETE RESTRICT,
    FOREIGN KEY (cashier_id)      REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE SET NULL,
    INDEX idx_rb_payment_order   (order_id),
    INDEX idx_rb_payment_tenant  (tenant_id),
    INDEX idx_rb_payment_session (cash_session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Pagos procesados por caja — permite dividir la cuenta por comensal';

-- ============================================================
-- TABLA: rb_reservations (Reservas de mesas — clientes online)
-- ============================================================
CREATE TABLE IF NOT EXISTS rb_reservations (
    id                  VARCHAR(36) PRIMARY KEY,
    tenant_id           VARCHAR(36) NOT NULL,
    table_id            VARCHAR(36) NULL            COMMENT 'NULL = pendiente de asignación por el restaurante',
    reservation_number  VARCHAR(20) NOT NULL         COMMENT 'Número legible: R-0001',
    customer_name       VARCHAR(255) NOT NULL,
    customer_phone      VARCHAR(50) NOT NULL,
    customer_email      VARCHAR(255) NULL,
    reservation_date    DATE NOT NULL,
    reservation_time    TIME NOT NULL,
    guests_count        INT NOT NULL DEFAULT 2,
    occasion            VARCHAR(100) NULL            COMMENT 'Cumpleaños, aniversario, etc.',
    notes               TEXT NULL                   COMMENT 'Descripción y peticiones especiales del cliente',
    pre_order_items     JSON NULL                   COMMENT '[{menuItemId,name,quantity,unitPrice}]',
    pre_order_notes     TEXT NULL,
    status              ENUM('pendiente','confirmada','cancelada','completada','no_show')
                            NOT NULL DEFAULT 'pendiente',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Reservas de mesas del restaurante — creadas por clientes online';

-- ============================================================
-- TABLA: rb_reservation_sequence (Numeración automática de reservas)
-- ============================================================
CREATE TABLE IF NOT EXISTS rb_reservation_sequence (
    id             INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id      VARCHAR(36) NOT NULL,
    prefix         VARCHAR(10) NOT NULL DEFAULT 'R',
    current_number INT NOT NULL DEFAULT 0,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_rb_res_seq (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Secuencia de numeración de reservas por tenant';

-- ============================================================
-- MÓDULO: finances v1.0
-- Control de ingresos y egresos del negocio
-- Libro de caja · Flujo de caja · Presupuesto
-- ============================================================

-- ============================================================
-- TABLA: finance_categories (Categorías de ingresos y egresos)
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_categories (
    id         VARCHAR(36) PRIMARY KEY,
    tenant_id  VARCHAR(36) NOT NULL,
    type       ENUM('ingreso','egreso') NOT NULL,
    name       VARCHAR(100) NOT NULL,
    icon       VARCHAR(50) NULL   COMMENT 'Emoji: "🏠", "💡", "👥"',
    color      VARCHAR(7) NULL    COMMENT 'Color hex para UI: "#e74c3c"',
    is_system  TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = creada por el sistema, no se puede eliminar',
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_fin_cat_name   (tenant_id, type, name),
    INDEX idx_fin_cat_tenant        (tenant_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Categorías de ingresos y egresos del negocio';

-- ============================================================
-- TABLA: finance_transactions (Libro diario — cada peso que entra/sale)
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_transactions (
    id               VARCHAR(36) PRIMARY KEY,
    tenant_id        VARCHAR(36) NOT NULL,
    type             ENUM('ingreso','egreso') NOT NULL,
    category_id      VARCHAR(36) NOT NULL,
    category_name    VARCHAR(100) NOT NULL COMMENT 'Copia del nombre al momento de registrar',
    description      VARCHAR(500) NOT NULL COMMENT 'Ej: "Pago arriendo enero", "Compra gas bar"',
    amount           DECIMAL(12,2) NOT NULL,
    transaction_date DATE NOT NULL         COMMENT 'Fecha real de la transacción',
    payment_method   ENUM(
                         'efectivo','tarjeta','transferencia',
                         'nequi','daviplata','cheque','otro'
                     ) NOT NULL DEFAULT 'efectivo',
    receipt_url      VARCHAR(500) NULL     COMMENT 'Foto/PDF del recibo o factura',
    receipt_number   VARCHAR(100) NULL     COMMENT 'Número del recibo o factura',
    -- Gastos recurrentes
    is_recurring     TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = gasto/ingreso que se repite periódicamente',
    recurrence_type  ENUM('diario','semanal','quincenal','mensual','bimestral','anual') NULL,
    recurrence_day   TINYINT NULL
        COMMENT 'Día del mes en que cae el gasto recurrente (1-31)',
    -- Trazabilidad automática (integración con otros módulos)
    source_type      ENUM(
                         'manual',           -- registrado manualmente
                         'sale',             -- generado desde una venta
                         'purchase_invoice', -- generado desde factura de compra
                         'payroll',          -- generado desde nómina pagada
                         'cash_movement'     -- generado desde movimiento de caja
                     ) NOT NULL DEFAULT 'manual',
    source_id        VARCHAR(36) NULL      COMMENT 'ID del registro origen',
    notes            TEXT NULL,
    tags             JSON NULL             COMMENT '["fijo","urgente","deducible"]',
    created_by       VARCHAR(36) NULL,
    created_by_name  VARCHAR(255) NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)   REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_fin_tx_tenant    (tenant_id),
    INDEX idx_fin_tx_type      (tenant_id, type),
    INDEX idx_fin_tx_date      (tenant_id, transaction_date),
    INDEX idx_fin_tx_category  (tenant_id, category_id),
    INDEX idx_fin_tx_source    (source_type, source_id),
    INDEX idx_fin_tx_recurring (tenant_id, is_recurring)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Libro diario: registro de cada peso que entra o sale del negocio';

-- ============================================================
-- TABLA: finance_budgets (Presupuesto mensual por categoría)
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_budgets (
    id              VARCHAR(36) PRIMARY KEY,
    tenant_id       VARCHAR(36) NOT NULL,
    category_id     VARCHAR(36) NOT NULL,
    year            SMALLINT NOT NULL,
    month           TINYINT NOT NULL COMMENT '1=Enero ... 12=Diciembre',
    budgeted_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes           TEXT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)   REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_budget_unique (tenant_id, category_id, year, month),
    INDEX idx_budget_period        (tenant_id, year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Presupuesto mensual por categoría — comparar planificado vs real';

-- ============================================================
-- TABLA: portfolio_config (Portafolio público de la marca DAIMUZ)
-- Singleton — siempre id = 1
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolio_config (
    id                   INT PRIMARY KEY DEFAULT 1
                         COMMENT 'Singleton — siempre un solo registro',
    hero_title           VARCHAR(255) NOT NULL DEFAULT 'DAIMUZ',
    hero_subtitle        TEXT,
    hero_image_url       TEXT,
    brand_description    TEXT,
    show_pricing         TINYINT(1) NOT NULL DEFAULT 1
                         COMMENT '1 = mostrar precios en el portafolio',
    show_featured_stores TINYINT(1) NOT NULL DEFAULT 1
                         COMMENT '1 = mostrar comercios destacados',
    featured_tenant_ids  JSON COMMENT 'Array de tenant IDs a destacar en el portafolio',
    contact_email        VARCHAR(255),
    contact_whatsapp     VARCHAR(50),
    contact_instagram    VARCHAR(255),
    accent_color         VARCHAR(30) NOT NULL DEFAULT '#6366f1',
    is_published         TINYINT(1) NOT NULL DEFAULT 1
                         COMMENT '1 = portafolio público activo',
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Configuración del portafolio público de la marca DAIMUZ';

-- ============================================================
-- TABLA: store_custom_sections (Secciones HTML personalizadas del storefront)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_custom_sections (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    name        VARCHAR(100) NOT NULL    COMMENT 'Nombre interno de la sección',
    slug        VARCHAR(100) NOT NULL    COMMENT 'Identificador URL amigable',
    html_content LONGTEXT NULL           COMMENT 'Contenido HTML libre de la sección',
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_custom_section_slug   (tenant_id, slug),
    INDEX idx_custom_section_tenant        (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Secciones HTML personalizadas del storefront por tenant';

-- ============================================================
-- MIGRACIONES INCREMENTALES v3.1 → v3.2
-- Idempotentes: seguras de ejecutar en DBs existentes
-- ============================================================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_migrate_v32()
BEGIN

    -- tenants: período de prueba
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'trial_ends_at'
    ) THEN
        ALTER TABLE tenants ADD COLUMN trial_ends_at DATETIME NULL DEFAULT NULL
            COMMENT 'Fecha de expiración del período de prueba';
    END IF;

    -- sales: campos pago mixto
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'mixed_efectivo_amount'
    ) THEN
        ALTER TABLE sales
            ADD COLUMN mixed_efectivo_amount DECIMAL(12,2) NULL
                COMMENT 'Pago mixto: monto en efectivo',
            ADD COLUMN mixed_second_method VARCHAR(30) NULL
                COMMENT 'Pago mixto: segundo método de pago',
            ADD COLUMN mixed_second_amount DECIMAL(12,2) NULL
                COMMENT 'Pago mixto: monto del segundo método';
    END IF;

    -- sales: sede_id
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'sede_id'
    ) THEN
        ALTER TABLE sales ADD COLUMN sede_id VARCHAR(36) NULL
            COMMENT 'Sede donde se realizó la venta';
        ALTER TABLE sales ADD INDEX idx_sales_sede_id (sede_id);
    END IF;

    -- cash_sessions: abonos a créditos por método de pago
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cash_sessions' AND COLUMN_NAME = 'total_credit_payments_efectivo'
    ) THEN
        ALTER TABLE cash_sessions
            ADD COLUMN total_credit_payments_efectivo DECIMAL(12,2) NULL DEFAULT 0
                COMMENT 'Abonos a créditos recibidos en efectivo durante la sesión',
            ADD COLUMN total_credit_payments_tarjeta DECIMAL(12,2) NULL DEFAULT 0
                COMMENT 'Abonos a créditos recibidos en tarjeta durante la sesión',
            ADD COLUMN total_credit_payments_transfer DECIMAL(12,2) NULL DEFAULT 0
                COMMENT 'Abonos a créditos recibidos en transferencia durante la sesión';
    END IF;

    -- purchase_invoices: pago mixto
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_invoices' AND COLUMN_NAME = 'mixed_efectivo_amount'
    ) THEN
        ALTER TABLE purchase_invoices
            ADD COLUMN mixed_efectivo_amount DECIMAL(12,2) NULL
                COMMENT 'Pago mixto: monto en efectivo',
            ADD COLUMN mixed_transferencia_amount DECIMAL(12,2) NULL
                COMMENT 'Pago mixto: monto en transferencia';
    END IF;

    -- purchase_invoice_items: precio de venta sugerido
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_invoice_items' AND COLUMN_NAME = 'sale_price'
    ) THEN
        ALTER TABLE purchase_invoice_items ADD COLUMN sale_price DECIMAL(12,2) NULL
            COMMENT 'Precio de venta del producto al momento de la compra'
            AFTER unit_cost;
    END IF;

    -- store_info: online_discount_enabled
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'online_discount_enabled'
    ) THEN
        ALTER TABLE store_info ADD COLUMN online_discount_enabled TINYINT(1) NOT NULL DEFAULT 0
            COMMENT '1 = descuento online activado';
    END IF;

    -- store_info: age gate
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'age_gate_enabled'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN age_gate_enabled TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = verificación de edad activada',
            ADD COLUMN age_gate_description TEXT NULL
                COMMENT 'Texto del aviso de verificación de edad';
    END IF;

    -- store_info: contact page
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_enabled'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN contact_page_enabled TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = página de contacto activa en storefront',
            ADD COLUMN contact_page_title VARCHAR(255) NULL
                COMMENT 'Título de la página de contacto',
            ADD COLUMN contact_page_description TEXT NULL,
            ADD COLUMN contact_page_image VARCHAR(500) NULL,
            ADD COLUMN contact_page_products TEXT NULL
                COMMENT 'JSON: array de product IDs destacados',
            ADD COLUMN contact_page_links TEXT NULL
                COMMENT 'JSON: array de links en página de contacto';
    END IF;

    -- product_recipes: include_in_cost (ya en sp_migrate_restbar_products, idempotente)
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_recipes' AND COLUMN_NAME = 'include_in_cost'
    ) THEN
        ALTER TABLE product_recipes ADD COLUMN include_in_cost TINYINT(1) NOT NULL DEFAULT 1
            COMMENT '1 = incluir este ingrediente en el costo del plato';
    END IF;

END //
DELIMITER ;
CALL sp_migrate_v32();
DROP PROCEDURE IF EXISTS sp_migrate_v32;

-- ============================================================
-- MIGRACIÓN v3.3: Módulo de Reservas de Mesas
-- ============================================================
DROP PROCEDURE IF EXISTS sp_migrate_reservations;
DELIMITER //
CREATE PROCEDURE sp_migrate_reservations()
BEGIN

    -- tenants: reservations_enabled
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'reservations_enabled'
    ) THEN
        ALTER TABLE tenants ADD COLUMN reservations_enabled TINYINT(1) NOT NULL DEFAULT 0
            COMMENT 'Reservas online activadas para este tenant';
    END IF;

    -- tenants: reservations_whatsapp
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'reservations_whatsapp'
    ) THEN
        ALTER TABLE tenants ADD COLUMN reservations_whatsapp VARCHAR(50) NULL
            COMMENT 'Número WhatsApp para notificaciones (ej: 573001234567)';
    END IF;

    -- tenants: reservations_open_time
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'reservations_open_time'
    ) THEN
        ALTER TABLE tenants ADD COLUMN reservations_open_time TIME NOT NULL DEFAULT '12:00:00'
            COMMENT 'Hora de apertura para reservas online';
    END IF;

    -- tenants: reservations_close_time
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'reservations_close_time'
    ) THEN
        ALTER TABLE tenants ADD COLUMN reservations_close_time TIME NOT NULL DEFAULT '22:00:00'
            COMMENT 'Hora de cierre para reservas online';
    END IF;

    -- tenants: reservations_slot_minutes
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'reservations_slot_minutes'
    ) THEN
        ALTER TABLE tenants ADD COLUMN reservations_slot_minutes INT NOT NULL DEFAULT 60
            COMMENT 'Duración de cada slot en minutos (15, 30, 60, 90, 120)';
    END IF;

    -- tenants: reservations_max_advance_days
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'reservations_max_advance_days'
    ) THEN
        ALTER TABLE tenants ADD COLUMN reservations_max_advance_days INT NOT NULL DEFAULT 30
            COMMENT 'Días máximos de anticipación para reservar';
    END IF;

    -- tenants: reservations_min_advance_hours
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'reservations_min_advance_hours'
    ) THEN
        ALTER TABLE tenants ADD COLUMN reservations_min_advance_hours INT NOT NULL DEFAULT 2
            COMMENT 'Horas mínimas de anticipación para reservar';
    END IF;

    -- tenants: reservations_occasions
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'reservations_occasions'
    ) THEN
        ALTER TABLE tenants ADD COLUMN reservations_occasions JSON NULL
            COMMENT 'Array de ocasiones: ["Cumpleaños","Aniversario","Cena romántica"]';
    END IF;

END //
DELIMITER ;
CALL sp_migrate_reservations();
DROP PROCEDURE IF EXISTS sp_migrate_reservations;

-- ============================================================
-- LIMPIEZA AUTOMÁTICA — Eventos MySQL (requiere event_scheduler=ON)
-- Activar con: SET GLOBAL event_scheduler = ON;
-- ============================================================

DELIMITER //

CREATE EVENT IF NOT EXISTS ev_cleanup_audit_log
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Conserva solo los últimos 90 días de audit_log
    DELETE FROM audit_log
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
END //

CREATE EVENT IF NOT EXISTS ev_cleanup_refresh_tokens
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Elimina tokens expirados o revocados
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW()
       OR revoked_at IS NOT NULL;
END //

CREATE EVENT IF NOT EXISTS ev_cleanup_login_attempts
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Conserva solo los últimos 30 días de intentos de login
    DELETE FROM login_attempts
    WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END //

CREATE EVENT IF NOT EXISTS ev_cleanup_chatbot_messages
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Elimina mensajes de sesiones con más de 60 días de inactividad
    DELETE cm FROM chatbot_messages cm
    JOIN chatbot_sessions cs ON cm.session_id = cs.id
    WHERE cs.last_activity < DATE_SUB(NOW(), INTERVAL 60 DAY);

    -- Elimina las sesiones vacías
    DELETE FROM chatbot_sessions
    WHERE last_activity < DATE_SUB(NOW(), INTERVAL 60 DAY);
END //

DELIMITER ;

-- ============================================================
-- MIGRACIÓN v3.3 — Ajustes de rendimiento
-- Idempotente: segura de ejecutar en bases de datos existentes
-- ============================================================
DROP PROCEDURE IF EXISTS sp_migrate_v33_perf;
DELIMITER //
CREATE PROCEDURE sp_migrate_v33_perf()
BEGIN

    -- -------------------------------------------------------
    -- 1. Índices compuestos en sales
    -- -------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND INDEX_NAME = 'idx_sales_tenant_date'
    ) THEN
        ALTER TABLE sales ADD INDEX idx_sales_tenant_date (tenant_id, created_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND INDEX_NAME = 'idx_sales_tenant_status_date'
    ) THEN
        ALTER TABLE sales ADD INDEX idx_sales_tenant_status_date (tenant_id, status, created_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND INDEX_NAME = 'idx_sales_tenant_customer'
    ) THEN
        ALTER TABLE sales ADD INDEX idx_sales_tenant_customer (tenant_id, customer_id);
    END IF;

    -- -------------------------------------------------------
    -- 2. Índice compuesto en sale_items
    -- -------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_items' AND INDEX_NAME = 'idx_sale_items_tenant_product'
    ) THEN
        ALTER TABLE sale_items ADD INDEX idx_sale_items_tenant_product (tenant_id, product_id);
    END IF;

    -- -------------------------------------------------------
    -- 3. Índice compuesto en stock_movements
    -- -------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_movements' AND INDEX_NAME = 'idx_stock_tenant_date'
    ) THEN
        ALTER TABLE stock_movements ADD INDEX idx_stock_tenant_date (tenant_id, created_at);
    END IF;

    -- -------------------------------------------------------
    -- 4. storefront_orders: reemplazar idx_order_status por compuesto
    -- -------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storefront_orders' AND INDEX_NAME = 'idx_order_status'
    ) THEN
        ALTER TABLE storefront_orders DROP INDEX idx_order_status;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storefront_orders' AND INDEX_NAME = 'idx_order_tenant_status'
    ) THEN
        ALTER TABLE storefront_orders ADD INDEX idx_order_tenant_status (tenant_id, status);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storefront_orders' AND INDEX_NAME = 'idx_order_tenant_date'
    ) THEN
        ALTER TABLE storefront_orders ADD INDEX idx_order_tenant_date (tenant_id, created_at);
    END IF;

    -- -------------------------------------------------------
    -- 5. products: eliminar índices simples redundantes
    -- -------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_sku'
    ) THEN
        ALTER TABLE products DROP INDEX idx_sku;
    END IF;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_barcode'
    ) THEN
        ALTER TABLE products DROP INDEX idx_barcode;
    END IF;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_stock'
    ) THEN
        ALTER TABLE products DROP INDEX idx_stock;
    END IF;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_product_type'
    ) THEN
        ALTER TABLE products DROP INDEX idx_product_type;
    END IF;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_brand'
    ) THEN
        ALTER TABLE products DROP INDEX idx_brand;
    END IF;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_serial_number'
    ) THEN
        ALTER TABLE products DROP INDEX idx_serial_number;
    END IF;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_isbn'
    ) THEN
        ALTER TABLE products DROP INDEX idx_isbn;
    END IF;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_published_store'
    ) THEN
        ALTER TABLE products DROP INDEX idx_published_store;
    END IF;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_on_offer'
    ) THEN
        ALTER TABLE products DROP INDEX idx_on_offer;
    END IF;

    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_delivery_type'
    ) THEN
        ALTER TABLE products DROP INDEX idx_delivery_type;
    END IF;

    -- Agregar índices compuestos en products
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_store'
    ) THEN
        ALTER TABLE products ADD INDEX idx_products_store (tenant_id, published_in_store);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_offer'
    ) THEN
        ALTER TABLE products ADD INDEX idx_products_offer (tenant_id, is_on_offer);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_expiry'
    ) THEN
        ALTER TABLE products ADD INDEX idx_products_expiry (tenant_id, expiry_date);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_delivery'
    ) THEN
        ALTER TABLE products ADD INDEX idx_products_delivery (tenant_id, delivery_type);
    END IF;

    -- -------------------------------------------------------
    -- 6. discount_coupons: eliminar idx_coupon_code redundante
    -- -------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'discount_coupons' AND INDEX_NAME = 'idx_coupon_code'
    ) THEN
        ALTER TABLE discount_coupons DROP INDEX idx_coupon_code;
    END IF;

    -- -------------------------------------------------------
    -- 7. rb_reservations: índice triple compuesto
    -- -------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rb_reservations' AND INDEX_NAME = 'idx_rb_res_tenant_date_status'
    ) THEN
        ALTER TABLE rb_reservations ADD INDEX idx_rb_res_tenant_date_status (tenant_id, reservation_date, status);
    END IF;

    -- -------------------------------------------------------
    -- 8. service_bookings: reemplazar idx_bookings_date por compuesto
    -- -------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_bookings' AND INDEX_NAME = 'idx_bookings_date'
    ) THEN
        ALTER TABLE service_bookings DROP INDEX idx_bookings_date;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_bookings' AND INDEX_NAME = 'idx_bookings_date'
    ) THEN
        ALTER TABLE service_bookings ADD INDEX idx_bookings_date (tenant_id, booking_date);
    END IF;

    -- -------------------------------------------------------
    -- 9. audit_log: índices compuestos
    -- -------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_log' AND INDEX_NAME = 'idx_audit_tenant_date'
    ) THEN
        ALTER TABLE audit_log ADD INDEX idx_audit_tenant_date (tenant_id, created_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_log' AND INDEX_NAME = 'idx_audit_tenant_action'
    ) THEN
        ALTER TABLE audit_log ADD INDEX idx_audit_tenant_action (tenant_id, action);
    END IF;

    -- -------------------------------------------------------
    -- 10. purchase_invoice_items: normalizar product_id a VARCHAR(36)
    -- -------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_invoice_items'
          AND COLUMN_NAME = 'product_id' AND CHARACTER_MAXIMUM_LENGTH = 50
    ) THEN
        ALTER TABLE purchase_invoice_items MODIFY COLUMN product_id VARCHAR(36) NOT NULL;
    END IF;

    -- -------------------------------------------------------
    -- 11. sp_create_tenant: secuencias de RestBar para tenants existentes
    --     (rellena tenants creados antes de esta migración)
    -- -------------------------------------------------------
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

END //
DELIMITER ;
CALL sp_migrate_v33_perf();
DROP PROCEDURE IF EXISTS sp_migrate_v33_perf;

-- ============================================================
-- MIGRACIÓN v3.4: MÓDULO PRE-ORDEN
-- Permite marcar productos como pre-orden con ventana temporal
-- y fecha estimada de envío (inspirado en Youtooz pre-order flow)
-- ============================================================
DROP PROCEDURE IF EXISTS sp_migrate_preorder;
DELIMITER //
CREATE PROCEDURE sp_migrate_preorder()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_preorder'
    ) THEN
        ALTER TABLE products
            ADD COLUMN is_preorder          TINYINT(1)  NOT NULL DEFAULT 0
                COMMENT '1 = producto en pre-orden (no requiere stock para comprar)',
            ADD COLUMN preorder_window_end  DATETIME    NULL
                COMMENT 'Hasta cuándo acepta pre-órdenes',
            ADD COLUMN preorder_ship_start  DATE        NULL
                COMMENT 'Inicio del rango de envío estimado',
            ADD COLUMN preorder_ship_end    DATE        NULL
                COMMENT 'Fin del rango de envío estimado',
            ADD COLUMN preorder_badge_text  VARCHAR(60) NOT NULL DEFAULT 'Pre-orden'
                COMMENT 'Texto del badge en la tienda',
            ADD COLUMN preorder_policy_text TEXT        NULL
                COMMENT 'Aviso legal / política de pre-orden';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_preorder'
    ) THEN
        ALTER TABLE products ADD INDEX idx_products_preorder (tenant_id, is_preorder);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storefront_order_items' AND COLUMN_NAME = 'is_preorder'
    ) THEN
        ALTER TABLE storefront_order_items
            ADD COLUMN is_preorder         TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = ítem era pre-orden al momento de comprar',
            ADD COLUMN preorder_ship_start DATE       NULL
                COMMENT 'Inicio del rango de envío prometido al cliente',
            ADD COLUMN preorder_ship_end   DATE       NULL
                COMMENT 'Fin del rango de envío prometido al cliente';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_preorder();
DROP PROCEDURE IF EXISTS sp_migrate_preorder;

-- ============================================================
-- MIGRACIÓN v3.5: MÓDULO LIKES DE MENÚ PÚBLICO
-- Permite a clientes del menú digital dar "me gusta" a platillos.
-- El comerciante ve métricas de favoritos en el módulo RestBar.
-- ============================================================
DROP PROCEDURE IF EXISTS sp_migrate_menu_likes;
DELIMITER //
CREATE PROCEDURE sp_migrate_menu_likes()
BEGIN
    -- Crear tabla si no existe
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
-- MIGRACIÓN v3.6: MÓDULO INMOBILIARIA
-- ============================================================
-- Diseño y relación con módulos existentes:
--   · SEPARADO de inventario: las propiedades son entidades únicas,
--     no tienen stock ni SKU. Usan el prefijo re_ para evitar colisiones.
--   · REUTILIZA: tenants (multi-tenant), users (auth + roles),
--     patrones de URL para archivos (imageUrl / url), y el sistema
--     de módulos por flag (como public_menu_enabled en tenants).
--   · PORTAL PÚBLICO en /inmobiliaria/[slug] análogo a /menu/[slug].
--   · STOREFRONT: la tienda existente NO se mezcla con propiedades.
--     Las propiedades tienen su propio portal y ficha digital.
--
-- Tablas nuevas:
--   re_owners           — Propietarios de inmuebles
--   re_clients          — Compradores / arrendatarios / prospectos
--   re_properties       — Inmuebles (núcleo del módulo)
--   re_property_features— Características / amenidades por inmueble
--   re_property_media   — Fotos, videos, planos, documentos
--   re_leads            — Embudo CRM (lead → cierre)
--   re_lead_activities  — Log de actividades CRM por lead
--   re_visits           — Agenda de visitas a inmuebles
--   re_contracts        — Contratos (compraventa, arriendo, admin)
--   re_rent_payments    — Cobros mensuales de arriendo
--   re_maintenances     — Solicitudes de mantenimiento / PQRS
--
-- Cambios en tablas existentes:
--   tenants.module_realestate   — Flag para habilitar el módulo
--   tenants.realestate_enabled  — Portal público activo
--   users.role ENUM             — +asesor_inmobiliario, +gerente_inmobiliario
-- ============================================================

DROP PROCEDURE IF EXISTS sp_migrate_realestate;
DELIMITER //
CREATE PROCEDURE sp_migrate_realestate()
BEGIN

    -- ────────────────────────────────────────────────────────
    -- 1. tenants: columnas del módulo inmobiliaria
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'
          AND COLUMN_NAME = 'module_realestate'
    ) THEN
        ALTER TABLE tenants
            ADD COLUMN module_realestate  TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = tenant tiene habilitado el módulo inmobiliaria',
            ADD COLUMN realestate_enabled TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = portal público de propiedades activo (/inmobiliaria/slug)';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 2. users.role: agregar roles inmobiliarios
    --    (ALTER MODIFY es idempotente si los valores ya existen)
    -- ────────────────────────────────────────────────────────
    ALTER TABLE users MODIFY COLUMN role ENUM(
        'superadmin','comerciante','vendedor','cliente','repartidor',
        'auxiliar_bodega','administrador_rb','cajero','mesero',
        'cocinero','bartender','despachador',
        'asesor_inmobiliario','gerente_inmobiliario'
    ) NOT NULL DEFAULT 'vendedor';

    -- ────────────────────────────────────────────────────────
    -- 3. re_owners — Propietarios de inmuebles
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_owners'
    ) THEN
        CREATE TABLE re_owners (
            id                VARCHAR(36)  PRIMARY KEY,
            tenant_id         VARCHAR(36)  NOT NULL,
            full_name         VARCHAR(255) NOT NULL,
            document_type     ENUM('cedula','nit','pasaporte','otro') NOT NULL DEFAULT 'cedula',
            document          VARCHAR(30)  NULL,
            phone             VARCHAR(50)  NULL,
            email             VARCHAR(255) NULL,
            address           TEXT         NULL,
            city              VARCHAR(100) NULL,
            bank_name         VARCHAR(100) NULL    COMMENT 'Banco para liquidaciones',
            bank_account      VARCHAR(50)  NULL,
            bank_account_type ENUM('ahorros','corriente') NULL,
            notes             TEXT         NULL,
            created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            INDEX idx_re_owners_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Propietarios / arrendadores de inmuebles';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 4. re_clients — Compradores, arrendatarios, prospectos
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_clients'
    ) THEN
        CREATE TABLE re_clients (
            id                VARCHAR(36)  PRIMARY KEY,
            tenant_id         VARCHAR(36)  NOT NULL,
            full_name         VARCHAR(255) NOT NULL,
            document_type     ENUM('cedula','nit','pasaporte','otro') NULL DEFAULT 'cedula',
            document          VARCHAR(30)  NULL,
            phone             VARCHAR(50)  NULL,
            email             VARCHAR(255) NULL,
            client_type       ENUM('comprador','arrendatario','inversionista','propietario','prospecto')
                              NOT NULL DEFAULT 'prospecto',
            source            VARCHAR(100) NULL    COMMENT 'Origen: web, instagram, referido, portal',
            assigned_agent_id VARCHAR(36)  NULL    COMMENT 'FK users.id — asesor responsable',
            notes             TEXT         NULL,
            created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            INDEX idx_re_clients_tenant      (tenant_id),
            INDEX idx_re_clients_type        (tenant_id, client_type),
            INDEX idx_re_clients_agent       (assigned_agent_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Clientes del módulo inmobiliario';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 5. re_properties — Inmuebles (núcleo del módulo)
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_properties'
    ) THEN
        CREATE TABLE re_properties (
            id               VARCHAR(36)  PRIMARY KEY,
            tenant_id        VARCHAR(36)  NOT NULL,
            code             VARCHAR(50)  NOT NULL  COMMENT 'Código interno del inmueble',
            title            VARCHAR(255) NOT NULL,
            description      TEXT         NULL,
            property_type    ENUM('casa','apartamento','local','oficina','bodega',
                                  'lote','finca','consultorio','hotel','proyecto')
                             NOT NULL DEFAULT 'apartamento',
            operation_type   ENUM('venta','arriendo','venta_arriendo')
                             NOT NULL DEFAULT 'venta',
            status           ENUM('disponible','vendido','arrendado','reservado',
                                  'en_negociacion','en_mantenimiento','inactivo')
                             NOT NULL DEFAULT 'disponible',
            -- Precios
            price            DECIMAL(15,2) NOT NULL DEFAULT 0   COMMENT 'Precio de venta o canon de arriendo',
            admin_fee        DECIMAL(12,2) NULL                 COMMENT 'Cuota de administración mensual',
            -- Ubicación
            address          VARCHAR(500) NULL,
            city             VARCHAR(100) NULL,
            neighborhood     VARCHAR(100) NULL    COMMENT 'Barrio',
            state_province   VARCHAR(100) NULL    COMMENT 'Departamento / provincia',
            country          VARCHAR(100) NOT NULL DEFAULT 'Colombia',
            lat              DECIMAL(10,8) NULL,
            lng              DECIMAL(11,8) NULL,
            stratum          TINYINT      NULL    COMMENT 'Estrato socioeconómico 1-6 (Colombia)',
            -- Características numéricas
            area_m2          DECIMAL(10,2) NULL   COMMENT 'Área total en m²',
            built_area_m2    DECIMAL(10,2) NULL   COMMENT 'Área construida en m²',
            bedrooms         TINYINT       NULL DEFAULT 0,
            bathrooms        TINYINT       NULL DEFAULT 0,
            garages          TINYINT       NULL DEFAULT 0,
            floors           TINYINT       NULL DEFAULT 1,
            age_years        SMALLINT      NULL   COMMENT 'Antigüedad en años',
            -- Relaciones
            owner_id         VARCHAR(36)  NULL    COMMENT 'FK re_owners.id',
            assigned_agent_id VARCHAR(36) NULL    COMMENT 'FK users.id — asesor responsable',
            -- Publicación
            is_featured      TINYINT(1)   NOT NULL DEFAULT 0,
            is_published     TINYINT(1)   NOT NULL DEFAULT 0,
            published_at     TIMESTAMP    NULL,
            cover_image_url  TEXT         NULL    COMMENT 'URL de la foto principal',
            -- Metadatos
            tags             JSON         NULL    COMMENT 'Etiquetas: ["oportunidad","nuevo","rebajado"]',
            seo_slug         VARCHAR(255) NULL    COMMENT 'Slug para URL del portal público',
            created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE  KEY uq_re_code       (tenant_id, code),
            FOREIGN KEY (tenant_id)      REFERENCES tenants(id) ON DELETE CASCADE,
            INDEX idx_re_prop_type       (tenant_id, property_type),
            INDEX idx_re_prop_status     (tenant_id, status),
            INDEX idx_re_prop_op         (tenant_id, operation_type),
            INDEX idx_re_prop_published  (tenant_id, is_published),
            INDEX idx_re_prop_featured   (tenant_id, is_featured),
            INDEX idx_re_prop_owner      (owner_id),
            INDEX idx_re_prop_agent      (assigned_agent_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Inmuebles del módulo inmobiliario';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 6. re_property_features — Características / amenidades
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_property_features'
    ) THEN
        CREATE TABLE re_property_features (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            property_id VARCHAR(36)  NOT NULL,
            feature     VARCHAR(100) NOT NULL
                COMMENT 'piscina, ascensor, vigilancia, terraza, patio, balcon, aire_acondicionado, parqueadero, bodega, amoblado, mascotas, gym, sauna, salon_comunal, cancha, porteria',
            UNIQUE KEY uq_prop_feat (property_id, feature),
            FOREIGN KEY (property_id) REFERENCES re_properties(id) ON DELETE CASCADE,
            INDEX idx_re_feat_prop (property_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Amenidades y características por inmueble';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 7. re_property_media — Fotos, videos, planos, documentos
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_property_media'
    ) THEN
        CREATE TABLE re_property_media (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            property_id VARCHAR(36)  NOT NULL,
            media_type  ENUM('foto','video','plano','documento','tour_360')
                        NOT NULL DEFAULT 'foto',
            url         TEXT         NOT NULL,
            caption     VARCHAR(255) NULL,
            sort_order  SMALLINT     NOT NULL DEFAULT 0,
            is_cover    TINYINT(1)   NOT NULL DEFAULT 0,
            created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES re_properties(id) ON DELETE CASCADE,
            INDEX idx_re_media_prop (property_id),
            INDEX idx_re_media_type (property_id, media_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Multimedia asociada a inmuebles';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 8. re_leads — Embudo CRM inmobiliario
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_leads'
    ) THEN
        CREATE TABLE re_leads (
            id                VARCHAR(36)  PRIMARY KEY,
            tenant_id         VARCHAR(36)  NOT NULL,
            client_id         VARCHAR(36)  NULL     COMMENT 'FK re_clients.id (se crea cuando avanza)',
            full_name         VARCHAR(255) NOT NULL,
            phone             VARCHAR(50)  NULL,
            email             VARCHAR(255) NULL,
            source            VARCHAR(100) NULL     COMMENT 'web, instagram, tiktok, referido, portal, whatsapp',
            interested_in     ENUM('venta','arriendo','ambos') NOT NULL DEFAULT 'venta',
            budget_min        DECIMAL(15,2) NULL,
            budget_max        DECIMAL(15,2) NULL,
            property_type_pref VARCHAR(100) NULL    COMMENT 'Tipo de inmueble que busca',
            city_pref         VARCHAR(100) NULL     COMMENT 'Ciudad o zona de preferencia',
            stage             ENUM('nuevo','contactado','interesado','visita',
                                   'negociacion','cierre','posventa','perdido')
                              NOT NULL DEFAULT 'nuevo',
            assigned_agent_id VARCHAR(36)  NULL,
            property_id       VARCHAR(36)  NULL     COMMENT 'Inmueble de interés principal',
            notes             TEXT         NULL,
            last_contact_at   TIMESTAMP    NULL,
            created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            INDEX idx_re_leads_tenant  (tenant_id),
            INDEX idx_re_leads_stage   (tenant_id, stage),
            INDEX idx_re_leads_agent   (assigned_agent_id),
            INDEX idx_re_leads_prop    (property_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Pipeline CRM de leads inmobiliarios';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 9. re_lead_activities — Log de actividad CRM
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_lead_activities'
    ) THEN
        CREATE TABLE re_lead_activities (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id     VARCHAR(36)  NOT NULL,
            lead_id       VARCHAR(36)  NOT NULL,
            activity_type ENUM('llamada','whatsapp','email','visita','nota',
                               'cambio_etapa','tarea') NOT NULL DEFAULT 'nota',
            description   TEXT         NOT NULL,
            created_by    VARCHAR(36)  NULL     COMMENT 'FK users.id — asesor que registra',
            scheduled_at  DATETIME     NULL     COMMENT 'Para tareas/recordatorios futuros',
            completed     TINYINT(1)   NOT NULL DEFAULT 1,
            created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lead_id)   REFERENCES re_leads(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            INDEX idx_re_act_lead   (lead_id),
            INDEX idx_re_act_tenant (tenant_id),
            INDEX idx_re_act_sched  (tenant_id, scheduled_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Historial de actividades CRM por lead';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 10. re_visits — Agenda de visitas a inmuebles
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_visits'
    ) THEN
        CREATE TABLE re_visits (
            id                VARCHAR(36) PRIMARY KEY,
            tenant_id         VARCHAR(36) NOT NULL,
            property_id       VARCHAR(36) NOT NULL,
            client_id         VARCHAR(36) NULL,
            lead_id           VARCHAR(36) NULL,
            assigned_agent_id VARCHAR(36) NULL,
            scheduled_at      DATETIME    NOT NULL,
            duration_minutes  SMALLINT    NOT NULL DEFAULT 30,
            visit_type        ENUM('presencial','virtual') NOT NULL DEFAULT 'presencial',
            status            ENUM('programada','confirmada','realizada','cancelada','no_show')
                              NOT NULL DEFAULT 'programada',
            feedback          TEXT        NULL     COMMENT 'Observaciones del cliente tras la visita',
            rating            TINYINT     NULL     COMMENT 'Calificación 1-5 dada por el cliente',
            notes             TEXT        NULL,
            created_at        TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id)   REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (property_id) REFERENCES re_properties(id) ON DELETE CASCADE,
            INDEX idx_re_vis_tenant   (tenant_id),
            INDEX idx_re_vis_property (property_id),
            INDEX idx_re_vis_date     (tenant_id, scheduled_at),
            INDEX idx_re_vis_agent    (assigned_agent_id),
            INDEX idx_re_vis_status   (tenant_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Agenda de visitas a inmuebles';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 11. re_contracts — Contratos (compraventa, arriendo, etc.)
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_contracts'
    ) THEN
        CREATE TABLE re_contracts (
            id               VARCHAR(36)  PRIMARY KEY,
            tenant_id        VARCHAR(36)  NOT NULL,
            contract_number  VARCHAR(30)  NOT NULL,
            contract_type    ENUM('compraventa','arrendamiento','administracion',
                                  'reserva','exclusividad') NOT NULL,
            property_id      VARCHAR(36)  NOT NULL,
            client_id        VARCHAR(36)  NOT NULL,
            owner_id         VARCHAR(36)  NULL,
            start_date       DATE         NOT NULL,
            end_date         DATE         NULL,
            canon            DECIMAL(15,2) NULL    COMMENT 'Canon mensual de arriendo',
            sale_price       DECIMAL(15,2) NULL    COMMENT 'Precio de venta acordado',
            commission_pct   DECIMAL(5,2)  NULL    COMMENT 'Porcentaje de comisión',
            commission_amount DECIMAL(15,2) NULL   COMMENT 'Monto de comisión calculado',
            deposit_amount   DECIMAL(15,2) NULL    COMMENT 'Depósito / cuota inicial',
            status           ENUM('borrador','activo','vencido','renovado',
                                  'terminado','cancelado') NOT NULL DEFAULT 'borrador',
            notes            TEXT         NULL,
            created_by       VARCHAR(36)  NULL     COMMENT 'FK users.id',
            created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE  KEY uq_re_contract_num  (tenant_id, contract_number),
            FOREIGN KEY (tenant_id)         REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (property_id)       REFERENCES re_properties(id),
            FOREIGN KEY (client_id)         REFERENCES re_clients(id),
            INDEX idx_re_con_tenant   (tenant_id),
            INDEX idx_re_con_property (property_id),
            INDEX idx_re_con_client   (client_id),
            INDEX idx_re_con_status   (tenant_id, status),
            INDEX idx_re_con_type     (tenant_id, contract_type),
            INDEX idx_re_con_end      (end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Contratos inmobiliarios (compraventa y arriendo)';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 12. re_rent_payments — Cobros mensuales de arriendo
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_rent_payments'
    ) THEN
        CREATE TABLE re_rent_payments (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id      VARCHAR(36)   NOT NULL,
            contract_id    VARCHAR(36)   NOT NULL,
            period_month   TINYINT       NOT NULL COMMENT '1-12',
            period_year    SMALLINT      NOT NULL,
            due_date       DATE          NOT NULL,
            canon          DECIMAL(15,2) NOT NULL,
            late_fee       DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Intereses / recargos por mora',
            total_amount   DECIMAL(15,2) NOT NULL,
            paid_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
            paid_at        TIMESTAMP     NULL,
            payment_method VARCHAR(30)   NULL
                COMMENT 'efectivo, transferencia, nequi, daviplata, tarjeta, pse',
            status         ENUM('pendiente','pagado','parcial','vencido')
                           NOT NULL DEFAULT 'pendiente',
            receipt_url    TEXT          NULL     COMMENT 'URL del comprobante',
            notes          TEXT          NULL,
            created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
            updated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id)   REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (contract_id) REFERENCES re_contracts(id) ON DELETE CASCADE,
            INDEX idx_re_pay_contract (contract_id),
            INDEX idx_re_pay_status   (tenant_id, status),
            INDEX idx_re_pay_due      (due_date),
            INDEX idx_re_pay_period   (contract_id, period_year, period_month)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Registro de pagos mensuales de arriendo';
    END IF;

    -- ────────────────────────────────────────────────────────
    -- 13. re_maintenances — Mantenimiento / PQRS
    -- ────────────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 're_maintenances'
    ) THEN
        CREATE TABLE re_maintenances (
            id             VARCHAR(36)  PRIMARY KEY,
            tenant_id      VARCHAR(36)  NOT NULL,
            property_id    VARCHAR(36)  NOT NULL,
            contract_id    VARCHAR(36)  NULL     COMMENT 'Contrato relacionado (arriendos)',
            reported_by    VARCHAR(36)  NULL     COMMENT 'FK re_clients.id o users.id',
            title          VARCHAR(255) NOT NULL,
            description    TEXT         NULL,
            category       VARCHAR(100) NULL
                COMMENT 'electrico, plomeria, pintura, cerrajeria, gas, structural, otro',
            priority       ENUM('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
            status         ENUM('solicitado','en_revision','aprobado',
                                'en_proceso','completado','cancelado')
                           NOT NULL DEFAULT 'solicitado',
            estimated_cost DECIMAL(12,2) NULL,
            actual_cost    DECIMAL(12,2) NULL,
            assigned_to    VARCHAR(255) NULL     COMMENT 'Nombre del técnico externo',
            scheduled_at   DATETIME     NULL,
            completed_at   DATETIME     NULL,
            evidence_urls  JSON         NULL     COMMENT 'Array de URLs de fotos/videos de evidencia',
            notes          TEXT         NULL,
            created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id)   REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (property_id) REFERENCES re_properties(id) ON DELETE CASCADE,
            INDEX idx_re_maint_tenant   (tenant_id),
            INDEX idx_re_maint_property (property_id),
            INDEX idx_re_maint_status   (tenant_id, status),
            INDEX idx_re_maint_priority (tenant_id, priority)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT 'Solicitudes de mantenimiento y PQRS por inmueble';
    END IF;

END //
DELIMITER ;
CALL sp_migrate_realestate();
DROP PROCEDURE IF EXISTS sp_migrate_realestate;

-- ============================================================
-- MIGRACIÓN v3.7 — Tapicería / Órdenes de Trabajo
-- ============================================================

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_migrate_workorders()
BEGIN

    -- Habilitar módulo en tenants
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

    -- Secuencia de numeración
    CREATE TABLE IF NOT EXISTS work_order_sequence (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id      VARCHAR(36) NOT NULL,
        prefix         VARCHAR(10) NOT NULL DEFAULT 'OT',
        current_number INT         NOT NULL DEFAULT 0,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE INDEX idx_wo_seq_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT 'Contador por tenant para OT-XXXX';

    -- Órdenes de trabajo
    CREATE TABLE IF NOT EXISTS work_orders (
        id               VARCHAR(36)  PRIMARY KEY,
        tenant_id        VARCHAR(36)  NOT NULL,
        order_number     VARCHAR(20)  NOT NULL,
        customer_id      VARCHAR(36)  NULL,
        customer_name    VARCHAR(255) NOT NULL,
        customer_phone   VARCHAR(50)  NULL,
        item_description VARCHAR(500) NOT NULL,
        item_type        VARCHAR(100) NOT NULL DEFAULT 'vehiculo'
                         COMMENT 'vehiculo, moto, silla, sofa, bote, camion, otro',
        job_type         VARCHAR(100) NOT NULL DEFAULT 'tapizado_completo'
                         COMMENT 'tapizado_completo, tapizado_parcial, reparacion, restauracion, tapizado_techo, alfombrado, otro',
        fabric_description VARCHAR(300) NULL,
        quoted_price     DECIMAL(12,2) NOT NULL DEFAULT 0,
        advance_paid     DECIMAL(12,2) NOT NULL DEFAULT 0,
        received_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        promised_at      DATE         NULL,
        delivered_at     TIMESTAMP    NULL,
        status           ENUM('recibido','cotizado','aprobado','en_proceso','listo','entregado','cancelado')
                         NOT NULL DEFAULT 'recibido',
        notes            TEXT         NULL,
        assigned_to      VARCHAR(36)  NULL,
        sale_id          VARCHAR(36)  NULL,
        photos_in        JSON         NULL COMMENT 'URLs de fotos al recibir',
        photos_out       JSON         NULL COMMENT 'URLs de fotos al entregar',
        created_by       VARCHAR(36)  NULL,
        created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id)   REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id)   ON DELETE SET NULL,
        FOREIGN KEY (created_by)  REFERENCES users(id)   ON DELETE SET NULL,
        UNIQUE INDEX idx_wo_number         (tenant_id, order_number),
        INDEX        idx_wo_tenant_status  (tenant_id, status),
        INDEX        idx_wo_promised       (tenant_id, promised_at),
        INDEX        idx_wo_customer       (tenant_id, customer_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT 'Órdenes de trabajo de tapicería';

    -- Materiales utilizados por orden
    CREATE TABLE IF NOT EXISTS work_order_materials (
        id            INT          PRIMARY KEY AUTO_INCREMENT,
        tenant_id     VARCHAR(36)  NOT NULL,
        work_order_id VARCHAR(36)  NOT NULL,
        product_id    VARCHAR(36)  NULL,
        product_name  VARCHAR(255) NOT NULL,
        quantity      DECIMAL(10,3) NOT NULL DEFAULT 1,
        unit          VARCHAR(50)  NOT NULL DEFAULT 'unidad',
        unit_cost     DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
        notes         TEXT         NULL,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        INDEX idx_wo_mat_order (work_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT 'Materiales/telas usados en cada orden de trabajo';

    -- Pagos recibidos por orden
    CREATE TABLE IF NOT EXISTS work_order_payments (
        id             INT          PRIMARY KEY AUTO_INCREMENT,
        tenant_id      VARCHAR(36)  NOT NULL,
        work_order_id  VARCHAR(36)  NOT NULL,
        amount         DECIMAL(12,2) NOT NULL,
        payment_method ENUM('efectivo','tarjeta','transferencia','nequi','otro')
                       NOT NULL DEFAULT 'efectivo',
        notes          TEXT         NULL,
        received_by    VARCHAR(36)  NULL,
        created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (received_by)   REFERENCES users(id)       ON DELETE SET NULL,
        INDEX idx_wo_pay_order  (work_order_id),
        INDEX idx_wo_pay_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT 'Cobros parciales por orden de trabajo';

END //
DELIMITER ;
CALL sp_migrate_workorders();
DROP PROCEDURE IF EXISTS sp_migrate_workorders;

-- ============================================================
-- MIGRACIÓN v3.3 — Módulos de Control, Merma, WhatsApp y Misceláneos
-- ============================================================

-- ── 1. Módulo de control de módulos por tenant ─────────────────────────────
DELIMITER //
DROP PROCEDURE IF EXISTS sp_migrate_v33_modules //
CREATE PROCEDURE sp_migrate_v33_modules()
BEGIN
    -- tenants.enabled_modules — array JSON de módulos activos (NULL = usar defaults)
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'enabled_modules'
    ) THEN
        ALTER TABLE tenants
            ADD COLUMN enabled_modules JSON NULL
            COMMENT 'Array de IDs de módulos habilitados. NULL = usar defaults por tipo de negocio';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_v33_modules();
DROP PROCEDURE IF EXISTS sp_migrate_v33_modules;

-- ── 2. Barra de anuncio: velocidad de desplazamiento ──────────────────────
DELIMITER //
DROP PROCEDURE IF EXISTS sp_migrate_v33_announcement //
CREATE PROCEDURE sp_migrate_v33_announcement()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_announcement_bar' AND COLUMN_NAME = 'scroll_speed'
    ) THEN
        ALTER TABLE store_announcement_bar
            ADD COLUMN scroll_speed TINYINT NOT NULL DEFAULT 3
            COMMENT 'Velocidad del marquee: 1=muy lento, 2=lento, 3=normal, 4=rápido, 5=muy rápido';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_v33_announcement();
DROP PROCEDURE IF EXISTS sp_migrate_v33_announcement;

-- ── 4. Merma / Waste records ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waste_records (
    id               VARCHAR(36)   NOT NULL PRIMARY KEY,
    tenant_id        VARCHAR(36)   NOT NULL,
    product_id       VARCHAR(36)   NULL        COMMENT 'FK a products (opcional)',
    product_name     VARCHAR(200)  NOT NULL,
    quantity         DECIMAL(10,3) NOT NULL,
    unit             VARCHAR(20)   NOT NULL DEFAULT 'unidad',
    waste_type       ENUM('natural','operativa','administrativa','vencimiento')
                     NOT NULL DEFAULT 'operativa',
    reason           ENUM('quemado','vencido','mal_corte','devolucion','consumo_interno',
                          'robo','cortesia','sobreporcion','dano','otro')
                     NOT NULL DEFAULT 'otro',
    cost_value       DECIMAL(12,2) NOT NULL DEFAULT 0,
    area             ENUM('cocina','bar','general') NOT NULL DEFAULT 'cocina',
    responsible_id   VARCHAR(36)   NULL,
    responsible_name VARCHAR(100)  NULL,
    notes            TEXT          NULL,
    photo_url        VARCHAR(500)  NULL,
    recorded_by      VARCHAR(36)   NOT NULL,
    recorded_by_name VARCHAR(100)  NOT NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wr_tenant_date (tenant_id, created_at),
    INDEX idx_wr_product     (product_id),
    INDEX idx_wr_area        (area)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Registro de mermas y pérdidas operativas del gastrobar';

-- ── 5. Niveles PAR de inventario ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS par_levels (
    id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
    tenant_id           VARCHAR(36)   NOT NULL,
    product_id          VARCHAR(36)   NOT NULL,
    daily_usage         DECIMAL(10,3) NOT NULL DEFAULT 0  COMMENT 'Consumo promedio diario',
    days_between_orders INT           NOT NULL DEFAULT 1  COMMENT 'Frecuencia de pedido en días',
    safety_stock        DECIMAL(10,3) NOT NULL DEFAULT 0  COMMENT 'Stock de seguridad mínimo',
    area                ENUM('cocina','bar','general') NOT NULL DEFAULT 'cocina',
    notes               TEXT          NULL,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pl_tenant_product (tenant_id, product_id),
    INDEX idx_pl_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Niveles PAR para cálculo de sugerencias de compra (gastrobar)';

-- ── 6. Solicitudes de desarrollo ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dev_requests (
    id               VARCHAR(36)   NOT NULL PRIMARY KEY,
    tenant_id        VARCHAR(36)   NOT NULL,
    user_id          VARCHAR(36)   NOT NULL,
    tenant_name      VARCHAR(255)  NULL,
    requester_name   VARCHAR(255)  NOT NULL,
    title            VARCHAR(300)  NOT NULL,
    description      TEXT          NOT NULL,
    type             ENUM('objetivo','mejora','actualizacion','bug','otro')
                     NOT NULL DEFAULT 'mejora',
    priority         ENUM('baja','media','alta') NOT NULL DEFAULT 'media',
    status           ENUM('pendiente','en_revision','cotizado','aprobado','en_progreso','completado','rechazado')
                     NOT NULL DEFAULT 'pendiente',
    estimated_hours  DECIMAL(6,2)  NULL,
    price_per_hour   DECIMAL(10,2) NULL,
    total_price      DECIMAL(12,2) NULL,
    admin_notes      TEXT          NULL,
    rejection_reason VARCHAR(500)  NULL,
    paid_at          TIMESTAMP     NULL,
    completed_at     TIMESTAMP     NULL,
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE RESTRICT,
    INDEX idx_dev_req_tenant  (tenant_id),
    INDEX idx_dev_req_status  (status),
    INDEX idx_dev_req_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Solicitudes de nuevas funcionalidades enviadas por comerciantes';

-- ── 7. Direcciones guardadas del usuario ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_addresses (
    id                  VARCHAR(36)    NOT NULL PRIMARY KEY,
    user_id             VARCHAR(36)    NOT NULL,
    label               VARCHAR(100)   NOT NULL DEFAULT 'Mi dirección',
    department          VARCHAR(500)   NULL,
    municipality        VARCHAR(500)   NULL,
    address             VARCHAR(500)   NULL,
    neighborhood        VARCHAR(500)   NULL,
    delivery_latitude   DECIMAL(10,7)  NULL,
    delivery_longitude  DECIMAL(10,7)  NULL,
    is_default          TINYINT(1)     NOT NULL DEFAULT 0,
    created_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ua_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Direcciones de entrega guardadas por los clientes';

-- ── 8. Registro de acciones del agente IA ──────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_actions (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    tenant_id   VARCHAR(36)  NOT NULL,
    session_id  VARCHAR(36)  NULL,
    channel     ENUM('chat','whatsapp','voice','web') NOT NULL DEFAULT 'chat',
    tool_name   VARCHAR(100) NOT NULL,
    tool_input  JSON         NULL,
    tool_output JSON         NULL,
    success     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_agent_actions_tenant  (tenant_id),
    INDEX idx_agent_actions_session (session_id),
    INDEX idx_agent_actions_tool    (tenant_id, tool_name),
    INDEX idx_agent_actions_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Auditoría de herramientas usadas por el agente WhatsApp/IA';

-- ── 9. Columnas WhatsApp / Agente en chatbot_sessions y chatbot_config ──────
DELIMITER //
DROP PROCEDURE IF EXISTS sp_migrate_v33_chatbot //
CREATE PROCEDURE sp_migrate_v33_chatbot()
BEGIN
    -- chatbot_sessions: human_takeover
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chatbot_sessions' AND COLUMN_NAME = 'human_takeover'
    ) THEN
        ALTER TABLE chatbot_sessions
            ADD COLUMN human_takeover TINYINT(1) NOT NULL DEFAULT 0
            COMMENT '1 = agente silenciado, responde un humano';
    END IF;

    -- chatbot_sessions: channel
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chatbot_sessions' AND COLUMN_NAME = 'channel'
    ) THEN
        ALTER TABLE chatbot_sessions
            ADD COLUMN channel ENUM('web','whatsapp','voice','api') NOT NULL DEFAULT 'web'
            COMMENT 'Canal de origen de la sesión';
    END IF;

    -- chatbot_config: whatsapp_enabled
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chatbot_config' AND COLUMN_NAME = 'whatsapp_enabled'
    ) THEN
        ALTER TABLE chatbot_config
            ADD COLUMN whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0
            COMMENT '1 = agente activo en WhatsApp';
    END IF;

    -- chatbot_config: whatsapp_number
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chatbot_config' AND COLUMN_NAME = 'whatsapp_number'
    ) THEN
        ALTER TABLE chatbot_config
            ADD COLUMN whatsapp_number VARCHAR(50) NULL
            COMMENT 'Número de WhatsApp del negocio';
    END IF;

    -- chatbot_config: evolution_instance
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chatbot_config' AND COLUMN_NAME = 'evolution_instance'
    ) THEN
        ALTER TABLE chatbot_config
            ADD COLUMN evolution_instance VARCHAR(100) NULL
            COMMENT 'Nombre de la instancia en Evolution API';
    END IF;

    -- chatbot_config: agent_tools
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chatbot_config' AND COLUMN_NAME = 'agent_tools'
    ) THEN
        ALTER TABLE chatbot_config
            ADD COLUMN agent_tools JSON NULL
            COMMENT 'Herramientas habilitadas para el agente';
    END IF;

    -- chatbot_config: working_hours
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chatbot_config' AND COLUMN_NAME = 'working_hours'
    ) THEN
        ALTER TABLE chatbot_config
            ADD COLUMN working_hours JSON NULL
            COMMENT 'Horario activo del agente';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_v33_chatbot();
DROP PROCEDURE IF EXISTS sp_migrate_v33_chatbot;

-- ============================================================
-- MIGRACIÓN v3.4 — inventory_holds + storefront_orders + store_info + announcement_bar
-- ============================================================

-- inventory_holds: reserva de stock durante el checkout
CREATE TABLE IF NOT EXISTS inventory_holds (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id    VARCHAR(36)     NOT NULL,
    tenant_id   VARCHAR(36)     NOT NULL,
    product_id  VARCHAR(36)     NOT NULL,
    quantity    INT             NOT NULL DEFAULT 1,
    expires_at  DATETIME        NOT NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_ih_order  (order_id),
    INDEX idx_ih_tenant (tenant_id),
    INDEX idx_ih_product_tenant (product_id, tenant_id),
    INDEX idx_ih_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- storefront_orders: columnas de pago gateway y reembolso
DELIMITER //
DROP PROCEDURE IF EXISTS sp_migrate_v34_orders //
CREATE PROCEDURE sp_migrate_v34_orders()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storefront_orders' AND COLUMN_NAME = 'gateway_payment_id'
    ) THEN
        ALTER TABLE storefront_orders
            ADD COLUMN gateway_payment_id VARCHAR(100) NULL COMMENT 'ID del pago en el gateway (MP, etc)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storefront_orders' AND COLUMN_NAME = 'refund_status'
    ) THEN
        ALTER TABLE storefront_orders
            ADD COLUMN refund_status VARCHAR(30) NULL COMMENT 'Estado del reembolso si aplica';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_v34_orders();
DROP PROCEDURE IF EXISTS sp_migrate_v34_orders;

-- store_info: columnas de configuración de tienda
DELIMITER //
DROP PROCEDURE IF EXISTS sp_migrate_v34_store_info //
CREATE PROCEDURE sp_migrate_v34_store_info()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'allow_contraentrega'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN allow_contraentrega TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = acepta pago contra entrega';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'online_discount_enabled'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN online_discount_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = aplica 10% descuento online MP';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'show_info_module'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN show_info_module TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = mostrar módulo info en tienda';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'info_module_description'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN info_module_description TEXT NULL COMMENT 'Descripción del módulo de info';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_enabled'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN contact_page_enabled TINYINT(1) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_title'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN contact_page_title VARCHAR(255) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_description'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN contact_page_description TEXT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_image'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN contact_page_image VARCHAR(500) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_links'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN contact_page_links TEXT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'contact_page_link_theme'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN contact_page_link_theme VARCHAR(20) NULL DEFAULT 'theme1';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'enable_iva'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN enable_iva TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = aplicar IVA 19% al registrar venta';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_info' AND COLUMN_NAME = 'meta_pixel_id'
    ) THEN
        ALTER TABLE store_info
            ADD COLUMN meta_pixel_id VARCHAR(100) NULL COMMENT 'ID del píxel de Meta/Facebook Ads';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_v34_store_info();
DROP PROCEDURE IF EXISTS sp_migrate_v34_store_info;

-- store_announcement_bar: velocidad de desplazamiento
DELIMITER //
DROP PROCEDURE IF EXISTS sp_migrate_v34_announcement //
CREATE PROCEDURE sp_migrate_v34_announcement()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_announcement_bar' AND COLUMN_NAME = 'scroll_speed'
    ) THEN
        ALTER TABLE store_announcement_bar
            ADD COLUMN scroll_speed TINYINT UNSIGNED NOT NULL DEFAULT 3
            COMMENT '1=muy lento … 5=muy rápido';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_v34_announcement();
DROP PROCEDURE IF EXISTS sp_migrate_v34_announcement;

-- ============================================================
-- MIGRACIÓN v3.8 — Tracker Financiero Gastrobar + Categorías CRUD
-- [2026-05-27]
-- ============================================================

-- ── 1. categories: nuevas columnas para CRUD completo ─────────────────────────
DELIMITER //
DROP PROCEDURE IF EXISTS sp_migrate_v38_categories //
CREATE PROCEDURE sp_migrate_v38_categories()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'is_active'
    ) THEN
        ALTER TABLE categories
            ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1
                COMMENT 'Visible en POS/inventario (1=activa, 0=oculta)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'color'
    ) THEN
        ALTER TABLE categories
            ADD COLUMN color VARCHAR(7) NULL
                COMMENT 'Color hex de la categoría: "#6366f1"';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'sort_order'
    ) THEN
        ALTER TABLE categories
            ADD COLUMN sort_order INT NOT NULL DEFAULT 0
                COMMENT 'Orden de visualización ascendente';
    END IF;
END //
DELIMITER ;
CALL sp_migrate_v38_categories();
DROP PROCEDURE IF EXISTS sp_migrate_v38_categories;

-- ── 2. rb_gastos — Gastos variables del gastrobar ────────────────────────────
CREATE TABLE IF NOT EXISTS rb_gastos (
    id            VARCHAR(36)   NOT NULL PRIMARY KEY,
    tenant_id     VARCHAR(36)   NOT NULL,
    concepto      VARCHAR(255)  NOT NULL     COMMENT 'Descripción del gasto',
    categoria     VARCHAR(50)   NOT NULL DEFAULT 'egreso',
    cantidad      DECIMAL(10,2) NOT NULL DEFAULT 1,
    valor_unitario DECIMAL(12,2) NOT NULL,
    total         DECIMAL(12,2) NOT NULL,
    notas         TEXT          NULL,
    registered_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                  COMMENT 'Timestamp automático del servidor al registrar',
    created_by    VARCHAR(36)   NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_rb_gastos_tenant_date (tenant_id, registered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Gastos variables del gastrobar (egresos operativos)';

-- ── 3. rb_ingresos_diarios — Ingresos diarios del gastrobar ──────────────────
CREATE TABLE IF NOT EXISTS rb_ingresos_diarios (
    id           VARCHAR(36)   NOT NULL PRIMARY KEY,
    tenant_id    VARCHAR(36)   NOT NULL,
    fecha        DATE          NOT NULL     COMMENT 'Fecha del día reportado',
    num_pedidos  INT           NOT NULL DEFAULT 0,
    valor_ventas DECIMAL(12,2) NOT NULL DEFAULT 0,
    ganancia     DECIMAL(12,2) NOT NULL DEFAULT 0,
    notas        TEXT          NULL,
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_rb_ing_tenant_fecha (tenant_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Ingresos diarios del gastrobar (upsert por fecha)';

-- ── 4. rb_gastos_fijos — Gastos fijos recurrentes del gastrobar ──────────────
CREATE TABLE IF NOT EXISTS rb_gastos_fijos (
    id        VARCHAR(36)   NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36)   NOT NULL,
    nombre    VARCHAR(255)  NOT NULL     COMMENT 'Nombre del gasto fijo (arriendo, servicios, etc.)',
    valor     DECIMAL(12,2) NOT NULL,
    periodo   ENUM('quincenal','semanal','mensual') NOT NULL DEFAULT 'quincenal',
    is_active TINYINT(1)   NOT NULL DEFAULT 1,
    created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_rb_gastos_fijos_tenant (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Gastos fijos recurrentes del gastrobar (para resumen quincenal)';

-- ============================================================
-- FIN DEL SCRIPT v3.8 Multi-Tenant
-- ============================================================
-- CREDENCIALES POR DEFECTO:
--   Superadmin:   superadmin@stockpro.com  / admin123
--   Comerciante:  comerciante@stockpro.com / admin123
--   Vendedor:     vendedor@stockpro.com    / admin123
-- ============================================================
-- PERFUMES BOM:
--   Perfume Larry White 100ML → $75,000 con IVA (43 extractos + envase + caja)
--   Perfume Larry White 50ML  → $38,000 con IVA (22 extractos + envase + caja)
--   Perfume Larry White 30ML  → $22,000 con IVA (13 extractos + envase + caja)
-- ============================================================
