CREATE TABLE `courier_tenants` (
	`id` varchar(36) NOT NULL,
	`courier_user_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`assigned_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `courier_tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_courier_tenant` UNIQUE(`courier_user_id`,`tenant_id`)
);
--> statement-breakpoint
ALTER TABLE `courier_tenants` ADD CONSTRAINT `courier_tenants_courier_user_id_users_id_fk` FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courier_tenants` ADD CONSTRAINT `courier_tenants_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_courier_tenants_courier` ON `courier_tenants` (`courier_user_id`);--> statement-breakpoint
CREATE INDEX `idx_courier_tenants_tenant` ON `courier_tenants` (`tenant_id`);