-- Landing /lopbuk: configuración singleton editable desde superadmin.
-- Guarda toda la config (textos por idioma + URLs de medios) como JSON.
CREATE TABLE IF NOT EXISTS lopbuk_landing (
  id          INT PRIMARY KEY DEFAULT 1,
  config      JSON,
  updated_by  VARCHAR(120),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
