-- ============================================================
-- MIGRACIÓN: Módulo de Reservas de Mesas (RestBar)
-- Segura para re-ejecutar: IF NOT EXISTS / IF NOT EXISTS columns
-- ============================================================
USE stockpro_db;

-- ── Columnas de configuración en tenants ──────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_enabled TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Reservas online activadas';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_whatsapp VARCHAR(50) NULL
  COMMENT 'Número WhatsApp para notificaciones (ej: 573001234567)';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_open_time TIME NOT NULL DEFAULT '12:00:00'
  COMMENT 'Hora de apertura para reservas';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_close_time TIME NOT NULL DEFAULT '22:00:00'
  COMMENT 'Hora de cierre para reservas';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_slot_minutes INT NOT NULL DEFAULT 60
  COMMENT 'Duración de cada slot en minutos (15, 30, 60)';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_max_advance_days INT NOT NULL DEFAULT 30
  COMMENT 'Días máximos de anticipación para reservar';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_min_advance_hours INT NOT NULL DEFAULT 2
  COMMENT 'Horas mínimas de anticipación para reservar';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservations_occasions JSON NULL
  COMMENT 'Array de ocasiones: ["Cumpleaños","Aniversario","Cena romántica"]';

-- ── Tabla principal de reservas ───────────────────────────────
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
    occasion            VARCHAR(100) NULL,
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
    INDEX idx_rb_res_tenant_status  (tenant_id, status),
    INDEX idx_rb_res_date           (tenant_id, reservation_date),
    INDEX idx_rb_res_table_date     (table_id, reservation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Reservas de mesas del restaurante';

-- ── Secuencia de numeración (patrón idéntico a rb_order_sequence) ──
CREATE TABLE IF NOT EXISTS rb_reservation_sequence (
    id             INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id      VARCHAR(36) NOT NULL,
    prefix         VARCHAR(10) NOT NULL DEFAULT 'R',
    current_number INT NOT NULL DEFAULT 0,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_rb_res_seq (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Secuencia de numeración de reservas por tenant';
