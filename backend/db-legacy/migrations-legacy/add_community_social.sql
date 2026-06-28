-- =====================================================
-- COMUNIDAD — extras sociales:
--  - shares_count: contador de compartidos (editable por el admin).
--  - comentarios sintéticos (masivos) del admin: user_id NULL + author_name.
-- =====================================================

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS shares_count INT NOT NULL DEFAULT 0;

-- Permite comentarios sin usuario real (insertados en masa por el admin).
ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS author_name VARCHAR(160) NULL;

ALTER TABLE community_comments
  MODIFY COLUMN user_id VARCHAR(36) NULL;
