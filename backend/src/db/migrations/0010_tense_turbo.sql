CREATE TABLE `consent_records` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`subject_type` enum('customer','guest','chat_contact') NOT NULL DEFAULT 'guest',
	`subject_id` varchar(36),
	`identifier` varchar(255) NOT NULL,
	`consent_type` enum('data_processing','terms','marketing_whatsapp','marketing_email','analytics_tracking') NOT NULL,
	`granted` tinyint NOT NULL DEFAULT 1,
	`policy_version` varchar(20) NOT NULL DEFAULT '1.0',
	`source` enum('checkout','cookie_banner','whatsapp','admin','signup') NOT NULL,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `consent_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_subject_requests` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`request_type` enum('access','rectify','erase','revoke_consent') NOT NULL,
	`status` enum('pending','in_progress','completed','denied') NOT NULL DEFAULT 'pending',
	`identifier` varchar(255) NOT NULL,
	`requester_name` varchar(255) NOT NULL,
	`verification_method` varchar(100),
	`details` text,
	`requested_at` timestamp DEFAULT (now()),
	`due_at` timestamp,
	`completed_at` timestamp,
	`handled_by` varchar(36),
	`notes` text,
	CONSTRAINT `data_subject_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `is_active` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `deleted_at` timestamp;--> statement-breakpoint
ALTER TABLE `customers` ADD `anonymized_at` timestamp;--> statement-breakpoint
ALTER TABLE `store_info` ADD `privacy_policy_version` varchar(20) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_info` ADD `cookies_content` text;--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD `consent_id` varchar(36);--> statement-breakpoint
ALTER TABLE `consent_records` ADD CONSTRAINT `consent_records_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_subject_requests` ADD CONSTRAINT `data_subject_requests_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_subject_requests` ADD CONSTRAINT `data_subject_requests_handled_by_users_id_fk` FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_consent_tenant_identifier` ON `consent_records` (`tenant_id`,`identifier`);--> statement-breakpoint
CREATE INDEX `idx_consent_tenant_type` ON `consent_records` (`tenant_id`,`consent_type`);--> statement-breakpoint
CREATE INDEX `idx_dsr_tenant_status` ON `data_subject_requests` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_dsr_identifier` ON `data_subject_requests` (`tenant_id`,`identifier`);