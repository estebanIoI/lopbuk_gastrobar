CREATE TABLE `product_templates` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300),
	`sections` json NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `template_id` varchar(36);--> statement-breakpoint
ALTER TABLE `products` ADD `page_content` json;--> statement-breakpoint
ALTER TABLE `product_templates` ADD CONSTRAINT `product_templates_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_ptpl_tenant_status` ON `product_templates` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_products_template` ON `products` (`tenant_id`,`template_id`);