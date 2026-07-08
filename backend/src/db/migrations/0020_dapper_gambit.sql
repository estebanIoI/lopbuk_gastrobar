ALTER TABLE `dispatch_routes` ADD `last_lat` decimal(10,7);--> statement-breakpoint
ALTER TABLE `dispatch_routes` ADD `last_lng` decimal(10,7);--> statement-breakpoint
ALTER TABLE `dispatch_routes` ADD `last_ping_at` timestamp;--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD `tracking_token` varchar(48);--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD `pod_photo_url` varchar(500);--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD `pod_received_by` varchar(120);