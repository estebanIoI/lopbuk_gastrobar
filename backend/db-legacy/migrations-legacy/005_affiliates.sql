-- ════════════════════════════════════════════════════════════════════════════
-- 005_affiliates.sql — Módulo de Promotores / Creadores (Programa de Afiliados)
--
-- Estas tablas también se crean de forma idempotente al arrancar el backend
-- (ver backend/src/index.ts → bloque "Affiliates / Programa de Promotores").
-- Este archivo es la referencia documentada / aplicación manual.
--
-- Notas de arquitectura:
--   • `affiliates` es de NIVEL PLATAFORMA: no lleva tenant_id (excepción consciente
--     a la regla general). El resto de tablas del módulo sí llevan tenant_id.
--   • `affiliate_campaigns` es POLIMÓRFICA: promueve store / product / event / service.
--   • Dos modelos de ingreso del promotor:
--       1) Comisión por conversión (link o código) → affiliate_conversions.
--       2) Paquetes de publicidad con pago inmediato → affiliate_package_orders.
--   • Auth del promotor (Sprint 2): propia (password_hash) o enlazada a users (user_id).
-- ════════════════════════════════════════════════════════════════════════════

-- Perfil del promotor (plataforma, sin tenant_id)
CREATE TABLE IF NOT EXISTS affiliates (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36) NULL,          -- enlace opcional a users.id
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  phone         VARCHAR(50)  NULL,
  handle        VARCHAR(100) NULL,         -- @usuario para URLs
  tier          ENUM('bronze','silver','gold') NOT NULL DEFAULT 'bronze',
  balance_cop   DECIMAL(14,2) NOT NULL DEFAULT 0,   -- wallet disponible
  pending_cop   DECIMAL(14,2) NOT NULL DEFAULT 0,   -- en espera de aprobación
  monthly_sales INT NOT NULL DEFAULT 0,             -- reset mensual (cron)
  status        ENUM('active','suspended') NOT NULL DEFAULT 'active',
  password_hash VARCHAR(255) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_aff_email (email),
  UNIQUE INDEX idx_aff_handle (handle),
  INDEX idx_aff_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Eventos del comercio (entidad promocionable: discotecas, shows, etc.)
