-- 0056 — Backfill de entitlements (compatibilidad: nadie pierde acceso)
-- Idempotente (ON DUPLICATE KEY). Se puede re-ejecutar sin duplicar.

-- 1) Todo usuario recibe OS Legend Free.
INSERT INTO `user_entitlements` (id, user_id, entitlement, source, status, granted_at)
SELECT UUID(), u.id, 'os_legend_free', 'system', 'active', now()
FROM `users` u
ON DUPLICATE KEY UPDATE status = 'active', revoked_at = NULL;

-- 2) Comerciantes existentes: entitlement de merchant según el plan del tenant.
INSERT INTO `user_entitlements` (id, user_id, entitlement, tenant_id, source, status, granted_at)
SELECT UUID(), u.id,
  CASE t.plan
    WHEN 'basico'      THEN 'merchant_basic'
    WHEN 'profesional' THEN 'merchant_pro'
    WHEN 'empresarial' THEN 'merchant_enterprise'
    ELSE 'merchant_basic'
  END,
  t.id, 'system', 'active', now()
FROM `users` u
JOIN `tenants` t ON t.id = u.tenant_id
WHERE u.role = 'comerciante' AND u.tenant_id IS NOT NULL
ON DUPLICATE KEY UPDATE status = 'active', tenant_id = VALUES(tenant_id), revoked_at = NULL;

-- 3) Enterprise incluye OS Legend Pro (regla de bundle obligatoria).
INSERT INTO `user_entitlements` (id, user_id, entitlement, source, status, granted_at)
SELECT UUID(), u.id, 'os_legend_pro', 'system', 'active', now()
FROM `users` u
JOIN `tenants` t ON t.id = u.tenant_id
WHERE u.role = 'comerciante' AND t.plan = 'empresarial'
ON DUPLICATE KEY UPDATE status = 'active', revoked_at = NULL;

-- 4) Superadmin: entitlement SUPER_ADMIN.
INSERT INTO `user_entitlements` (id, user_id, entitlement, source, status, granted_at)
SELECT UUID(), u.id, 'super_admin', 'system', 'active', now()
FROM `users` u
WHERE u.role = 'superadmin'
ON DUPLICATE KEY UPDATE status = 'active', revoked_at = NULL;
