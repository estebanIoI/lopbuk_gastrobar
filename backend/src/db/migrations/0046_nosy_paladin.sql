CREATE TABLE `event_logs` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`event_id` varchar(36),
	`booking_id` varchar(36),
	`trace_id` varchar(64),
	`action` varchar(50) NOT NULL,
	`actor` varchar(100),
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `event_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `event_bookings` ADD `trace_id` varchar(64);--> statement-breakpoint
ALTER TABLE `event_seat_holds` ADD `trace_id` varchar(64);--> statement-breakpoint
CREATE INDEX `idx_elog_trace` ON `event_logs` (`trace_id`);--> statement-breakpoint
CREATE INDEX `idx_elog_booking` ON `event_logs` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_elog_event` ON `event_logs` (`event_id`,`action`);