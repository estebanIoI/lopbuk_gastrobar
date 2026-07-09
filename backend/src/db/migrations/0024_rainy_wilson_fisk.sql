CREATE TABLE `inventory_count_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`count_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`product_name` varchar(255) NOT NULL,
	`warehouse_location` varchar(50),
	`expected_qty` decimal(12,3) NOT NULL DEFAULT '0.000',
	`counted_qty` decimal(12,3),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `inventory_count_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_inv_count_item` UNIQUE(`count_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_counts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`count_number` varchar(20) NOT NULL,
	`sede_id` varchar(36),
	`status` enum('abierto','cerrado','cancelado') NOT NULL DEFAULT 'abierto',
	`accuracy_pct` decimal(5,2),
	`items_total` int NOT NULL DEFAULT 0,
	`items_counted` int NOT NULL DEFAULT 0,
	`items_diff` int NOT NULL DEFAULT 0,
	`notes` varchar(500),
	`created_by` varchar(36),
	`closed_by` varchar(36),
	`closed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_counts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_inv_count_items_count` ON `inventory_count_items` (`count_id`);--> statement-breakpoint
CREATE INDEX `idx_inv_counts_tenant_status` ON `inventory_counts` (`tenant_id`,`status`);