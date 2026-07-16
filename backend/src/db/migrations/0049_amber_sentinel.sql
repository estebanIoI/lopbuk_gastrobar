CREATE TABLE `engagement_notes` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`account_id` varchar(36) NOT NULL,
	`note` varchar(1000) NOT NULL,
	`created_by` varchar(120),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `engagement_notes_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_note_account` ON `engagement_notes` (`tenant_id`,`account_id`);
