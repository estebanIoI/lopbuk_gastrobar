CREATE TABLE `courier_availability` (
	`user_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`is_online` tinyint NOT NULL DEFAULT 0,
	`current_lat` decimal(10,7),
	`current_lng` decimal(10,7),
	`last_seen_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courier_availability_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_chat_messages` (
	`id` varchar(36) NOT NULL,
	`room_id` varchar(36) NOT NULL,
	`sender_id` varchar(36) NOT NULL,
	`sender_name` varchar(100) NOT NULL,
	`sender_role` varchar(30) NOT NULL,
	`message` text NOT NULL,
	`message_type` varchar(20) NOT NULL DEFAULT 'text',
	`read_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `delivery_chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_chat_rooms` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'active',
	`created_at` timestamp DEFAULT (now()),
	`closed_at` timestamp,
	CONSTRAINT `delivery_chat_rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_zones` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`city` varchar(100) NOT NULL,
	`polygon` text,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`delivery_fee_base` decimal(10,2) NOT NULL DEFAULT '0.00',
	`max_radius_km` decimal(5,2),
	`min_order_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`estimated_minutes` int NOT NULL DEFAULT 30,
	`color` varchar(20) DEFAULT '#3B82F6',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `delivery_zones` ADD CONSTRAINT `delivery_zones_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_avail_tenant` ON `courier_availability` (`tenant_id`,`is_online`);--> statement-breakpoint
CREATE INDEX `idx_chat_msg_room` ON `delivery_chat_messages` (`room_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_msg_sender` ON `delivery_chat_messages` (`sender_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_msg_created` ON `delivery_chat_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_room_order` ON `delivery_chat_rooms` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_room_tenant` ON `delivery_chat_rooms` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_room_status` ON `delivery_chat_rooms` (`status`);--> statement-breakpoint
CREATE INDEX `idx_zone_tenant` ON `delivery_zones` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_zone_city` ON `delivery_zones` (`city`);--> statement-breakpoint
CREATE INDEX `idx_zone_active` ON `delivery_zones` (`is_active`);