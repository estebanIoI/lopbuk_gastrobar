CREATE TABLE `engagement_automations` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(500),
	`trigger_type` enum('sale_completed','points_earned','level_up','inactive_7d','inactive_30d','birthday','geo_enter','time_of_day','near_reward','visit_streak','first_purchase') NOT NULL,
	`trigger_config` json,
	`action_type` enum('push','whatsapp','notification','coupon','wallet_update','email') NOT NULL,
	`action_config` json,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `engagement_automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engagement_campaigns` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(500),
	`objective` enum('increase_sales','recover_inactive','reward_loyal','promote_product','anniversary','birthday','custom') NOT NULL DEFAULT 'increase_sales',
	`audience_filter` json,
	`offer_type` enum('percentage','fixed','free_item','points_multiplier','free_delivery'),
	`offer_value` decimal(10,2),
	`channels` json NOT NULL,
	`scheduled_at` timestamp,
	`sent_count` int NOT NULL DEFAULT 0,
	`opened_count` int NOT NULL DEFAULT 0,
	`converted_count` int NOT NULL DEFAULT 0,
	`status` enum('draft','scheduled','active','completed','cancelled') NOT NULL DEFAULT 'draft',
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `engagement_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engagement_events` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`account_id` varchar(36),
	`event_type` varchar(50) NOT NULL,
	`event_data` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `engagement_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engagement_notes` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`account_id` varchar(36) NOT NULL,
	`note` varchar(1000) NOT NULL,
	`created_by` varchar(120),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `engagement_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `engagement_segments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300),
	`rules` json NOT NULL,
	`customer_count` int NOT NULL DEFAULT 0,
	`is_dynamic` tinyint NOT NULL DEFAULT 1,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `engagement_segments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exercise_media` (
	`id` varchar(36) NOT NULL,
	`exercise_id` varchar(36) NOT NULL,
	`kind` varchar(20) NOT NULL,
	`url` varchar(220) NOT NULL,
	`width` int,
	`height` int,
	`attribution` varchar(220),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `exercise_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exercise_tags` (
	`exercise_id` varchar(36) NOT NULL,
	`tag` varchar(60) NOT NULL,
	CONSTRAINT `exercise_tags_id` PRIMARY KEY(`exercise_id`,`tag`)
);
--> statement-breakpoint
CREATE TABLE `exercise_translations` (
	`id` varchar(36) NOT NULL,
	`exercise_id` varchar(36) NOT NULL,
	`language` varchar(5) NOT NULL,
	`name` varchar(200),
	`instructions` text,
	`steps` json,
	`tips` text,
	`mistakes` text,
	CONSTRAINT `exercise_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_extr` UNIQUE(`exercise_id`,`language`)
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` varchar(36) NOT NULL,
	`dataset_id` varchar(10),
	`slug` varchar(180),
	`source` varchar(20) NOT NULL DEFAULT 'dataset',
	`body_part` varchar(40),
	`equipment` varchar(60),
	`target` varchar(60),
	`muscle_group` varchar(60),
	`secondary_muscles` json,
	`movement_pattern` varchar(10),
	`difficulty` varchar(20),
	`experience_level` varchar(20),
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `exercises_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_ex_dataset` UNIQUE(`dataset_id`)
);
--> statement-breakpoint
CREATE TABLE `gym_member_profiles` (
	`id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`birth_date` date,
	`sex` enum('M','F','otro'),
	`height_cm` decimal(5,1),
	`initial_weight_kg` decimal(5,1),
	`blood_type` varchar(5),
	`objective_id` varchar(36),
	`level` enum('principiante','intermedio','avanzado','elite') NOT NULL DEFAULT 'principiante',
	`occupation` varchar(100),
	`emergency_contact` varchar(100),
	`emergency_phone` varchar(20),
	`medical_notes` text,
	`allergies` json,
	`conditions` json,
	`medications` json,
	`social_instagram` varchar(50),
	`social_facebook` varchar(100),
	`social_tiktok` varchar(50),
	`observations` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gym_member_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `gym_profile_member` UNIQUE(`member_id`)
);
--> statement-breakpoint
CREATE TABLE `gym_member_timeline` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`event_label` varchar(255) NOT NULL,
	`entity_type` varchar(50),
	`entity_id` varchar(36),
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `gym_member_timeline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_members` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`member_number` varchar(20) NOT NULL,
	`photo_url` varchar(500),
	`cover_photo_url` varchar(500),
	`avatar_color` varchar(7) NOT NULL DEFAULT '#8b5cf6',
	`status` enum('activo','inactivo','congelado','lesionado','dado_de_baja') NOT NULL DEFAULT 'activo',
	`join_date` date,
	`trainer_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gym_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `gym_member_number` UNIQUE(`member_number`),
	CONSTRAINT `gym_member_user_tenant` UNIQUE(`tenant_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `gym_objectives` (
	`id` varchar(36) NOT NULL,
	`key` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`icon` varchar(50) NOT NULL,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `gym_objectives_id` PRIMARY KEY(`id`),
	CONSTRAINT `gym_objectives_key` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `routine_exercises` (
	`id` varchar(36) NOT NULL,
	`routine_version_id` varchar(36) NOT NULL,
	`exercise_id` varchar(36) NOT NULL,
	`display_name` varchar(160),
	`exercise_order` int NOT NULL DEFAULT 0,
	`group_id` varchar(10),
	`execution_type` varchar(12) NOT NULL DEFAULT 'NORMAL',
	`target_sets` int NOT NULL DEFAULT 3,
	`target_reps` int NOT NULL DEFAULT 12,
	`start_weight` decimal(8,2) NOT NULL DEFAULT '0.00',
	`rpe` decimal(3,1),
	`rir` int,
	`tempo` varchar(16),
	`rest_seconds` int,
	CONSTRAINT `routine_exercises_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `routine_versions` (
	`id` varchar(36) NOT NULL,
	`routine_id` varchar(36) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` varchar(12) NOT NULL DEFAULT 'draft',
	`movement_pattern` varchar(10),
	`notes` text,
	`published_at` datetime,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `routine_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_rv` UNIQUE(`routine_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `routines` (
	`id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`goal` varchar(24) NOT NULL DEFAULT 'hypertrophy',
	`is_active` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `routines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
ALTER TABLE `loyalty_config` ADD `wallet_enabled` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `wallet_logo_url` varchar(500);--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `wallet_primary_color` varchar(7) DEFAULT '#000000';--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `wallet_business_name` varchar(120);--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `wallet_short_description` varchar(300);--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `geo_radius_meters` int DEFAULT 300;--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `geo_push_enabled` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `geo_push_message` varchar(300);--> statement-breakpoint
ALTER TABLE `loyalty_rewards` ADD `reward_type` enum('points','purchase_count','spend_amount','cashback','streak','referral') DEFAULT 'points' NOT NULL;--> statement-breakpoint
ALTER TABLE `loyalty_rewards` ADD `condition_value` decimal(12,2);--> statement-breakpoint
ALTER TABLE `loyalty_rewards` ADD `streak_days` int;--> statement-breakpoint
ALTER TABLE `gym_member_profiles` ADD CONSTRAINT `gym_member_profiles_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_member_timeline` ADD CONSTRAINT `gym_member_timeline_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_member_timeline` ADD CONSTRAINT `gym_member_timeline_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_members` ADD CONSTRAINT `gym_members_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_members` ADD CONSTRAINT `gym_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_members` ADD CONSTRAINT `gym_members_trainer_id_users_id_fk` FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_automation_tenant` ON `engagement_automations` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_campaign_tenant` ON `engagement_campaigns` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_eng_event_type` ON `engagement_events` (`tenant_id`,`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_eng_event_acct` ON `engagement_events` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_note_account` ON `engagement_notes` (`tenant_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `idx_segment_tenant` ON `engagement_segments` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_exmed_ex` ON `exercise_media` (`exercise_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_extag_tag` ON `exercise_tags` (`tag`);--> statement-breakpoint
CREATE INDEX `idx_extr_lang` ON `exercise_translations` (`language`);--> statement-breakpoint
CREATE INDEX `idx_ex_body` ON `exercises` (`body_part`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_ex_equipment` ON `exercises` (`equipment`);--> statement-breakpoint
CREATE INDEX `idx_ex_pattern` ON `exercises` (`movement_pattern`);--> statement-breakpoint
CREATE INDEX `idx_gym_profile_member` ON `gym_member_profiles` (`member_id`);--> statement-breakpoint
CREATE INDEX `idx_gym_profile_objective` ON `gym_member_profiles` (`objective_id`);--> statement-breakpoint
CREATE INDEX `idx_timeline_member` ON `gym_member_timeline` (`member_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_timeline_tenant` ON `gym_member_timeline` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_timeline_event` ON `gym_member_timeline` (`member_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `idx_gym_member_tenant` ON `gym_members` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_gym_member_user` ON `gym_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_gym_member_status` ON `gym_members` (`status`);--> statement-breakpoint
CREATE INDEX `idx_gym_member_trainer` ON `gym_members` (`trainer_id`);--> statement-breakpoint
CREATE INDEX `idx_rex_version` ON `routine_exercises` (`routine_version_id`,`exercise_order`);--> statement-breakpoint
CREATE INDEX `idx_rv_status` ON `routine_versions` (`routine_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_rt_active` ON `routines` (`is_active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_loyalty_level` ON `loyalty_accounts` (`tenant_id`,`level`);