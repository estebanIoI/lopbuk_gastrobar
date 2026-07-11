CREATE TABLE `modifier_templates` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`groups` json NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `modifier_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `modifier_templates` ADD CONSTRAINT `modifier_templates_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_mod_tpl_tenant` ON `modifier_templates` (`tenant_id`);