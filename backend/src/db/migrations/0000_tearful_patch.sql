CREATE TABLE `affiliate_campaigns` (
	`id` varchar(36) NOT NULL,
	`affiliate_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`entity_type` enum('store','product','event','service') NOT NULL DEFAULT 'store',
	`entity_id` varchar(36),
	`ref_token` varchar(100) NOT NULL,
	`discount_code` varchar(50),
	`discount_pct` decimal(5,2) NOT NULL DEFAULT '0.00',
	`commission_pct` decimal(5,2) NOT NULL,
	`cookie_days` tinyint NOT NULL DEFAULT 7,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_campaign_code` UNIQUE(`discount_code`),
	CONSTRAINT `idx_campaign_ref` UNIQUE(`ref_token`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_commissions` (
	`id` varchar(36) NOT NULL,
	`affiliate_id` varchar(36) NOT NULL,
	`conversion_id` varchar(36),
	`type` enum('conversion','mission_bonus','tier_bonus','package') NOT NULL,
	`amount_cop` decimal(14,2) NOT NULL,
	`status` enum('pending','approved','paid') NOT NULL DEFAULT 'pending',
	`note` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `affiliate_commissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_conversions` (
	`id` varchar(36) NOT NULL,
	`campaign_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_id` varchar(36),
	`sale_id` varchar(36),
	`method` enum('link','code') NOT NULL,
	`order_total_cop` decimal(14,2) NOT NULL,
	`commission_cop` decimal(14,2) NOT NULL,
	`status` enum('pending','approved','paid','rejected') NOT NULL DEFAULT 'pending',
	`approved_at` timestamp,
	`paid_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `affiliate_conversions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_mission_submissions` (
	`id` varchar(36) NOT NULL,
	`mission_id` varchar(36) NOT NULL,
	`affiliate_id` varchar(36) NOT NULL,
	`content_url` varchar(800) NOT NULL,
	`status` enum('submitted','approved','rejected') NOT NULL DEFAULT 'submitted',
	`reviewed_by` varchar(36),
	`review_note` text,
	`reviewed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `affiliate_mission_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_missions` (
	`id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`reward_cop` decimal(14,2) NOT NULL,
	`required_views` int,
	`min_tier` enum('bronze','silver','gold') NOT NULL DEFAULT 'bronze',
	`expires_at` timestamp,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `affiliate_missions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_package_orders` (
	`id` varchar(36) NOT NULL,
	`package_id` varchar(36) NOT NULL,
	`affiliate_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`entity_type` enum('store','event','service') NOT NULL DEFAULT 'store',
	`entity_id` varchar(36),
	`status` enum('pending_payment','paid','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending_payment',
	`total_cop` decimal(14,2) NOT NULL,
	`affiliate_cop` decimal(14,2) NOT NULL,
	`platform_cop` decimal(14,2) NOT NULL,
	`paid_at` timestamp,
	`content_deadline` timestamp,
	`content_delivered` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_package_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_packages` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`deliverables` json,
	`price_cop` decimal(14,2) NOT NULL,
	`affiliate_pct` decimal(5,2) NOT NULL,
	`platform_pct` decimal(5,2) NOT NULL,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_withdrawals` (
	`id` varchar(36) NOT NULL,
	`affiliate_id` varchar(36) NOT NULL,
	`amount_cop` decimal(14,2) NOT NULL,
	`payment_method` varchar(100) NOT NULL,
	`status` enum('requested','processing','paid','rejected') NOT NULL DEFAULT 'requested',
	`processed_by` varchar(36),
	`note` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_withdrawals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliates` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(50),
	`handle` varchar(100),
	`tier` enum('bronze','silver','gold') NOT NULL DEFAULT 'bronze',
	`balance_cop` decimal(14,2) NOT NULL DEFAULT '0.00',
	`pending_cop` decimal(14,2) NOT NULL DEFAULT '0.00',
	`monthly_sales` int NOT NULL DEFAULT 0,
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`password_hash` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliates_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_aff_email` UNIQUE(`email`),
	CONSTRAINT `idx_aff_handle` UNIQUE(`handle`)
);
--> statement-breakpoint
CREATE TABLE `agent_actions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`channel` enum('chat','whatsapp','voice','web') NOT NULL DEFAULT 'chat',
	`tool_name` varchar(100) NOT NULL,
	`tool_input` json,
	`tool_output` json,
	`success` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_usage_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36),
	`provider` varchar(20) NOT NULL,
	`model` varchar(80),
	`tier` varchar(16),
	`prompt_tokens` int NOT NULL DEFAULT 0,
	`completion_tokens` int NOT NULL DEFAULT 0,
	`total_tokens` int NOT NULL DEFAULT 0,
	`est_cost` decimal(12,6) NOT NULL DEFAULT '0.000000',
	`ok` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `ai_usage_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_vision_cache` (
	`hash` varchar(64) NOT NULL,
	`text` mediumtext NOT NULL,
	`provider` varchar(20),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `ai_vision_cache_hash` PRIMARY KEY(`hash`)
);
--> statement-breakpoint
CREATE TABLE `arena_feed` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` enum('post','progress','achievement','challenge','milestone') NOT NULL DEFAULT 'post',
	`body` varchar(500),
	`photo_url` varchar(800),
	`metadata` json,
	`likes` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`comments_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `arena_feed_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `arena_feed_comments` (
	`id` varchar(36) NOT NULL,
	`feed_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`body` varchar(400) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `arena_feed_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `arena_feed_likes` (
	`id` varchar(36) NOT NULL,
	`feed_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `arena_feed_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_afl_unique` UNIQUE(`feed_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`user_id` varchar(36),
	`user_email` varchar(255),
	`action` varchar(100) NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`entity_type` varchar(50),
	`entity_id` varchar(36),
	`details` json,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_actividad_opciones` (
	`id` varchar(36) NOT NULL,
	`actividad_id` varchar(36) NOT NULL,
	`texto` varchar(255) NOT NULL,
	`orden` int DEFAULT 0,
	CONSTRAINT `cartilla_actividad_opciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_actividad_ordenar` (
	`id` varchar(36) NOT NULL,
	`actividad_id` varchar(36) NOT NULL,
	`fragmento` varchar(500) NOT NULL,
	`orden_correcto` int NOT NULL,
	CONSTRAINT `cartilla_actividad_ordenar_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_actividad_pares` (
	`id` varchar(36) NOT NULL,
	`actividad_id` varchar(36) NOT NULL,
	`inga` varchar(255) NOT NULL,
	`espanol` varchar(255) NOT NULL,
	CONSTRAINT `cartilla_actividad_pares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_actividad_vf` (
	`id` varchar(36) NOT NULL,
	`actividad_id` varchar(36) NOT NULL,
	`enunciado` text NOT NULL,
	`es_verdadero` tinyint(1) NOT NULL,
	`orden` int DEFAULT 0,
	CONSTRAINT `cartilla_actividad_vf_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_actividades` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`modulo_id` varchar(36) NOT NULL,
	`tipo` enum('completar','emparejar','verdadero_falso','ordenar') NOT NULL,
	`pregunta` text NOT NULL,
	`respuesta_correcta` varchar(255),
	`orden` int DEFAULT 0,
	CONSTRAINT `cartilla_actividades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_comentarios` (
	`id` varchar(36) NOT NULL,
	`publicacion_id` varchar(36) NOT NULL,
	`usuario_id` varchar(36) NOT NULL,
	`contenido` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_comentarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_compras` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`cartilla_id` varchar(36) NOT NULL,
	`usuario_id` varchar(36) NOT NULL,
	`precio` decimal(10,2) NOT NULL DEFAULT '0.00',
	`moneda` varchar(8) NOT NULL DEFAULT 'COP',
	`estado` enum('gratis','pendiente','pagado','reembolsado') NOT NULL DEFAULT 'pendiente',
	`metodo` enum('gratis','stripe','credito','efectivo','manual') NOT NULL DEFAULT 'manual',
	`referencia` varchar(255),
	`pagado_en` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cartilla_compras_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_compra_usuario_cartilla` UNIQUE(`usuario_id`,`cartilla_id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_modulo_audios` (
	`id` varchar(36) NOT NULL,
	`modulo_id` varchar(36) NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`url` varchar(500) NOT NULL,
	`descripcion` text,
	`orden` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_modulo_audios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_modulo_imagenes` (
	`id` varchar(36) NOT NULL,
	`modulo_id` varchar(36) NOT NULL,
	`url` varchar(500) NOT NULL,
	`alt` varchar(255),
	`caption` text,
	`orden` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_modulo_imagenes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_modulo_secciones` (
	`id` varchar(36) NOT NULL,
	`modulo_id` varchar(36) NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`contenido` text,
	`tipo` enum('texto','vocabulario','cultural','pronunciacion','gramatica') DEFAULT 'texto',
	`orden` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_modulo_secciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_modulos` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`cartilla_id` varchar(36) NOT NULL,
	`clave` varchar(60) NOT NULL,
	`titulo` varchar(160) NOT NULL,
	`icono` varchar(40) NOT NULL DEFAULT 'Book',
	`color` enum('emerald','green','amber','purple','pink') NOT NULL DEFAULT 'emerald',
	`descripcion` text,
	`video_url` varchar(500),
	`frase` varchar(255),
	`traduccion` varchar(255),
	`orden` int DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_modulos_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_modulo_cartilla_clave` UNIQUE(`cartilla_id`,`clave`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_progreso` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`usuario_id` varchar(36) NOT NULL,
	`cartilla_id` varchar(36) NOT NULL,
	`puntos` int DEFAULT 0,
	`dias_seguidos` int DEFAULT 0,
	`palabras_aprendidas` int DEFAULT 0,
	`ultimo_acceso` date,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cartilla_progreso_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_progreso_usuario_cartilla` UNIQUE(`usuario_id`,`cartilla_id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_publicacion_likes` (
	`id` varchar(36) NOT NULL,
	`publicacion_id` varchar(36) NOT NULL,
	`usuario_id` varchar(36) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_publicacion_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_pub_like` UNIQUE(`publicacion_id`,`usuario_id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_publicaciones` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`cartilla_id` varchar(36),
	`usuario_id` varchar(36) NOT NULL,
	`contenido` text NOT NULL,
	`likes` int DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_publicaciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_retos` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`cartilla_id` varchar(36),
	`titulo` varchar(150) NOT NULL,
	`descripcion` text NOT NULL,
	`puntos` int NOT NULL DEFAULT 0,
	`dificultad` enum('facil','medio','dificil') NOT NULL DEFAULT 'facil',
	`categoria` enum('vocabulario','conversacion','modulo','comunidad') NOT NULL,
	`meta` int DEFAULT 1,
	`activo` tinyint(1) DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_retos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_usuario_modulos` (
	`id` varchar(36) NOT NULL,
	`usuario_id` varchar(36) NOT NULL,
	`modulo_id` varchar(36) NOT NULL,
	`completado` tinyint(1) DEFAULT 0,
	`puntos_obtenidos` int DEFAULT 0,
	`completado_en` timestamp,
	CONSTRAINT `cartilla_usuario_modulos_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_usuario_modulo` UNIQUE(`usuario_id`,`modulo_id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_usuario_respuestas` (
	`id` varchar(36) NOT NULL,
	`usuario_id` varchar(36) NOT NULL,
	`actividad_id` varchar(36) NOT NULL,
	`respuesta` varchar(255) NOT NULL,
	`es_correcta` tinyint(1) NOT NULL,
	`puntos_obtenidos` int DEFAULT 0,
	`respondido_en` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_usuario_respuestas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_usuario_retos` (
	`id` varchar(36) NOT NULL,
	`usuario_id` varchar(36) NOT NULL,
	`reto_id` varchar(36) NOT NULL,
	`fecha` date NOT NULL,
	`completado` tinyint(1) DEFAULT 0,
	`actual` int DEFAULT 0,
	`progreso` int DEFAULT 0,
	`completado_en` timestamp,
	CONSTRAINT `cartilla_usuario_retos_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_usuario_reto_fecha` UNIQUE(`usuario_id`,`reto_id`,`fecha`)
);
--> statement-breakpoint
CREATE TABLE `cartilla_vocabulario` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`cartilla_id` varchar(36),
	`modulo_id` varchar(36),
	`espanol` varchar(200) NOT NULL,
	`inga` varchar(200) NOT NULL,
	`categoria` varchar(50) DEFAULT 'general',
	`notas` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cartilla_vocabulario_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cartillas` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`titulo` varchar(160) NOT NULL,
	`tipo` enum('cartilla','libro','curso') NOT NULL DEFAULT 'cartilla',
	`descripcion` text,
	`portada_url` varchar(500),
	`color` enum('emerald','green','amber','purple','pink') NOT NULL DEFAULT 'emerald',
	`autor` varchar(160),
	`idioma` varchar(60) DEFAULT 'Inga',
	`nivel` varchar(60),
	`frase` varchar(255),
	`traduccion` varchar(255),
	`es_gratis` tinyint(1) NOT NULL DEFAULT 1,
	`precio` decimal(10,2) NOT NULL DEFAULT '0.00',
	`moneda` varchar(8) NOT NULL DEFAULT 'COP',
	`publicado` tinyint(1) NOT NULL DEFAULT 0,
	`destacado` tinyint(1) NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cartillas_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cartilla_tenant_slug` UNIQUE(`tenant_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `cash_movements` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`type` enum('entrada','salida') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`reason` varchar(255) NOT NULL,
	`notes` text,
	`created_by` varchar(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cash_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cash_sessions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`opened_by` varchar(36) NOT NULL,
	`opened_by_name` varchar(255) NOT NULL,
	`opening_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`opened_at` timestamp NOT NULL DEFAULT (now()),
	`closed_by` varchar(36),
	`closed_by_name` varchar(255),
	`closed_at` timestamp,
	`total_cash_sales` decimal(12,2) DEFAULT '0.00',
	`total_card_sales` decimal(12,2) DEFAULT '0.00',
	`total_transfer_sales` decimal(12,2) DEFAULT '0.00',
	`total_fiado_sales` decimal(12,2) DEFAULT '0.00',
	`total_sales_count` int DEFAULT 0,
	`total_change_given` decimal(12,2) DEFAULT '0.00',
	`total_cash_entries` decimal(12,2) DEFAULT '0.00',
	`total_cash_withdrawals` decimal(12,2) DEFAULT '0.00',
	`total_credit_payments_efectivo` decimal(12,2) DEFAULT '0.00',
	`total_credit_payments_tarjeta` decimal(12,2) DEFAULT '0.00',
	`total_credit_payments_transfer` decimal(12,2) DEFAULT '0.00',
	`expected_cash` decimal(12,2),
	`actual_cash` decimal(12,2),
	`difference` decimal(12,2),
	`status` enum('abierta','cerrada') NOT NULL DEFAULT 'abierta',
	`closing_status` enum('cuadrado','sobrante','faltante'),
	`observations` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`shift_type` enum('ma??ana','tarde','unico') NOT NULL DEFAULT 'unico',
	`shift_label` varchar(50),
	CONSTRAINT `cash_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`image_url` varchar(500),
	`hidden_in_store` tinyint(1) NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`color` varchar(7),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `categories_tenant_id_id` PRIMARY KEY(`tenant_id`,`id`),
	CONSTRAINT `idx_category_tenant_name` UNIQUE(`tenant_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `challenge_participants` (
	`id` varchar(36) NOT NULL,
	`challenge_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`joined_at` timestamp DEFAULT (now()),
	CONSTRAINT `challenge_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_cp_unique` UNIQUE(`challenge_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`is_enabled` tinyint(1) NOT NULL DEFAULT 0,
	`bot_name` varchar(100) NOT NULL DEFAULT 'Asistente',
	`bot_avatar_url` varchar(500),
	`system_prompt` text,
	`business_info` text,
	`faqs` text,
	`tone` enum('profesional','amigable','formal','casual') NOT NULL DEFAULT 'amigable',
	`notify_email` tinyint(1) NOT NULL DEFAULT 1,
	`notify_whatsapp` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`whatsapp_enabled` tinyint(1) NOT NULL DEFAULT 0,
	`whatsapp_number` varchar(50),
	`evolution_instance` varchar(100),
	`agent_tools` json,
	`working_hours` json,
	`accent_color` varchar(20) DEFAULT '#f59e0b',
	CONSTRAINT `chatbot_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_id` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `chatbot_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_sessions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`session_token` varchar(100) NOT NULL,
	`customer_name` varchar(255),
	`customer_phone` varchar(50),
	`created_at` timestamp DEFAULT (now()),
	`last_activity` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`human_takeover` tinyint(1) NOT NULL DEFAULT 0,
	`channel` enum('web','whatsapp','voice','api') NOT NULL DEFAULT 'web',
	CONSTRAINT `chatbot_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_session_token` UNIQUE(`session_token`)
);
--> statement-breakpoint
CREATE TABLE `coach_feed_entries` (
	`id` varchar(36) NOT NULL,
	`booking_id` varchar(36) NOT NULL,
	`author` enum('coach','user') NOT NULL,
	`kind` enum('feedback','checkin','adjustment','audio','photo','task','announcement','reply') NOT NULL DEFAULT 'feedback',
	`body` text,
	`media_url` varchar(800),
	`metadata` json,
	`is_read` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `coach_feed_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_comments` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`body` text NOT NULL,
	`parent_id` varchar(36),
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`author_name` varchar(160),
	CONSTRAINT `community_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_post_ads` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	CONSTRAINT `community_post_ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_post_media` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`media_type` enum('image','video','gif') NOT NULL DEFAULT 'image',
	`url` varchar(500) NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	CONSTRAINT `community_post_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_posts` (
	`id` varchar(36) NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`category` enum('noticia','video','tutorial','app','oferta') NOT NULL DEFAULT 'noticia',
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`cover_url` varchar(500),
	`likes_count` int NOT NULL DEFAULT 0,
	`saves_count` int NOT NULL DEFAULT 0,
	`comments_count` int NOT NULL DEFAULT 0,
	`shares_count` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`published_at` timestamp,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_reactions` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`device_id` varchar(64),
	`type` enum('like','save') NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `community_reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_react_device` UNIQUE(`post_id`,`device_id`,`type`),
	CONSTRAINT `uq_reaction` UNIQUE(`post_id`,`user_id`,`type`)
);
--> statement-breakpoint
CREATE TABLE `community_settings` (
	`setting_key` varchar(100) NOT NULL,
	`setting_value` text,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_settings_setting_key` PRIMARY KEY(`setting_key`)
);
--> statement-breakpoint
CREATE TABLE `consumer_access_codes` (
	`id` varchar(36) NOT NULL,
	`code_hash` varchar(255) NOT NULL,
	`code_preview` varchar(30) NOT NULL,
	`tier` varchar(50) NOT NULL DEFAULT 'legend',
	`duration_value` int NOT NULL,
	`duration_unit` enum('day','month') NOT NULL DEFAULT 'day',
	`stack_policy` enum('extend','replace','block') NOT NULL DEFAULT 'extend',
	`max_redemptions` int,
	`redemptions` int NOT NULL DEFAULT 0,
	`valid_from` datetime,
	`valid_until` datetime,
	`scope` enum('global','tenant') NOT NULL DEFAULT 'global',
	`tenant_id` varchar(36),
	`metadata` json,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consumer_access_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_cac_hash` UNIQUE(`code_hash`)
);
--> statement-breakpoint
CREATE TABLE `consumer_access_ledger` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`code_id` varchar(36),
	`grant_id` varchar(36),
	`action` enum('redeem','extend','replace','expire','revoke') NOT NULL,
	`old_expires_at` datetime,
	`new_expires_at` datetime,
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `consumer_access_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consumer_achievements` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`achievement_code` varchar(60) NOT NULL,
	`source` varchar(40),
	`unlocked_at` timestamp DEFAULT (now()),
	CONSTRAINT `consumer_achievements_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_ach_unique` UNIQUE(`user_id`,`achievement_code`)
);
--> statement-breakpoint
CREATE TABLE `consumer_body_logs` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`logged_on` date NOT NULL,
	`weight_kg` decimal(6,2),
	`body_fat` decimal(5,2),
	`measurements` json,
	`photo_url` varchar(800),
	`note` varchar(300),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `consumer_body_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_bl_unique` UNIQUE(`user_id`,`logged_on`)
);
--> statement-breakpoint
CREATE TABLE `consumer_daily_checks` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`day` date NOT NULL,
	`item_key` varchar(30) NOT NULL,
	`done` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `consumer_daily_checks_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_dc_unique` UNIQUE(`user_id`,`day`,`item_key`)
);
--> statement-breakpoint
CREATE TABLE `consumer_discount_rules` (
	`id` varchar(36) NOT NULL,
	`tier` varchar(50) NOT NULL DEFAULT 'legend',
	`kind` enum('percent','free_shipping','preventa') NOT NULL DEFAULT 'percent',
	`percent_off` decimal(5,2),
	`scope` enum('all','category') NOT NULL DEFAULT 'all',
	`category` varchar(120),
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `consumer_discount_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consumer_entitlements` (
	`id` varchar(36) NOT NULL,
	`tier` varchar(50) NOT NULL,
	`entitlement_key` varchar(100) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `consumer_entitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_cent_tier_key` UNIQUE(`tier`,`entitlement_key`)
);
--> statement-breakpoint
CREATE TABLE `consumer_events` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`event` varchar(80) NOT NULL,
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `consumer_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consumer_plan_grants` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`tier` varchar(50) NOT NULL DEFAULT 'legend',
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`started_at` datetime NOT NULL,
	`expires_at` datetime NOT NULL,
	`source_ledger_id` varchar(36),
	`last_checked_at` datetime,
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consumer_plan_grants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consumer_streak_days` (
	`user_id` varchar(36) NOT NULL,
	`day` date NOT NULL,
	CONSTRAINT `consumer_streak_days_user_id_day` PRIMARY KEY(`user_id`,`day`)
);
--> statement-breakpoint
CREATE TABLE `consumer_vault_unlocks` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`unlock_key` varchar(80) NOT NULL,
	`vault_key_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `consumer_vault_unlocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_cvu_unique` UNIQUE(`user_id`,`unlock_key`)
);
--> statement-breakpoint
CREATE TABLE `consumer_xp_log` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`amount` int NOT NULL,
	`reason` varchar(40) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `consumer_xp_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_payments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`sale_id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`payment_method` enum('efectivo','tarjeta','transferencia') NOT NULL,
	`receipt_number` varchar(20),
	`notes` text,
	`received_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `credit_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`cedula` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(50),
	`email` varchar(255),
	`address` varchar(500),
	`credit_limit` decimal(12,2) NOT NULL DEFAULT '0.00',
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_customer_tenant_cedula` UNIQUE(`tenant_id`,`cedula`)
);
--> statement-breakpoint
CREATE TABLE `dev_requests` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`tenant_name` varchar(255),
	`requester_name` varchar(255) NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text NOT NULL,
	`type` enum('objetivo','mejora','actualizacion','bug','otro') NOT NULL DEFAULT 'mejora',
	`priority` enum('baja','media','alta') NOT NULL DEFAULT 'media',
	`status` enum('pendiente','en_revision','cotizado','aprobado','en_progreso','completado','rechazado') NOT NULL DEFAULT 'pendiente',
	`estimated_hours` decimal(6,2),
	`price_per_hour` decimal(10,2),
	`total_price` decimal(12,2),
	`admin_notes` text,
	`rejection_reason` varchar(500),
	`paid_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dev_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discount_coupons` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`description` varchar(255),
	`discount_type` enum('porcentaje','fijo') NOT NULL DEFAULT 'porcentaje',
	`discount_value` decimal(12,2) NOT NULL,
	`min_purchase` decimal(12,2),
	`max_uses` int,
	`times_used` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`expires_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discount_coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_coupon_tenant_code` UNIQUE(`tenant_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `drop_claims` (
	`id` varchar(36) NOT NULL,
	`drop_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`status` enum('reserved','converted') NOT NULL DEFAULT 'reserved',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `drop_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_dc_unique` UNIQUE(`drop_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `drops` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`title` varchar(200) NOT NULL,
	`subtitle` varchar(300),
	`image_url` varchar(800),
	`requires_unlock` varchar(80),
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`total_slots` int NOT NULL,
	`slots_taken` int NOT NULL DEFAULT 0,
	`product_ref` json,
	`status` enum('scheduled','cancelled') NOT NULL DEFAULT 'scheduled',
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `drops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_cargos` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`permissions` json,
	CONSTRAINT `employee_cargos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_novelties` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`user_name` varchar(255) NOT NULL,
	`type` enum('vacaciones','permiso_remunerado','permiso_no_remunerado','incapacidad','calamidad','licencia_maternidad','suspension','otro') NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`days_count` int NOT NULL DEFAULT 1,
	`deducts_salary` tinyint(1) NOT NULL DEFAULT 0,
	`deduct_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`deducts_vacation` tinyint(1) NOT NULL DEFAULT 0,
	`description` text,
	`attachment_url` varchar(500),
	`status` enum('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
	`rejection_reason` varchar(500),
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employee_novelties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_vacation_balances` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`year` int NOT NULL,
	`days_granted` int NOT NULL DEFAULT 15,
	`days_used` int NOT NULL DEFAULT 0,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employee_vacation_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_vacation_user_year` UNIQUE(`tenant_id`,`user_id`,`year`)
);
--> statement-breakpoint
CREATE TABLE `exercise_progressions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`exercise_id` varchar(80) NOT NULL,
	`current_weight` decimal(8,2) NOT NULL DEFAULT '0.00',
	`next_weight` decimal(8,2) NOT NULL DEFAULT '0.00',
	`best_weight` decimal(8,2) NOT NULL DEFAULT '0.00',
	`last_action` varchar(12),
	`completion_rate` decimal(5,3),
	`estimated_1rm` decimal(8,2),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exercise_progressions_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_ep_user_ex` UNIQUE(`user_id`,`exercise_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_budgets` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`category_id` varchar(36) NOT NULL,
	`year` smallint NOT NULL,
	`month` tinyint NOT NULL,
	`budgeted_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_budgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_budget_unique` UNIQUE(`tenant_id`,`category_id`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `finance_categories` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`type` enum('ingreso','egreso') NOT NULL,
	`name` varchar(100) NOT NULL,
	`icon` varchar(50),
	`color` varchar(7),
	`is_system` tinyint(1) NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `finance_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_fin_cat_name` UNIQUE(`tenant_id`,`type`,`name`)
);
--> statement-breakpoint
CREATE TABLE `finance_transactions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`type` enum('ingreso','egreso') NOT NULL,
	`category_id` varchar(36) NOT NULL,
	`category_name` varchar(100) NOT NULL,
	`description` varchar(500) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`transaction_date` date NOT NULL,
	`payment_method` enum('efectivo','tarjeta','transferencia','nequi','daviplata','cheque','otro') NOT NULL DEFAULT 'efectivo',
	`receipt_url` varchar(500),
	`receipt_number` varchar(100),
	`is_recurring` tinyint(1) NOT NULL DEFAULT 0,
	`recurrence_type` enum('diario','semanal','quincenal','mensual','bimestral','anual'),
	`recurrence_day` tinyint,
	`source_type` enum('manual','sale','purchase_invoice','payroll','cash_movement') NOT NULL DEFAULT 'manual',
	`source_id` varchar(36),
	`notes` text,
	`tags` json,
	`created_by` varchar(36),
	`created_by_name` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleet_maintenance` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`vehicle_id` varchar(36) NOT NULL,
	`type` enum('preventivo','correctivo','revision') NOT NULL DEFAULT 'preventivo',
	`description` text NOT NULL,
	`scheduled_date` date,
	`completed_date` date,
	`cost` decimal(12,2) NOT NULL DEFAULT '0.00',
	`status` enum('pendiente','en_proceso','completado','cancelado') NOT NULL DEFAULT 'pendiente',
	`notes` text,
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fleet_maintenance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleet_vehicles` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`plate` varchar(20),
	`type` enum('planta','ligera','moto') NOT NULL DEFAULT 'ligera',
	`max_weight_kg` decimal(10,2) NOT NULL DEFAULT '500.00',
	`status` enum('disponible','en_ruta','mantenimiento','inactivo') NOT NULL DEFAULT 'disponible',
	`year` int,
	`brand` varchar(50),
	`model` varchar(50),
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fleet_vehicles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guild_members` (
	`id` varchar(36) NOT NULL,
	`guild_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`joined_at` timestamp DEFAULT (now()),
	CONSTRAINT `guild_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_gm_user` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `guilds` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`tagline` varchar(200),
	`emoji` varchar(12),
	`owner_user_id` varchar(36),
	`members_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `guilds_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_guild_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `horma_colors` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`horma_id` varchar(36) NOT NULL,
	`color` varchar(100) NOT NULL,
	`hex` varchar(9),
	`shelf` json,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` timestamp DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `horma_colors_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_horma_color` UNIQUE(`horma_id`,`color`)
);
--> statement-breakpoint
CREATE TABLE `hormas` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`slug` varchar(150) NOT NULL,
	`base_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
	`base_price` decimal(12,2) NOT NULL DEFAULT '0.00',
	`size_chart` json,
	`has_sleeves` tinyint(1) NOT NULL DEFAULT 1,
	`sexo` enum('unisex','hombre','mujer') NOT NULL DEFAULT 'unisex',
	`composition` varchar(150),
	`weight_grams` int,
	`shelf` json,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` timestamp DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hormas_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_horma_slug_tenant` UNIQUE(`tenant_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `inventory_holds` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_holds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`variant_id` varchar(36),
	`product_id` varchar(36) NOT NULL,
	`type` enum('entrada','salida','ajuste','merma','transferencia','reserva','liberacion') NOT NULL,
	`quantity` int NOT NULL,
	`reason` text NOT NULL,
	`reference_type` varchar(50),
	`reference_id` varchar(36),
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_sequence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`prefix` varchar(10) NOT NULL DEFAULT 'FAC',
	`current_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `invoice_sequence_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_invoice_seq_tenant` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `legend_purchases` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`plan_key` varchar(20) NOT NULL,
	`months` int NOT NULL,
	`amount_cop` decimal(14,2) NOT NULL,
	`status` enum('pending','paid','cancelled') NOT NULL DEFAULT 'pending',
	`gateway_payment_id` varchar(120),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `legend_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`ip_address` varchar(45) NOT NULL,
	`success` tinyint(1) NOT NULL DEFAULT 0,
	`failure_reason` varchar(100),
	`attempted_at` timestamp DEFAULT (now()),
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lopbuk_landing` (
	`id` int NOT NULL DEFAULT 1,
	`config` json,
	`updated_by` varchar(120),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lopbuk_landing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_accounts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`customer_name` varchar(120),
	`customer_phone` varchar(40) NOT NULL,
	`points_balance` int NOT NULL DEFAULT 0,
	`total_earned` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyalty_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_loyalty_acct` UNIQUE(`tenant_id`,`customer_phone`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_config` (
	`tenant_id` varchar(36) NOT NULL,
	`enabled` tinyint NOT NULL DEFAULT 1,
	`points_per_thousand` decimal(8,2) NOT NULL DEFAULT '1.00',
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyalty_config_tenant_id` PRIMARY KEY(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_rewards` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300),
	`points_cost` int NOT NULL,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `loyalty_rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_transactions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`account_id` varchar(36) NOT NULL,
	`type` enum('earn','redeem','adjust') NOT NULL,
	`points` int NOT NULL,
	`reason` varchar(200),
	`order_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `loyalty_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_external_cards` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255),
	`logo_url` varchar(800),
	`cover_url` varchar(800),
	`description` varchar(500),
	`external_url` varchar(1000) NOT NULL,
	`city` varchar(255),
	`is_verified` tinyint(1) NOT NULL DEFAULT 0,
	`is_visible` tinyint(1) NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_external_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menu_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`device_id` varchar(64) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `menu_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_device_product` UNIQUE(`device_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `merchant_events` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`event_date` datetime NOT NULL,
	`location` varchar(255),
	`cover_image` varchar(800),
	`ticket_price` decimal(14,2),
	`capacity` int,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchant_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merchant_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`type` enum('new_order','new_booking','chatbot_lead','new_service_booking') NOT NULL DEFAULT 'new_order',
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`data` json,
	`is_read` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `merchant_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`type` varchar(40) NOT NULL DEFAULT 'general',
	`title` varchar(200) NOT NULL,
	`body` varchar(500),
	`link` varchar(500),
	`is_read` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`from_status` varchar(30),
	`to_status` varchar(30) NOT NULL,
	`changed_by` varchar(36) NOT NULL,
	`note` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `order_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `par_levels` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`daily_usage` decimal(10,3) NOT NULL DEFAULT '0.000',
	`days_between_orders` int NOT NULL DEFAULT 1,
	`safety_stock` decimal(10,3) NOT NULL DEFAULT '0.000',
	`area` enum('cocina','bar','general') NOT NULL DEFAULT 'cocina',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `par_levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_pl_tenant_product` UNIQUE(`tenant_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `payment_receipt_sequence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`prefix` varchar(10) NOT NULL DEFAULT 'REC',
	`current_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `payment_receipt_sequence_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_receipt_seq_tenant` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_adjustments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`seller_id` varchar(36) NOT NULL,
	`seller_name` varchar(255) NOT NULL,
	`period_from` date NOT NULL,
	`period_to` date NOT NULL,
	`type` enum('bono','descuento') NOT NULL,
	`concept` varchar(255) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `payroll_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_records` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`period_from` date NOT NULL,
	`period_to` date NOT NULL,
	`period_label` varchar(100) NOT NULL,
	`seller_id` varchar(36) NOT NULL,
	`seller_name` varchar(255) NOT NULL,
	`total_ventas` int NOT NULL DEFAULT 0,
	`total_monto` decimal(12,2) NOT NULL DEFAULT '0.00',
	`salary_base` decimal(12,2) NOT NULL DEFAULT '0.00',
	`commission_type` varchar(50) NOT NULL DEFAULT 'sin_comision',
	`commission_value` decimal(10,2) NOT NULL DEFAULT '0.00',
	`commission_earned` decimal(12,2) NOT NULL DEFAULT '0.00',
	`monthly_goal` decimal(12,2) NOT NULL DEFAULT '0.00',
	`goal_bonus_earned` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_bonos` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_descuentos` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_pagar` decimal(12,2) NOT NULL DEFAULT '0.00',
	`status` enum('borrador','pagado') NOT NULL DEFAULT 'borrador',
	`notes` text,
	`generated_by` varchar(36),
	`generated_at` timestamp DEFAULT (now()),
	`paid_at` timestamp,
	CONSTRAINT `payroll_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_payment_gateways` (
	`provider` varchar(20) NOT NULL,
	`environment` varchar(20) NOT NULL DEFAULT 'sandbox',
	`public_key` text,
	`private_key` text,
	`integrity_secret` text,
	`events_secret` text,
	`is_active` tinyint(1) NOT NULL DEFAULT 0,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_payment_gateways_provider` PRIMARY KEY(`provider`)
);
--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`setting_key` varchar(100) NOT NULL,
	`setting_value` text,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_settings_setting_key` PRIMARY KEY(`setting_key`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_config` (
	`id` int NOT NULL DEFAULT 1,
	`hero_title` varchar(255) NOT NULL DEFAULT 'DAIMUZ',
	`hero_subtitle` text,
	`hero_image_url` text,
	`brand_description` text,
	`show_pricing` tinyint(1) NOT NULL DEFAULT 1,
	`show_featured_stores` tinyint(1) NOT NULL DEFAULT 1,
	`featured_tenant_ids` json,
	`contact_email` varchar(255),
	`contact_whatsapp` varchar(50),
	`contact_instagram` varchar(255),
	`accent_color` varchar(30) NOT NULL DEFAULT '#6366f1',
	`is_published` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`robot_spline_url` text,
	`lanyard_offset_x` int NOT NULL DEFAULT 0,
	`lanyard_offset_y` int NOT NULL DEFAULT 0,
	`lanyard_scale` int NOT NULL DEFAULT 100,
	CONSTRAINT `portfolio_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_feature_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`icon` varchar(10) NOT NULL DEFAULT '???',
	`title` varchar(120) NOT NULL,
	`description` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_feature_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_service_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`icon` varchar(10) NOT NULL DEFAULT '????',
	`label` varchar(120) NOT NULL,
	`type` enum('package','subscription','addon') NOT NULL DEFAULT 'package',
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_service_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_service_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category_id` int NOT NULL,
	`title` varchar(120) NOT NULL,
	`description` text,
	`savings` varchar(50),
	`price` decimal(12,0) NOT NULL DEFAULT '0',
	`is_popular` tinyint(1) NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_service_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_team_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`role` varchar(120) NOT NULL DEFAULT '',
	`bio` text,
	`photo_url` text,
	`accent_color` varchar(30) NOT NULL DEFAULT '#06b6d4',
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`github_url` varchar(255),
	`linkedin_url` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`band_image_url` text,
	CONSTRAINT `portfolio_team_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(50) NOT NULL,
	`old_cost_price` decimal(10,2),
	`new_cost_price` decimal(10,2),
	`old_sale_price` decimal(10,2),
	`new_sale_price` decimal(10,2),
	`reason` varchar(200),
	`changed_by` varchar(50),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `printers` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`connection_type` enum('lan','usb','bluetooth') NOT NULL DEFAULT 'usb',
	`ip` varchar(45),
	`port` int NOT NULL DEFAULT 9100,
	`paper_width` tinyint NOT NULL DEFAULT 80,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`assigned_module` enum('caja','cocina','bar','factura'),
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `printers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_alerts` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(50) NOT NULL,
	`alert_type` enum('vencimiento','stock_bajo','garantia_proxima','reorden','otro') NOT NULL,
	`alert_date` date NOT NULL,
	`priority` enum('baja','media','alta','critica') DEFAULT 'media',
	`message` text,
	`is_resolved` tinyint(1) DEFAULT 0,
	`resolved_at` timestamp,
	`resolved_by` varchar(50),
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `product_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_modifier_groups` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`selection_type` enum('single','multiple') NOT NULL DEFAULT 'multiple',
	`is_required` tinyint(1) NOT NULL DEFAULT 0,
	`min_select` int NOT NULL DEFAULT 0,
	`max_select` int,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `product_modifier_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_modifier_options` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`image_url` varchar(500),
	`price_delta` decimal(12,2) NOT NULL DEFAULT '0.00',
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_modifier_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_recipes` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`ingredient_id` varchar(36) NOT NULL,
	`quantity` decimal(10,3) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`include_in_cost` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `product_recipes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_reviews` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`reviewer_name` varchar(200) NOT NULL,
	`reviewer_email` varchar(200),
	`rating` tinyint NOT NULL DEFAULT 5,
	`title` varchar(200),
	`body` text,
	`image_url_1` varchar(500),
	`image_url_2` varchar(500),
	`status` enum('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
	`reply` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_rating` CHECK(((`rating` >= 1) and (`rating` <= 5)))
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`sku` varchar(100) NOT NULL,
	`barcode` varchar(100),
	`color` varchar(100),
	`size` varchar(50),
	`material` varchar(100),
	`stock` int DEFAULT 0,
	`reserved_stock` int DEFAULT 0,
	`min_stock` int DEFAULT 0,
	`cost_price` decimal(12,2) DEFAULT '0.00',
	`price_override` decimal(12,2),
	`supplier_id` varchar(36),
	`images` json,
	`sort_order` int DEFAULT 0,
	`is_active` tinyint(1) DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`preorder_limit` int,
	`preorder_count` int NOT NULL DEFAULT 0,
	`color_hex` varchar(9),
	`horma_id` varchar(36),
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_pv_sku_tenant` UNIQUE(`sku`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`articulo` varchar(255),
	`category` varchar(50) NOT NULL,
	`product_type` enum('general','alimentos','bebidas','ropa','electronica','farmacia','ferreteria','libreria','juguetes','cosmetica','perfumes','deportes','hogar','mascotas','otros') NOT NULL DEFAULT 'general',
	`brand` varchar(100),
	`model` varchar(100),
	`description` text,
	`purchase_price` decimal(12,2) NOT NULL DEFAULT '0.00',
	`sale_price` decimal(12,2) NOT NULL,
	`sku` varchar(50) NOT NULL,
	`barcode` varchar(100),
	`stock` int NOT NULL DEFAULT 0,
	`reorder_point` int NOT NULL DEFAULT 5,
	`supplier` varchar(255),
	`supplier_id` varchar(50),
	`entry_date` date NOT NULL,
	`image_url` varchar(500),
	`image_urls` json,
	`location_in_store` varchar(100),
	`notes` text,
	`tags` json,
	`expiry_date` date,
	`batch_number` varchar(50),
	`net_weight` decimal(10,3),
	`weight_unit` enum('g','kg','ml','l','oz','lb','unidad'),
	`sanitary_registration` varchar(100),
	`storage_temperature` varchar(50),
	`ingredients` text,
	`nutritional_info` text,
	`alcohol_content` decimal(5,2),
	`allergens` text,
	`size` varchar(20),
	`color` varchar(50),
	`material` varchar(100),
	`gender` enum('hombre','mujer','unisex','ni??o','ni??a'),
	`season` enum('verano','invierno','primavera','oto??o','todo_a??o'),
	`garment_type` varchar(50),
	`washing_instructions` text,
	`country_of_origin` varchar(50),
	`serial_number` varchar(100),
	`warranty_months` int,
	`technical_specs` text,
	`voltage` varchar(20),
	`power_watts` int,
	`compatibility` text,
	`includes_accessories` text,
	`product_condition` enum('nuevo','reacondicionado','usado','exhibici??n') DEFAULT 'nuevo',
	`active_ingredient` varchar(200),
	`concentration` varchar(50),
	`requires_prescription` tinyint(1) DEFAULT 0,
	`administration_route` varchar(50),
	`presentation` varchar(50),
	`units_per_package` int,
	`laboratory` varchar(100),
	`contraindications` text,
	`dimensions` varchar(50),
	`weight` decimal(10,3),
	`hardware_weight_unit` enum('kg','ton','lb','g') DEFAULT 'kg',
	`caliber` varchar(20),
	`resistance` varchar(50),
	`finish` varchar(50),
	`recommended_use` text,
	`author` varchar(200),
	`publisher` varchar(100),
	`isbn` varchar(20),
	`pages` int,
	`language` varchar(50),
	`publication_year` int,
	`edition` varchar(50),
	`book_format` enum('pasta_dura','pasta_blanda','digital','audio'),
	`recommended_age` varchar(50),
	`number_of_players` varchar(20),
	`game_type` varchar(50),
	`requires_batteries` tinyint(1),
	`package_dimensions` varchar(50),
	`package_contents` text,
	`safety_warnings` text,
	`published_in_store` tinyint(1) NOT NULL DEFAULT 0,
	`available_for_delivery` tinyint(1) NOT NULL DEFAULT 0,
	`delivery_type` enum('domicilio','envio','ambos'),
	`is_new_launch` tinyint(1) NOT NULL DEFAULT 0,
	`launch_date` date,
	`is_preorder` tinyint(1) NOT NULL DEFAULT 0,
	`preorder_window_end` datetime,
	`preorder_ship_start` date,
	`preorder_ship_end` date,
	`preorder_badge_text` varchar(60) NOT NULL DEFAULT 'Pre-orden',
	`preorder_policy_text` text,
	`is_on_offer` tinyint(1) NOT NULL DEFAULT 0,
	`offer_price` decimal(12,2),
	`offer_label` varchar(100),
	`offer_start` datetime,
	`offer_end` datetime,
	`sede_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_by` varchar(50),
	`updated_by` varchar(50),
	`is_menu_item` tinyint(1) NOT NULL DEFAULT 0,
	`is_ingredient` tinyint(1) NOT NULL DEFAULT 0,
	`preparation_area` enum('bar','cocina','ambos'),
	`prep_time_minutes` int,
	`available_in_menu` tinyint(1) NOT NULL DEFAULT 1,
	`qty_promo` text,
	`images` text,
	`horma_id` varchar(36),
	`base_price` decimal(12,2),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_product_tenant_barcode` UNIQUE(`tenant_id`,`barcode`),
	CONSTRAINT `idx_product_tenant_sku` UNIQUE(`tenant_id`,`sku`)
);
--> statement-breakpoint
CREATE TABLE `profile_sections` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`section_type` enum('image_text','video','gif','description','gallery') NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	`content` json,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profile_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_invoice_items` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`invoice_id` varchar(50) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`product_name` varchar(200) NOT NULL,
	`product_sku` varchar(100) NOT NULL,
	`quantity` decimal(10,3) NOT NULL,
	`unit_cost` decimal(12,2) NOT NULL,
	`sale_price` decimal(12,2),
	`subtotal` decimal(12,2) NOT NULL,
	CONSTRAINT `purchase_invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_invoices` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`invoice_number` varchar(100) NOT NULL,
	`supplier_id` varchar(50),
	`supplier_name` varchar(200) NOT NULL,
	`purchase_date` date NOT NULL,
	`document_type` enum('factura','remision','orden_compra','nota_credito') NOT NULL DEFAULT 'factura',
	`subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
	`discount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total` decimal(12,2) NOT NULL DEFAULT '0.00',
	`payment_method` enum('efectivo','tarjeta','transferencia','credito','nequi','daviplata','credito_proveedor','mixto') NOT NULL DEFAULT 'efectivo',
	`payment_status` enum('pagado','pendiente','parcial') NOT NULL DEFAULT 'pagado',
	`due_date` date,
	`file_url` varchar(500),
	`notes` text,
	`mixed_efectivo_amount` decimal(12,2),
	`mixed_transferencia_amount` decimal(12,2),
	`created_by` varchar(50),
	`synced` tinyint(1) NOT NULL DEFAULT 1,
	`synced_at` timestamp,
	`origin` enum('local','cloud') NOT NULL DEFAULT 'cloud',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`p256dh` varchar(200) NOT NULL,
	`auth` varchar(100) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_push_endpoint` UNIQUE(`endpoint`)
);
--> statement-breakpoint
CREATE TABLE `rb_gastos` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`concepto` varchar(255) NOT NULL,
	`categoria` varchar(50) NOT NULL DEFAULT 'egreso',
	`cantidad` decimal(10,2) NOT NULL DEFAULT '1.00',
	`valor_unitario` decimal(12,2) NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`notas` text,
	`registered_at` timestamp NOT NULL DEFAULT (now()),
	`created_by` varchar(36),
	CONSTRAINT `rb_gastos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rb_gastos_fijos` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`valor` decimal(12,2) NOT NULL,
	`periodo` enum('quincenal','semanal','mensual') NOT NULL DEFAULT 'quincenal',
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rb_gastos_fijos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rb_ingresos_diarios` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`fecha` date NOT NULL,
	`num_pedidos` int NOT NULL DEFAULT 0,
	`valor_ventas` decimal(12,2) NOT NULL DEFAULT '0.00',
	`ganancia` decimal(12,2) NOT NULL DEFAULT '0.00',
	`notas` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rb_ingresos_diarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_rb_ing_tenant_fecha` UNIQUE(`tenant_id`,`fecha`)
);
--> statement-breakpoint
CREATE TABLE `rb_jukebox_config` (
	`tenant_id` varchar(36) NOT NULL,
	`enabled` tinyint NOT NULL DEFAULT 1,
	`threshold` decimal(12,2) NOT NULL DEFAULT '50000.00',
	CONSTRAINT `rb_jukebox_config_tenant_id` PRIMARY KEY(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `rb_jukebox_queue` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`table_session_id` varchar(36),
	`title` varchar(200) NOT NULL,
	`url` varchar(500),
	`requested_by` varchar(120),
	`status` enum('queued','playing','played','skipped') NOT NULL DEFAULT 'queued',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `rb_jukebox_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rb_order_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`menu_item_id` varchar(36) NOT NULL,
	`menu_item_name` varchar(255) NOT NULL,
	`preparation_area` enum('bar','cocina','ambos') NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unit_price` decimal(12,2) NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	`discount` decimal(5,2) NOT NULL DEFAULT '0.00',
	`status` enum('pendiente','en_preparacion','listo','entregado','cancelado') NOT NULL DEFAULT 'pendiente',
	`guest_number` tinyint,
	`item_notes` text,
	`sent_to_kitchen_at` timestamp,
	`ready_at` timestamp,
	`delivered_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rb_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rb_order_sequence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`prefix` varchar(10) NOT NULL DEFAULT 'C',
	`current_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `rb_order_sequence_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_rb_order_seq` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `rb_orders` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`table_id` varchar(36) NOT NULL,
	`order_number` varchar(20) NOT NULL,
	`waiter_id` varchar(36) NOT NULL,
	`waiter_name` varchar(255) NOT NULL,
	`guests_count` int NOT NULL DEFAULT 1,
	`status` enum('abierta','en_proceso','lista','entregada','cerrada','cancelada') NOT NULL DEFAULT 'abierta',
	`notes` text,
	`subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(12,2) NOT NULL DEFAULT '0.00',
	`discount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total` decimal(12,2) NOT NULL DEFAULT '0.00',
	`sale_id` varchar(36),
	`opened_at` timestamp NOT NULL DEFAULT (now()),
	`closed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`priority` enum('normal','urgente') NOT NULL DEFAULT 'normal',
	CONSTRAINT `rb_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_rb_order_number` UNIQUE(`tenant_id`,`order_number`)
);
--> statement-breakpoint
CREATE TABLE `rb_payments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`guest_number` tinyint,
	`payment_method` enum('efectivo','tarjeta','nequi','bancolombia','bbva','transferencia','mixto') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`amount_paid` decimal(12,2) NOT NULL,
	`change_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`cashier_id` varchar(36) NOT NULL,
	`cashier_name` varchar(255) NOT NULL,
	`cash_session_id` varchar(36),
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `rb_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rb_reservation_sequence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`prefix` varchar(10) NOT NULL DEFAULT 'R',
	`current_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `rb_reservation_sequence_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_rb_res_seq` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `rb_reservations` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`table_id` varchar(36),
	`reservation_number` varchar(20) NOT NULL,
	`customer_name` varchar(255) NOT NULL,
	`customer_phone` varchar(50) NOT NULL,
	`customer_email` varchar(255),
	`reservation_date` date NOT NULL,
	`reservation_time` time NOT NULL,
	`guests_count` int NOT NULL DEFAULT 2,
	`occasion` varchar(100),
	`notes` text,
	`pre_order_items` json,
	`pre_order_notes` text,
	`status` enum('pendiente','confirmada','cancelada','completada','no_show') NOT NULL DEFAULT 'pendiente',
	`rejection_reason` text,
	`notified_whatsapp` tinyint(1) NOT NULL DEFAULT 0,
	`confirmed_at` timestamp,
	`cancelled_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rb_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rb_table_guests` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `rb_table_guests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rb_table_sessions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`table_id` varchar(36) NOT NULL,
	`token` varchar(48) NOT NULL,
	`waiter_id` varchar(36) NOT NULL,
	`waiter_name` varchar(255) NOT NULL,
	`order_id` varchar(36),
	`status` enum('active','closed') NOT NULL DEFAULT 'active',
	`expires_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `rb_table_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_rbts_token` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `rb_tables` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`number` varchar(20) NOT NULL,
	`capacity` int NOT NULL DEFAULT 4,
	`area` varchar(100),
	`status` enum('libre','ocupada','reservada','inactiva') NOT NULL DEFAULT 'libre',
	`qr_code` varchar(500),
	`notes` text,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`merge_group` varchar(36),
	CONSTRAINT `rb_tables_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_rb_table_number` UNIQUE(`tenant_id`,`number`)
);
--> statement-breakpoint
CREATE TABLE `re_clients` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`document_type` enum('cedula','nit','pasaporte','otro') DEFAULT 'cedula',
	`document` varchar(30),
	`phone` varchar(50),
	`email` varchar(255),
	`client_type` enum('comprador','arrendatario','inversionista','propietario','prospecto') NOT NULL DEFAULT 'prospecto',
	`source` varchar(100),
	`assigned_agent_id` varchar(36),
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `re_clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `re_contracts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`contract_number` varchar(30) NOT NULL,
	`contract_type` enum('compraventa','arrendamiento','administracion','reserva','exclusividad') NOT NULL,
	`property_id` varchar(36) NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`owner_id` varchar(36),
	`start_date` date NOT NULL,
	`end_date` date,
	`canon` decimal(15,2),
	`sale_price` decimal(15,2),
	`commission_pct` decimal(5,2),
	`commission_amount` decimal(15,2),
	`deposit_amount` decimal(15,2),
	`status` enum('borrador','activo','vencido','renovado','terminado','cancelado') NOT NULL DEFAULT 'borrador',
	`notes` text,
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `re_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_re_contract_num` UNIQUE(`tenant_id`,`contract_number`)
);
--> statement-breakpoint
CREATE TABLE `re_lead_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`lead_id` varchar(36) NOT NULL,
	`activity_type` enum('llamada','whatsapp','email','visita','nota','cambio_etapa','tarea') NOT NULL DEFAULT 'nota',
	`description` text NOT NULL,
	`created_by` varchar(36),
	`scheduled_at` datetime,
	`completed` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `re_lead_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `re_leads` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`client_id` varchar(36),
	`full_name` varchar(255) NOT NULL,
	`phone` varchar(50),
	`email` varchar(255),
	`source` varchar(100),
	`interested_in` enum('venta','arriendo','ambos') NOT NULL DEFAULT 'venta',
	`budget_min` decimal(15,2),
	`budget_max` decimal(15,2),
	`property_type_pref` varchar(100),
	`city_pref` varchar(100),
	`stage` enum('nuevo','contactado','interesado','visita','negociacion','cierre','posventa','perdido') NOT NULL DEFAULT 'nuevo',
	`assigned_agent_id` varchar(36),
	`property_id` varchar(36),
	`notes` text,
	`last_contact_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `re_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `re_maintenances` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`property_id` varchar(36) NOT NULL,
	`contract_id` varchar(36),
	`reported_by` varchar(36),
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`priority` enum('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
	`status` enum('solicitado','en_revision','aprobado','en_proceso','completado','cancelado') NOT NULL DEFAULT 'solicitado',
	`estimated_cost` decimal(12,2),
	`actual_cost` decimal(12,2),
	`assigned_to` varchar(255),
	`scheduled_at` datetime,
	`completed_at` datetime,
	`evidence_urls` json,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `re_maintenances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `re_owners` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`document_type` enum('cedula','nit','pasaporte','otro') NOT NULL DEFAULT 'cedula',
	`document` varchar(30),
	`phone` varchar(50),
	`email` varchar(255),
	`address` text,
	`city` varchar(100),
	`bank_name` varchar(100),
	`bank_account` varchar(50),
	`bank_account_type` enum('ahorros','corriente'),
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `re_owners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `re_properties` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`property_type` enum('casa','apartamento','local','oficina','bodega','lote','finca','consultorio','hotel','proyecto') NOT NULL DEFAULT 'apartamento',
	`operation_type` enum('venta','arriendo','venta_arriendo') NOT NULL DEFAULT 'venta',
	`status` enum('disponible','vendido','arrendado','reservado','en_negociacion','en_mantenimiento','inactivo') NOT NULL DEFAULT 'disponible',
	`price` decimal(15,2) NOT NULL DEFAULT '0.00',
	`admin_fee` decimal(12,2),
	`address` varchar(500),
	`city` varchar(100),
	`neighborhood` varchar(100),
	`state_province` varchar(100),
	`country` varchar(100) NOT NULL DEFAULT 'Colombia',
	`lat` decimal(10,8),
	`lng` decimal(11,8),
	`stratum` tinyint,
	`area_m2` decimal(10,2),
	`built_area_m2` decimal(10,2),
	`bedrooms` tinyint DEFAULT 0,
	`bathrooms` tinyint DEFAULT 0,
	`garages` tinyint DEFAULT 0,
	`floors` tinyint DEFAULT 1,
	`age_years` smallint,
	`owner_id` varchar(36),
	`assigned_agent_id` varchar(36),
	`is_featured` tinyint(1) NOT NULL DEFAULT 0,
	`is_published` tinyint(1) NOT NULL DEFAULT 0,
	`published_at` timestamp,
	`cover_image_url` text,
	`tags` json,
	`seo_slug` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `re_properties_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_re_code` UNIQUE(`tenant_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `re_property_features` (
	`id` int AUTO_INCREMENT NOT NULL,
	`property_id` varchar(36) NOT NULL,
	`feature` varchar(100) NOT NULL,
	CONSTRAINT `re_property_features_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_prop_feat` UNIQUE(`property_id`,`feature`)
);
--> statement-breakpoint
CREATE TABLE `re_property_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`property_id` varchar(36) NOT NULL,
	`media_type` enum('foto','video','plano','documento','tour_360') NOT NULL DEFAULT 'foto',
	`url` text NOT NULL,
	`caption` varchar(255),
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_cover` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `re_property_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `re_rent_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`contract_id` varchar(36) NOT NULL,
	`period_month` tinyint NOT NULL,
	`period_year` smallint NOT NULL,
	`due_date` date NOT NULL,
	`canon` decimal(15,2) NOT NULL,
	`late_fee` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_amount` decimal(15,2) NOT NULL,
	`paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
	`paid_at` timestamp,
	`payment_method` varchar(30),
	`status` enum('pendiente','pagado','parcial','vencido') NOT NULL DEFAULT 'pendiente',
	`receipt_url` text,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `re_rent_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `re_visits` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`property_id` varchar(36) NOT NULL,
	`client_id` varchar(36),
	`lead_id` varchar(36),
	`assigned_agent_id` varchar(36),
	`scheduled_at` datetime NOT NULL,
	`duration_minutes` smallint NOT NULL DEFAULT 30,
	`visit_type` enum('presencial','virtual') NOT NULL DEFAULT 'presencial',
	`status` enum('programada','confirmada','realizada','cancelada','no_show') NOT NULL DEFAULT 'programada',
	`feedback` text,
	`rating` tinyint,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `re_visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`revoke_reason` enum('logout','password_change','admin_revoke','rotation','suspicious'),
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_rt_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`sale_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`variant_id` varchar(36),
	`product_name` varchar(255) NOT NULL,
	`product_sku` varchar(50) NOT NULL,
	`quantity` int NOT NULL,
	`unit_price` decimal(12,2) NOT NULL,
	`discount` decimal(5,2) NOT NULL DEFAULT '0.00',
	`subtotal` decimal(12,2) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`cost_price` decimal(12,2),
	`margin_pct` decimal(5,2),
	`margin_amount` decimal(12,2),
	CONSTRAINT `sale_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`invoice_number` varchar(20) NOT NULL,
	`customer_id` varchar(36),
	`customer_name` varchar(255),
	`customer_phone` varchar(50),
	`customer_email` varchar(255),
	`subtotal` decimal(12,2) NOT NULL,
	`tax` decimal(12,2) NOT NULL DEFAULT '0.00',
	`discount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total` decimal(12,2) NOT NULL,
	`payment_method` enum('efectivo','tarjeta','transferencia','fiado','addi','sistecredito','mixto') NOT NULL,
	`amount_paid` decimal(12,2) NOT NULL,
	`change_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`seller_id` varchar(36),
	`seller_name` varchar(255) NOT NULL,
	`cash_session_id` varchar(36),
	`status` enum('completada','anulada') NOT NULL DEFAULT 'completada',
	`credit_status` enum('pendiente','parcial','pagado'),
	`due_date` date,
	`notes` text,
	`mixed_efectivo_amount` decimal(12,2),
	`mixed_second_method` varchar(30),
	`mixed_second_amount` decimal(12,2),
	`sede_id` varchar(36),
	`vehicle_id` varchar(36),
	`dispatch_status` enum('pendiente','en_pista','cargado','despachado','entregado') NOT NULL DEFAULT 'pendiente',
	`total_weight_kg` decimal(10,3),
	`synced` tinyint(1) NOT NULL DEFAULT 1,
	`synced_at` timestamp,
	`origin` enum('local','cloud') NOT NULL DEFAULT 'cloud',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`dispatch_notes` text,
	`dispatched_at` timestamp,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_sale_tenant_invoice` UNIQUE(`tenant_id`,`invoice_number`)
);
--> statement-breakpoint
CREATE TABLE `seasonal_challenges` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` varchar(500),
	`metric` enum('streak','drops','achievements') NOT NULL DEFAULT 'streak',
	`goal_value` int NOT NULL DEFAULT 7,
	`reward` varchar(200),
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`status` enum('active','cancelled') NOT NULL DEFAULT 'active',
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`reward_unlock` varchar(80),
	`settled_at` datetime,
	`scope` varchar(12) NOT NULL DEFAULT 'individual',
	CONSTRAINT `seasonal_challenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sedes` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`address` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sedes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_availability` (
	`id` varchar(50) NOT NULL,
	`service_id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`day_of_week` tinyint NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`slot_duration_minutes` int NOT NULL DEFAULT 30,
	`max_simultaneous` int NOT NULL DEFAULT 1,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `service_availability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_blocked_periods` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`service_id` varchar(50),
	`blocked_date` date NOT NULL,
	`start_time` time,
	`end_time` time,
	`reason` varchar(200),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `service_blocked_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_bookings` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`service_id` varchar(50) NOT NULL,
	`service_name` varchar(200) NOT NULL,
	`booking_type` enum('cita','asesoria','contacto') NOT NULL,
	`client_name` varchar(200) NOT NULL,
	`client_phone` varchar(50) NOT NULL,
	`client_email` varchar(100),
	`client_notes` text,
	`booking_date` date,
	`start_time` time,
	`end_time` time,
	`preferred_date_range` varchar(200),
	`project_description` text,
	`budget_range` varchar(100),
	`status` enum('pendiente','confirmada','cancelada','completada','no_asistio') NOT NULL DEFAULT 'pendiente',
	`payment_status` enum('sin_pago','pendiente','pagado') NOT NULL DEFAULT 'sin_pago',
	`amount_paid` decimal(12,2) NOT NULL DEFAULT '0.00',
	`merchant_notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`category` varchar(100),
	`service_type` enum('cita','asesoria','contacto') NOT NULL DEFAULT 'cita',
	`price` decimal(12,2) NOT NULL DEFAULT '0.00',
	`price_type` enum('fijo','desde','gratis','cotizacion') NOT NULL DEFAULT 'fijo',
	`duration_minutes` int,
	`image_url` varchar(500),
	`requires_payment` tinyint(1) NOT NULL DEFAULT 0,
	`max_advance_days` int NOT NULL DEFAULT 30,
	`cancellation_hours` int NOT NULL DEFAULT 24,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`is_published` tinyint(1) NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shift_employee_bonuses` (
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
CREATE TABLE `shift_employees` (
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
CREATE TABLE `stock_movements` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`type` enum('entrada','salida','ajuste','venta','devolucion') NOT NULL,
	`quantity` int NOT NULL,
	`previous_stock` int NOT NULL,
	`new_stock` int NOT NULL,
	`reason` varchar(255),
	`reference_id` varchar(36),
	`user_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_announcement_bar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`text` varchar(500) NOT NULL,
	`link_url` varchar(500),
	`bg_color` varchar(20) DEFAULT '#f59e0b',
	`text_color` varchar(20) DEFAULT '#000000',
	`is_active` tinyint(1) DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`scroll_speed` tinyint NOT NULL DEFAULT 3,
	CONSTRAINT `store_announcement_bar_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_announcement_tenant` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `store_banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`position` varchar(20) NOT NULL,
	`image_url` varchar(500) NOT NULL,
	`video_url` varchar(500),
	`title` varchar(255),
	`subtitle` varchar(500),
	`link_url` varchar(500),
	`is_active` tinyint(1) DEFAULT 1,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_custom_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`html_content` longtext,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_custom_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_custom_section_slug` UNIQUE(`tenant_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `store_drop_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drop_id` int NOT NULL,
	`product_id` varchar(50) NOT NULL,
	`custom_discount` int,
	CONSTRAINT `store_drop_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_drop_product` UNIQUE(`drop_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `store_drops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`description` varchar(500),
	`banner_url` varchar(500),
	`global_discount` int DEFAULT 0,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`is_active` tinyint(1) DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_drops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_featured_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(50) NOT NULL,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `store_featured_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_featured_tenant_product` UNIQUE(`tenant_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `store_info` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` varchar(500),
	`phone` varchar(50),
	`tax_id` varchar(50),
	`email` varchar(255),
	`logo_url` varchar(500),
	`schedule` varchar(500),
	`location_map_url` varchar(500),
	`terms_url` text,
	`privacy_url` text,
	`shipping_terms` text,
	`payment_methods` text,
	`social_instagram` varchar(255),
	`social_facebook` varchar(255),
	`social_tiktok` varchar(255),
	`social_whatsapp` varchar(50),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`department` varchar(100),
	`municipality` varchar(100),
	`invoice_logo` varchar(500),
	`invoice_greeting` varchar(255) DEFAULT '??Gracias por su compra!',
	`invoice_policy` text,
	`invoice_copies` tinyint NOT NULL DEFAULT 1,
	`product_card_style` varchar(20) DEFAULT 'style1',
	`allow_contraentrega` tinyint(1) NOT NULL DEFAULT 1,
	`online_discount_enabled` tinyint(1) NOT NULL DEFAULT 0,
	`age_gate_enabled` tinyint(1) NOT NULL DEFAULT 0,
	`age_gate_description` text,
	`contact_page_enabled` tinyint(1) NOT NULL DEFAULT 0,
	`contact_page_title` varchar(255),
	`contact_page_description` text,
	`contact_page_image` varchar(500),
	`contact_page_products` text,
	`contact_page_links` text,
	`show_info_module` tinyint(1) NOT NULL DEFAULT 0,
	`info_module_description` text,
	`cart_min_purchase` int NOT NULL DEFAULT 0,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`contact_page_link_theme` varchar(20) DEFAULT 'theme1',
	`enable_iva` tinyint(1) NOT NULL DEFAULT 0,
	`meta_pixel_id` varchar(100),
	`product_detail_style` varchar(20) DEFAULT 'default',
	`card_cover_url` varchar(500),
	`card_description` varchar(300),
	`is_verified` tinyint(1) NOT NULL DEFAULT 0,
	`open_state` enum('open','closed') NOT NULL DEFAULT 'open',
	`marketplace_visible` tinyint(1) NOT NULL DEFAULT 1,
	`marketplace_order` int NOT NULL DEFAULT 0,
	`business_hours` json,
	`store_theme` varchar(20) NOT NULL DEFAULT 'theme1',
	`logo_size` smallint,
	`cart_delivery_fee` int NOT NULL DEFAULT 0,
	`social_x` varchar(500),
	`social_snapchat` varchar(500),
	CONSTRAINT `store_info_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_store_tenant` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `store_locations` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(100) NOT NULL,
	`zone` varchar(50),
	`description` text,
	`is_active` tinyint(1) DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `store_locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_location_tenant_code` UNIQUE(`tenant_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `store_order_bump` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`is_enabled` tinyint(1) NOT NULL DEFAULT 0,
	`mode` enum('auto','manual') NOT NULL DEFAULT 'auto',
	`title` varchar(255) NOT NULL DEFAULT '??Tambi??n te puede interesar?',
	`max_items` int NOT NULL DEFAULT 3,
	`product_ids` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_order_bump_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_order_bump_tenant` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `storefront_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`product_id` varchar(36),
	`product_name` varchar(255) NOT NULL,
	`product_image` varchar(500),
	`quantity` int NOT NULL DEFAULT 1,
	`unit_price` decimal(12,2) NOT NULL,
	`original_price` decimal(12,2),
	`discount_percent` int DEFAULT 0,
	`total_price` decimal(12,2) NOT NULL,
	`size` varchar(20),
	`color` varchar(50),
	`is_preorder` tinyint(1) NOT NULL DEFAULT 0,
	`preorder_ship_start` date,
	`preorder_ship_end` date,
	`variant_id` varchar(36),
	`cost_price` decimal(12,2),
	`margin_pct` decimal(5,2),
	`margin_amount` decimal(12,2),
	CONSTRAINT `storefront_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storefront_orders` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_number` varchar(20) NOT NULL,
	`customer_name` varchar(255) NOT NULL,
	`customer_phone` varchar(50) NOT NULL,
	`customer_email` varchar(255),
	`customer_cedula` varchar(50),
	`department` varchar(100),
	`municipality` varchar(100),
	`address` text,
	`neighborhood` varchar(255),
	`delivery_latitude` decimal(10,7),
	`delivery_longitude` decimal(10,7),
	`notes` text,
	`subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
	`shipping_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
	`discount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total` decimal(12,2) NOT NULL,
	`status` enum('pendiente','confirmado','preparando','enviado','entregado','cancelado') NOT NULL DEFAULT 'pendiente',
	`payment_method` varchar(50),
	`delivery_driver_id` varchar(36),
	`delivery_status` enum('sin_asignar','asignado','recogido','en_camino','entregado') DEFAULT 'sin_asignar',
	`delivery_assigned_at` timestamp,
	`delivery_picked_at` timestamp,
	`delivery_delivered_at` timestamp,
	`vehicle_id` varchar(36),
	`dispatch_status` enum('pendiente','en_pista','cargado','despachado','entregado') NOT NULL DEFAULT 'pendiente',
	`total_weight_kg` decimal(10,3),
	`dispatch_notes` text,
	`dispatched_at` timestamp,
	`client_user_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`data_encrypted` tinyint(1) NOT NULL DEFAULT 0,
	`gateway_payment_id` varchar(100),
	`refund_status` varchar(30),
	CONSTRAINT `storefront_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_products` (
	`id` varchar(36) NOT NULL,
	`supplier_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`supplier_sku` varchar(100),
	`cost_price` decimal(12,2) DEFAULT '0.00',
	`lead_time_days` int DEFAULT 0,
	`is_preferred` tinyint(1) DEFAULT 0,
	`is_active` tinyint(1) DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` varchar(50) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`contact_name` varchar(200),
	`phone` varchar(20),
	`email` varchar(100),
	`address` text,
	`city` varchar(100),
	`country` varchar(100) DEFAULT 'Colombia',
	`tax_id` varchar(50),
	`payment_terms` varchar(100),
	`notes` text,
	`is_active` tinyint(1) DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_profile` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`cover_url` varchar(500),
	`profile_photo_url` varchar(500),
	`display_name` varchar(160),
	`tagline` varchar(255),
	`about_text` text,
	`instagram` varchar(255),
	`whatsapp` varchar(60),
	`website` varchar(255),
	`accent_color` varchar(16),
	`is_published` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_profile_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_profile_tenant` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`business_type` varchar(100),
	`status` enum('activo','suspendido','cancelado') NOT NULL DEFAULT 'activo',
	`plan` enum('basico','profesional','empresarial') NOT NULL DEFAULT 'basico',
	`max_users` int NOT NULL DEFAULT 5,
	`max_products` int NOT NULL DEFAULT 500,
	`owner_id` varchar(36),
	`bg_color` varchar(7) DEFAULT '#000000',
	`public_menu_enabled` tinyint(1) NOT NULL DEFAULT 0,
	`trial_ends_at` datetime,
	`reservations_enabled` tinyint(1) NOT NULL DEFAULT 0,
	`reservations_whatsapp` varchar(50),
	`reservations_open_time` time NOT NULL DEFAULT '12:00:00',
	`reservations_close_time` time NOT NULL DEFAULT '22:00:00',
	`reservations_slot_minutes` int NOT NULL DEFAULT 60,
	`reservations_max_advance_days` int NOT NULL DEFAULT 30,
	`reservations_min_advance_hours` int NOT NULL DEFAULT 2,
	`reservations_occasions` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`module_realestate` tinyint(1) NOT NULL DEFAULT 0,
	`realestate_enabled` tinyint(1) NOT NULL DEFAULT 0,
	`module_workorders` tinyint(1) NOT NULL DEFAULT 0,
	`enabled_modules` json,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `theme4_config` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`business_type` enum('transport','software','general') NOT NULL DEFAULT 'general',
	`hero_video_url` varchar(500),
	`hero_image_url` varchar(500),
	`hero_title` varchar(200),
	`hero_subtitle` varchar(300),
	`cta_label` varchar(80),
	`cta_url` varchar(500),
	`about_text` text,
	`accent_color` varchar(16),
	`whatsapp` varchar(60),
	`email` varchar(160),
	`phone` varchar(60),
	`address` varchar(255),
	`map_url` varchar(500),
	`show_stats` tinyint(1) NOT NULL DEFAULT 1,
	`show_services` tinyint(1) NOT NULL DEFAULT 1,
	`show_process` tinyint(1) NOT NULL DEFAULT 1,
	`show_team` tinyint(1) NOT NULL DEFAULT 1,
	`show_testimonials` tinyint(1) NOT NULL DEFAULT 1,
	`show_contact` tinyint(1) NOT NULL DEFAULT 1,
	`show_community` tinyint(1) NOT NULL DEFAULT 1,
	`likes_count` int NOT NULL DEFAULT 0,
	`saves_count` int NOT NULL DEFAULT 0,
	`is_published` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `theme4_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_theme4_tenant` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `theme4_fleet` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`vehicle_type` enum('bus','van','car','other') NOT NULL DEFAULT 'other',
	`capacity` int,
	`photo_url` varchar(500),
	`features` json,
	`order_index` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `theme4_fleet_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme4_projects` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`category` varchar(80),
	`screenshot_urls` json,
	`tech_stack` json,
	`live_url` varchar(500),
	`case_study_url` varchar(500),
	`is_featured` tinyint(1) NOT NULL DEFAULT 0,
	`order_index` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `theme4_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme4_reactions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`type` enum('like','save') NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `theme4_reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_t4react` UNIQUE(`tenant_id`,`user_id`,`type`)
);
--> statement-breakpoint
CREATE TABLE `theme4_routes` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`origin` varchar(160) NOT NULL,
	`destination` varchar(160) NOT NULL,
	`stops` json,
	`departure_time` varchar(40),
	`arrival_time` varchar(40),
	`vehicle_id` varchar(36),
	`price` decimal(10,2),
	`booking_url` varchar(500),
	`order_index` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `theme4_routes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme4_services` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`icon` varchar(40),
	`title` varchar(160) NOT NULL,
	`description` text,
	`price_label` varchar(80),
	`is_featured` tinyint(1) NOT NULL DEFAULT 0,
	`order_index` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `theme4_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme4_stats` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`icon` varchar(40),
	`label` varchar(120) NOT NULL,
	`value` varchar(80) NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `theme4_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme4_steps` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`step_number` int NOT NULL DEFAULT 1,
	`title` varchar(160) NOT NULL,
	`description` text,
	`icon` varchar(40),
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `theme4_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme4_team` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`role` varchar(160),
	`photo_url` varchar(500),
	`bio` text,
	`linkedin_url` varchar(500),
	`order_index` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `theme4_team_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme4_testimonials` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`author` varchar(160) NOT NULL,
	`role` varchar(160),
	`avatar_url` varchar(500),
	`rating` tinyint NOT NULL DEFAULT 5,
	`text` text NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	CONSTRAINT `theme4_testimonials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_bookings` (
	`id` varchar(36) NOT NULL,
	`offer_id` varchar(36) NOT NULL,
	`trainer_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`amount_cop` decimal(14,2) NOT NULL,
	`platform_cop` decimal(14,2) NOT NULL DEFAULT '0.00',
	`trainer_cop` decimal(14,2) NOT NULL DEFAULT '0.00',
	`gateway_fee_cop` decimal(14,2) NOT NULL DEFAULT '0.00',
	`status` enum('pending','paid','delivered','completed','refunded') NOT NULL DEFAULT 'pending',
	`activation_status` enum('pending','active','paused','completed','cancelled') NOT NULL DEFAULT 'pending',
	`current_week` int NOT NULL DEFAULT 1,
	`program_snapshot` json,
	`wompi_reference` varchar(120),
	`gateway_payment_id` varchar(255),
	`started_at` datetime,
	`expires_at` datetime,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trainer_bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_commissions` (
	`id` varchar(36) NOT NULL,
	`booking_id` varchar(36) NOT NULL,
	`trainer_id` varchar(36) NOT NULL,
	`gross_cop` decimal(14,2) NOT NULL,
	`platform_cop` decimal(14,2) NOT NULL,
	`trainer_cop` decimal(14,2) NOT NULL,
	`gateway_fee_cop` decimal(14,2) NOT NULL DEFAULT '0.00',
	`status` enum('pending','available','paid') NOT NULL DEFAULT 'pending',
	`created_at` timestamp DEFAULT (now()),
	`release_at` datetime,
	CONSTRAINT `trainer_commissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_offers` (
	`id` varchar(36) NOT NULL,
	`trainer_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`kind` enum('programa','sesion','mensual','combo') NOT NULL DEFAULT 'programa',
	`price_cop` decimal(14,2) NOT NULL,
	`duration_days` int,
	`deliverables` json,
	`media` json,
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trainer_offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_reviews` (
	`id` varchar(36) NOT NULL,
	`booking_id` varchar(36) NOT NULL,
	`trainer_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`rating` tinyint NOT NULL,
	`comment` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `trainer_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_withdrawals` (
	`id` varchar(36) NOT NULL,
	`trainer_id` varchar(36) NOT NULL,
	`amount_cop` decimal(14,2) NOT NULL,
	`payment_method` varchar(200) NOT NULL,
	`status` enum('requested','processing','paid','rejected') NOT NULL DEFAULT 'requested',
	`processed_by` varchar(36),
	`note` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `trainer_withdrawals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainers` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`handle` varchar(100),
	`bio` text,
	`photo_url` varchar(800),
	`specialties` json,
	`status` enum('pending','active','suspended') NOT NULL DEFAULT 'pending',
	`commission_pct` decimal(5,2) NOT NULL DEFAULT '20.00',
	`min_commission_cop` decimal(14,2) NOT NULL DEFAULT '100000.00',
	`balance_cop` decimal(14,2) NOT NULL DEFAULT '0.00',
	`pending_cop` decimal(14,2) NOT NULL DEFAULT '0.00',
	`rating_avg` decimal(3,2) NOT NULL DEFAULT '0.00',
	`sessions_count` int NOT NULL DEFAULT 0,
	`password_hash` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trainers_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_tr_email` UNIQUE(`email`),
	CONSTRAINT `idx_tr_handle` UNIQUE(`handle`)
);
--> statement-breakpoint
CREATE TABLE `user_addresses` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`label` varchar(100) NOT NULL DEFAULT 'Mi direcci??n',
	`department` varchar(500),
	`municipality` varchar(500),
	`address` varchar(500),
	`neighborhood` varchar(500),
	`delivery_latitude` decimal(10,7),
	`delivery_longitude` decimal(10,7),
	`is_default` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`email` varchar(255) NOT NULL,
	`password` varchar(255),
	`name` varchar(255) NOT NULL,
	`role` enum('superadmin','comerciante','vendedor','cliente','repartidor','auxiliar_bodega','administrador_rb','cajero','mesero','cocinero','bartender','despachador') NOT NULL DEFAULT 'vendedor',
	`phone` text,
	`avatar` varchar(500),
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	`can_login` tinyint(1) NOT NULL DEFAULT 1,
	`cargo_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`auth_provider` enum('local','google') NOT NULL DEFAULT 'local',
	`google_id` varchar(255),
	`cedula` varchar(500),
	`department` varchar(500),
	`municipality` varchar(500),
	`address` varchar(500),
	`neighborhood` varchar(500),
	`delivery_latitude` decimal(10,7),
	`delivery_longitude` decimal(10,7),
	`profile_completed` tinyint(1) NOT NULL DEFAULT 0,
	`commission_type` enum('sin_comision','porcentaje','fijo_por_venta','fijo_por_item') NOT NULL DEFAULT 'sin_comision',
	`commission_value` decimal(10,2) NOT NULL DEFAULT '0.00',
	`salary_base` decimal(12,2) NOT NULL DEFAULT '0.00',
	`monthly_goal` decimal(12,2) NOT NULL DEFAULT '0.00',
	`goal_bonus` decimal(12,2) NOT NULL DEFAULT '0.00',
	`data_encrypted` tinyint(1) NOT NULL DEFAULT 0,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `variant_price_tiers` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`variant_id` varchar(36) NOT NULL,
	`min_qty` int NOT NULL DEFAULT 1,
	`price` decimal(12,2) NOT NULL,
	`tenant_margin_pct` decimal(5,2) DEFAULT '0.00',
	`is_active` tinyint(1) DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `variant_price_tiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vault_key_redemptions` (
	`id` varchar(36) NOT NULL,
	`vault_key_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`zero_party_data` json,
	`redeemed_at` timestamp DEFAULT (now()),
	CONSTRAINT `vault_key_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_vkr_unique` UNIQUE(`vault_key_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `vault_keys` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36),
	`code` varchar(40) NOT NULL,
	`label` varchar(160) NOT NULL,
	`key_type` enum('one_use','window','multi') NOT NULL DEFAULT 'multi',
	`unlocks` json NOT NULL,
	`max_redemptions` int,
	`redemptions` int NOT NULL DEFAULT 0,
	`starts_at` datetime,
	`expires_at` datetime,
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`created_by` varchar(36),
	`created_by_affiliate_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `vault_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_vk_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `waste_records` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`product_id` varchar(36),
	`product_name` varchar(200) NOT NULL,
	`quantity` decimal(10,3) NOT NULL,
	`unit` varchar(20) NOT NULL DEFAULT 'unidad',
	`waste_type` enum('natural','operativa','administrativa','vencimiento') NOT NULL DEFAULT 'operativa',
	`reason` enum('quemado','vencido','mal_corte','devolucion','consumo_interno','robo','cortesia','sobreporcion','dano','otro') NOT NULL DEFAULT 'otro',
	`cost_value` decimal(12,2) NOT NULL DEFAULT '0.00',
	`area` enum('cocina','bar','general') NOT NULL DEFAULT 'cocina',
	`responsible_id` varchar(36),
	`responsible_name` varchar(100),
	`notes` text,
	`photo_url` varchar(500),
	`recorded_by` varchar(36) NOT NULL,
	`recorded_by_name` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waste_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wompi_transactions` (
	`reference` varchar(64) NOT NULL,
	`owner` varchar(20) NOT NULL DEFAULT 'platform',
	`tenant_id` varchar(36),
	`context` varchar(30) NOT NULL,
	`context_id` varchar(64),
	`amount_in_cents` bigint NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'COP',
	`status` varchar(20) NOT NULL DEFAULT 'PENDING',
	`wompi_id` varchar(80),
	`customer_email` varchar(255),
	`payload` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wompi_transactions_reference` PRIMARY KEY(`reference`)
);
--> statement-breakpoint
CREATE TABLE `work_order_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`work_order_id` varchar(36) NOT NULL,
	`product_id` varchar(36),
	`product_name` varchar(255) NOT NULL,
	`quantity` decimal(10,3) NOT NULL DEFAULT '1.000',
	`unit` varchar(50) NOT NULL DEFAULT 'unidad',
	`unit_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `work_order_materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_order_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`work_order_id` varchar(36) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`payment_method` enum('efectivo','tarjeta','transferencia','nequi','otro') NOT NULL DEFAULT 'efectivo',
	`notes` text,
	`received_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `work_order_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_order_sequence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`prefix` varchar(10) NOT NULL DEFAULT 'OT',
	`current_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `work_order_sequence_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_wo_seq_tenant` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_number` varchar(20) NOT NULL,
	`customer_id` varchar(36),
	`customer_name` varchar(255) NOT NULL,
	`customer_phone` varchar(50),
	`item_description` varchar(500) NOT NULL,
	`item_type` varchar(100) NOT NULL DEFAULT 'vehiculo',
	`job_type` varchar(100) NOT NULL DEFAULT 'tapizado_completo',
	`fabric_description` varchar(300),
	`quoted_price` decimal(12,2) NOT NULL DEFAULT '0.00',
	`advance_paid` decimal(12,2) NOT NULL DEFAULT '0.00',
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`promised_at` date,
	`delivered_at` timestamp,
	`status` enum('recibido','cotizado','aprobado','en_proceso','listo','entregado','cancelado') NOT NULL DEFAULT 'recibido',
	`notes` text,
	`assigned_to` varchar(36),
	`sale_id` varchar(36),
	`photos_in` json,
	`photos_out` json,
	`created_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `work_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_wo_number` UNIQUE(`tenant_id`,`order_number`)
);
--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`exercise_id` varchar(80) NOT NULL,
	`exercise_name` varchar(160),
	`exercise_order` int NOT NULL DEFAULT 0,
	`target_sets` int NOT NULL,
	`target_reps` int NOT NULL,
	`suggested_weight` decimal(8,2) NOT NULL DEFAULT '0.00',
	`movement_pattern` varchar(10),
	`completed` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `workout_exercises_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`routine_id` varchar(36),
	`goal` varchar(20) NOT NULL DEFAULT 'hypertrophy',
	`status` enum('pending','active','paused','completed','cancelled') NOT NULL DEFAULT 'active',
	`started_at` datetime,
	`completed_at` datetime,
	`duration_seconds` int,
	`total_volume` decimal(12,2) NOT NULL DEFAULT '0.00',
	`current_exercise_index` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workout_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` varchar(36) NOT NULL,
	`exercise_session_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`set_number` int NOT NULL,
	`target_reps` int NOT NULL,
	`completed_reps` int,
	`target_weight` decimal(8,2) NOT NULL DEFAULT '0.00',
	`used_weight` decimal(8,2),
	`completed` tinyint(1) NOT NULL DEFAULT 0,
	`completed_at` datetime,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `workout_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `affiliate_campaigns` ADD CONSTRAINT `affiliate_campaigns_ibfk_1` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_campaigns` ADD CONSTRAINT `affiliate_campaigns_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_ibfk_1` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_conversions` ADD CONSTRAINT `affiliate_conversions_ibfk_1` FOREIGN KEY (`campaign_id`) REFERENCES `affiliate_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_mission_submissions` ADD CONSTRAINT `affiliate_mission_submissions_ibfk_1` FOREIGN KEY (`mission_id`) REFERENCES `affiliate_missions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_mission_submissions` ADD CONSTRAINT `affiliate_mission_submissions_ibfk_2` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_package_orders` ADD CONSTRAINT `affiliate_package_orders_ibfk_1` FOREIGN KEY (`package_id`) REFERENCES `affiliate_packages`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_package_orders` ADD CONSTRAINT `affiliate_package_orders_ibfk_2` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_package_orders` ADD CONSTRAINT `affiliate_package_orders_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_withdrawals` ADD CONSTRAINT `affiliate_withdrawals_ibfk_1` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_actions` ADD CONSTRAINT `agent_actions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `arena_feed_comments` ADD CONSTRAINT `arena_feed_comments_ibfk_1` FOREIGN KEY (`feed_id`) REFERENCES `arena_feed`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `arena_feed_likes` ADD CONSTRAINT `arena_feed_likes_ibfk_1` FOREIGN KEY (`feed_id`) REFERENCES `arena_feed`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_actividad_opciones` ADD CONSTRAINT `cartilla_actividad_opciones_ibfk_1` FOREIGN KEY (`actividad_id`) REFERENCES `cartilla_actividades`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_actividad_ordenar` ADD CONSTRAINT `cartilla_actividad_ordenar_ibfk_1` FOREIGN KEY (`actividad_id`) REFERENCES `cartilla_actividades`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_actividad_pares` ADD CONSTRAINT `cartilla_actividad_pares_ibfk_1` FOREIGN KEY (`actividad_id`) REFERENCES `cartilla_actividades`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_actividad_vf` ADD CONSTRAINT `cartilla_actividad_vf_ibfk_1` FOREIGN KEY (`actividad_id`) REFERENCES `cartilla_actividades`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_actividades` ADD CONSTRAINT `cartilla_actividades_ibfk_1` FOREIGN KEY (`modulo_id`) REFERENCES `cartilla_modulos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_comentarios` ADD CONSTRAINT `cartilla_comentarios_ibfk_1` FOREIGN KEY (`publicacion_id`) REFERENCES `cartilla_publicaciones`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_compras` ADD CONSTRAINT `cartilla_compras_ibfk_1` FOREIGN KEY (`cartilla_id`) REFERENCES `cartillas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_modulo_audios` ADD CONSTRAINT `cartilla_modulo_audios_ibfk_1` FOREIGN KEY (`modulo_id`) REFERENCES `cartilla_modulos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_modulo_imagenes` ADD CONSTRAINT `cartilla_modulo_imagenes_ibfk_1` FOREIGN KEY (`modulo_id`) REFERENCES `cartilla_modulos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_modulo_secciones` ADD CONSTRAINT `cartilla_modulo_secciones_ibfk_1` FOREIGN KEY (`modulo_id`) REFERENCES `cartilla_modulos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_modulos` ADD CONSTRAINT `cartilla_modulos_ibfk_1` FOREIGN KEY (`cartilla_id`) REFERENCES `cartillas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_progreso` ADD CONSTRAINT `cartilla_progreso_ibfk_1` FOREIGN KEY (`cartilla_id`) REFERENCES `cartillas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_publicacion_likes` ADD CONSTRAINT `cartilla_publicacion_likes_ibfk_1` FOREIGN KEY (`publicacion_id`) REFERENCES `cartilla_publicaciones`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_usuario_modulos` ADD CONSTRAINT `cartilla_usuario_modulos_ibfk_1` FOREIGN KEY (`modulo_id`) REFERENCES `cartilla_modulos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_usuario_respuestas` ADD CONSTRAINT `cartilla_usuario_respuestas_ibfk_1` FOREIGN KEY (`actividad_id`) REFERENCES `cartilla_actividades`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_usuario_retos` ADD CONSTRAINT `cartilla_usuario_retos_ibfk_1` FOREIGN KEY (`reto_id`) REFERENCES `cartilla_retos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cartilla_vocabulario` ADD CONSTRAINT `cartilla_vocabulario_ibfk_1` FOREIGN KEY (`cartilla_id`) REFERENCES `cartillas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_ibfk_2` FOREIGN KEY (`session_id`) REFERENCES `cash_sessions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_ibfk_2` FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_ibfk_3` FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `challenge_participants` ADD CONSTRAINT `challenge_participants_ibfk_1` FOREIGN KEY (`challenge_id`) REFERENCES `seasonal_challenges`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chatbot_config` ADD CONSTRAINT `chatbot_config_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chatbot_sessions` ADD CONSTRAINT `chatbot_sessions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coach_feed_entries` ADD CONSTRAINT `coach_feed_entries_ibfk_1` FOREIGN KEY (`booking_id`) REFERENCES `trainer_bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_comments` ADD CONSTRAINT `community_comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_post_ads` ADD CONSTRAINT `community_post_ads_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_post_media` ADD CONSTRAINT `community_post_media_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_reactions` ADD CONSTRAINT `community_reactions_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_payments` ADD CONSTRAINT `credit_payments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_payments` ADD CONSTRAINT `credit_payments_ibfk_2` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_payments` ADD CONSTRAINT `credit_payments_ibfk_3` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_payments` ADD CONSTRAINT `credit_payments_ibfk_4` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dev_requests` ADD CONSTRAINT `dev_requests_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dev_requests` ADD CONSTRAINT `dev_requests_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discount_coupons` ADD CONSTRAINT `discount_coupons_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drop_claims` ADD CONSTRAINT `drop_claims_ibfk_1` FOREIGN KEY (`drop_id`) REFERENCES `drops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_cargos` ADD CONSTRAINT `employee_cargos_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_novelties` ADD CONSTRAINT `employee_novelties_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_novelties` ADD CONSTRAINT `employee_novelties_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_vacation_balances` ADD CONSTRAINT `employee_vacation_balances_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_vacation_balances` ADD CONSTRAINT `employee_vacation_balances_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_budgets` ADD CONSTRAINT `finance_budgets_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_budgets` ADD CONSTRAINT `finance_budgets_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `finance_categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_categories` ADD CONSTRAINT `finance_categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD CONSTRAINT `finance_transactions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD CONSTRAINT `finance_transactions_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `finance_categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD CONSTRAINT `finance_transactions_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_maintenance` ADD CONSTRAINT `fleet_maintenance_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_maintenance` ADD CONSTRAINT `fleet_maintenance_ibfk_2` FOREIGN KEY (`vehicle_id`) REFERENCES `fleet_vehicles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_maintenance` ADD CONSTRAINT `fleet_maintenance_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_vehicles` ADD CONSTRAINT `fleet_vehicles_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `guild_members` ADD CONSTRAINT `guild_members_ibfk_1` FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice_sequence` ADD CONSTRAINT `invoice_sequence_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `merchant_events` ADD CONSTRAINT `merchant_events_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `merchant_notifications` ADD CONSTRAINT `merchant_notifications_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_receipt_sequence` ADD CONSTRAINT `payment_receipt_sequence_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_adjustments` ADD CONSTRAINT `payroll_adjustments_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_records` ADD CONSTRAINT `payroll_records_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payroll_records` ADD CONSTRAINT `payroll_records_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_service_options` ADD CONSTRAINT `portfolio_service_options_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `portfolio_service_categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_history` ADD CONSTRAINT `price_history_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_history` ADD CONSTRAINT `price_history_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_alerts` ADD CONSTRAINT `product_alerts_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_alerts` ADD CONSTRAINT `product_alerts_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_recipes` ADD CONSTRAINT `product_recipes_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_recipes` ADD CONSTRAINT `product_recipes_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_recipes` ADD CONSTRAINT `product_recipes_ibfk_3` FOREIGN KEY (`ingredient_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_reviews` ADD CONSTRAINT `product_reviews_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_reviews` ADD CONSTRAINT `product_reviews_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_invoice_items` ADD CONSTRAINT `purchase_invoice_items_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_invoice_items` ADD CONSTRAINT `purchase_invoice_items_ibfk_2` FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_invoice_items` ADD CONSTRAINT `purchase_invoice_items_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD CONSTRAINT `purchase_invoices_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD CONSTRAINT `purchase_invoices_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD CONSTRAINT `purchase_invoices_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_gastos` ADD CONSTRAINT `rb_gastos_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_gastos_fijos` ADD CONSTRAINT `rb_gastos_fijos_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_ingresos_diarios` ADD CONSTRAINT `rb_ingresos_diarios_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_order_items` ADD CONSTRAINT `rb_order_items_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_order_items` ADD CONSTRAINT `rb_order_items_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `rb_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_order_items` ADD CONSTRAINT `rb_order_items_ibfk_3` FOREIGN KEY (`menu_item_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_order_sequence` ADD CONSTRAINT `rb_order_sequence_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_orders` ADD CONSTRAINT `rb_orders_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_orders` ADD CONSTRAINT `rb_orders_ibfk_2` FOREIGN KEY (`table_id`) REFERENCES `rb_tables`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_orders` ADD CONSTRAINT `rb_orders_ibfk_3` FOREIGN KEY (`waiter_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_orders` ADD CONSTRAINT `rb_orders_ibfk_4` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_payments` ADD CONSTRAINT `rb_payments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_payments` ADD CONSTRAINT `rb_payments_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `rb_orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_payments` ADD CONSTRAINT `rb_payments_ibfk_3` FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_payments` ADD CONSTRAINT `rb_payments_ibfk_4` FOREIGN KEY (`cash_session_id`) REFERENCES `cash_sessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_reservation_sequence` ADD CONSTRAINT `rb_reservation_sequence_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_reservations` ADD CONSTRAINT `rb_reservations_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_reservations` ADD CONSTRAINT `rb_reservations_ibfk_2` FOREIGN KEY (`table_id`) REFERENCES `rb_tables`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rb_tables` ADD CONSTRAINT `rb_tables_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_clients` ADD CONSTRAINT `re_clients_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_contracts` ADD CONSTRAINT `re_contracts_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_contracts` ADD CONSTRAINT `re_contracts_ibfk_2` FOREIGN KEY (`property_id`) REFERENCES `re_properties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_contracts` ADD CONSTRAINT `re_contracts_ibfk_3` FOREIGN KEY (`client_id`) REFERENCES `re_clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_lead_activities` ADD CONSTRAINT `re_lead_activities_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `re_leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_lead_activities` ADD CONSTRAINT `re_lead_activities_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_leads` ADD CONSTRAINT `re_leads_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_maintenances` ADD CONSTRAINT `re_maintenances_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_maintenances` ADD CONSTRAINT `re_maintenances_ibfk_2` FOREIGN KEY (`property_id`) REFERENCES `re_properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_owners` ADD CONSTRAINT `re_owners_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_properties` ADD CONSTRAINT `re_properties_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_property_features` ADD CONSTRAINT `re_property_features_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `re_properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_property_media` ADD CONSTRAINT `re_property_media_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `re_properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_rent_payments` ADD CONSTRAINT `re_rent_payments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_rent_payments` ADD CONSTRAINT `re_rent_payments_ibfk_2` FOREIGN KEY (`contract_id`) REFERENCES `re_contracts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_visits` ADD CONSTRAINT `re_visits_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `re_visits` ADD CONSTRAINT `re_visits_ibfk_2` FOREIGN KEY (`property_id`) REFERENCES `re_properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_3` FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_4` FOREIGN KEY (`vehicle_id`) REFERENCES `fleet_vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sedes` ADD CONSTRAINT `sedes_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_availability` ADD CONSTRAINT `service_availability_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_availability` ADD CONSTRAINT `service_availability_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_blocked_periods` ADD CONSTRAINT `service_blocked_periods_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_blocked_periods` ADD CONSTRAINT `service_blocked_periods_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_bookings` ADD CONSTRAINT `service_bookings_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_bookings` ADD CONSTRAINT `service_bookings_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift_employee_bonuses` ADD CONSTRAINT `shift_employee_bonuses_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `cash_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift_employee_bonuses` ADD CONSTRAINT `shift_employee_bonuses_ibfk_2` FOREIGN KEY (`shift_emp_id`) REFERENCES `shift_employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift_employees` ADD CONSTRAINT `shift_employees_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `cash_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_announcement_bar` ADD CONSTRAINT `store_announcement_bar_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_banners` ADD CONSTRAINT `store_banners_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_custom_sections` ADD CONSTRAINT `store_custom_sections_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_drop_products` ADD CONSTRAINT `store_drop_products_ibfk_1` FOREIGN KEY (`drop_id`) REFERENCES `store_drops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_drop_products` ADD CONSTRAINT `store_drop_products_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_drops` ADD CONSTRAINT `store_drops_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_featured_products` ADD CONSTRAINT `store_featured_products_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_featured_products` ADD CONSTRAINT `store_featured_products_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_info` ADD CONSTRAINT `store_info_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_locations` ADD CONSTRAINT `store_locations_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_order_bump` ADD CONSTRAINT `store_order_bump_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storefront_order_items` ADD CONSTRAINT `storefront_order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `storefront_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storefront_order_items` ADD CONSTRAINT `storefront_order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD CONSTRAINT `storefront_orders_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD CONSTRAINT `storefront_orders_ibfk_2` FOREIGN KEY (`delivery_driver_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD CONSTRAINT `storefront_orders_ibfk_3` FOREIGN KEY (`client_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storefront_orders` ADD CONSTRAINT `storefront_orders_ibfk_4` FOREIGN KEY (`vehicle_id`) REFERENCES `fleet_vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenants` ADD CONSTRAINT `fk_tenant_owner` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_bookings` ADD CONSTRAINT `trainer_bookings_ibfk_1` FOREIGN KEY (`offer_id`) REFERENCES `trainer_offers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_bookings` ADD CONSTRAINT `trainer_bookings_ibfk_2` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_commissions` ADD CONSTRAINT `trainer_commissions_ibfk_1` FOREIGN KEY (`booking_id`) REFERENCES `trainer_bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_commissions` ADD CONSTRAINT `trainer_commissions_ibfk_2` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_offers` ADD CONSTRAINT `trainer_offers_ibfk_1` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_reviews` ADD CONSTRAINT `trainer_reviews_ibfk_1` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_withdrawals` ADD CONSTRAINT `trainer_withdrawals_ibfk_1` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_addresses` ADD CONSTRAINT `user_addresses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vault_key_redemptions` ADD CONSTRAINT `vault_key_redemptions_ibfk_1` FOREIGN KEY (`vault_key_id`) REFERENCES `vault_keys`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD CONSTRAINT `work_order_materials_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD CONSTRAINT `work_order_materials_ibfk_2` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_payments` ADD CONSTRAINT `work_order_payments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_payments` ADD CONSTRAINT `work_order_payments_ibfk_2` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_payments` ADD CONSTRAINT `work_order_payments_ibfk_3` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_sequence` ADD CONSTRAINT `work_order_sequence_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD CONSTRAINT `workout_exercises_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workout_sets` ADD CONSTRAINT `workout_sets_ibfk_1` FOREIGN KEY (`exercise_session_id`) REFERENCES `workout_exercises`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_campaign_affiliate` ON `affiliate_campaigns` (`affiliate_id`);--> statement-breakpoint
CREATE INDEX `idx_campaign_tenant` ON `affiliate_campaigns` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_comm_affiliate` ON `affiliate_commissions` (`affiliate_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_comm_conversion` ON `affiliate_commissions` (`conversion_id`);--> statement-breakpoint
CREATE INDEX `idx_conv_campaign` ON `affiliate_conversions` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `idx_conv_order` ON `affiliate_conversions` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_conv_sale` ON `affiliate_conversions` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_conv_status` ON `affiliate_conversions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_conv_tenant` ON `affiliate_conversions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_submission_affiliate` ON `affiliate_mission_submissions` (`affiliate_id`);--> statement-breakpoint
CREATE INDEX `idx_submission_mission` ON `affiliate_mission_submissions` (`mission_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_mission_active` ON `affiliate_missions` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_pkgorder_affiliate` ON `affiliate_package_orders` (`affiliate_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_pkgorder_tenant` ON `affiliate_package_orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `package_id` ON `affiliate_package_orders` (`package_id`);--> statement-breakpoint
CREATE INDEX `idx_affpkg_active` ON `affiliate_packages` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_withdraw_affiliate` ON `affiliate_withdrawals` (`affiliate_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_aff_status` ON `affiliates` (`status`);--> statement-breakpoint
CREATE INDEX `idx_agent_actions_created` ON `agent_actions` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_actions_session` ON `agent_actions` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_actions_tenant` ON `agent_actions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_actions_tool` ON `agent_actions` (`tenant_id`,`tool_name`);--> statement-breakpoint
CREATE INDEX `idx_aul_created` ON `ai_usage_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_aul_provider` ON `ai_usage_log` (`provider`);--> statement-breakpoint
CREATE INDEX `idx_af_created` ON `arena_feed` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_af_user` ON `arena_feed` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_afc_feed` ON `arena_feed_comments` (`feed_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_date` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_severity` ON `audit_log` (`severity`);--> statement-breakpoint
CREATE INDEX `idx_audit_tenant` ON `audit_log` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_tenant_action` ON `audit_log` (`tenant_id`,`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_tenant_date` ON `audit_log` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_user` ON `audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `actividad_id` ON `cartilla_actividad_opciones` (`actividad_id`);--> statement-breakpoint
CREATE INDEX `actividad_id` ON `cartilla_actividad_ordenar` (`actividad_id`);--> statement-breakpoint
CREATE INDEX `actividad_id` ON `cartilla_actividad_pares` (`actividad_id`);--> statement-breakpoint
CREATE INDEX `actividad_id` ON `cartilla_actividad_vf` (`actividad_id`);--> statement-breakpoint
CREATE INDEX `idx_act_modulo` ON `cartilla_actividades` (`modulo_id`);--> statement-breakpoint
CREATE INDEX `publicacion_id` ON `cartilla_comentarios` (`publicacion_id`);--> statement-breakpoint
CREATE INDEX `idx_compra_cartilla` ON `cartilla_compras` (`cartilla_id`);--> statement-breakpoint
CREATE INDEX `idx_compra_tenant` ON `cartilla_compras` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `modulo_id` ON `cartilla_modulo_audios` (`modulo_id`);--> statement-breakpoint
CREATE INDEX `modulo_id` ON `cartilla_modulo_imagenes` (`modulo_id`);--> statement-breakpoint
CREATE INDEX `modulo_id` ON `cartilla_modulo_secciones` (`modulo_id`);--> statement-breakpoint
CREATE INDEX `idx_modulo_cartilla` ON `cartilla_modulos` (`cartilla_id`);--> statement-breakpoint
CREATE INDEX `idx_modulo_tenant` ON `cartilla_modulos` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_progreso_cartilla` ON `cartilla_progreso` (`cartilla_id`);--> statement-breakpoint
CREATE INDEX `idx_pub_cartilla` ON `cartilla_publicaciones` (`cartilla_id`);--> statement-breakpoint
CREATE INDEX `idx_pub_tenant` ON `cartilla_publicaciones` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_reto_cartilla` ON `cartilla_retos` (`cartilla_id`);--> statement-breakpoint
CREATE INDEX `idx_reto_tenant` ON `cartilla_retos` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `modulo_id` ON `cartilla_usuario_modulos` (`modulo_id`);--> statement-breakpoint
CREATE INDEX `actividad_id` ON `cartilla_usuario_respuestas` (`actividad_id`);--> statement-breakpoint
CREATE INDEX `reto_id` ON `cartilla_usuario_retos` (`reto_id`);--> statement-breakpoint
CREATE INDEX `idx_vocab_cartilla` ON `cartilla_vocabulario` (`cartilla_id`);--> statement-breakpoint
CREATE INDEX `idx_vocab_tenant` ON `cartilla_vocabulario` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_cartilla_publicado` ON `cartillas` (`publicado`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_cartilla_tenant` ON `cartillas` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `created_by` ON `cash_movements` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_cash_movement_session` ON `cash_movements` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_cash_movement_tenant` ON `cash_movements` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `closed_by` ON `cash_sessions` (`closed_by`);--> statement-breakpoint
CREATE INDEX `idx_cash_session_opened` ON `cash_sessions` (`opened_at`);--> statement-breakpoint
CREATE INDEX `idx_cash_session_status` ON `cash_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_cash_session_tenant` ON `cash_sessions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `opened_by` ON `cash_sessions` (`opened_by`);--> statement-breakpoint
CREATE INDEX `idx_category_tenant` ON `categories` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_cp_user` ON `challenge_participants` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chatbot_tenant` ON `chatbot_config` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_msg_session` ON `chatbot_messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_msg_tenant` ON `chatbot_messages` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_session_tenant` ON `chatbot_sessions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_cfe_booking` ON `coach_feed_entries` (`booking_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comment_parent` ON `community_comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_comment_post` ON `community_comments` (`post_id`,`is_active`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ad_post` ON `community_post_ads` (`post_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_ad_product` ON `community_post_ads` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_media_post` ON `community_post_media` (`post_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_post_author` ON `community_posts` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_post_category` ON `community_posts` (`category`);--> statement-breakpoint
CREATE INDEX `idx_post_status` ON `community_posts` (`status`,`is_active`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_reaction_device` ON `community_reactions` (`device_id`);--> statement-breakpoint
CREATE INDEX `idx_reaction_post` ON `community_reactions` (`post_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_cac_active` ON `consumer_access_codes` (`is_active`,`scope`,`tier`);--> statement-breakpoint
CREATE INDEX `idx_cal_code` ON `consumer_access_ledger` (`code_id`);--> statement-breakpoint
CREATE INDEX `idx_cal_user` ON `consumer_access_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ach_user` ON `consumer_achievements` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bl_user` ON `consumer_body_logs` (`user_id`,`logged_on`);--> statement-breakpoint
CREATE INDEX `idx_dc_user` ON `consumer_daily_checks` (`user_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_cdr_tier` ON `consumer_discount_rules` (`tier`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_cev_event` ON `consumer_events` (`event`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_cev_user` ON `consumer_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_cpg_user_active` ON `consumer_plan_grants` (`user_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_cvu_user` ON `consumer_vault_unlocks` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_xp_user` ON `consumer_xp_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_credit_payments_customer` ON `credit_payments` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_credit_payments_date` ON `credit_payments` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_credit_payments_sale` ON `credit_payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_credit_payments_tenant` ON `credit_payments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `received_by` ON `credit_payments` (`received_by`);--> statement-breakpoint
CREATE INDEX `idx_customer_tenant` ON `customers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_customers_name` ON `customers` (`name`);--> statement-breakpoint
CREATE INDEX `idx_dev_req_created` ON `dev_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_dev_req_status` ON `dev_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dev_req_tenant` ON `dev_requests` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `user_id` ON `dev_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_coupon_active` ON `discount_coupons` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_coupon_tenant` ON `discount_coupons` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_dc_user` ON `drop_claims` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_drop_status` ON `drops` (`status`);--> statement-breakpoint
CREATE INDEX `idx_drop_window` ON `drops` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_cargos_tenant` ON `employee_cargos` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_novelties_date` ON `employee_novelties` (`tenant_id`,`start_date`);--> statement-breakpoint
CREATE INDEX `idx_novelties_status` ON `employee_novelties` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_novelties_tenant` ON `employee_novelties` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_novelties_type` ON `employee_novelties` (`tenant_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_novelties_user` ON `employee_novelties` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_vacation_tenant` ON `employee_vacation_balances` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `user_id` ON `employee_vacation_balances` (`user_id`);--> statement-breakpoint
CREATE INDEX `category_id` ON `finance_budgets` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_period` ON `finance_budgets` (`tenant_id`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `idx_fin_cat_tenant` ON `finance_categories` (`tenant_id`,`type`);--> statement-breakpoint
CREATE INDEX `category_id` ON `finance_transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `created_by` ON `finance_transactions` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_fin_tx_category` ON `finance_transactions` (`tenant_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_fin_tx_date` ON `finance_transactions` (`tenant_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_fin_tx_recurring` ON `finance_transactions` (`tenant_id`,`is_recurring`);--> statement-breakpoint
CREATE INDEX `idx_fin_tx_source` ON `finance_transactions` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_fin_tx_tenant` ON `finance_transactions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_fin_tx_type` ON `finance_transactions` (`tenant_id`,`type`);--> statement-breakpoint
CREATE INDEX `created_by` ON `fleet_maintenance` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_maintenance_scheduled` ON `fleet_maintenance` (`scheduled_date`);--> statement-breakpoint
CREATE INDEX `idx_maintenance_status` ON `fleet_maintenance` (`status`);--> statement-breakpoint
CREATE INDEX `idx_maintenance_tenant` ON `fleet_maintenance` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_maintenance_vehicle` ON `fleet_maintenance` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `idx_fleet_status` ON `fleet_vehicles` (`status`);--> statement-breakpoint
CREATE INDEX `idx_fleet_tenant` ON `fleet_vehicles` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_fleet_type` ON `fleet_vehicles` (`type`);--> statement-breakpoint
CREATE INDEX `idx_gm_guild` ON `guild_members` (`guild_id`);--> statement-breakpoint
CREATE INDEX `idx_hc_horma` ON `horma_colors` (`horma_id`,`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_hc_tenant` ON `horma_colors` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_hormas_tenant` ON `hormas` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_ih_expires` ON `inventory_holds` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_ih_order` ON `inventory_holds` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_ih_product_tenant` ON `inventory_holds` (`product_id`,`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_ih_tenant` ON `inventory_holds` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_im_created` ON `inventory_movements` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_im_product` ON `inventory_movements` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_im_tenant` ON `inventory_movements` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_im_variant` ON `inventory_movements` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_lp_user` ON `legend_purchases` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_la_email_time` ON `login_attempts` (`email`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `idx_la_ip_time` ON `login_attempts` (`ip_address`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `idx_loyalty_reward` ON `loyalty_rewards` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_loyalty_tx` ON `loyalty_transactions` (`tenant_id`,`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mec_visible` ON `marketplace_external_cards` (`is_visible`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_ml_product` ON `menu_likes` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_ml_tenant` ON `menu_likes` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_mevent_tenant` ON `merchant_events` (`tenant_id`,`is_active`,`event_date`);--> statement-breakpoint
CREATE INDEX `idx_notif_created` ON `merchant_notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notif_tenant_read` ON `merchant_notifications` (`tenant_id`,`is_read`);--> statement-breakpoint
CREATE INDEX `idx_notif_tenant` ON `notifications` (`tenant_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_osh_order` ON `order_status_history` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_osh_tenant` ON `order_status_history` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_pl_tenant` ON `par_levels` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_adj_period` ON `payroll_adjustments` (`tenant_id`,`period_from`,`period_to`);--> statement-breakpoint
CREATE INDEX `idx_adj_tenant_seller` ON `payroll_adjustments` (`tenant_id`,`seller_id`);--> statement-breakpoint
CREATE INDEX `seller_id` ON `payroll_adjustments` (`seller_id`);--> statement-breakpoint
CREATE INDEX `idx_payroll_period` ON `payroll_records` (`tenant_id`,`period_from`,`period_to`);--> statement-breakpoint
CREATE INDEX `idx_payroll_seller` ON `payroll_records` (`seller_id`);--> statement-breakpoint
CREATE INDEX `idx_payroll_status` ON `payroll_records` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_payroll_tenant` ON `payroll_records` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `category_id` ON `portfolio_service_options` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_price_product_date` ON `price_history` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_price_tenant` ON `price_history` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_printers_module` ON `printers` (`tenant_id`,`assigned_module`);--> statement-breakpoint
CREATE INDEX `idx_printers_tenant` ON `printers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_alert_date` ON `product_alerts` (`alert_date`,`is_resolved`);--> statement-breakpoint
CREATE INDEX `idx_alert_priority` ON `product_alerts` (`priority`,`is_resolved`);--> statement-breakpoint
CREATE INDEX `idx_alert_tenant` ON `product_alerts` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_alert_type` ON `product_alerts` (`alert_type`);--> statement-breakpoint
CREATE INDEX `product_id` ON `product_alerts` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_pmg_product` ON `product_modifier_groups` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_pmg_tenant` ON `product_modifier_groups` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_pmo_group` ON `product_modifier_options` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_pmo_tenant` ON `product_modifier_options` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_recipe_product` ON `product_recipes` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_recipe_tenant` ON `product_recipes` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `ingredient_id` ON `product_recipes` (`ingredient_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_product` ON `product_reviews` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_status` ON `product_reviews` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_reviews_tenant` ON `product_reviews` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_pv_horma` ON `product_variants` (`horma_id`);--> statement-breakpoint
CREATE INDEX `idx_pv_product` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_pv_sku` ON `product_variants` (`tenant_id`,`sku`);--> statement-breakpoint
CREATE INDEX `idx_pv_supplier` ON `product_variants` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_pv_tenant_product` ON `product_variants` (`tenant_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `idx_category` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `idx_menu_item` ON `products` (`tenant_id`,`is_menu_item`,`available_in_menu`);--> statement-breakpoint
CREATE INDEX `idx_prep_area` ON `products` (`tenant_id`,`preparation_area`);--> statement-breakpoint
CREATE INDEX `idx_product_tenant` ON `products` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_products_delivery` ON `products` (`tenant_id`,`delivery_type`);--> statement-breakpoint
CREATE INDEX `idx_products_expiry` ON `products` (`tenant_id`,`expiry_date`);--> statement-breakpoint
CREATE INDEX `idx_products_horma` ON `products` (`horma_id`);--> statement-breakpoint
CREATE INDEX `idx_products_offer` ON `products` (`tenant_id`,`is_on_offer`);--> statement-breakpoint
CREATE INDEX `idx_products_preorder` ON `products` (`tenant_id`,`is_preorder`);--> statement-breakpoint
CREATE INDEX `idx_products_store` ON `products` (`tenant_id`,`published_in_store`);--> statement-breakpoint
CREATE INDEX `supplier_id` ON `products` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_psection_active` ON `profile_sections` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_psection_tenant` ON `profile_sections` (`tenant_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_purchase_items_invoice` ON `purchase_invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_purchase_items_product` ON `purchase_invoice_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `tenant_id` ON `purchase_invoice_items` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `created_by` ON `purchase_invoices` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_purchase_invoices_date` ON `purchase_invoices` (`purchase_date`);--> statement-breakpoint
CREATE INDEX `idx_purchase_invoices_status` ON `purchase_invoices` (`tenant_id`,`payment_status`);--> statement-breakpoint
CREATE INDEX `idx_purchase_invoices_supplier` ON `purchase_invoices` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_purchase_invoices_tenant` ON `purchase_invoices` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_purchases_synced` ON `purchase_invoices` (`synced`);--> statement-breakpoint
CREATE INDEX `idx_push_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_rb_gastos_tenant_date` ON `rb_gastos` (`tenant_id`,`registered_at`);--> statement-breakpoint
CREATE INDEX `idx_rb_gastos_fijos_tenant` ON `rb_gastos_fijos` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_jukebox_tenant` ON `rb_jukebox_queue` (`tenant_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_rb_item_area` ON `rb_order_items` (`tenant_id`,`preparation_area`,`status`);--> statement-breakpoint
CREATE INDEX `idx_rb_item_order` ON `rb_order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_rb_item_status` ON `rb_order_items` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `menu_item_id` ON `rb_order_items` (`menu_item_id`);--> statement-breakpoint
CREATE INDEX `idx_rb_order_status` ON `rb_orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_rb_order_table` ON `rb_orders` (`table_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_rb_order_waiter` ON `rb_orders` (`tenant_id`,`waiter_id`);--> statement-breakpoint
CREATE INDEX `sale_id` ON `rb_orders` (`sale_id`);--> statement-breakpoint
CREATE INDEX `waiter_id` ON `rb_orders` (`waiter_id`);--> statement-breakpoint
CREATE INDEX `cashier_id` ON `rb_payments` (`cashier_id`);--> statement-breakpoint
CREATE INDEX `idx_rb_payment_order` ON `rb_payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_rb_payment_session` ON `rb_payments` (`cash_session_id`);--> statement-breakpoint
CREATE INDEX `idx_rb_payment_tenant` ON `rb_payments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_rb_res_date` ON `rb_reservations` (`tenant_id`,`reservation_date`);--> statement-breakpoint
CREATE INDEX `idx_rb_res_table_date` ON `rb_reservations` (`table_id`,`reservation_date`);--> statement-breakpoint
CREATE INDEX `idx_rb_res_tenant_date_status` ON `rb_reservations` (`tenant_id`,`reservation_date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_rb_res_tenant_status` ON `rb_reservations` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_rbtg_session` ON `rb_table_guests` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_rbts_table` ON `rb_table_sessions` (`table_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_rb_table_status` ON `rb_tables` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_re_clients_agent` ON `re_clients` (`assigned_agent_id`);--> statement-breakpoint
CREATE INDEX `idx_re_clients_tenant` ON `re_clients` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_re_clients_type` ON `re_clients` (`tenant_id`,`client_type`);--> statement-breakpoint
CREATE INDEX `idx_re_con_client` ON `re_contracts` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_re_con_end` ON `re_contracts` (`end_date`);--> statement-breakpoint
CREATE INDEX `idx_re_con_property` ON `re_contracts` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_re_con_status` ON `re_contracts` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_re_con_tenant` ON `re_contracts` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_re_con_type` ON `re_contracts` (`tenant_id`,`contract_type`);--> statement-breakpoint
CREATE INDEX `idx_re_act_lead` ON `re_lead_activities` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_re_act_sched` ON `re_lead_activities` (`tenant_id`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `idx_re_act_tenant` ON `re_lead_activities` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_re_leads_agent` ON `re_leads` (`assigned_agent_id`);--> statement-breakpoint
CREATE INDEX `idx_re_leads_prop` ON `re_leads` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_re_leads_stage` ON `re_leads` (`tenant_id`,`stage`);--> statement-breakpoint
CREATE INDEX `idx_re_leads_tenant` ON `re_leads` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_re_maint_priority` ON `re_maintenances` (`tenant_id`,`priority`);--> statement-breakpoint
CREATE INDEX `idx_re_maint_property` ON `re_maintenances` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_re_maint_status` ON `re_maintenances` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_re_maint_tenant` ON `re_maintenances` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_re_owners_tenant` ON `re_owners` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_re_prop_agent` ON `re_properties` (`assigned_agent_id`);--> statement-breakpoint
CREATE INDEX `idx_re_prop_featured` ON `re_properties` (`tenant_id`,`is_featured`);--> statement-breakpoint
CREATE INDEX `idx_re_prop_op` ON `re_properties` (`tenant_id`,`operation_type`);--> statement-breakpoint
CREATE INDEX `idx_re_prop_owner` ON `re_properties` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_re_prop_published` ON `re_properties` (`tenant_id`,`is_published`);--> statement-breakpoint
CREATE INDEX `idx_re_prop_status` ON `re_properties` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_re_prop_type` ON `re_properties` (`tenant_id`,`property_type`);--> statement-breakpoint
CREATE INDEX `idx_re_feat_prop` ON `re_property_features` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_re_media_prop` ON `re_property_media` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_re_media_type` ON `re_property_media` (`property_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `idx_re_pay_contract` ON `re_rent_payments` (`contract_id`);--> statement-breakpoint
CREATE INDEX `idx_re_pay_due` ON `re_rent_payments` (`due_date`);--> statement-breakpoint
CREATE INDEX `idx_re_pay_period` ON `re_rent_payments` (`contract_id`,`period_year`,`period_month`);--> statement-breakpoint
CREATE INDEX `idx_re_pay_status` ON `re_rent_payments` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_re_vis_agent` ON `re_visits` (`assigned_agent_id`);--> statement-breakpoint
CREATE INDEX `idx_re_vis_date` ON `re_visits` (`tenant_id`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `idx_re_vis_property` ON `re_visits` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_re_vis_status` ON `re_visits` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_re_vis_tenant` ON `re_visits` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_rt_expires` ON `refresh_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_rt_user` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_rt_user_valid` ON `refresh_tokens` (`user_id`,`revoked_at`,`expires_at`);--> statement-breakpoint
CREATE INDEX `tenant_id` ON `refresh_tokens` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_product` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_sale` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_sale_items_tenant` ON `sale_items` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_sale_items_tenant_product` ON `sale_items` (`tenant_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `idx_si_variant` ON `sale_items` (`variant_id`);--> statement-breakpoint
CREATE INDEX `customer_id` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_created` ON `sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_invoice` ON `sales` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `idx_sale_tenant` ON `sales` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_credit_status` ON `sales` (`credit_status`);--> statement-breakpoint
CREATE INDEX `idx_sales_due_date` ON `sales` (`due_date`);--> statement-breakpoint
CREATE INDEX `idx_sales_payment_method` ON `sales` (`payment_method`);--> statement-breakpoint
CREATE INDEX `idx_sales_sede_id` ON `sales` (`sede_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_synced` ON `sales` (`synced`);--> statement-breakpoint
CREATE INDEX `idx_sales_tenant_customer` ON `sales` (`tenant_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tenant_date` ON `sales` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sales_tenant_status_date` ON `sales` (`tenant_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sales_vehicle` ON `sales` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `sales` (`status`);--> statement-breakpoint
CREATE INDEX `seller_id` ON `sales` (`seller_id`);--> statement-breakpoint
CREATE INDEX `idx_sc_window` ON `seasonal_challenges` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_sedes_tenant` ON `sedes` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_availability_day` ON `service_availability` (`service_id`,`day_of_week`);--> statement-breakpoint
CREATE INDEX `idx_availability_service` ON `service_availability` (`service_id`);--> statement-breakpoint
CREATE INDEX `tenant_id` ON `service_availability` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_blocked_service_date` ON `service_blocked_periods` (`service_id`,`blocked_date`);--> statement-breakpoint
CREATE INDEX `idx_blocked_tenant_date` ON `service_blocked_periods` (`tenant_id`,`blocked_date`);--> statement-breakpoint
CREATE INDEX `idx_bookings_date` ON `service_bookings` (`tenant_id`,`booking_date`);--> statement-breakpoint
CREATE INDEX `idx_bookings_service` ON `service_bookings` (`service_id`);--> statement-breakpoint
CREATE INDEX `idx_bookings_status` ON `service_bookings` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_bookings_tenant` ON `service_bookings` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_bookings_tenant_date` ON `service_bookings` (`tenant_id`,`booking_date`);--> statement-breakpoint
CREATE INDEX `idx_services_published` ON `services` (`tenant_id`,`is_published`);--> statement-breakpoint
CREATE INDEX `idx_services_tenant` ON `services` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_services_type` ON `services` (`service_type`);--> statement-breakpoint
CREATE INDEX `idx_bonus_emp` ON `shift_employee_bonuses` (`shift_emp_id`);--> statement-breakpoint
CREATE INDEX `idx_bonus_session` ON `shift_employee_bonuses` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_shiftemp_session` ON `shift_employees` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_shiftemp_tenant` ON `shift_employees` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_created` ON `stock_movements` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_stock_product` ON `stock_movements` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_tenant` ON `stock_movements` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_tenant_date` ON `stock_movements` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_stock_type` ON `stock_movements` (`type`);--> statement-breakpoint
CREATE INDEX `user_id` ON `stock_movements` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_banner_tenant_pos` ON `store_banners` (`tenant_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_custom_section_tenant` ON `store_custom_sections` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `product_id` ON `store_drop_products` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_drop_tenant_active` ON `store_drops` (`tenant_id`,`is_active`,`ends_at`);--> statement-breakpoint
CREATE INDEX `product_id` ON `store_featured_products` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_store_municipality` ON `store_info` (`municipality`);--> statement-breakpoint
CREATE INDEX `idx_location_tenant` ON `store_locations` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_location_zone` ON `store_locations` (`zone`);--> statement-breakpoint
CREATE INDEX `idx_order_item_order` ON `storefront_order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_soi_variant` ON `storefront_order_items` (`variant_id`);--> statement-breakpoint
CREATE INDEX `product_id` ON `storefront_order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_order_client` ON `storefront_orders` (`client_user_id`);--> statement-breakpoint
CREATE INDEX `idx_order_created` ON `storefront_orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_order_dispatch_status` ON `storefront_orders` (`dispatch_status`);--> statement-breakpoint
CREATE INDEX `idx_order_driver` ON `storefront_orders` (`delivery_driver_id`);--> statement-breakpoint
CREATE INDEX `idx_order_number` ON `storefront_orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `idx_order_tenant` ON `storefront_orders` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_order_tenant_date` ON `storefront_orders` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_order_tenant_status` ON `storefront_orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_order_vehicle` ON `storefront_orders` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `idx_sp_product` ON `supplier_products` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_sp_supplier` ON `supplier_products` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_sp_supplier_product` ON `supplier_products` (`supplier_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `idx_supplier_active` ON `suppliers` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_supplier_name` ON `suppliers` (`name`);--> statement-breakpoint
CREATE INDEX `idx_supplier_tenant` ON `suppliers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_tenant_slug` ON `tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tenant_status` ON `tenants` (`status`);--> statement-breakpoint
CREATE INDEX `idx_t4fleet_tenant` ON `theme4_fleet` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_t4proj_tenant` ON `theme4_projects` (`tenant_id`,`is_active`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_t4routes_tenant` ON `theme4_routes` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_t4svc_tenant` ON `theme4_services` (`tenant_id`,`is_active`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_t4stats_tenant` ON `theme4_stats` (`tenant_id`,`is_active`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_t4steps_tenant` ON `theme4_steps` (`tenant_id`,`is_active`,`step_number`);--> statement-breakpoint
CREATE INDEX `idx_t4team_tenant` ON `theme4_team` (`tenant_id`,`is_active`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_t4test_tenant` ON `theme4_testimonials` (`tenant_id`,`is_active`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_trbk_ref` ON `trainer_bookings` (`wompi_reference`);--> statement-breakpoint
CREATE INDEX `idx_trbk_trainer` ON `trainer_bookings` (`trainer_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_trbk_user` ON `trainer_bookings` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `offer_id` ON `trainer_bookings` (`offer_id`);--> statement-breakpoint
CREATE INDEX `booking_id` ON `trainer_commissions` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_trcomm_trainer` ON `trainer_commissions` (`trainer_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_troffer_trainer` ON `trainer_offers` (`trainer_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_trrev_trainer` ON `trainer_reviews` (`trainer_id`);--> statement-breakpoint
CREATE INDEX `idx_trwd_trainer` ON `trainer_withdrawals` (`trainer_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tr_status` ON `trainers` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ua_user` ON `user_addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_google_id` ON `users` (`google_id`);--> statement-breakpoint
CREATE INDEX `idx_users_active` ON `users` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_tenant` ON `users` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_vpt_tenant` ON `variant_price_tiers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_vpt_variant` ON `variant_price_tiers` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_vpt_variant_minqty` ON `variant_price_tiers` (`variant_id`,`tenant_id`,`min_qty`);--> statement-breakpoint
CREATE INDEX `idx_vkr_user` ON `vault_key_redemptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_vk_status` ON `vault_keys` (`status`);--> statement-breakpoint
CREATE INDEX `idx_wr_area` ON `waste_records` (`area`);--> statement-breakpoint
CREATE INDEX `idx_wr_product` ON `waste_records` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_wr_tenant_date` ON `waste_records` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_wtx_context` ON `wompi_transactions` (`context`,`context_id`);--> statement-breakpoint
CREATE INDEX `idx_wtx_status` ON `wompi_transactions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_wtx_tenant` ON `wompi_transactions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_wo_mat_order` ON `work_order_materials` (`work_order_id`);--> statement-breakpoint
CREATE INDEX `tenant_id` ON `work_order_materials` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_wo_pay_order` ON `work_order_payments` (`work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_wo_pay_tenant` ON `work_order_payments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `received_by` ON `work_order_payments` (`received_by`);--> statement-breakpoint
CREATE INDEX `assigned_to` ON `work_orders` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `created_by` ON `work_orders` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_wo_customer` ON `work_orders` (`tenant_id`,`customer_name`);--> statement-breakpoint
CREATE INDEX `idx_wo_promised` ON `work_orders` (`tenant_id`,`promised_at`);--> statement-breakpoint
CREATE INDEX `idx_wo_tenant_status` ON `work_orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_we_session` ON `workout_exercises` (`session_id`,`exercise_order`);--> statement-breakpoint
CREATE INDEX `idx_we_user_ex` ON `workout_exercises` (`user_id`,`exercise_id`);--> statement-breakpoint
CREATE INDEX `idx_ws_user` ON `workout_sessions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_ws_user_created` ON `workout_sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_wset_exercise` ON `workout_sets` (`exercise_session_id`,`set_number`);--> statement-breakpoint
CREATE ALGORITHM = undefined
SQL SECURITY definer
VIEW `v_customer_balances` AS (select `c`.`id` AS `customer_id`,`c`.`tenant_id` AS `tenant_id`,`c`.`cedula` AS `cedula`,`c`.`name` AS `customer_name`,`c`.`phone` AS `phone`,`c`.`email` AS `email`,`c`.`address` AS `address`,`c`.`credit_limit` AS `credit_limit`,`c`.`notes` AS `notes`,coalesce(`s_agg`.`total_credit`,0) AS `total_credit`,coalesce(`cp_agg`.`total_paid`,0) AS `total_paid`,(coalesce(`s_agg`.`total_credit`,0) - coalesce(`cp_agg`.`total_paid`,0)) AS `balance`,`c`.`created_at` AS `created_at`,`c`.`updated_at` AS `updated_at` from ((`customers` `c` left join (select `sales`.`customer_id` AS `customer_id`,sum(`sales`.`total`) AS `total_credit` from `sales` where ((`sales`.`payment_method` = 'fiado') and (`sales`.`status` = 'completada')) group by `sales`.`customer_id`) `s_agg` on((`s_agg`.`customer_id` = `c`.`id`))) left join (select `credit_payments`.`customer_id` AS `customer_id`,sum(`credit_payments`.`amount`) AS `total_paid` from `credit_payments` group by `credit_payments`.`customer_id`) `cp_agg` on((`cp_agg`.`customer_id` = `c`.`id`))));--> statement-breakpoint
CREATE ALGORITHM = undefined
SQL SECURITY definer
VIEW `v_products_expiring_soon` AS (select `p`.`id` AS `id`,`p`.`tenant_id` AS `tenant_id`,`p`.`name` AS `name`,`p`.`articulo` AS `articulo`,`p`.`category` AS `category`,`p`.`product_type` AS `product_type`,`p`.`brand` AS `brand`,`p`.`model` AS `model`,`p`.`description` AS `description`,`p`.`purchase_price` AS `purchase_price`,`p`.`sale_price` AS `sale_price`,`p`.`sku` AS `sku`,`p`.`barcode` AS `barcode`,`p`.`stock` AS `stock`,`p`.`reorder_point` AS `reorder_point`,`p`.`supplier` AS `supplier`,`p`.`supplier_id` AS `supplier_id`,`p`.`entry_date` AS `entry_date`,`p`.`image_url` AS `image_url`,`p`.`image_urls` AS `image_urls`,`p`.`location_in_store` AS `location_in_store`,`p`.`notes` AS `notes`,`p`.`tags` AS `tags`,`p`.`expiry_date` AS `expiry_date`,`p`.`batch_number` AS `batch_number`,`p`.`net_weight` AS `net_weight`,`p`.`weight_unit` AS `weight_unit`,`p`.`sanitary_registration` AS `sanitary_registration`,`p`.`storage_temperature` AS `storage_temperature`,`p`.`ingredients` AS `ingredients`,`p`.`nutritional_info` AS `nutritional_info`,`p`.`alcohol_content` AS `alcohol_content`,`p`.`allergens` AS `allergens`,`p`.`size` AS `size`,`p`.`color` AS `color`,`p`.`material` AS `material`,`p`.`gender` AS `gender`,`p`.`season` AS `season`,`p`.`garment_type` AS `garment_type`,`p`.`washing_instructions` AS `washing_instructions`,`p`.`country_of_origin` AS `country_of_origin`,`p`.`serial_number` AS `serial_number`,`p`.`warranty_months` AS `warranty_months`,`p`.`technical_specs` AS `technical_specs`,`p`.`voltage` AS `voltage`,`p`.`power_watts` AS `power_watts`,`p`.`compatibility` AS `compatibility`,`p`.`includes_accessories` AS `includes_accessories`,`p`.`product_condition` AS `product_condition`,`p`.`active_ingredient` AS `active_ingredient`,`p`.`concentration` AS `concentration`,`p`.`requires_prescription` AS `requires_prescription`,`p`.`administration_route` AS `administration_route`,`p`.`presentation` AS `presentation`,`p`.`units_per_package` AS `units_per_package`,`p`.`laboratory` AS `laboratory`,`p`.`contraindications` AS `contraindications`,`p`.`dimensions` AS `dimensions`,`p`.`weight` AS `weight`,`p`.`hardware_weight_unit` AS `hardware_weight_unit`,`p`.`caliber` AS `caliber`,`p`.`resistance` AS `resistance`,`p`.`finish` AS `finish`,`p`.`recommended_use` AS `recommended_use`,`p`.`author` AS `author`,`p`.`publisher` AS `publisher`,`p`.`isbn` AS `isbn`,`p`.`pages` AS `pages`,`p`.`language` AS `language`,`p`.`publication_year` AS `publication_year`,`p`.`edition` AS `edition`,`p`.`book_format` AS `book_format`,`p`.`recommended_age` AS `recommended_age`,`p`.`number_of_players` AS `number_of_players`,`p`.`game_type` AS `game_type`,`p`.`requires_batteries` AS `requires_batteries`,`p`.`package_dimensions` AS `package_dimensions`,`p`.`package_contents` AS `package_contents`,`p`.`safety_warnings` AS `safety_warnings`,`p`.`published_in_store` AS `published_in_store`,`p`.`available_for_delivery` AS `available_for_delivery`,`p`.`delivery_type` AS `delivery_type`,`p`.`is_new_launch` AS `is_new_launch`,`p`.`launch_date` AS `launch_date`,`p`.`is_preorder` AS `is_preorder`,`p`.`preorder_window_end` AS `preorder_window_end`,`p`.`preorder_ship_start` AS `preorder_ship_start`,`p`.`preorder_ship_end` AS `preorder_ship_end`,`p`.`preorder_badge_text` AS `preorder_badge_text`,`p`.`preorder_policy_text` AS `preorder_policy_text`,`p`.`is_on_offer` AS `is_on_offer`,`p`.`offer_price` AS `offer_price`,`p`.`offer_label` AS `offer_label`,`p`.`offer_start` AS `offer_start`,`p`.`offer_end` AS `offer_end`,`p`.`sede_id` AS `sede_id`,`p`.`created_at` AS `created_at`,`p`.`updated_at` AS `updated_at`,`p`.`created_by` AS `created_by`,`p`.`updated_by` AS `updated_by`,`p`.`is_menu_item` AS `is_menu_item`,`p`.`is_ingredient` AS `is_ingredient`,`p`.`preparation_area` AS `preparation_area`,`p`.`prep_time_minutes` AS `prep_time_minutes`,`p`.`available_in_menu` AS `available_in_menu`,`p`.`qty_promo` AS `qty_promo`,`p`.`images` AS `images`,`p`.`horma_id` AS `horma_id`,`p`.`base_price` AS `base_price`,`c`.`name` AS `category_name`,(to_days(`p`.`expiry_date`) - to_days(curdate())) AS `days_until_expiry` from (`products` `p` left join `categories` `c` on(((`p`.`category` = `c`.`id`) and (`p`.`tenant_id` = `c`.`tenant_id`)))) where ((`p`.`expiry_date` is not null) and (`p`.`expiry_date` <= (curdate() + interval 30 day)) and (`p`.`expiry_date` >= curdate())) order by `p`.`expiry_date`);--> statement-breakpoint
CREATE ALGORITHM = undefined
SQL SECURITY definer
VIEW `v_products_low_stock` AS (select `p`.`id` AS `id`,`p`.`tenant_id` AS `tenant_id`,`p`.`name` AS `name`,`p`.`articulo` AS `articulo`,`p`.`category` AS `category`,`p`.`product_type` AS `product_type`,`p`.`brand` AS `brand`,`p`.`model` AS `model`,`p`.`description` AS `description`,`p`.`purchase_price` AS `purchase_price`,`p`.`sale_price` AS `sale_price`,`p`.`sku` AS `sku`,`p`.`barcode` AS `barcode`,`p`.`stock` AS `stock`,`p`.`reorder_point` AS `reorder_point`,`p`.`supplier` AS `supplier`,`p`.`supplier_id` AS `supplier_id`,`p`.`entry_date` AS `entry_date`,`p`.`image_url` AS `image_url`,`p`.`image_urls` AS `image_urls`,`p`.`location_in_store` AS `location_in_store`,`p`.`notes` AS `notes`,`p`.`tags` AS `tags`,`p`.`expiry_date` AS `expiry_date`,`p`.`batch_number` AS `batch_number`,`p`.`net_weight` AS `net_weight`,`p`.`weight_unit` AS `weight_unit`,`p`.`sanitary_registration` AS `sanitary_registration`,`p`.`storage_temperature` AS `storage_temperature`,`p`.`ingredients` AS `ingredients`,`p`.`nutritional_info` AS `nutritional_info`,`p`.`alcohol_content` AS `alcohol_content`,`p`.`allergens` AS `allergens`,`p`.`size` AS `size`,`p`.`color` AS `color`,`p`.`material` AS `material`,`p`.`gender` AS `gender`,`p`.`season` AS `season`,`p`.`garment_type` AS `garment_type`,`p`.`washing_instructions` AS `washing_instructions`,`p`.`country_of_origin` AS `country_of_origin`,`p`.`serial_number` AS `serial_number`,`p`.`warranty_months` AS `warranty_months`,`p`.`technical_specs` AS `technical_specs`,`p`.`voltage` AS `voltage`,`p`.`power_watts` AS `power_watts`,`p`.`compatibility` AS `compatibility`,`p`.`includes_accessories` AS `includes_accessories`,`p`.`product_condition` AS `product_condition`,`p`.`active_ingredient` AS `active_ingredient`,`p`.`concentration` AS `concentration`,`p`.`requires_prescription` AS `requires_prescription`,`p`.`administration_route` AS `administration_route`,`p`.`presentation` AS `presentation`,`p`.`units_per_package` AS `units_per_package`,`p`.`laboratory` AS `laboratory`,`p`.`contraindications` AS `contraindications`,`p`.`dimensions` AS `dimensions`,`p`.`weight` AS `weight`,`p`.`hardware_weight_unit` AS `hardware_weight_unit`,`p`.`caliber` AS `caliber`,`p`.`resistance` AS `resistance`,`p`.`finish` AS `finish`,`p`.`recommended_use` AS `recommended_use`,`p`.`author` AS `author`,`p`.`publisher` AS `publisher`,`p`.`isbn` AS `isbn`,`p`.`pages` AS `pages`,`p`.`language` AS `language`,`p`.`publication_year` AS `publication_year`,`p`.`edition` AS `edition`,`p`.`book_format` AS `book_format`,`p`.`recommended_age` AS `recommended_age`,`p`.`number_of_players` AS `number_of_players`,`p`.`game_type` AS `game_type`,`p`.`requires_batteries` AS `requires_batteries`,`p`.`package_dimensions` AS `package_dimensions`,`p`.`package_contents` AS `package_contents`,`p`.`safety_warnings` AS `safety_warnings`,`p`.`published_in_store` AS `published_in_store`,`p`.`available_for_delivery` AS `available_for_delivery`,`p`.`delivery_type` AS `delivery_type`,`p`.`is_new_launch` AS `is_new_launch`,`p`.`launch_date` AS `launch_date`,`p`.`is_preorder` AS `is_preorder`,`p`.`preorder_window_end` AS `preorder_window_end`,`p`.`preorder_ship_start` AS `preorder_ship_start`,`p`.`preorder_ship_end` AS `preorder_ship_end`,`p`.`preorder_badge_text` AS `preorder_badge_text`,`p`.`preorder_policy_text` AS `preorder_policy_text`,`p`.`is_on_offer` AS `is_on_offer`,`p`.`offer_price` AS `offer_price`,`p`.`offer_label` AS `offer_label`,`p`.`offer_start` AS `offer_start`,`p`.`offer_end` AS `offer_end`,`p`.`sede_id` AS `sede_id`,`p`.`created_at` AS `created_at`,`p`.`updated_at` AS `updated_at`,`p`.`created_by` AS `created_by`,`p`.`updated_by` AS `updated_by`,`p`.`is_menu_item` AS `is_menu_item`,`p`.`is_ingredient` AS `is_ingredient`,`p`.`preparation_area` AS `preparation_area`,`p`.`prep_time_minutes` AS `prep_time_minutes`,`p`.`available_in_menu` AS `available_in_menu`,`p`.`qty_promo` AS `qty_promo`,`p`.`images` AS `images`,`p`.`horma_id` AS `horma_id`,`p`.`base_price` AS `base_price`,`c`.`name` AS `category_name` from (`products` `p` left join `categories` `c` on(((`p`.`category` = `c`.`id`) and (`p`.`tenant_id` = `c`.`tenant_id`)))) where ((`p`.`stock` <= `p`.`reorder_point`) and (`p`.`stock` >= 0)) order by (`p`.`stock` - `p`.`reorder_point`));--> statement-breakpoint
CREATE ALGORITHM = undefined
SQL SECURITY definer
VIEW `v_products_stock_status` AS (select `p`.`id` AS `id`,`p`.`tenant_id` AS `tenant_id`,`p`.`name` AS `name`,`p`.`articulo` AS `articulo`,`p`.`category` AS `category`,`p`.`product_type` AS `product_type`,`p`.`brand` AS `brand`,`p`.`model` AS `model`,`p`.`description` AS `description`,`p`.`purchase_price` AS `purchase_price`,`p`.`sale_price` AS `sale_price`,`p`.`sku` AS `sku`,`p`.`barcode` AS `barcode`,`p`.`stock` AS `stock`,`p`.`reorder_point` AS `reorder_point`,`p`.`supplier` AS `supplier`,`p`.`supplier_id` AS `supplier_id`,`p`.`entry_date` AS `entry_date`,`p`.`image_url` AS `image_url`,`p`.`image_urls` AS `image_urls`,`p`.`location_in_store` AS `location_in_store`,`p`.`notes` AS `notes`,`p`.`tags` AS `tags`,`p`.`expiry_date` AS `expiry_date`,`p`.`batch_number` AS `batch_number`,`p`.`net_weight` AS `net_weight`,`p`.`weight_unit` AS `weight_unit`,`p`.`sanitary_registration` AS `sanitary_registration`,`p`.`storage_temperature` AS `storage_temperature`,`p`.`ingredients` AS `ingredients`,`p`.`nutritional_info` AS `nutritional_info`,`p`.`alcohol_content` AS `alcohol_content`,`p`.`allergens` AS `allergens`,`p`.`size` AS `size`,`p`.`color` AS `color`,`p`.`material` AS `material`,`p`.`gender` AS `gender`,`p`.`season` AS `season`,`p`.`garment_type` AS `garment_type`,`p`.`washing_instructions` AS `washing_instructions`,`p`.`country_of_origin` AS `country_of_origin`,`p`.`serial_number` AS `serial_number`,`p`.`warranty_months` AS `warranty_months`,`p`.`technical_specs` AS `technical_specs`,`p`.`voltage` AS `voltage`,`p`.`power_watts` AS `power_watts`,`p`.`compatibility` AS `compatibility`,`p`.`includes_accessories` AS `includes_accessories`,`p`.`product_condition` AS `product_condition`,`p`.`active_ingredient` AS `active_ingredient`,`p`.`concentration` AS `concentration`,`p`.`requires_prescription` AS `requires_prescription`,`p`.`administration_route` AS `administration_route`,`p`.`presentation` AS `presentation`,`p`.`units_per_package` AS `units_per_package`,`p`.`laboratory` AS `laboratory`,`p`.`contraindications` AS `contraindications`,`p`.`dimensions` AS `dimensions`,`p`.`weight` AS `weight`,`p`.`hardware_weight_unit` AS `hardware_weight_unit`,`p`.`caliber` AS `caliber`,`p`.`resistance` AS `resistance`,`p`.`finish` AS `finish`,`p`.`recommended_use` AS `recommended_use`,`p`.`author` AS `author`,`p`.`publisher` AS `publisher`,`p`.`isbn` AS `isbn`,`p`.`pages` AS `pages`,`p`.`language` AS `language`,`p`.`publication_year` AS `publication_year`,`p`.`edition` AS `edition`,`p`.`book_format` AS `book_format`,`p`.`recommended_age` AS `recommended_age`,`p`.`number_of_players` AS `number_of_players`,`p`.`game_type` AS `game_type`,`p`.`requires_batteries` AS `requires_batteries`,`p`.`package_dimensions` AS `package_dimensions`,`p`.`package_contents` AS `package_contents`,`p`.`safety_warnings` AS `safety_warnings`,`p`.`published_in_store` AS `published_in_store`,`p`.`available_for_delivery` AS `available_for_delivery`,`p`.`delivery_type` AS `delivery_type`,`p`.`is_new_launch` AS `is_new_launch`,`p`.`launch_date` AS `launch_date`,`p`.`is_preorder` AS `is_preorder`,`p`.`preorder_window_end` AS `preorder_window_end`,`p`.`preorder_ship_start` AS `preorder_ship_start`,`p`.`preorder_ship_end` AS `preorder_ship_end`,`p`.`preorder_badge_text` AS `preorder_badge_text`,`p`.`preorder_policy_text` AS `preorder_policy_text`,`p`.`is_on_offer` AS `is_on_offer`,`p`.`offer_price` AS `offer_price`,`p`.`offer_label` AS `offer_label`,`p`.`offer_start` AS `offer_start`,`p`.`offer_end` AS `offer_end`,`p`.`sede_id` AS `sede_id`,`p`.`created_at` AS `created_at`,`p`.`updated_at` AS `updated_at`,`p`.`created_by` AS `created_by`,`p`.`updated_by` AS `updated_by`,`p`.`is_menu_item` AS `is_menu_item`,`p`.`is_ingredient` AS `is_ingredient`,`p`.`preparation_area` AS `preparation_area`,`p`.`prep_time_minutes` AS `prep_time_minutes`,`p`.`available_in_menu` AS `available_in_menu`,`p`.`qty_promo` AS `qty_promo`,`p`.`images` AS `images`,`p`.`horma_id` AS `horma_id`,`p`.`base_price` AS `base_price`,(case when (`p`.`stock` = 0) then 'agotado' when (`p`.`stock` <= `p`.`reorder_point`) then 'bajo' else 'suficiente' end) AS `stock_status` from `products` `p`);--> statement-breakpoint
CREATE ALGORITHM = undefined
SQL SECURITY definer
VIEW `v_sales_detail` AS (select `s`.`id` AS `id`,`s`.`tenant_id` AS `tenant_id`,`s`.`invoice_number` AS `invoice_number`,`s`.`customer_id` AS `customer_id`,`s`.`customer_name` AS `customer_name`,`s`.`customer_phone` AS `customer_phone`,`s`.`customer_email` AS `customer_email`,`s`.`subtotal` AS `subtotal`,`s`.`tax` AS `tax`,`s`.`discount` AS `discount`,`s`.`total` AS `total`,`s`.`payment_method` AS `payment_method`,`s`.`amount_paid` AS `amount_paid`,`s`.`change_amount` AS `change_amount`,`s`.`seller_id` AS `seller_id`,`s`.`seller_name` AS `seller_name`,`s`.`cash_session_id` AS `cash_session_id`,`s`.`status` AS `status`,`s`.`credit_status` AS `credit_status`,`s`.`due_date` AS `due_date`,`s`.`notes` AS `notes`,`s`.`mixed_efectivo_amount` AS `mixed_efectivo_amount`,`s`.`mixed_second_method` AS `mixed_second_method`,`s`.`mixed_second_amount` AS `mixed_second_amount`,`s`.`sede_id` AS `sede_id`,`s`.`vehicle_id` AS `vehicle_id`,`s`.`dispatch_status` AS `dispatch_status`,`s`.`total_weight_kg` AS `total_weight_kg`,`s`.`synced` AS `synced`,`s`.`synced_at` AS `synced_at`,`s`.`origin` AS `origin`,`s`.`created_at` AS `created_at`,`s`.`updated_at` AS `updated_at`,`s`.`dispatch_notes` AS `dispatch_notes`,`s`.`dispatched_at` AS `dispatched_at`,count(`si`.`id`) AS `total_items`,sum(`si`.`quantity`) AS `total_quantity` from (`sales` `s` left join `sale_items` `si` on((`s`.`id` = `si`.`sale_id`))) group by `s`.`id`);--> statement-breakpoint
CREATE ALGORITHM = undefined
SQL SECURITY definer
VIEW `v_tenants_summary` AS (select `t`.`id` AS `tenant_id`,`t`.`name` AS `tenant_name`,`t`.`slug` AS `slug`,`t`.`business_type` AS `business_type`,`t`.`status` AS `status`,`t`.`plan` AS `plan`,`t`.`created_at` AS `created_at`,`u`.`name` AS `owner_name`,`u`.`email` AS `owner_email`,coalesce(`usr_agg`.`total_users`,0) AS `total_users`,coalesce(`prod_agg`.`total_products`,0) AS `total_products`,coalesce(`prod_agg`.`inventory_value`,0) AS `inventory_value`,coalesce(`cust_agg`.`total_customers`,0) AS `total_customers`,coalesce(`sale_agg`.`total_sales_count`,0) AS `total_sales_count`,coalesce(`sale_agg`.`total_sales_amount`,0) AS `total_sales_amount` from (((((`tenants` `t` left join `users` `u` on((`t`.`owner_id` = `u`.`id`))) left join (select `users`.`tenant_id` AS `tenant_id`,count(0) AS `total_users` from `users` group by `users`.`tenant_id`) `usr_agg` on((`usr_agg`.`tenant_id` = `t`.`id`))) left join (select `products`.`tenant_id` AS `tenant_id`,count(0) AS `total_products`,sum((`products`.`stock` * `products`.`sale_price`)) AS `inventory_value` from `products` group by `products`.`tenant_id`) `prod_agg` on((`prod_agg`.`tenant_id` = `t`.`id`))) left join (select `customers`.`tenant_id` AS `tenant_id`,count(0) AS `total_customers` from `customers` group by `customers`.`tenant_id`) `cust_agg` on((`cust_agg`.`tenant_id` = `t`.`id`))) left join (select `sales`.`tenant_id` AS `tenant_id`,count(0) AS `total_sales_count`,sum(`sales`.`total`) AS `total_sales_amount` from `sales` where (`sales`.`status` = 'completada') group by `sales`.`tenant_id`) `sale_agg` on((`sale_agg`.`tenant_id` = `t`.`id`))));
