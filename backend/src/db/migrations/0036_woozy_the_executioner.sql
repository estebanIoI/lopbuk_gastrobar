CREATE TABLE `combo_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`combo_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `combo_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `combos` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`active_days` json NOT NULL,
	`sizes` json NOT NULL,
	`includes` text,
	`image_url` varchar(500),
	`is_active` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `combos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `combo_items` ADD CONSTRAINT `combo_items_combo_id_combos_id_fk` FOREIGN KEY (`combo_id`) REFERENCES `combos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `combos` ADD CONSTRAINT `combos_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_combo_items_combo` ON `combo_items` (`combo_id`);--> statement-breakpoint
CREATE INDEX `idx_combos_tenant` ON `combos` (`tenant_id`,`is_active`);