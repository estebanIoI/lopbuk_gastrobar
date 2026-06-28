-- ============================================
-- 001 — PRIMARY KEY compuesta en categories (PostgreSQL)
-- ============================================
-- Fecha: 2026-06-05
-- Problema: categories.id (slug del nombre) era PRIMARY KEY global, así que
--   dos tenants distintos con el mismo nombre de categoría colisionaban.
-- Fix: PK compuesta (tenant_id, id), respetando el aislamiento multi-tenant.
--
-- Equivalente Postgres del fix MySQL en ../fix_categories_composite_pk.sql
-- NOTA: conéctate antes a la base daimuz_lopbuk. En Postgres NO existe `USE`.
--   psql:    \c daimuz_lopbuk
--   pgAdmin: selecciona la BD en el árbol antes de ejecutar.
-- ============================================

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_pkey;
ALTER TABLE categories ADD PRIMARY KEY (tenant_id, id);
