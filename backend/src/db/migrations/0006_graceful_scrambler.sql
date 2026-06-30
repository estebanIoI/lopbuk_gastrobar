CREATE TABLE `cartilla_archivos` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`cartilla_id` varchar(36) NOT NULL,
	`nombre` varchar(200) NOT NULL,
	`url` varchar(500) NOT NULL,
	`tipo` varchar(30),
	`size_bytes` int,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_archivos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ca_cartilla` ON `cartilla_archivos` (`cartilla_id`);