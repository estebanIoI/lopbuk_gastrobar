CREATE TABLE `print_agents` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(100),
	`pairing_code` varchar(12) NOT NULL,
	`token` varchar(64) NOT NULL,
	`paired_at` datetime,
	`last_seen_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `print_agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_print_agents_code` UNIQUE(`pairing_code`),
	CONSTRAINT `uniq_print_agents_token` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `print_agents` ADD CONSTRAINT `print_agents_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_print_agents_tenant` ON `print_agents` (`tenant_id`);