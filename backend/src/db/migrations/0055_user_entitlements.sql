-- 0055 — user_entitlements (modelo de identidad por entitlements)
-- Aditiva: no altera tablas existentes. Fuente de verdad canónica: la definición Drizzle
-- en schema.ts (ver plan-identidad-entitlements.md). Este archivo es el SQL equivalente
-- para `npm run migrate` / aplicación manual.

CREATE TABLE IF NOT EXISTS `user_entitlements` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `entitlement` VARCHAR(64) NOT NULL,
  `tenant_id` VARCHAR(36) NULL,
  `source` VARCHAR(20) NOT NULL DEFAULT 'manual',
  `status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `metadata` JSON NULL,
  `granted_at` TIMESTAMP NOT NULL DEFAULT (now()),
  `revoked_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NULL DEFAULT (now()),
  `updated_at` TIMESTAMP NULL DEFAULT (now()) ON UPDATE now(),
  CONSTRAINT `user_entitlements_id` PRIMARY KEY (`id`),
  CONSTRAINT `uq_user_entitlement` UNIQUE (`user_id`, `entitlement`),
  CONSTRAINT `fk_ue_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_ue_status` ON `user_entitlements` (`user_id`, `status`);
CREATE INDEX `idx_ue_entitlement` ON `user_entitlements` (`entitlement`);
