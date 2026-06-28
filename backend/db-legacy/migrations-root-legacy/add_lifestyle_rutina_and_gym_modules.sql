-- ============================================================================
-- Migración: Módulo CONSUMIDOR (Rutina/Estilo de vida) + Módulo GIMNASIO
-- Fecha: 2026-06-05
-- ============================================================================
-- Contexto:
--   Capa nueva orientada al USUARIO FINAL (role 'cliente'). A diferencia del
--   resto del esquema, los datos de "rutina/estilo de vida" pertenecen a la
--   PERSONA (users.id), no a un tenant — son cross-comercio: el usuario arma
--   su rutina diaria, qué comer, qué recetas hacer con lo que tiene en casa,
--   qué le falta comprar, y de qué comercios registrados comprarlo.
--
--   El módulo GIMNASIO sí es tenant-scoped: un comercio con
--   business_type='gimnasio' lleva el control de sus miembros, les arma
--   planes de entrenamiento y registra su progreso. El miembro puede ver
--   sus estadísticas desde la app.
--
-- Convenciones (consistentes con inventarioEsteban_v3_multitenant.sql):
--   - ids VARCHAR(36) (uuid v4)
--   - FK a tenants/users con ON DELETE CASCADE / SET NULL
--   - timestamps created_at / updated_at
--   - InnoDB + utf8mb4_unicode_ci
--   - is_active TINYINT(1) para soft-flags
--
-- Referencias "blandas" (sin FK físico) a products.id / *.recipe por ser
-- cross-tenant; se indexan pero no se restringen para no acoplar catálogos.
-- ============================================================================


