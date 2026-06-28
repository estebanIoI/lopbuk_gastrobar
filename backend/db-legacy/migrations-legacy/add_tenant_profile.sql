-- =====================================================
-- TEMA 3 — PERFIL PÚBLICO DEL TENANT (estilo "perfil")
-- Página pública por negocio: banner, foto, descripción, links,
-- secciones dinámicas ordenables y mini-catálogo de productos.
--
-- Convenciones Lopbuk: tenant_id en todas las tablas, soft flags,
-- IDs VARCHAR(36) (UUID) generados en el backend.
-- =====================================================

-- 1. tenant_profile — datos fijos del perfil (1 por tenant) -------------------
CREATE TABLE IF NOT EXISTS tenant_profile (
  id                 VARCHAR(36) PRIMARY KEY,
  tenant_id          VARCHAR(36) NOT NULL,
  cover_url          VARCHAR(500) NULL,        -- banner / foto de portada
  profile_photo_url  VARCHAR(500) NULL,        -- foto de perfil (avatar)
  display_name       VARCHAR(160) NULL,        -- nombre mostrado (default = nombre del tenant)
  tagline            VARCHAR(255) NULL,        -- descripción corta / eslogan
  about_text         TEXT NULL,                -- "quiénes somos"
  instagram          VARCHAR(255) NULL,
  whatsapp           VARCHAR(60)  NULL,
  website            VARCHAR(255) NULL,
  accent_color       VARCHAR(16)  NULL,        -- color de acento opcional
  is_published       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_profile_tenant (tenant_id)
);

-- 2. profile_sections — secciones dinámicas ordenables ------------------------
-- section_type: image_text | video | gif | description | gallery
-- content: JSON según el tipo, p.ej.
--   image_text  { "imageUrl": "...", "text": "...", "layout": "left|right" }
--   video       { "url": "youtube.com/...", "title": "..." }
--   gif         { "url": "...", "caption": "..." }
--   description { "title": "...", "body": "..." }
--   gallery     { "images": ["...", "..."], "title": "..." }
CREATE TABLE IF NOT EXISTS profile_sections (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  section_type  ENUM('image_text','video','gif','description','gallery') NOT NULL,
  order_index   INT NOT NULL DEFAULT 0,
  content       JSON NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_psection_tenant (tenant_id, order_index),
  KEY idx_psection_active (tenant_id, is_active)
);

-- 3. (opcional) habilitar 'theme3' como tema de tienda.
-- El tema vive en store_info.theme ('theme1' | 'theme2' | 'theme3'). Si la
-- columna ya existe como VARCHAR no requiere cambios; este bloque es informativo.
-- ALTER TABLE store_info MODIFY COLUMN theme VARCHAR(20) DEFAULT 'theme1';
