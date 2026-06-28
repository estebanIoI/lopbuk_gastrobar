-- =====================================================
-- MÓDULO CARTILLA (Cartilla Digital) — multi-tenant Lopbuk
-- Portado e integrado desde "cartilladigitalinga".
--
-- La sección "cartilla" es independiente: cada comercio (tenant)
-- publica CARTILLAS / LIBROS / CURSOS. Cada cartilla puede ser
-- gratis o tener precio. Al abrir una cartilla gratis (o ya comprada)
-- el usuario interactúa con todo su contenido: módulos, actividades,
-- secciones, audios, vocabulario, comunidad y retos (gamificación).
--
-- Convenciones Lopbuk:
--   * tenant_id en TODAS las tablas de negocio
--   * IDs VARCHAR(36) (UUID) generados en el service
--   * soft delete con is_active = 0
-- =====================================================

-- 1. CARTILLAS (contenedor: libro | curso | cartilla) ---------------------------
CREATE TABLE IF NOT EXISTS cartillas (
  id              VARCHAR(36) PRIMARY KEY,
  tenant_id       VARCHAR(36) NOT NULL,
  slug            VARCHAR(120) NOT NULL,
  titulo          VARCHAR(160) NOT NULL,
  tipo            ENUM('cartilla','libro','curso') NOT NULL DEFAULT 'cartilla',
  descripcion     TEXT NULL,
  portada_url     VARCHAR(500) NULL,
  color           ENUM('emerald','green','amber','purple','pink') NOT NULL DEFAULT 'emerald',
  autor           VARCHAR(160) NULL,
  idioma          VARCHAR(60) DEFAULT 'Inga',
  nivel           VARCHAR(60) NULL,
  frase           VARCHAR(255) NULL,
  traduccion      VARCHAR(255) NULL,
  -- Precios / acceso
  es_gratis       BOOLEAN NOT NULL DEFAULT TRUE,
  precio          DECIMAL(10,2) NOT NULL DEFAULT 0,
  moneda          VARCHAR(8) NOT NULL DEFAULT 'COP',
  -- Publicación
  publicado       BOOLEAN NOT NULL DEFAULT FALSE,
  destacado       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cartilla_tenant_slug (tenant_id, slug),
  KEY idx_cartilla_tenant (tenant_id),
  KEY idx_cartilla_publicado (publicado, is_active)
);

-- 2. MÓDULOS DE LA CARTILLA -----------------------------------------------------
CREATE TABLE IF NOT EXISTS cartilla_modulos (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  cartilla_id VARCHAR(36) NOT NULL,
  clave       VARCHAR(60) NOT NULL,
  titulo      VARCHAR(160) NOT NULL,
  icono       VARCHAR(40) NOT NULL DEFAULT 'Book',
  color       ENUM('emerald','green','amber','purple','pink') NOT NULL DEFAULT 'emerald',
  descripcion TEXT NULL,
  video_url   VARCHAR(500) NULL,
  frase       VARCHAR(255) NULL,
  traduccion  VARCHAR(255) NULL,
  orden       INT DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_modulo_cartilla_clave (cartilla_id, clave),
  KEY idx_modulo_tenant (tenant_id),
  KEY idx_modulo_cartilla (cartilla_id),
  FOREIGN KEY (cartilla_id) REFERENCES cartillas(id) ON DELETE CASCADE
);

-- 3. ACTIVIDADES ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cartilla_actividades (
  id                  VARCHAR(36) PRIMARY KEY,
  tenant_id           VARCHAR(36) NOT NULL,
  modulo_id           VARCHAR(36) NOT NULL,
  tipo                ENUM('completar','emparejar','verdadero_falso','ordenar') NOT NULL,
  pregunta            TEXT NOT NULL,
  respuesta_correcta  VARCHAR(255) NULL,
  orden               INT DEFAULT 0,
  FOREIGN KEY (modulo_id) REFERENCES cartilla_modulos(id) ON DELETE CASCADE,
  KEY idx_act_modulo (modulo_id)
);

