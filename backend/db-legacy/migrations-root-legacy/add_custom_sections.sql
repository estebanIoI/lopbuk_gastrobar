-- Migration: store_custom_sections
-- Permite al comerciante crear secciones HTML personalizadas con link compartible y activación en tienda

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
  INDEX         idx_tenant    (tenant_id)
);
