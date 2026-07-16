ALTER TABLE `loyalty_accounts` ADD `customer_email` varchar(255);--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `level` enum('bronze','silver','gold','platinum') DEFAULT 'bronze' NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `visits` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `last_visit` timestamp;--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `total_spent` decimal(14,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `wallet_id` varchar(255);--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `wallet_provider` varchar(50) DEFAULT 'google';--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `wallet_status` enum('active','expired','revoked') DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `birthday` date;--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `acquisition_channel` varchar(100);--> statement-breakpoint
ALTER TABLE `loyalty_accounts` ADD `favorite_category_id` varchar(36);--> statement-breakpoint
CREATE INDEX `idx_loyalty_level` ON `loyalty_accounts` (`tenant_id`,`level`);

--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `wallet_enabled` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `wallet_logo_url` varchar(500);--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `wallet_primary_color` varchar(7) DEFAULT '#000000';--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `wallet_business_name` varchar(120);--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `wallet_short_description` varchar(300);--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `geo_radius_meters` int DEFAULT 300;--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `geo_push_enabled` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `geo_push_message` varchar(300);

--> statement-breakpoint
ALTER TABLE `loyalty_rewards` ADD `reward_type` enum('points','purchase_count','spend_amount','cashback','streak','referral') DEFAULT 'points' NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_rewards` ADD `condition_value` decimal(12,2);--> statement-breakpoint
ALTER TABLE `loyalty_rewards` ADD `streak_days` int;

--> statement-breakpoint
CREATE TABLE `engagement_campaigns` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(500),
	`objective` enum('increase_sales','recover_inactive','reward_loyal','promote_product','anniversary','birthday','custom') DEFAULT 'increase_sales' NOT NULL,
	`audience_filter` json,
	`offer_type` enum('percentage','fixed','free_item','points_multiplier','free_delivery'),
	`offer_value` decimal(10,2),
	`channels` json NOT NULL,
	`scheduled_at` timestamp,
	`sent_count` int DEFAULT 0 NOT NULL,
	`opened_count` int DEFAULT 0 NOT NULL,
	`converted_count` int DEFAULT 0 NOT NULL,
	`status` enum('draft','scheduled','active','completed','cancelled') DEFAULT 'draft' NOT NULL,
	`is_active` tinyint DEFAULT 1 NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `engagement_campaigns_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_campaign_tenant` ON `engagement_campaigns` (`tenant_id`,`status`);

--> statement-breakpoint
CREATE TABLE `engagement_automations` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(500),
	`trigger_type` enum('sale_completed','points_earned','level_up','inactive_7d','inactive_30d','birthday','geo_enter','time_of_day','near_reward','visit_streak','first_purchase') NOT NULL,
	`trigger_config` json,
	`action_type` enum('push','whatsapp','notification','coupon','wallet_update','email') NOT NULL,
	`action_config` json,
	`is_active` tinyint DEFAULT 1 NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `engagement_automations_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_automation_tenant` ON `engagement_automations` (`tenant_id`,`is_active`);

--> statement-breakpoint
CREATE TABLE `engagement_events` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`account_id` varchar(36),
	`event_type` varchar(50) NOT NULL,
	`event_data` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `engagement_events_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_eng_event_type` ON `engagement_events` (`tenant_id`,`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_eng_event_acct` ON `engagement_events` (`account_id`);

--> statement-breakpoint
CREATE TABLE `engagement_segments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300),
	`rules` json NOT NULL,
	`customer_count` int DEFAULT 0 NOT NULL,
	`is_dynamic` tinyint DEFAULT 1 NOT NULL,
	`is_active` tinyint DEFAULT 1 NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `engagement_segments_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_segment_tenant` ON `engagement_segments` (`tenant_id`,`is_active`);
