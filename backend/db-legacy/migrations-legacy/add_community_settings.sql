-- =====================================================
-- COMUNIDAD — ajustes globales editables por el comunidad_admin.
-- Primer ajuste: like_requires_login (¿se exige login para dar like?).
-- =====================================================
CREATE TABLE IF NOT EXISTS community_settings (
  setting_key   VARCHAR(60) PRIMARY KEY,
  setting_value VARCHAR(255) NULL,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO community_settings (setting_key, setting_value) VALUES ('like_requires_login', '0');