CREATE TABLE IF NOT EXISTS merchant_events (
  id           VARCHAR(36) PRIMARY KEY,
  tenant_id    VARCHAR(36) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT NULL,
  event_date   DATETIME NOT NULL,
  location     VARCHAR(255) NULL,
  cover_image  VARCHAR(800) NULL,
  ticket_price DECIMAL(14,2) NULL,
  capacity     INT NULL,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_mevent_tenant (tenant_id, is_active, event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogo de paquetes de publicidad (definido por superadmin)
CREATE TABLE IF NOT EXISTS affiliate_packages (
  id            VARCHAR(36) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  description   TEXT NULL,
  deliverables  JSON NULL,                 -- { "videos": 3, "reels": 0, "stories": 5 }
  price_cop     DECIMAL(14,2) NOT NULL,    -- lo que paga el comercio
  affiliate_pct DECIMAL(5,2)  NOT NULL,    -- % para el promotor
  platform_pct  DECIMAL(5,2)  NOT NULL,    -- % para DAIMUZ
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_affpkg_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Campaña: un promotor promueve una entidad de un comercio
CREATE TABLE IF NOT EXISTS affiliate_campaigns (
  id             VARCHAR(36) PRIMARY KEY,
  affiliate_id   VARCHAR(36) NOT NULL,
  tenant_id      VARCHAR(36) NOT NULL,
  entity_type    ENUM('store','product','event','service') NOT NULL DEFAULT 'store',
  entity_id      VARCHAR(36) NULL,         -- NULL = toda la tienda
  ref_token      VARCHAR(100) NOT NULL,    -- ?ref=TOKEN
  discount_code  VARCHAR(50)  NULL,        -- PROMO-JUAN10 (opcional)
  discount_pct   DECIMAL(5,2) NOT NULL DEFAULT 0,
  commission_pct DECIMAL(5,2) NOT NULL,
  cookie_days    TINYINT NOT NULL DEFAULT 7,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_campaign_ref (ref_token),
  UNIQUE INDEX idx_campaign_code (discount_code),
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id)    REFERENCES tenants(id)    ON DELETE CASCADE,
  INDEX idx_campaign_affiliate (affiliate_id),
  INDEX idx_campaign_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversión: 1 venta atribuida a 1 campaña (online o POS por código)
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id              VARCHAR(36) PRIMARY KEY,
  campaign_id     VARCHAR(36) NOT NULL,
  tenant_id       VARCHAR(36) NOT NULL,
  order_id        VARCHAR(36) NULL,        -- storefront_orders.id
  sale_id         VARCHAR(36) NULL,        -- sales.id (POS con código)
  method          ENUM('link','code') NOT NULL,
  order_total_cop DECIMAL(14,2) NOT NULL,
  commission_cop  DECIMAL(14,2) NOT NULL,  -- congelada al crear
  status          ENUM('pending','approved','paid','rejected') NOT NULL DEFAULT 'pending',
  approved_at     TIMESTAMP NULL,
  paid_at         TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES affiliate_campaigns(id) ON DELETE CASCADE,
  INDEX idx_conv_campaign (campaign_id),
  INDEX idx_conv_tenant (tenant_id),
  INDEX idx_conv_status (status),
  INDEX idx_conv_order (order_id),
  INDEX idx_conv_sale (sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ledger de comisiones (auditoría financiera)
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id            VARCHAR(36) PRIMARY KEY,
  affiliate_id  VARCHAR(36) NOT NULL,
  conversion_id VARCHAR(36) NULL,          -- NULL si es bono o paquete
  type          ENUM('conversion','mission_bonus','tier_bonus','package') NOT NULL,
  amount_cop    DECIMAL(14,2) NOT NULL,
  status        ENUM('pending','approved','paid') NOT NULL DEFAULT 'pending',
  note          TEXT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
  INDEX idx_comm_affiliate (affiliate_id, status),
  INDEX idx_comm_conversion (conversion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contratación de paquete con pago inmediato
CREATE TABLE IF NOT EXISTS affiliate_package_orders (
  id                VARCHAR(36) PRIMARY KEY,
  package_id        VARCHAR(36) NOT NULL,
  affiliate_id      VARCHAR(36) NOT NULL,
  tenant_id         VARCHAR(36) NOT NULL,
  entity_type       ENUM('store','event','service') NOT NULL DEFAULT 'store',
  entity_id         VARCHAR(36) NULL,
  status            ENUM('pending_payment','paid','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending_payment',
  total_cop         DECIMAL(14,2) NOT NULL,
  affiliate_cop     DECIMAL(14,2) NOT NULL,   -- congelado al crear
  platform_cop      DECIMAL(14,2) NOT NULL,
  paid_at           TIMESTAMP NULL,           -- al pagar → se libera al wallet
  content_deadline  TIMESTAMP NULL,
  content_delivered JSON NULL,                -- URLs entregadas
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id)   REFERENCES affiliate_packages(id) ON DELETE RESTRICT,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)         ON DELETE CASCADE,
  FOREIGN KEY (tenant_id)    REFERENCES tenants(id)            ON DELETE CASCADE,
  INDEX idx_pkgorder_affiliate (affiliate_id, status),
  INDEX idx_pkgorder_tenant (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Solicitudes de retiro (pago manual por superadmin)
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id             VARCHAR(36) PRIMARY KEY,
  affiliate_id   VARCHAR(36) NOT NULL,
  amount_cop     DECIMAL(14,2) NOT NULL,
  payment_method VARCHAR(100) NOT NULL,    -- "Nequi: 3001234567"
  status         ENUM('requested','processing','paid','rejected') NOT NULL DEFAULT 'requested',
  processed_by   VARCHAR(36) NULL,         -- users.id (superadmin)
  note           TEXT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
  INDEX idx_withdraw_affiliate (affiliate_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Misiones de gamificación
CREATE TABLE IF NOT EXISTS affiliate_missions (
  id             VARCHAR(36) PRIMARY KEY,
  title          VARCHAR(255) NOT NULL,
  description    TEXT NULL,
  reward_cop     DECIMAL(14,2) NOT NULL,
  required_views INT NULL,
  min_tier       ENUM('bronze','silver','gold') NOT NULL DEFAULT 'bronze',
  expires_at     TIMESTAMP NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mission_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Envíos de misiones (el promotor pega la URL del contenido)
CREATE TABLE IF NOT EXISTS affiliate_mission_submissions (
  id          VARCHAR(36) PRIMARY KEY,
  mission_id  VARCHAR(36) NOT NULL,
  affiliate_id VARCHAR(36) NOT NULL,
  content_url VARCHAR(800) NOT NULL,
  status      ENUM('submitted','approved','rejected') NOT NULL DEFAULT 'submitted',
  reviewed_by VARCHAR(36) NULL,
  review_note TEXT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id)   REFERENCES affiliate_missions(id) ON DELETE CASCADE,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)         ON DELETE CASCADE,
  INDEX idx_submission_mission (mission_id, status),
  INDEX idx_submission_affiliate (affiliate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
