-- ============================================================
-- MIGRACIÓN: Tabla portfolio_config
-- Portafolio público de la marca DAIMUZ
-- ============================================================

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
  COMMENT 'Configuración del portafolio público de la marca DAIMUZ';
