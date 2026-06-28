-- =====================================================
-- COMUNIDAD DAIMUZ — feed público tipo Instagram/blog
-- Rol nuevo: comunidad_admin (usuario global, tenant_id = NULL).
-- Publica posts con media y anuncios de productos de tiendas públicas.
-- =====================================================

-- users.role es un ENUM: hay que agregar el valor 'comunidad_admin'.
-- (Se listan todos los roles conocidos para no perder ninguno existente.)
ALTER TABLE users MODIFY COLUMN role ENUM(
    'superadmin','comerciante','vendedor','cliente','repartidor',
    'auxiliar_bodega','administrador_rb','cajero','mesero',
    'cocinero','bartender','despachador',
    'asesor_inmobiliario','gerente_inmobiliario',
    'comunidad_admin'
) NOT NULL DEFAULT 'vendedor';

-- 1. community_posts ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_posts (
  id            VARCHAR(36) PRIMARY KEY,
  author_id     VARCHAR(36) NOT NULL,                 -- usuario comunidad_admin
  title         VARCHAR(200) NOT NULL,
  body          TEXT NULL,
  category      ENUM('noticia','video','tutorial','app','oferta') NOT NULL DEFAULT 'noticia',
  status        ENUM('draft','published') NOT NULL DEFAULT 'draft',
  cover_url     VARCHAR(500) NULL,
  likes_count   INT NOT NULL DEFAULT 0,
  saves_count   INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  shares_count  INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at  TIMESTAMP NULL,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_post_status (status, is_active, published_at),
  KEY idx_post_author (author_id),
  KEY idx_post_category (category)
);

-- 2. community_post_media -----------------------------------------------------
CREATE TABLE IF NOT EXISTS community_post_media (
  id          VARCHAR(36) PRIMARY KEY,
  post_id     VARCHAR(36) NOT NULL,
  media_type  ENUM('image','video','gif') NOT NULL DEFAULT 'image',
  url         VARCHAR(500) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  KEY idx_media_post (post_id, order_index)
);

-- 3. community_post_ads — vincula post con producto de un comercio -----------
CREATE TABLE IF NOT EXISTS community_post_ads (
  id          VARCHAR(36) PRIMARY KEY,
  post_id     VARCHAR(36) NOT NULL,
  product_id  VARCHAR(36) NOT NULL,
  tenant_id   VARCHAR(36) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  KEY idx_ad_post (post_id, order_index),
  KEY idx_ad_product (product_id)
);

-- 4. community_reactions — like | save ---------------------------------------
CREATE TABLE IF NOT EXISTS community_reactions (
  id         VARCHAR(36) PRIMARY KEY,
  post_id    VARCHAR(36) NOT NULL,
  user_id    VARCHAR(36) NULL,                     -- NULL si la reacción es anónima (por dispositivo)
  device_id  VARCHAR(64) NULL,                     -- like anónimo rastreado por dispositivo
  type       ENUM('like','save') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reaction (post_id, user_id, type),
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  KEY idx_reaction_post (post_id, type),
  KEY idx_reaction_device (device_id)
);

-- 5. community_comments (con respuestas anidadas) ----------------------------
CREATE TABLE IF NOT EXISTS community_comments (
  id          VARCHAR(36) PRIMARY KEY,
  post_id     VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  body        TEXT NOT NULL,
  parent_id   VARCHAR(36) NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  KEY idx_comment_post (post_id, is_active, created_at),
  KEY idx_comment_parent (parent_id)
);

-- 6. community_settings — ajustes globales del feed -------------------------
CREATE TABLE IF NOT EXISTS community_settings (
  setting_key   VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
