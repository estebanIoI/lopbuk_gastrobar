-- =====================================================
-- COMUNIDAD — like anónimo por DISPOSITIVO (1 like por dispositivo/post).
-- El cliente genera un device_id persistente (localStorage) y lo envía.
-- =====================================================

ALTER TABLE community_reactions
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(64) NULL;

-- Unicidad para anónimos: un like por (post, dispositivo). Las filas de usuarios
-- autenticados tienen device_id NULL (InnoDB permite múltiples NULL en índice único).
-- Si esta línea da error porque el índice ya existe, ignórala.
ALTER TABLE community_reactions
  ADD UNIQUE KEY uq_react_device (post_id, device_id, type);
