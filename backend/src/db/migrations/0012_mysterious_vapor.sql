CREATE TABLE `dispatch_routes` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`route_number` varchar(20) NOT NULL,
	`vehicle_id` varchar(36),
	`driver_id` varchar(36),
	`auxiliaries` json,
	`status` enum('planificada','cargando','en_ruta','retornando','cerrada','cancelada') NOT NULL DEFAULT 'planificada',
	`total_weight_kg` decimal(10,3) NOT NULL DEFAULT '0.000',
	`stops_count` int NOT NULL DEFAULT 0,
	`zone_label` varchar(120),
	`sede_id` varchar(36),
	`started_at` timestamp,
	`closed_at` timestamp,
	`notes` varchar(300),
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dispatch_routes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleet_vehicle_expenses` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`vehicle_id` varchar(36) NOT NULL,
	`type` enum('combustible','peaje','repuesto','lavado','otro') NOT NULL DEFAULT 'combustible',
	`amount` decimal(12,2) NOT NULL,
	`gallons` decimal(8,2),
	`odometer_km` int,
	`route_id` varchar(36),
	`notes` varchar(300),
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `fleet_vehicle_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `courier_availability` ADD `status` enum('disponible','en_ruta','descargando','almuerzo','fuera_turno','incapacidad') DEFAULT 'disponible' NOT NULL;--> statement-breakpoint
ALTER TABLE `fleet_vehicles` ADD `soat_expiry` date;--> statement-breakpoint
ALTER TABLE `fleet_vehicles` ADD `tecno_expiry` date;--> statement-breakpoint
ALTER TABLE `fleet_vehicles` ADD `insurance_expiry` date;--> statement-breakpoint
ALTER TABLE `fleet_vehicles` ADD `odometer_km` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `fleet_vehicles` ADD `fuel_type` varchar(20);--> statement-breakpoint
ALTER TABLE `fleet_vehicles` ADD `volume_m3` decimal(8,2);--> statement-breakpoint
ALTER TABLE `fleet_vehicles` ADD `maintenance_every_km` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `fleet_vehicles` ADD `last_maintenance_km` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD `route_id` varchar(36);--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD `route_sequence` int;--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD `sede_id` varchar(36);--> statement-breakpoint
ALTER TABLE `dispatch_routes` ADD CONSTRAINT `dispatch_routes_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispatch_routes` ADD CONSTRAINT `dispatch_routes_vehicle_id_fleet_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `fleet_vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispatch_routes` ADD CONSTRAINT `dispatch_routes_driver_id_users_id_fk` FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dispatch_routes` ADD CONSTRAINT `dispatch_routes_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_vehicle_expenses` ADD CONSTRAINT `fleet_vehicle_expenses_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_vehicle_expenses` ADD CONSTRAINT `fleet_vehicle_expenses_vehicle_id_fleet_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `fleet_vehicles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_vehicle_expenses` ADD CONSTRAINT `fleet_vehicle_expenses_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_droute_tenant_status` ON `dispatch_routes` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_droute_vehicle` ON `dispatch_routes` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `idx_droute_driver` ON `dispatch_routes` (`driver_id`);--> statement-breakpoint
CREATE INDEX `idx_fvexp_tenant_vehicle` ON `fleet_vehicle_expenses` (`tenant_id`,`vehicle_id`);--> statement-breakpoint
CREATE INDEX `idx_fvexp_date` ON `fleet_vehicle_expenses` (`tenant_id`,`created_at`);