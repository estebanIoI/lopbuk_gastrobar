CREATE TABLE `service_waitlist` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`service_id` varchar(50) NOT NULL,
	`service_name` varchar(200) NOT NULL,
	`client_name` varchar(200) NOT NULL,
	`client_phone` varchar(50) NOT NULL,
	`desired_date` date,
	`note` text,
	`status` enum('pendiente','notificado','convertido','cancelado') NOT NULL DEFAULT 'pendiente',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_waitlist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `service_bookings` ADD `loyalty_awarded` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `service_waitlist` ADD CONSTRAINT `service_waitlist_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_waitlist_tenant` ON `service_waitlist` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_waitlist_service` ON `service_waitlist` (`service_id`,`desired_date`);