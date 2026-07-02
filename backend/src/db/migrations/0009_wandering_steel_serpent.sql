ALTER TABLE `cartilla_compras` MODIFY COLUMN `usuario_id` varchar(36);--> statement-breakpoint
ALTER TABLE `cartilla_compras` ADD `guest_nombre` varchar(120);--> statement-breakpoint
ALTER TABLE `cartilla_compras` ADD `guest_email` varchar(160);--> statement-breakpoint
ALTER TABLE `cartilla_compras` ADD `guest_telefono` varchar(40);--> statement-breakpoint
ALTER TABLE `cartilla_compras` ADD `token` varchar(64);--> statement-breakpoint
CREATE INDEX `idx_compra_token` ON `cartilla_compras` (`token`);