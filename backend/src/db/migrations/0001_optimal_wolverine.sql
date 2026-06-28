ALTER TABLE `tenants` ADD `is_hidden` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `hidden_access_token` varchar(128);--> statement-breakpoint
ALTER TABLE `tenants` ADD `hidden_access_code` varchar(32);--> statement-breakpoint
ALTER TABLE `tenants` ADD `hidden_token_expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `tenants` ADD `allow_regeneration` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `hidden_theme` varchar(50) DEFAULT 'default';--> statement-breakpoint
ALTER TABLE `tenants` ADD `vip_intro_enabled` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_tenant_hidden_token` ON `tenants` (`hidden_access_token`);