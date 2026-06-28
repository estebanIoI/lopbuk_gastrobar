-- =====================================================
-- NOTIFICACIONES (dirigidas al comercio / tenant)
-- Sistema ligero reutilizable. Primer uso: avisar al comercio cuando
-- uno de sus productos se adjunta como anuncio en un post de la Comunidad.
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  type       VARCHAR(40) NOT NULL DEFAULT 'general',  -- p.ej. 'community_ad'
  title      VARCHAR(200) NOT NULL,
  body       VARCHAR(500) NULL,
  link       VARCHAR(500) NULL,                         -- ruta interna o URL
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_tenant (tenant_id, is_read, created_at)
);
