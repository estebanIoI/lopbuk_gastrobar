CREATE TABLE `print_jobs` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`module` varchar(20) NOT NULL,
	`printer_ip` varchar(45) NOT NULL,
	`printer_port` int NOT NULL DEFAULT 9100,
	`data_base64` mediumtext NOT NULL,
	`status` enum('pending','sent','done','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`error` varchar(255),
	`sent_at` datetime,
	`done_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `print_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_print_jobs_tenant_status` ON `print_jobs` (`tenant_id`,`status`);