-- ============================================
-- CONSUMIDOR — Perfil de estilo de vida
-- 1 fila por usuario cliente
-- ============================================
USE daimuz_lopbuk;
CREATE TABLE IF NOT EXISTS rutina_perfil (
    user_id            VARCHAR(36) PRIMARY KEY,
    birth_date         DATE         NULL,
    sex                ENUM('masculino','femenino','otro','prefiero_no_decir') NULL,
    height_cm          DECIMAL(5,1) NULL COMMENT 'Estatura en cm',
    weight_kg          DECIMAL(5,1) NULL COMMENT 'Peso actual en kg',
    goal               ENUM('bajar_peso','subir_masa','mantener','salud_general') NULL,
    activity_level     ENUM('sedentario','ligero','moderado','activo','muy_activo') NULL,
    daily_calorie_target INT        NULL COMMENT 'Meta calórica diaria',
    target_weight_kg   DECIMAL(5,1) NULL COMMENT 'Peso objetivo (para mostrar progreso a la meta)',
    bmr                DECIMAL(7,1) NULL COMMENT 'Tasa metabólica basal (kcal)',
    tdee               DECIMAL(7,1) NULL COMMENT 'Gasto energético total diario (kcal)',
    bmi                DECIMAL(4,1) NULL COMMENT 'Índice de masa corporal',
    water_target_ml    INT          NULL COMMENT 'Meta diaria de agua (ml)',
    dietary_prefs      JSON         NULL COMMENT '["vegetariano","sin_gluten",...]',
    allergies          TEXT         NULL,
    city               VARCHAR(100) NULL COMMENT 'Ciudad para sugerir comercios cercanos',
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- CONSUMIDOR — Despensa (lo que el usuario tiene en casa)
-- Base para calcular "qué recetas puedo hacer" y "qué me falta comprar"
-- ============================================
CREATE TABLE IF NOT EXISTS rutina_despensa (
    id          VARCHAR(36) PRIMARY KEY,
    user_id     VARCHAR(36) NOT NULL,
    name        VARCHAR(150) NOT NULL,
    quantity    DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit        VARCHAR(20)  NULL COMMENT 'g, kg, ml, l, unidad, ...',
    category    VARCHAR(60)  NULL COMMENT 'proteína, fruta, verdura, lácteo, ...',
    product_id  VARCHAR(36)  NULL COMMENT 'Ref. blanda a products.id si vino de un comercio',
    expires_at  DATE         NULL COMMENT 'Fecha de caducidad para alertas',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_despensa_user (user_id),
    INDEX idx_despensa_product (product_id),
    INDEX idx_despensa_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- CONSUMIDOR — Recetas personales
-- (distintas de las recipes BOM del restbar, que son tenant-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS rutina_recetas (
    id           VARCHAR(36) PRIMARY KEY,
    user_id      VARCHAR(36) NOT NULL,
    name         VARCHAR(150) NOT NULL,
    description  TEXT         NULL,
    instructions TEXT         NULL,
    servings     INT          NULL DEFAULT 1,
    prep_minutes INT          NULL,
    cook_minutes INT          NULL COMMENT 'Tiempo de cocción',
    total_minutes INT         NULL COMMENT 'prep + cocción',
    difficulty   ENUM('fácil','medio','difícil') NULL,
    meal_type    ENUM('desayuno','almuerzo','cena','snack','cualquiera') NOT NULL DEFAULT 'cualquiera'
                 COMMENT 'Permite sugerir recetas por slot del plan de comidas',
    calories     INT          NULL COMMENT 'Calorías por porción (aprox.)',
    protein_g    DECIMAL(6,1) NULL,
    carbs_g      DECIMAL(6,1) NULL,
    fat_g        DECIMAL(6,1) NULL,
    image_url    VARCHAR(500) NULL,
    is_public    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = visible para otros usuarios',
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_recetas_user (user_id),
    INDEX idx_recetas_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- CONSUMIDOR — Ingredientes de una receta personal
-- Permite cruzar contra la despensa: tengo vs me falta
-- ============================================
CREATE TABLE IF NOT EXISTS rutina_receta_ingredientes (
    id          VARCHAR(36) PRIMARY KEY,
    receta_id   VARCHAR(36) NOT NULL,
    user_id     VARCHAR(36) NOT NULL COMMENT 'Denormalizado para filtrar rápido por dueño',
    name        VARCHAR(150) NOT NULL,
    quantity    DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit        VARCHAR(20)  NULL,
    product_id  VARCHAR(36)  NULL COMMENT 'Ref. blanda a products.id (comprable)',
    is_optional TINYINT(1)   NOT NULL DEFAULT 0,
    FOREIGN KEY (receta_id) REFERENCES rutina_recetas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)          ON DELETE CASCADE,
    INDEX idx_receta_ing_receta (receta_id),
    INDEX idx_receta_ing_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- CONSUMIDOR — Rutinas (contenedores: general / comida / ejercicio)
-- ============================================
CREATE TABLE IF NOT EXISTS rutina_rutinas (
    id         VARCHAR(36) PRIMARY KEY,
    user_id    VARCHAR(36) NOT NULL,
    name       VARCHAR(120) NOT NULL,
    type       ENUM('general','comida','ejercicio','compras') NOT NULL DEFAULT 'general',
    color      VARCHAR(7)  NULL,
    is_active  TINYINT(1)  NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_rutinas_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- CONSUMIDOR — Actividades dentro de una rutina
-- (un bloque agendado: comida, ejercicio, hábito o recordatorio de compra)
-- ============================================
CREATE TABLE IF NOT EXISTS rutina_actividades (
    id          VARCHAR(36) PRIMARY KEY,
    rutina_id   VARCHAR(36) NOT NULL,
    user_id     VARCHAR(36) NOT NULL COMMENT 'Denormalizado para filtrar por dueño',
    day_of_week TINYINT     NULL COMMENT '0=Dom..6=Sáb; NULL = todos los días',
    start_time  TIME        NULL,
    title       VARCHAR(150) NOT NULL,
    type        ENUM('comida','ejercicio','habito','compra','otro') NOT NULL DEFAULT 'otro',
    ref_type    ENUM('receta','producto','plan_gym','ninguno') NOT NULL DEFAULT 'ninguno',
    ref_id      VARCHAR(36) NULL COMMENT 'id de receta/producto/plan según ref_type (ref. blanda)',
    notes       TEXT        NULL,
    sort_order  INT         NOT NULL DEFAULT 0,
    is_active   TINYINT(1)  NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rutina_id) REFERENCES rutina_rutinas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)          ON DELETE CASCADE,
    INDEX idx_actividades_rutina (rutina_id),
    INDEX idx_actividades_user_day (user_id, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- CONSUMIDOR — Plan de comidas por fecha
-- ============================================
CREATE TABLE IF NOT EXISTS rutina_plan_comidas (
    id         VARCHAR(36) PRIMARY KEY,
    user_id    VARCHAR(36) NOT NULL,
    plan_date  DATE        NOT NULL,
    meal_type  ENUM('desayuno','media_manana','almuerzo','onces','cena','snack') NOT NULL,
    receta_id  VARCHAR(36) NULL COMMENT 'FK a rutina_recetas (puede ser texto libre)',
    title      VARCHAR(150) NULL COMMENT 'Si no hay receta asociada',
    calories   INT         NULL,
    protein_g  DECIMAL(6,1) NULL,
    carbs_g    DECIMAL(6,1) NULL,
    fat_g      DECIMAL(6,1) NULL,
    is_done    TINYINT(1)  NOT NULL DEFAULT 0,
    notes      TEXT        NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES users(id)          ON DELETE CASCADE,
    FOREIGN KEY (receta_id) REFERENCES rutina_recetas(id) ON DELETE SET NULL,
    INDEX idx_plan_comidas_user_date (user_id, plan_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- CONSUMIDOR — Lista de compras (qué falta y dónde comprarlo)
-- ============================================
CREATE TABLE IF NOT EXISTS rutina_lista_compras (
    id           VARCHAR(36) PRIMARY KEY,
    user_id      VARCHAR(36) NOT NULL,
    name         VARCHAR(150) NOT NULL,
    quantity     DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit         VARCHAR(20)  NULL,
    product_id   VARCHAR(36)  NULL COMMENT 'Ref. blanda a products.id sugerido',
    tenant_id    VARCHAR(36)  NULL COMMENT 'Comercio sugerido para comprarlo (ref. blanda)',
    source       ENUM('manual','receta','despensa') NOT NULL DEFAULT 'manual',
    receta_id    VARCHAR(36)  NULL COMMENT 'Origen si vino de una receta',
    is_purchased TINYINT(1)   NOT NULL DEFAULT 0,
    purchased_at TIMESTAMP    NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id)           ON DELETE CASCADE,
    FOREIGN KEY (receta_id) REFERENCES rutina_recetas(id)  ON DELETE SET NULL,
    INDEX idx_lista_user (user_id),
    INDEX idx_lista_user_pending (user_id, is_purchased),
    INDEX idx_lista_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- GIMNASIO — Membresías (cliente <-> tenant gimnasio)
-- ============================================
CREATE TABLE IF NOT EXISTS gym_membresias (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL COMMENT 'Gimnasio (tenant con business_type=gimnasio)',
    user_id     VARCHAR(36) NOT NULL COMMENT 'Usuario miembro (role cliente)',
    plan_name   VARCHAR(100) NULL,
    status      ENUM('activa','pausada','vencida','cancelada') NOT NULL DEFAULT 'activa',
    price          DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Precio del plan',
    payment_cycle  ENUM('mensual','trimestral','semestral','anual') NOT NULL DEFAULT 'mensual',
    auto_renew     TINYINT(1)    NOT NULL DEFAULT 0,
    last_payment_at  TIMESTAMP   NULL,
    next_payment_at  TIMESTAMP   NULL,
    start_date  DATE        NULL,
    end_date    DATE        NULL,
    notes       TEXT        NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    UNIQUE INDEX idx_membresia_tenant_user (tenant_id, user_id),
    INDEX idx_membresia_user (user_id),
    INDEX idx_membresia_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- GIMNASIO — Planes de entrenamiento (el gym los arma para un miembro)
-- ============================================
CREATE TABLE IF NOT EXISTS gym_planes_entrenamiento (
    id             VARCHAR(36) PRIMARY KEY,
    tenant_id      VARCHAR(36) NOT NULL,
    member_user_id VARCHAR(36) NOT NULL,
    name           VARCHAR(120) NOT NULL,
    description    TEXT        NULL,
    days_per_week  TINYINT     NULL,
    created_by     VARCHAR(36) NULL COMMENT 'Entrenador/staff que lo creó (users.id)',
    is_active      TINYINT(1)  NOT NULL DEFAULT 1,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)      REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (member_user_id) REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (created_by)     REFERENCES users(id)   ON DELETE SET NULL,
    INDEX idx_planes_tenant (tenant_id),
    INDEX idx_planes_member (member_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- GIMNASIO — Ejercicios de un plan
-- ============================================
CREATE TABLE IF NOT EXISTS gym_ejercicios (
    id           VARCHAR(36) PRIMARY KEY,
    plan_id      VARCHAR(36) NOT NULL,
    tenant_id    VARCHAR(36) NOT NULL COMMENT 'Denormalizado para filtrar por gym',
    day_label    VARCHAR(30) NULL COMMENT 'Día/grupo: "Día 1 - Pecho", "Lunes", ...',
    name         VARCHAR(120) NOT NULL,
    sets         TINYINT     NULL,
    reps         VARCHAR(30) NULL COMMENT 'Texto: "12", "8-10", "al fallo"',
    weight_kg    DECIMAL(6,2) NULL COMMENT 'Peso sugerido',
    rest_seconds INT         NULL,
    notes        TEXT        NULL,
    sort_order   INT         NOT NULL DEFAULT 0,
    FOREIGN KEY (plan_id)   REFERENCES gym_planes_entrenamiento(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)                  ON DELETE CASCADE,
    INDEX idx_ejercicios_plan (plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- GIMNASIO — Progreso del miembro (estadísticas en el tiempo)
-- El miembro ve su evolución; el gym también
-- ============================================
CREATE TABLE IF NOT EXISTS gym_progreso (
    id             VARCHAR(36) PRIMARY KEY,
    tenant_id      VARCHAR(36) NOT NULL,
    member_user_id VARCHAR(36) NOT NULL,
    log_date       DATE        NOT NULL,
    weight_kg      DECIMAL(5,1) NULL,
    body_fat_pct   DECIMAL(4,1) NULL,
    muscle_mass_kg DECIMAL(5,1) NULL,
    measurements   JSON        NULL COMMENT '{"cintura":80,"brazo":35,...} en cm',
    notes          TEXT        NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)      REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (member_user_id) REFERENCES users(id)   ON DELETE CASCADE,
    INDEX idx_progreso_member_date (member_user_id, log_date),
    INDEX idx_progreso_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- GIMNASIO — Asistencia (check-in/out del miembro)
-- Progreso físico y asistencia son cosas distintas: esto mide quién viene
-- y con qué frecuencia (rachas → retención).
-- ============================================
CREATE TABLE IF NOT EXISTS gym_asistencia (
    id             VARCHAR(36) PRIMARY KEY,
    tenant_id      VARCHAR(36) NOT NULL,
    member_user_id VARCHAR(36) NOT NULL,
    checked_in_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_out_at TIMESTAMP   NULL,
    notes          TEXT        NULL,
    FOREIGN KEY (tenant_id)      REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (member_user_id) REFERENCES users(id)   ON DELETE CASCADE,
    INDEX idx_asist_tenant_date (tenant_id, checked_in_at),
    INDEX idx_asist_member      (member_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- CONSUMIDOR — Log de cumplimiento de actividades de rutina
-- Permite rachas (streaks), % de cumplimiento y recordatorios.
-- ============================================
CREATE TABLE IF NOT EXISTS rutina_actividades_log (
    id            VARCHAR(36) PRIMARY KEY,
    actividad_id  VARCHAR(36) NOT NULL,
    user_id       VARCHAR(36) NOT NULL,
    log_date      DATE        NOT NULL,
    completed     TINYINT(1)  NOT NULL DEFAULT 0,
    skipped       TINYINT(1)  NOT NULL DEFAULT 0,
    skip_reason   VARCHAR(255) NULL,
    notes         TEXT        NULL,
    created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actividad_id) REFERENCES rutina_actividades(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)      REFERENCES users(id)              ON DELETE CASCADE,
    UNIQUE INDEX idx_act_log_unique (actividad_id, log_date),
    INDEX idx_act_log_user_date     (user_id, log_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
