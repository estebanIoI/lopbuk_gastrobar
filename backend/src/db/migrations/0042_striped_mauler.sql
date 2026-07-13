CREATE TABLE `content_pages` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` longtext NOT NULL,
	`meta_title` varchar(255),
	`meta_description` varchar(500),
	`page_type` enum('corporate','legal','custom') NOT NULL DEFAULT 'custom',
	`is_published` tinyint NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_content_pages_slug` UNIQUE(`tenant_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `faq_categories` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faq_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faq_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`category_id` varchar(36),
	`question` varchar(500) NOT NULL,
	`answer` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faq_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `homepage_sections` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`section_type` enum('hero','categoryGrid','categoryStrip','productGrid','recipeGrid','brandChips','trustBadges','newsletter','footer','pillRow') NOT NULL,
	`title` varchar(255),
	`enabled` tinyint NOT NULL DEFAULT 1,
	`config` json NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `homepage_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`accepted_terms` tinyint NOT NULL DEFAULT 1,
	`subscribed_at` timestamp DEFAULT (now()),
	`unsubscribed_at` timestamp,
	`is_active` tinyint NOT NULL DEFAULT 1,
	CONSTRAINT `newsletter_subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_newsletter_email` UNIQUE(`tenant_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `popular_searches` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`term` varchar(255) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `popular_searches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_page_ingredients` (
	`id` varchar(36) NOT NULL,
	`recipe_page_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`quantity` decimal(10,3) NOT NULL,
	`unit` varchar(50) NOT NULL DEFAULT 'unidad',
	`notes` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `recipe_page_ingredients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_pages` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`image_url` varchar(500),
	`prep_time_minutes` int,
	`difficulty` enum('fácil','medio','difícil') DEFAULT 'fácil',
	`servings` int NOT NULL DEFAULT 4,
	`steps` json NOT NULL,
	`tips` text,
	`tags` varchar(500),
	`total_cost` decimal(12,2),
	`is_active` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recipe_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_badges` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`icon` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trust_badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `content_pages` ADD CONSTRAINT `content_pages_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `faq_categories` ADD CONSTRAINT `faq_categories_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `faq_items` ADD CONSTRAINT `faq_items_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `faq_items` ADD CONSTRAINT `faq_items_category_id_faq_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `faq_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `homepage_sections` ADD CONSTRAINT `homepage_sections_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD CONSTRAINT `newsletter_subscribers_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `popular_searches` ADD CONSTRAINT `popular_searches_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipe_page_ingredients` ADD CONSTRAINT `recipe_page_ingredients_recipe_page_id_recipe_pages_id_fk` FOREIGN KEY (`recipe_page_id`) REFERENCES `recipe_pages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipe_page_ingredients` ADD CONSTRAINT `recipe_page_ingredients_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipe_pages` ADD CONSTRAINT `recipe_pages_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipe_pages` ADD CONSTRAINT `recipe_pages_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trust_badges` ADD CONSTRAINT `trust_badges_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_content_pages_tenant` ON `content_pages` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_faq_cat_tenant` ON `faq_categories` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_faq_item_cat` ON `faq_items` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_faq_item_tenant` ON `faq_items` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_hp_sections_tenant` ON `homepage_sections` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_hp_sections_type` ON `homepage_sections` (`tenant_id`,`section_type`);--> statement-breakpoint
CREATE INDEX `idx_newsletter_tenant` ON `newsletter_subscribers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_popular_searches_tenant` ON `popular_searches` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_rpi_recipe` ON `recipe_page_ingredients` (`recipe_page_id`);--> statement-breakpoint
CREATE INDEX `idx_rpi_product` ON `recipe_page_ingredients` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_recipe_pages_tenant` ON `recipe_pages` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_recipe_pages_product` ON `recipe_pages` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_trust_badges_tenant` ON `trust_badges` (`tenant_id`);