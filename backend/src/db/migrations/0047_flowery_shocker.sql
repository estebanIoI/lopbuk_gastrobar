CREATE TABLE `event_waitlists` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`customer_name` varchar(255) NOT NULL,
	`customer_phone` varchar(20),
	`customer_email` varchar(255),
	`quantity` int DEFAULT 1,
	`notified_at` datetime,
	`expires_at` datetime,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `event_waitlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `event_waitlists` ADD CONSTRAINT `event_waitlists_event_id_merchant_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `merchant_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_waitlists` ADD CONSTRAINT `event_waitlists_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_ewl_event` ON `event_waitlists` (`event_id`,`notified_at`);