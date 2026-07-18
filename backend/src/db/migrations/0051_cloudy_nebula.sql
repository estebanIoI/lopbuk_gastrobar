CREATE TABLE `gym_exercise_categories` (
	`id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`icon` varchar(50),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `gym_exercise_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `gym_ex_cat_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `gym_exercise_favorites` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`exercise_id` varchar(36) NOT NULL,
	`staff_user_id` varchar(36) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `gym_exercise_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `gym_ex_fav_unique` UNIQUE(`tenant_id`,`exercise_id`,`staff_user_id`)
);
--> statement-breakpoint
CREATE TABLE `gym_exercise_library` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`category_id` varchar(36),
	`name` varchar(120) NOT NULL,
	`slug` varchar(180),
	`description` text,
	`muscle_group` varchar(60) NOT NULL,
	`secondary_muscles` json,
	`equipment` varchar(60),
	`difficulty` enum('principiante','intermedio','avanzado') NOT NULL DEFAULT 'intermedio',
	`movement_pattern` varchar(20),
	`tips` text,
	`common_errors` text,
	`alternatives` json,
	`rpe_recommendation` decimal(2,1),
	`tempo` varchar(10),
	`rest_seconds` int,
	`estimated_kcal` int,
	`estimated_seconds` int,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`popularity` int unsigned NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gym_exercise_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_exercise_media` (
	`id` varchar(36) NOT NULL,
	`exercise_id` varchar(36) NOT NULL,
	`kind` enum('gif','video','image') NOT NULL,
	`url` varchar(500) NOT NULL,
	`thumbnail_url` varchar(500),
	`width` int unsigned,
	`height` int unsigned,
	`attribution` varchar(200),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `gym_exercise_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_personal_records` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`exercise_id` varchar(36),
	`exercise_name` varchar(120) NOT NULL,
	`record_type` enum('max_weight','max_reps','max_volume','max_tonnage','max_duration','max_frequency') NOT NULL,
	`value` decimal(10,2) NOT NULL,
	`unit` varchar(20) NOT NULL,
	`session_id` varchar(36),
	`achieved_at` timestamp DEFAULT (now()),
	`previous_value` decimal(10,2),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `gym_personal_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_workout_assignments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`template_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`start_date` date,
	`start_week` tinyint unsigned NOT NULL DEFAULT 1,
	`status` enum('activo','completado','abandonado','pausado') NOT NULL DEFAULT 'activo',
	`assigned_by` varchar(36),
	`completed_at` timestamp,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gym_workout_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_workout_session_exercises` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`exercise_id` varchar(36),
	`exercise_name` varchar(120) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`notes` text,
	CONSTRAINT `gym_workout_session_exercises_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_workout_sessions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`assignment_id` varchar(36),
	`week_number` tinyint unsigned,
	`day_number` tinyint unsigned,
	`dayLabel` varchar(40),
	`started_at` timestamp DEFAULT (now()),
	`ended_at` timestamp,
	`duration_min` int unsigned,
	`perceived_effort` tinyint unsigned,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `gym_workout_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_workout_sets` (
	`id` varchar(36) NOT NULL,
	`session_exercise_id` varchar(36) NOT NULL,
	`set_number` tinyint unsigned NOT NULL,
	`weight_kg` decimal(6,2),
	`reps` smallint unsigned,
	`rpe` decimal(2,1),
	`is_warmup` tinyint NOT NULL DEFAULT 0,
	`is_failure` tinyint NOT NULL DEFAULT 0,
	`is_skipped` tinyint NOT NULL DEFAULT 0,
	`is_extra` tinyint NOT NULL DEFAULT 0,
	`rest_seconds` int unsigned,
	`duration_seconds` int unsigned,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `gym_workout_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_workout_template_exercises` (
	`id` varchar(36) NOT NULL,
	`template_id` varchar(36) NOT NULL,
	`exercise_id` varchar(36) NOT NULL,
	`week_number` tinyint unsigned NOT NULL DEFAULT 1,
	`day_number` tinyint unsigned NOT NULL,
	`dayLabel` varchar(40),
	`target_sets` tinyint unsigned NOT NULL DEFAULT 3,
	`target_reps` varchar(30),
	`start_weight` decimal(6,2),
	`rpe_target` decimal(2,1),
	`tempo` varchar(10),
	`rest_seconds` int,
	`progression_type` enum('linear','double_progression','wave','rpe','manual') NOT NULL DEFAULT 'linear',
	`progression_config` json,
	`notes` text,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `gym_workout_template_exercises_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_workout_templates` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`category` varchar(50),
	`weeks` tinyint unsigned NOT NULL DEFAULT 4,
	`days_per_week` tinyint unsigned,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gym_workout_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_template_versions` (
	`id` varchar(36) NOT NULL,
	`template_id` varchar(36) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`sections` json NOT NULL,
	`status` varchar(12) NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `product_template_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_ptv` UNIQUE(`template_id`,`version`)
);
--> statement-breakpoint
ALTER TABLE `gym_exercise_favorites` ADD CONSTRAINT `gym_exercise_favorites_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_exercise_favorites` ADD CONSTRAINT `gym_exercise_favorites_exercise_id_gym_exercise_library_id_fk` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercise_library`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_exercise_favorites` ADD CONSTRAINT `gym_exercise_favorites_staff_user_id_users_id_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_exercise_library` ADD CONSTRAINT `gym_exercise_library_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_exercise_library` ADD CONSTRAINT `gym_exercise_library_category_id_gym_exercise_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `gym_exercise_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_exercise_library` ADD CONSTRAINT `gym_exercise_library_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_exercise_media` ADD CONSTRAINT `gym_exercise_media_exercise_id_gym_exercise_library_id_fk` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercise_library`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_personal_records` ADD CONSTRAINT `gym_personal_records_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_personal_records` ADD CONSTRAINT `gym_personal_records_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_personal_records` ADD CONSTRAINT `gym_personal_records_exercise_id_gym_exercise_library_id_fk` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercise_library`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_personal_records` ADD CONSTRAINT `gym_personal_records_session_id_gym_workout_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `gym_workout_sessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_assignments` ADD CONSTRAINT `gym_workout_assignments_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_assignments` ADD CONSTRAINT `gym_workout_assignments_template_id_gym_workout_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `gym_workout_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_assignments` ADD CONSTRAINT `gym_workout_assignments_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_assignments` ADD CONSTRAINT `gym_workout_assignments_assigned_by_users_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_session_exercises` ADD CONSTRAINT `gym_workout_session_exercises_session_id_gym_workout_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `gym_workout_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_session_exercises` ADD CONSTRAINT `gym_workout_session_exercises_exercise_id_gym_exercise_library_id_fk` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercise_library`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_sessions` ADD CONSTRAINT `gym_workout_sessions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_sessions` ADD CONSTRAINT `gym_workout_sessions_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_sessions` ADD CONSTRAINT `gym_workout_sessions_assignment_id_gym_workout_assignments_id_fk` FOREIGN KEY (`assignment_id`) REFERENCES `gym_workout_assignments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_sets` ADD CONSTRAINT `gym_workout_sets_session_exercise_id_gym_workout_session_exercises_id_fk` FOREIGN KEY (`session_exercise_id`) REFERENCES `gym_workout_session_exercises`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_template_exercises` ADD CONSTRAINT `gym_workout_template_exercises_template_id_gym_workout_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `gym_workout_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_template_exercises` ADD CONSTRAINT `gym_workout_template_exercises_exercise_id_gym_exercise_library_id_fk` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercise_library`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_templates` ADD CONSTRAINT `gym_workout_templates_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_workout_templates` ADD CONSTRAINT `gym_workout_templates_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_exfav_tenant` ON `gym_exercise_favorites` (`tenant_id`,`staff_user_id`);--> statement-breakpoint
CREATE INDEX `idx_exlib_tenant` ON `gym_exercise_library` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_exlib_category` ON `gym_exercise_library` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_exlib_muscle` ON `gym_exercise_library` (`muscle_group`);--> statement-breakpoint
CREATE INDEX `idx_exlib_difficulty` ON `gym_exercise_library` (`difficulty`);--> statement-breakpoint
CREATE INDEX `idx_exlib_active` ON `gym_exercise_library` (`is_active`,`popularity`);--> statement-breakpoint
CREATE INDEX `idx_exmedia_exercise` ON `gym_exercise_media` (`exercise_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_pr_member` ON `gym_personal_records` (`member_id`);--> statement-breakpoint
CREATE INDEX `idx_pr_exercise` ON `gym_personal_records` (`member_id`,`exercise_id`,`record_type`);--> statement-breakpoint
CREATE INDEX `idx_wass_tenant` ON `gym_workout_assignments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_wass_member` ON `gym_workout_assignments` (`member_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_wass_template` ON `gym_workout_assignments` (`template_id`);--> statement-breakpoint
CREATE INDEX `idx_wsese_session` ON `gym_workout_session_exercises` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_wses_member` ON `gym_workout_sessions` (`member_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_wses_tenant` ON `gym_workout_sessions` (`tenant_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_wset_session` ON `gym_workout_sets` (`session_exercise_id`);--> statement-breakpoint
CREATE INDEX `idx_wtex_template` ON `gym_workout_template_exercises` (`template_id`,`week_number`,`day_number`);--> statement-breakpoint
CREATE INDEX `idx_wtpl_tenant` ON `gym_workout_templates` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_wtpl_category` ON `gym_workout_templates` (`tenant_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_ptv_status` ON `product_template_versions` (`template_id`,`status`);