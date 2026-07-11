CREATE TABLE `service_specialists` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`title` varchar(150),
	`photo_url` varchar(500),
	`is_active` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_specialists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `service_bookings` ADD `specialist_id` varchar(36);--> statement-breakpoint
ALTER TABLE `service_bookings` ADD `specialist_name` varchar(200);--> statement-breakpoint
ALTER TABLE `services` ADD `specialist_ids` json;--> statement-breakpoint
ALTER TABLE `service_specialists` ADD CONSTRAINT `service_specialists_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_specialists_tenant` ON `service_specialists` (`tenant_id`,`is_active`);