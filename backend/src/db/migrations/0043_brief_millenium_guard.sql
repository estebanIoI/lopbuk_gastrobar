-- Turnos de caja: valor del turno por empleado (base para el total a pagar al cierre).
-- Defensiva para prod vieja/incompleta: crea las tablas de turno si faltan (el baseline
-- se marca-aplicado sin ejecutarse en prod existente, así que estas tablas pueden no existir)
-- y luego agrega la columna. El CREATE IF NOT EXISTS nunca incluye shift_value, por lo que el
-- ALTER siempre encuentra una tabla sin la columna y no hay riesgo de "duplicate column".
CREATE TABLE IF NOT EXISTS `shift_employees` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`employee_name` varchar(100) NOT NULL,
	`role_label` varchar(50),
	`status` enum('activo','baja') NOT NULL DEFAULT 'activo',
	`baja_reason` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `shift_employees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `shift_employee_bonuses` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`shift_emp_id` varchar(36) NOT NULL,
	`type` enum('bono','descuento') NOT NULL,
	`amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`concept` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `shift_employee_bonuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `shift_employees` ADD `shift_value` decimal(12,2) DEFAULT '0.00' NOT NULL;
