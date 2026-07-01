ALTER TABLE `store_info` ADD `allow_wompi` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `store_info` ADD `contraentrega_label` varchar(60) DEFAULT 'Contra entrega' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_info` ADD `contraentrega_desc` varchar(160) DEFAULT 'Paga en efectivo cuando recibas tu pedido' NOT NULL;