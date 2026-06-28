-- ============================================================================
--  seed.sql — Datos demo mínimos para desarrollo (usuarios + tenant).
--  El baseline Drizzle crea solo el ESQUEMA; este seed carga datos de prueba.
--
--  Uso (BD del contenedor Docker):
--    docker exec -i lopbuk_db mysql -uroot -plopbuk_root_pw lopbuk < src/db/seed.sql
--
--  Idempotente (INSERT IGNORE): se puede correr varias veces sin error.
--
--  Credenciales (TODOS): password = admin123
--    superadmin@stockpro.com    → rol superadmin
--    comerciante@stockpro.com   → rol comerciante (dueño del tenant demo)
--    vendedor@stockpro.com      → rol vendedor
--  Hash bcrypt de 'admin123': $2a$10$0IZ8BSUNFt48w2LMZjmT8uc.rfa3lU4HPJqmaLfDMKpKzR/G3Hx0W
-- ============================================================================

-- 1. Superadmin (sin tenant)
INSERT IGNORE INTO users (id, tenant_id, email, password, name, role, is_active) VALUES
('usr-superadmin-001', NULL, 'superadmin@stockpro.com', '$2a$10$0IZ8BSUNFt48w2LMZjmT8uc.rfa3lU4HPJqmaLfDMKpKzR/G3Hx0W', 'Super Administrador', 'superadmin', TRUE);

-- 2. Tenant demo
INSERT IGNORE INTO tenants (id, name, slug, business_type, status, plan, max_users, max_products) VALUES
('tenant-demo-001', 'Tienda de Ropa Demo', 'tienda-ropa-demo', 'ropa', 'activo', 'profesional', 10, 1000);

-- 3. Comerciante (dueño del tenant demo)
INSERT IGNORE INTO users (id, tenant_id, email, password, name, role, is_active) VALUES
('usr-comerciante-001', 'tenant-demo-001', 'comerciante@stockpro.com', '$2a$10$0IZ8BSUNFt48w2LMZjmT8uc.rfa3lU4HPJqmaLfDMKpKzR/G3Hx0W', 'Comerciante Demo', 'comerciante', TRUE);
UPDATE tenants SET owner_id = 'usr-comerciante-001' WHERE id = 'tenant-demo-001' AND owner_id IS NULL;

-- 4. Vendedor del tenant demo
INSERT IGNORE INTO users (id, tenant_id, email, password, name, role, is_active) VALUES
('usr-vendedor-001', 'tenant-demo-001', 'vendedor@stockpro.com', '$2a$10$0IZ8BSUNFt48w2LMZjmT8uc.rfa3lU4HPJqmaLfDMKpKzR/G3Hx0W', 'Vendedor Demo', 'vendedor', TRUE);

-- 5. Info de la tienda del tenant demo
INSERT IGNORE INTO store_info (tenant_id, name, address, phone, tax_id, email) VALUES
('tenant-demo-001', 'Tienda de Ropa Demo', 'Calle Principal #123, Centro Comercial Plaza', '+57 300 123 4567', '900.123.456-7', 'contacto@stockpro.com');
