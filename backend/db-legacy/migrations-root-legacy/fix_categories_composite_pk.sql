-- ============================================
-- Migración: PRIMARY KEY compuesta en categories
-- ============================================
-- Problema: categories.id era PRIMARY KEY global (VARCHAR(50)).
-- El id se genera desde el nombre (slug), así que dos tenants
-- distintos que creaban una categoría con el mismo nombre
-- (ej. "opa") colisionaban: ER_DUP_ENTRY 'opa' for key PRIMARY.
--
-- Fix: la PK pasa a ser (tenant_id, id), respetando el aislamiento
-- multi-tenant. Seguro porque:
--   - ninguna otra tabla tiene FK hacia categories(id)
--   - los ids son únicos globalmente hoy, no hay (tenant_id, id) duplicados
--   - la app (categories.service) ya valida unicidad por id + tenant_id
--
-- Idempotente-ish: si ya está aplicada, el DROP/ADD fallará; correr una sola vez.
-- ============================================


ALTER TABLE categories
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (tenant_id, id);
