ALTER TABLE `users` ADD `manager_id` varchar(36);--> statement-breakpoint
CREATE INDEX `idx_users_manager` ON `users` (`manager_id`);