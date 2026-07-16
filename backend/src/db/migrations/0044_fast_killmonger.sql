CREATE TABLE `event_booking_items` (
	`id` varchar(36) NOT NULL,
	`booking_id` varchar(36) NOT NULL,
	`ticket_type_id` varchar(36),
	`zone_id` varchar(36),
	`seat_label` varchar(50),
	`row_label` varchar(50),
	`price` decimal(14,2) NOT NULL,
	`ticket_code` varchar(64),
	`qr_data` text,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`ticket_pdf_url` varchar(800),
	`ticket_wallet_url` varchar(800),
	`guest_name` varchar(255),
	`checked_in_at` datetime,
	`checked_in_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `event_booking_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_bookings` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`customer_name` varchar(255) NOT NULL,
	`customer_email` varchar(255),
	`customer_phone` varchar(20),
	`customer_document` varchar(20),
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`total_amount` decimal(14,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`hold_token` varchar(128),
	`coupon_id` varchar(36),
	`notes` text,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_coupons` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`discount_type` varchar(20) NOT NULL,
	`discount_value` decimal(14,2) NOT NULL,
	`max_uses` int DEFAULT 0,
	`uses_count` int DEFAULT 0,
	`min_tickets` int DEFAULT 1,
	`applies_to_ticket_type_id` varchar(36),
	`starts_at` datetime,
	`ends_at` datetime,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `event_coupons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_payment_transactions` (
	`id` varchar(36) NOT NULL,
	`booking_id` varchar(36) NOT NULL,
	`gateway` varchar(30) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`external_reference` varchar(255),
	`transaction_id` varchar(255),
	`amount` decimal(14,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'COP',
	`payload` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `event_payment_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_seat_holds` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`ticket_type_id` varchar(36),
	`seat_id` varchar(36),
	`hold_token` varchar(128) NOT NULL,
	`quantity` int DEFAULT 1,
	`customer_ip` varchar(45),
	`customer_session` varchar(255),
	`expires_at` datetime NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `event_seat_holds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_seat_maps` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`venue_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`layout` json NOT NULL,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_seat_maps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_ticket_types` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`price` decimal(14,2) NOT NULL,
	`capacity` int DEFAULT 0,
	`tickets_sold` int DEFAULT 0,
	`max_per_order` int DEFAULT 10,
	`sort_order` int DEFAULT 0,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `event_ticket_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_transfers` (
	`id` varchar(36) NOT NULL,
	`booking_item_id` varchar(36) NOT NULL,
	`from_user_id` varchar(36),
	`to_name` varchar(255) NOT NULL,
	`to_email` varchar(255),
	`old_ticket_code` varchar(64) NOT NULL,
	`new_ticket_code` varchar(64) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `event_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `et_new_code` UNIQUE(`new_ticket_code`)
);
--> statement-breakpoint
CREATE TABLE `event_venues` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`address` varchar(500),
	`city` varchar(100),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`contact_phone` varchar(20),
	`contact_email` varchar(255),
	`capacity` int DEFAULT 0,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_venues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `venue_id` varchar(36);--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `seat_map_id` varchar(36);--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `short_description` varchar(500);--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `end_date` datetime;--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `gallery` json;--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `video_url` varchar(500);--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `category` varchar(50);--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `tags` json;--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `status` varchar(20) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `refund_policy` varchar(20) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `min_age` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `max_tickets_per_user` int DEFAULT 10;--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `is_featured` tinyint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `merchant_events` ADD `event_type` varchar(20) DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `rb_order_items` ADD `original_price` decimal(12,2);--> statement-breakpoint
ALTER TABLE `rb_order_items` ADD `course_number` tinyint;--> statement-breakpoint
ALTER TABLE `event_booking_items` ADD CONSTRAINT `event_booking_items_booking_id_event_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `event_bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_coupons` ADD CONSTRAINT `event_coupons_event_id_merchant_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `merchant_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_coupons` ADD CONSTRAINT `event_coupons_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_payment_transactions` ADD CONSTRAINT `event_payment_transactions_booking_id_event_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `event_bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_seat_holds` ADD CONSTRAINT `event_seat_holds_event_id_merchant_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `merchant_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_seat_maps` ADD CONSTRAINT `event_seat_maps_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_seat_maps` ADD CONSTRAINT `event_seat_maps_venue_id_event_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `event_venues`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_ticket_types` ADD CONSTRAINT `event_ticket_types_event_id_merchant_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `merchant_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_ticket_types` ADD CONSTRAINT `event_ticket_types_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_transfers` ADD CONSTRAINT `event_transfers_booking_item_id_event_booking_items_id_fk` FOREIGN KEY (`booking_item_id`) REFERENCES `event_booking_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_venues` ADD CONSTRAINT `event_venues_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_ebi_booking` ON `event_booking_items` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_ebi_code` ON `event_booking_items` (`ticket_code`);--> statement-breakpoint
CREATE INDEX `idx_eb_event` ON `event_bookings` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_eb_tenant` ON `event_bookings` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_ec_code` ON `event_coupons` (`code`);--> statement-breakpoint
CREATE INDEX `idx_ept_booking` ON `event_payment_transactions` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_esh_expires` ON `event_seat_holds` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_esh_token` ON `event_seat_holds` (`hold_token`);--> statement-breakpoint
CREATE INDEX `idx_esm_venue` ON `event_seat_maps` (`venue_id`);--> statement-breakpoint
CREATE INDEX `idx_ett_event` ON `event_ticket_types` (`event_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_ev_tenant` ON `event_venues` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_mevent_status` ON `merchant_events` (`status`,`is_active`);