ALTER TABLE `service_bookings` ADD `addons` json;--> statement-breakpoint
ALTER TABLE `service_bookings` ADD `total_amount` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `addon_service_ids` json;