CREATE TABLE `picking_tasks` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`order_number` varchar(20),
	`customer_name` varchar(255),
	`sede_id` varchar(36),
	`items` json NOT NULL,
	`status` enum('pendiente','en_preparacion','preparada','cancelada') NOT NULL DEFAULT 'pendiente',
	`priority` int NOT NULL DEFAULT 0,
	`assigned_to` varchar(36),
	`notes` varchar(500),
	`taken_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `picking_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_picking_order` UNIQUE(`order_id`)
);
--> statement-breakpoint
ALTER TABLE `sede_stock` ADD `warehouse_location` varchar(50);--> statement-breakpoint
ALTER TABLE `picking_tasks` ADD CONSTRAINT `picking_tasks_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_picking_tenant_status` ON `picking_tasks` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_picking_assigned` ON `picking_tasks` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `idx_picking_created` ON `picking_tasks` (`tenant_id`,`created_at`);