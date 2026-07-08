CREATE TABLE `quotes` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`quote_number` varchar(20) NOT NULL,
	`customer_id` varchar(36),
	`customer_name` varchar(255),
	`customer_phone` varchar(30),
	`customer_email` varchar(255),
	`seller_id` varchar(36),
	`seller_name` varchar(255),
	`sede_id` varchar(36),
	`items` json NOT NULL,
	`subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
	`discount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total` decimal(12,2) NOT NULL DEFAULT '0.00',
	`status` enum('borrador','enviada','aceptada','facturada','vencida','cancelada') NOT NULL DEFAULT 'borrador',
	`valid_until` date,
	`delivery_promise` date,
	`notes` varchar(1000),
	`sale_id` varchar(36),
	`sent_at` timestamp,
	`accepted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_quotes_tenant` ON `quotes` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_quotes_status` ON `quotes` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_quotes_created` ON `quotes` (`tenant_id`,`created_at`);