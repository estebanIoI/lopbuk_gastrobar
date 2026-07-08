CREATE TABLE `sede_stock` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`sede_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`stock` decimal(12,3) NOT NULL DEFAULT '0.000',
	`reserved_stock` decimal(12,3) NOT NULL DEFAULT '0.000',
	`min_stock` decimal(12,3) NOT NULL DEFAULT '0.000',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sede_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_sede_stock` UNIQUE(`sede_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `stock_transfers` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`transfer_number` varchar(20) NOT NULL,
	`from_sede_id` varchar(36) NOT NULL,
	`to_sede_id` varchar(36) NOT NULL,
	`items` json NOT NULL,
	`status` enum('solicitada','en_transito','recibida','cancelada') NOT NULL DEFAULT 'solicitada',
	`notes` varchar(500),
	`requested_by` varchar(36),
	`sent_by` varchar(36),
	`received_by` varchar(36),
	`sent_at` timestamp,
	`received_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_transfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sedes` ADD `type` enum('punto_venta','bodega','mixta') DEFAULT 'mixta' NOT NULL;--> statement-breakpoint
ALTER TABLE `sedes` ADD `phone` varchar(30);--> statement-breakpoint
ALTER TABLE `sedes` ADD `manager_id` varchar(36);--> statement-breakpoint
ALTER TABLE `sedes` ADD `is_active` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `sede_id` varchar(36);--> statement-breakpoint
ALTER TABLE `sede_stock` ADD CONSTRAINT `sede_stock_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_sede_stock_tenant` ON `sede_stock` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_sede_stock_product` ON `sede_stock` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_transfers_tenant` ON `stock_transfers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_transfers_status` ON `stock_transfers` (`tenant_id`,`status`);