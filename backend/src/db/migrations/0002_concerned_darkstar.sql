ALTER TABLE `storefront_orders` ADD `assigned_to` varchar(36);--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD CONSTRAINT `storefront_orders_assigned_to_users_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_order_assigned` ON `storefront_orders` (`assigned_to`);