CREATE TABLE IF NOT EXISTS cartilla_actividad_opciones (
  id            VARCHAR(36) PRIMARY KEY,
  actividad_id  VARCHAR(36) NOT NULL,
  texto         VARCHAR(255) NOT NULL,
  orden         INT DEFAULT 0,
  FOREIGN KEY (actividad_id) REFERENCES cartilla_actividades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cartilla_actividad_pares (
  id            VARCHAR(36) PRIMARY KEY,
  actividad_id  VARCHAR(36) NOT NULL,
  inga          VARCHAR(255) NOT NULL,
  espanol       VARCHAR(255) NOT NULL,
  FOREIGN KEY (actividad_id) REFERENCES cartilla_actividades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cartilla_actividad_vf (
  id            VARCHAR(36) PRIMARY KEY,
  actividad_id  VARCHAR(36) NOT NULL,
  enunciado     TEXT NOT NULL,
  es_verdadero  BOOLEAN NOT NULL,
  orden         INT DEFAULT 0,
  FOREIGN KEY (actividad_id) REFERENCES cartilla_actividades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cartilla_actividad_ordenar (
  id              VARCHAR(36) PRIMARY KEY,
  actividad_id    VARCHAR(36) NOT NULL,
  fragmento       VARCHAR(500) NOT NULL,
  orden_correcto  INT NOT NULL,
  FOREIGN KEY (actividad_id) REFERENCES cartilla_actividades(id) ON DELETE CASCADE
);

-- 4. CONTENIDO RICO DEL MÓDULO --------------------------------------------------
CREATE TABLE IF NOT EXISTS cartilla_modulo_imagenes (
  id          VARCHAR(36) PRIMARY KEY,
  modulo_id   VARCHAR(36) NOT NULL,
  url         VARCHAR(500) NOT NULL,
  alt         VARCHAR(255) NULL,
  caption     TEXT NULL,
  orden       INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (modulo_id) REFERENCES cartilla_modulos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cartilla_modulo_secciones (
  id          VARCHAR(36) PRIMARY KEY,
  modulo_id   VARCHAR(36) NOT NULL,
  titulo      VARCHAR(255) NOT NULL,
  contenido   TEXT NULL,
  tipo        ENUM('texto','vocabulario','cultural','pronunciacion','gramatica') DEFAULT 'texto',
  orden       INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (modulo_id) REFERENCES cartilla_modulos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cartilla_modulo_audios (
  id          VARCHAR(36) PRIMARY KEY,
  modulo_id   VARCHAR(36) NOT NULL,
  titulo      VARCHAR(255) NOT NULL,
  url         VARCHAR(500) NOT NULL,
  descripcion TEXT NULL,
  orden       INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (modulo_id) REFERENCES cartilla_modulos(id) ON DELETE CASCADE
);

-- 5. VOCABULARIO / TRADUCTOR ----------------------------------------------------
CREATE TABLE IF NOT EXISTS cartilla_vocabulario (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  cartilla_id VARCHAR(36) NULL,
  modulo_id   VARCHAR(36) NULL,
  espanol     VARCHAR(200) NOT NULL,
  inga        VARCHAR(200) NOT NULL,
  categoria   VARCHAR(50) DEFAULT 'general',
  notas       TEXT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_vocab_tenant (tenant_id),
  KEY idx_vocab_cartilla (cartilla_id),
  FOREIGN KEY (cartilla_id) REFERENCES cartillas(id) ON DELETE CASCADE
);

-- 6. RETOS (gamificación) -------------------------------------------------------
CREATE TABLE IF NOT EXISTS cartilla_retos (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  cartilla_id VARCHAR(36) NULL,           -- NULL = reto a nivel de comercio
  titulo      VARCHAR(150) NOT NULL,
  descripcion TEXT NOT NULL,
  puntos      INT NOT NULL DEFAULT 0,
  dificultad  ENUM('facil','medio','dificil') NOT NULL DEFAULT 'facil',
  categoria   ENUM('vocabulario','conversacion','modulo','comunidad') NOT NULL,
  meta        INT DEFAULT 1,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reto_tenant (tenant_id),
  KEY idx_reto_cartilla (cartilla_id)
);

CREATE TABLE IF NOT EXISTS cartilla_usuario_retos (
  id            VARCHAR(36) PRIMARY KEY,
  usuario_id    VARCHAR(36) NOT NULL,
  reto_id       VARCHAR(36) NOT NULL,
  fecha         DATE NOT NULL,
  completado    BOOLEAN DEFAULT FALSE,
  actual        INT DEFAULT 0,
  progreso      INT DEFAULT 0,
  completado_en TIMESTAMP NULL,
  FOREIGN KEY (reto_id) REFERENCES cartilla_retos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_usuario_reto_fecha (usuario_id, reto_id, fecha)
);

-- 7. PROGRESO / PUNTOS POR USUARIO Y CARTILLA -----------------------------------
-- Los puntos de gamificación viven aquí (NO en la tabla users de Lopbuk).
CREATE TABLE IF NOT EXISTS cartilla_progreso (
  id                   VARCHAR(36) PRIMARY KEY,
  tenant_id            VARCHAR(36) NOT NULL,
  usuario_id           VARCHAR(36) NOT NULL,
  cartilla_id          VARCHAR(36) NOT NULL,
  puntos               INT DEFAULT 0,
  dias_seguidos        INT DEFAULT 0,
  palabras_aprendidas  INT DEFAULT 0,
  ultimo_acceso        DATE NULL,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progreso_usuario_cartilla (usuario_id, cartilla_id),
  KEY idx_progreso_cartilla (cartilla_id),
  FOREIGN KEY (cartilla_id) REFERENCES cartillas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cartilla_usuario_modulos (
  id               VARCHAR(36) PRIMARY KEY,
  usuario_id       VARCHAR(36) NOT NULL,
  modulo_id        VARCHAR(36) NOT NULL,
  completado       BOOLEAN DEFAULT FALSE,
  puntos_obtenidos INT DEFAULT 0,
  completado_en    TIMESTAMP NULL,
  UNIQUE KEY uq_usuario_modulo (usuario_id, modulo_id),
  FOREIGN KEY (modulo_id) REFERENCES cartilla_modulos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cartilla_usuario_respuestas (
  id               VARCHAR(36) PRIMARY KEY,
  usuario_id       VARCHAR(36) NOT NULL,
  actividad_id     VARCHAR(36) NOT NULL,
  respuesta        VARCHAR(255) NOT NULL,
  es_correcta      BOOLEAN NOT NULL,
  puntos_obtenidos INT DEFAULT 0,
  respondido_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actividad_id) REFERENCES cartilla_actividades(id) ON DELETE CASCADE
);

-- 8. COMUNIDAD ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cartilla_publicaciones (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  cartilla_id VARCHAR(36) NULL,
  usuario_id  VARCHAR(36) NOT NULL,
  contenido   TEXT NOT NULL,
  likes       INT DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pub_tenant (tenant_id),
  KEY idx_pub_cartilla (cartilla_id)
);

CREATE TABLE IF NOT EXISTS cartilla_comentarios (
  id              VARCHAR(36) PRIMARY KEY,
  publicacion_id  VARCHAR(36) NOT NULL,
  usuario_id      VARCHAR(36) NOT NULL,
  contenido       TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (publicacion_id) REFERENCES cartilla_publicaciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cartilla_publicacion_likes (
  id              VARCHAR(36) PRIMARY KEY,
  publicacion_id  VARCHAR(36) NOT NULL,
  usuario_id      VARCHAR(36) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pub_like (publicacion_id, usuario_id),
  FOREIGN KEY (publicacion_id) REFERENCES cartilla_publicaciones(id) ON DELETE CASCADE
);

-- 9. COMPRAS / DESBLOQUEO (integración de pago) ---------------------------------
CREATE TABLE IF NOT EXISTS cartilla_compras (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  cartilla_id   VARCHAR(36) NOT NULL,
  usuario_id    VARCHAR(36) NOT NULL,
  precio        DECIMAL(10,2) NOT NULL DEFAULT 0,
  moneda        VARCHAR(8) NOT NULL DEFAULT 'COP',
  -- estado del pago: gratis (sin costo), pendiente (esperando pago),
  -- pagado (acceso concedido), reembolsado
  estado        ENUM('gratis','pendiente','pagado','reembolsado') NOT NULL DEFAULT 'pendiente',
  metodo        ENUM('gratis','stripe','credito','efectivo','manual') NOT NULL DEFAULT 'manual',
  referencia    VARCHAR(255) NULL,        -- id de sesión Stripe / pago externo
  pagado_en     TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_compra_usuario_cartilla (usuario_id, cartilla_id),
  KEY idx_compra_tenant (tenant_id),
  KEY idx_compra_cartilla (cartilla_id),
  FOREIGN KEY (cartilla_id) REFERENCES cartillas(id) ON DELETE CASCADE
);

-- 10. Registrar módulo activable para el comercio (si existe catálogo de módulos)
-- (Lopbuk gestiona los módulos activos por tenant en la columna JSON enabled_modules
--  de la tabla tenants; la clave del módulo es 'cartilla'. No requiere DDL aquí.)
