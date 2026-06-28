-- 006_consumer_plans.sql — Consumer Plans / LEGEND System (G1)
-- Acceso premium del USUARIO final (cross-comercio, sobre users.id) vía códigos
-- canjeables: access_codes → ledger → grant activo → entitlements (feature gating).
-- REFERENCIA: la migración real corre idempotente (inline) en src/index.ts.
-- Ids VARCHAR(36) UUID (convención del proyecto). Todo CREATE TABLE IF NOT EXISTS.

-- Códigos generados por el admin. NO se guarda el código real, solo su hash + preview.
CREATE TABLE IF NOT EXISTS consumer_access_codes (
    id VARCHAR(36) PRIMARY KEY,
    code_hash VARCHAR(255) NOT NULL,                  -- SHA256(code)
    code_preview VARCHAR(30) NOT NULL,                -- ej. LEGEND-****
    tier VARCHAR(50) NOT NULL DEFAULT 'legend',
    duration_value INT NOT NULL,
    duration_unit ENUM('day','month') NOT NULL DEFAULT 'day',
    stack_policy ENUM('extend','replace','block') NOT NULL DEFAULT 'extend',
    max_redemptions INT NULL,                          -- NULL = ilimitado
    redemptions INT NOT NULL DEFAULT 0,
    valid_from DATETIME NULL,                          -- ventana de canje (opcional)
    valid_until DATETIME NULL,
    scope ENUM('global','tenant') NOT NULL DEFAULT 'global',
    tenant_id VARCHAR(36) NULL,                        -- solo si scope='tenant'
    metadata JSON NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_cac_hash (code_hash),
    INDEX idx_cac_active (is_active, scope, tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grant activo del usuario (el contador regresivo vive en expires_at).
CREATE TABLE IF NOT EXISTS consumer_plan_grants (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'legend',
    status ENUM('active','expired','revoked') NOT NULL DEFAULT 'active',
    started_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    source_ledger_id VARCHAR(36) NULL,
    last_checked_at DATETIME NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cpg_user_active (user_id, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial inmutable de movimientos (auditoría, soporte, antifraude, analytics).
CREATE TABLE IF NOT EXISTS consumer_access_ledger (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    code_id VARCHAR(36) NULL,
    grant_id VARCHAR(36) NULL,
    action ENUM('redeem','extend','replace','expire','revoke') NOT NULL,
    old_expires_at DATETIME NULL,
    new_expires_at DATETIME NULL,
    metadata JSON NULL,                               -- ip, user_agent, source...
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cal_user (user_id, created_at),
    INDEX idx_cal_code (code_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Entitlements por tier (sistema universal de feature gating).
CREATE TABLE IF NOT EXISTS consumer_entitlements (
    id VARCHAR(36) PRIMARY KEY,
    tier VARCHAR(50) NOT NULL,
    entitlement_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_cent_tier_key (tier, entitlement_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed de los entitlements del tier LEGEND (idempotente).
INSERT IGNORE INTO consumer_entitlements (id, tier, entitlement_key) VALUES
    (UUID(),'legend','routine_ai'),
    (UUID(),'legend','premium_theme'),
    (UUID(),'legend','coach_priority'),
    (UUID(),'legend','discounts'),
    (UUID(),'legend','smart_combos'),
    (UUID(),'legend','content_vault');

-- Config visual (animación/colores del reveal) → vive en platform_settings (KV),
-- no requiere tabla nueva. Claves: legend_animation, legend_primary, legend_accent,
-- legend_glow, legend_reveal_duration, legend_sound_enabled, legend_badge_style.
