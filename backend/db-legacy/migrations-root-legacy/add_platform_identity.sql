-- ============================================================================
-- Migración: Capa de IDENTIDAD CROSS-COMERCIO (platform user)
-- Fecha: 2026-06-05
-- ============================================================================
-- Decisión de arquitectura:
--   `users` con role='cliente' ES el "platform_user" (identidad global única,
--   email/cedula únicos, tenant_id puede ser NULL para clientes de plataforma).
--   No se crea una tabla platform_users aparte para no duplicar identidad ni
--   romper auth: users ya cumple ese rol.
--
--   Lo que faltaba: la RELACIÓN del cliente con CADA comercio que visita, con
--   datos específicos por tienda (dirección de entrega preferida, notas del
--   comerciante, cupo de crédito). Eso vive en customer_tenant_profiles.
--
--   `customers` se mantiene intacta: es para clientes de MOSTRADOR que el
--   comerciante registra manualmente en el POS (pueden no tener cuenta).
--   `customer_tenant_profiles` es para clientes con CUENTA (users) que compran
--   online en uno o varios comercios.
--
-- Nota sobre storefront_orders.client_user_id:
--   Hoy es NULL-able (permite checkout de invitado). NO lo forzamos a NOT NULL
--   en esta migración para no romper pedidos de invitado existentes. Si más
--   adelante se exige cuenta para comprar, se puede endurecer con:
--     -- ALTER TABLE storefront_orders MODIFY client_user_id VARCHAR(36) NOT NULL;
-- ============================================================================
USE daimuz_lopbuk;
CREATE TABLE IF NOT EXISTS customer_tenant_profiles (
    platform_user_id VARCHAR(36)  NOT NULL COMMENT 'FK a users.id (cliente con cuenta global)',
    tenant_id        VARCHAR(36)  NOT NULL COMMENT 'Comercio donde tiene actividad',
    -- Dirección preferida para ESTE comercio (geo para domicilios, consistente con users/orders)
    address          TEXT         NULL COMMENT 'Dirección preferida para este comercio',
    neighborhood     VARCHAR(255) NULL COMMENT 'Barrio — crítico para domicilios',
    municipality     VARCHAR(100) NULL COMMENT 'Municipio — lo usa delivery_type',
    department       VARCHAR(100) NULL COMMENT 'Departamento — consistente con users',
    -- Relación comercio → cliente
    notes            TEXT         NULL COMMENT 'Notas internas del comerciante sobre este cliente',
    credit_limit     DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Cupo de crédito otorgado por este comercio',
    is_blocked       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Cliente bloqueado (moroso/problemático) sin perder historial',
    block_reason     VARCHAR(255) NULL COMMENT 'Motivo del bloqueo',
    -- Preferencias del cliente en este comercio
    is_favorite      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'El cliente marcó este comercio como favorito',
    accepts_marketing TINYINT(1)  NOT NULL DEFAULT 1 COMMENT 'Consentimiento Habeas Data (Ley 1581 CO) para mensajes comerciales',
    -- Métricas denormalizadas (se actualizan por trigger/evento al confirmar pedidos)
    first_order_at   TIMESTAMP    NULL,
    last_order_at    TIMESTAMP    NULL,
    total_orders     INT          NOT NULL DEFAULT 0,
    total_spent      DECIMAL(14,2) NOT NULL DEFAULT 0,
    average_ticket   DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'total_spent / total_orders, para segmentación',
    total_returns    INT          NOT NULL DEFAULT 0 COMMENT 'Devoluciones — detectar abuso antes de dar crédito',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (platform_user_id, tenant_id),
    FOREIGN KEY (platform_user_id) REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (tenant_id)        REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_ctp_tenant     (tenant_id),
    INDEX idx_ctp_user       (platform_user_id),
    INDEX idx_ctp_favorite   (platform_user_id, is_favorite),
    INDEX idx_ctp_last_order (tenant_id, last_order_at),  -- campañas de reactivación
    INDEX idx_ctp_blocked    (tenant_id, is_blocked)      -- verificación O(1) en checkout
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
