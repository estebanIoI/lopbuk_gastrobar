CREATE TABLE `share_links` (
	`id` varchar(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`type` enum('product','store','collection') NOT NULL,
	`config` json NOT NULL,
	`title` varchar(200),
	`clicks` int NOT NULL DEFAULT 0,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `share_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_share_link_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE INDEX `idx_share_link_active` ON `share_links` (`is_active`);