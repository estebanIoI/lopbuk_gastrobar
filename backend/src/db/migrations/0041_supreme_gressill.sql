ALTER TABLE `print_jobs` MODIFY COLUMN `printer_ip` varchar(45);--> statement-breakpoint
ALTER TABLE `print_jobs` ADD `connection_type` varchar(10) DEFAULT 'lan' NOT NULL;--> statement-breakpoint
ALTER TABLE `print_jobs` ADD `printer_name` varchar(150);--> statement-breakpoint
ALTER TABLE `printers` ADD `device_name` varchar(150);