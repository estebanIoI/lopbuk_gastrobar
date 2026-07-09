CREATE TABLE `idempotency_keys` (
	`id` varchar(64) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`action` varchar(60),
	`user_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `idempotency_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_idemp_tenant` ON `idempotency_keys` (`tenant_id`);