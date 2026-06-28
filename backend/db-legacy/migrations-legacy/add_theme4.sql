-- =====================================================
-- TEMA 4 — Servicios Profesionales (Adaptable)
-- Tema de tienda (store_info.store_theme = 'theme4') que se adapta a empresas
-- de servicios: transporte, software/digital o general. El comercio activa
-- las secciones que necesita.
-- Convenciones: tenant_id en todas las tablas, IDs VARCHAR(36) (UUID),
-- soft flags is_active, JSON para listas.
-- =====================================================

-- 1. Config base --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS theme4_config (
  id             VARCHAR(36) PRIMARY KEY,
  tenant_id      VARCHAR(36) NOT NULL,
  business_type  ENUM('transport','software','general') NOT NULL DEFAULT 'general',
  hero_video_url VARCHAR(500) NULL,
  hero_image_url VARCHAR(500) NULL,
  hero_title     VARCHAR(200) NULL,
  hero_subtitle  VARCHAR(300) NULL,
  cta_label      VARCHAR(80)  NULL,
  cta_url        VARCHAR(500) NULL,
  about_text     TEXT NULL,
  accent_color   VARCHAR(16)  NULL,
  whatsapp       VARCHAR(60)  NULL,
  email          VARCHAR(160) NULL,
  phone          VARCHAR(60)  NULL,
  address        VARCHAR(255) NULL,
  map_url        VARCHAR(500) NULL,
  -- secciones activables (1/0)
  show_stats     BOOLEAN NOT NULL DEFAULT TRUE,
  show_services  BOOLEAN NOT NULL DEFAULT TRUE,
  show_process   BOOLEAN NOT NULL DEFAULT TRUE,
  show_team      BOOLEAN NOT NULL DEFAULT TRUE,
  show_testimonials BOOLEAN NOT NULL DEFAULT TRUE,
  show_contact   BOOLEAN NOT NULL DEFAULT TRUE,
  show_community BOOLEAN NOT NULL DEFAULT TRUE,
  likes_count    INT NOT NULL DEFAULT 0,
  saves_count    INT NOT NULL DEFAULT 0,
  is_published   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_theme4_tenant (tenant_id)
);

-- 2. Servicios ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS theme4_services (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  icon        VARCHAR(40) NULL,
  title       VARCHAR(160) NOT NULL,
  description TEXT NULL,
  price_label VARCHAR(80) NULL,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_t4svc_tenant (tenant_id, is_active, order_index)
);

-- 3. Flota (transporte) -------------------------------------------------------
CREATE TABLE IF NOT EXISTS theme4_fleet (
  id           VARCHAR(36) PRIMARY KEY,
  tenant_id    VARCHAR(36) NOT NULL,
  name         VARCHAR(160) NOT NULL,
  vehicle_type ENUM('bus','van','car','other') NOT NULL DEFAULT 'other',
  capacity     INT NULL,
  photo_url    VARCHAR(500) NULL,
  features     JSON NULL,
  order_index  INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_t4fleet_tenant (tenant_id, is_active)
);

-- 4. Rutas (transporte) -------------------------------------------------------
CREATE TABLE IF NOT EXISTS theme4_routes (
  id             VARCHAR(36) PRIMARY KEY,
  tenant_id      VARCHAR(36) NOT NULL,
  origin         VARCHAR(160) NOT NULL,
  destination    VARCHAR(160) NOT NULL,
  stops          JSON NULL,
  departure_time VARCHAR(40) NULL,
  arrival_time   VARCHAR(40) NULL,
  vehicle_id     VARCHAR(36) NULL,
  price          DECIMAL(10,2) NULL,
  booking_url    VARCHAR(500) NULL,
  order_index    INT NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_t4routes_tenant (tenant_id, is_active)
);

-- 5. Proyectos (software) -----------------------------------------------------
CREATE TABLE IF NOT EXISTS theme4_projects (
  id              VARCHAR(36) PRIMARY KEY,
  tenant_id       VARCHAR(36) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NULL,
  category        VARCHAR(80) NULL,
  screenshot_urls JSON NULL,
  tech_stack      JSON NULL,
  live_url        VARCHAR(500) NULL,
  case_study_url  VARCHAR(500) NULL,
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  order_index     INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_t4proj_tenant (tenant_id, is_active, order_index)
);

-- 6. Stats banner -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS theme4_stats (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  icon        VARCHAR(40) NULL,
  label       VARCHAR(120) NOT NULL,
  value       VARCHAR(80) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_t4stats_tenant (tenant_id, is_active, order_index)
);

-- 7. Proceso de trabajo -------------------------------------------------------
CREATE TABLE IF NOT EXISTS theme4_steps (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  step_number INT NOT NULL DEFAULT 1,
  title       VARCHAR(160) NOT NULL,
  description TEXT NULL,
  icon        VARCHAR(40) NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_t4steps_tenant (tenant_id, is_active, step_number)
);

-- 8. Equipo -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS theme4_team (
  id           VARCHAR(36) PRIMARY KEY,
  tenant_id    VARCHAR(36) NOT NULL,
  name         VARCHAR(160) NOT NULL,
  role         VARCHAR(160) NULL,
  photo_url    VARCHAR(500) NULL,
  bio          TEXT NULL,
  linkedin_url VARCHAR(500) NULL,
  order_index  INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_t4team_tenant (tenant_id, is_active, order_index)
);

-- 9. Testimonios (carrusel) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS theme4_testimonials (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  author      VARCHAR(160) NOT NULL,
  role        VARCHAR(160) NULL,
  avatar_url  VARCHAR(500) NULL,
  rating      TINYINT NOT NULL DEFAULT 5,
  text        TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_t4test_tenant (tenant_id, is_active, order_index)
);

-- 10. Reacciones del perfil (CommunityBar: like/save) ------------------------
CREATE TABLE IF NOT EXISTS theme4_reactions (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  user_id    VARCHAR(36) NOT NULL,
  type       ENUM('like','save') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_t4react (tenant_id, user_id, type)
);
