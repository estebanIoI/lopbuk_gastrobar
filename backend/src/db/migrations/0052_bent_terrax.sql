CREATE TABLE `gym_assessment_files` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`assessment_id` varchar(36),
	`category` enum('certificado','examen','incapacidad','rx','informe','otro') NOT NULL DEFAULT 'otro',
	`title` varchar(200) NOT NULL,
	`file_url` varchar(500) NOT NULL,
	`file_type` varchar(20),
	`file_size` int unsigned,
	`notes` text,
	`uploaded_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `gym_assessment_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_body_measurements` (
	`id` varchar(36) NOT NULL,
	`assessment_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`measurement_date` date NOT NULL,
	`neck_cm` decimal(5,1),
	`shoulders_cm` decimal(5,1),
	`chest_cm` decimal(5,1),
	`left_arm_cm` decimal(5,1),
	`right_arm_cm` decimal(5,1),
	`left_forearm_cm` decimal(5,1),
	`right_forearm_cm` decimal(5,1),
	`waist_cm` decimal(5,1),
	`hip_cm` decimal(5,1),
	`left_thigh_cm` decimal(5,1),
	`right_thigh_cm` decimal(5,1),
	`left_calf_cm` decimal(5,1),
	`right_calf_cm` decimal(5,1),
	`waist_hip_ratio` decimal(4,2),
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `gym_body_measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_health_assessments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`trainer_id` varchar(36),
	`assessment_date` date NOT NULL,
	`type` enum('inicial','periodica','especial','alta') NOT NULL DEFAULT 'periodica',
	`weight_kg` decimal(5,1),
	`height_cm` decimal(5,1),
	`imc` decimal(5,1),
	`body_fat_pct` decimal(4,1),
	`muscle_mass_kg` decimal(5,1),
	`body_water_pct` decimal(4,1),
	`visceral_fat` decimal(3,1),
	`metabolic_age` tinyint unsigned,
	`bone_mass_kg` decimal(4,1),
	`resting_hr_bpm` tinyint unsigned,
	`systolic_bp` smallint unsigned,
	`diastolic_bp` smallint unsigned,
	`flexibility_score` tinyint unsigned,
	`posture_score` tinyint unsigned,
	`mobility_score` tinyint unsigned,
	`pain_level` tinyint unsigned,
	`stress_level` tinyint unsigned,
	`sleep_hours` decimal(3,1),
	`water_intake_ml` int unsigned,
	`observations` text,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gym_health_assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_medical_conditions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`type` enum('lesion','enfermedad','alergia','condicion','restriccion','cirugia') NOT NULL DEFAULT 'lesion',
	`zone` varchar(60),
	`description` text NOT NULL,
	`date_reported` date,
	`status` enum('activa','recuperando','recuperada','cronica','controlada') NOT NULL DEFAULT 'activa',
	`severity` enum('leve','moderada','grave') NOT NULL DEFAULT 'moderada',
	`restricted_exercises` json,
	`restricted_movements` json,
	`document_url` varchar(500),
	`recovery_date` date,
	`recovery_notes` text,
	`reported_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gym_medical_conditions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gym_progress_photos` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`member_id` varchar(36) NOT NULL,
	`assessment_id` varchar(36),
	`category` enum('progreso','evaluacion','lesion','otro') NOT NULL DEFAULT 'progreso',
	`label` varchar(100),
	`photo_url` varchar(500) NOT NULL,
	`thumbnail_url` varchar(500),
	`view_angle` enum('frontal','lateral','espalda','otro') NOT NULL DEFAULT 'frontal',
	`taken_at` date,
	`dayLabel` varchar(30),
	`sort_order` int NOT NULL DEFAULT 0,
	`uploaded_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `gym_progress_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_bundle_items` (
	`id` varchar(36) NOT NULL,
	`bundle_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`variant_id` varchar(36),
	`quantity` int NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_bundle_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_bundles` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` varchar(400),
	`image_url` varchar(500),
	`label` varchar(60),
	`discount_type` enum('fixed_total','percent','amount_off') NOT NULL DEFAULT 'percent',
	`discount_value` decimal(12,2) NOT NULL DEFAULT '0.00',
	`anchor_product_id` varchar(36),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_bundles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `gym_assessment_files` ADD CONSTRAINT `gym_assessment_files_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_assessment_files` ADD CONSTRAINT `gym_assessment_files_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_assessment_files` ADD CONSTRAINT `gym_assessment_files_assessment_id_gym_health_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `gym_health_assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_assessment_files` ADD CONSTRAINT `gym_assessment_files_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_body_measurements` ADD CONSTRAINT `gym_body_measurements_assessment_id_gym_health_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `gym_health_assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_body_measurements` ADD CONSTRAINT `gym_body_measurements_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_health_assessments` ADD CONSTRAINT `gym_health_assessments_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_health_assessments` ADD CONSTRAINT `gym_health_assessments_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_health_assessments` ADD CONSTRAINT `gym_health_assessments_trainer_id_users_id_fk` FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_medical_conditions` ADD CONSTRAINT `gym_medical_conditions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_medical_conditions` ADD CONSTRAINT `gym_medical_conditions_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_medical_conditions` ADD CONSTRAINT `gym_medical_conditions_reported_by_users_id_fk` FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_progress_photos` ADD CONSTRAINT `gym_progress_photos_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_progress_photos` ADD CONSTRAINT `gym_progress_photos_member_id_gym_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gym_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_progress_photos` ADD CONSTRAINT `gym_progress_photos_assessment_id_gym_health_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `gym_health_assessments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gym_progress_photos` ADD CONSTRAINT `gym_progress_photos_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_bundles` ADD CONSTRAINT `product_bundles_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_gaf_member` ON `gym_assessment_files` (`member_id`);--> statement-breakpoint
CREATE INDEX `idx_gaf_assessment` ON `gym_assessment_files` (`assessment_id`);--> statement-breakpoint
CREATE INDEX `idx_gbm_member` ON `gym_body_measurements` (`member_id`,`measurement_date`);--> statement-breakpoint
CREATE INDEX `idx_gbm_assessment` ON `gym_body_measurements` (`assessment_id`);--> statement-breakpoint
CREATE INDEX `idx_gha_member` ON `gym_health_assessments` (`member_id`,`assessment_date`);--> statement-breakpoint
CREATE INDEX `idx_gha_tenant` ON `gym_health_assessments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_gmc_member` ON `gym_medical_conditions` (`member_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_gmc_tenant` ON `gym_medical_conditions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_gpp_member` ON `gym_progress_photos` (`member_id`,`taken_at`);--> statement-breakpoint
CREATE INDEX `idx_gpp_assessment` ON `gym_progress_photos` (`assessment_id`);--> statement-breakpoint
CREATE INDEX `idx_pbi_bundle` ON `product_bundle_items` (`bundle_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_pb_tenant_status` ON `product_bundles` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_pb_anchor` ON `product_bundles` (`anchor_product_id`);