CREATE TABLE `service_slot_holds` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`service_id` varchar(50) NOT NULL,
	`hold_token` varchar(48) NOT NULL,
	`booking_date` date NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `service_slot_holds_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_slot_hold_token` UNIQUE(`hold_token`)
);
--> statement-breakpoint
ALTER TABLE `service_slot_holds` ADD CONSTRAINT `service_slot_holds_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_slot_holds_lookup` ON `service_slot_holds` (`service_id`,`booking_date`);--> statement-breakpoint
CREATE INDEX `idx_slot_holds_expires` ON `service_slot_holds` (`expires_at`);