CREATE TABLE `order_stage_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`stage` enum('confirmado','en_picking','preparado','cargado','despachado','entregado','cancelado') NOT NULL,
	`from_stage` varchar(30),
	`duration_seconds` int,
	`sede_id` varchar(36),
	`user_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `order_stage_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `arrival_at` timestamp;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `received_at` timestamp;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `received_by` varchar(36);--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD `promised_at` datetime;--> statement-breakpoint
CREATE INDEX `idx_stage_events_order` ON `order_stage_events` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_stage_events_tenant_stage` ON `order_stage_events` (`tenant_id`,`stage`);--> statement-breakpoint
CREATE INDEX `idx_stage_events_tenant_date` ON `order_stage_events` (`tenant_id`,`created_at`);