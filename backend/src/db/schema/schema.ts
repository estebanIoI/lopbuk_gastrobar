import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, foreignKey, primaryKey, unique, varchar, mysqlEnum, decimal, tinyint, timestamp, text, int, json, bigint, mediumtext, date, datetime, smallint, check, time, longtext, mysqlView } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const affiliateCampaigns = mysqlTable("affiliate_campaigns", {
	id: varchar({ length: 36 }).notNull(),
	affiliateId: varchar("affiliate_id", { length: 36 }).notNull().references(() => affiliates.id, { onDelete: "cascade" } ),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	entityType: mysqlEnum("entity_type", ['store','product','event','service']).default('store').notNull(),
	entityId: varchar("entity_id", { length: 36 }),
	refToken: varchar("ref_token", { length: 100 }).notNull(),
	discountCode: varchar("discount_code", { length: 50 }),
	discountPct: decimal("discount_pct", { precision: 5, scale: 2 }).default('0.00').notNull(),
	commissionPct: decimal("commission_pct", { precision: 5, scale: 2 }).notNull(),
	cookieDays: tinyint("cookie_days").default(7).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxCampaignAffiliate: index("idx_campaign_affiliate").on(table.affiliateId),
		idxCampaignTenant: index("idx_campaign_tenant").on(table.tenantId),
		affiliateCampaignsId: primaryKey({ columns: [table.id], name: "affiliate_campaigns_id"}),
		idxCampaignCode: unique("idx_campaign_code").on(table.discountCode),
		idxCampaignRef: unique("idx_campaign_ref").on(table.refToken),
	}
});

export const affiliateCommissions = mysqlTable("affiliate_commissions", {
	id: varchar({ length: 36 }).notNull(),
	affiliateId: varchar("affiliate_id", { length: 36 }).notNull().references(() => affiliates.id, { onDelete: "cascade" } ),
	conversionId: varchar("conversion_id", { length: 36 }),
	type: mysqlEnum(['conversion','mission_bonus','tier_bonus','package']).notNull(),
	amountCop: decimal("amount_cop", { precision: 14, scale: 2 }).notNull(),
	status: mysqlEnum(['pending','approved','paid']).default('pending').notNull(),
	note: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCommAffiliate: index("idx_comm_affiliate").on(table.affiliateId, table.status),
		idxCommConversion: index("idx_comm_conversion").on(table.conversionId),
		affiliateCommissionsId: primaryKey({ columns: [table.id], name: "affiliate_commissions_id"}),
	}
});

export const affiliateConversions = mysqlTable("affiliate_conversions", {
	id: varchar({ length: 36 }).notNull(),
	campaignId: varchar("campaign_id", { length: 36 }).notNull().references(() => affiliateCampaigns.id, { onDelete: "cascade" } ),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	orderId: varchar("order_id", { length: 36 }),
	saleId: varchar("sale_id", { length: 36 }),
	method: mysqlEnum(['link','code']).notNull(),
	orderTotalCop: decimal("order_total_cop", { precision: 14, scale: 2 }).notNull(),
	commissionCop: decimal("commission_cop", { precision: 14, scale: 2 }).notNull(),
	status: mysqlEnum(['pending','approved','paid','rejected']).default('pending').notNull(),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxConvCampaign: index("idx_conv_campaign").on(table.campaignId),
		idxConvOrder: index("idx_conv_order").on(table.orderId),
		idxConvSale: index("idx_conv_sale").on(table.saleId),
		idxConvStatus: index("idx_conv_status").on(table.status),
		idxConvTenant: index("idx_conv_tenant").on(table.tenantId),
		affiliateConversionsId: primaryKey({ columns: [table.id], name: "affiliate_conversions_id"}),
	}
});

export const affiliateMissionSubmissions = mysqlTable("affiliate_mission_submissions", {
	id: varchar({ length: 36 }).notNull(),
	missionId: varchar("mission_id", { length: 36 }).notNull().references(() => affiliateMissions.id, { onDelete: "cascade" } ),
	affiliateId: varchar("affiliate_id", { length: 36 }).notNull().references(() => affiliates.id, { onDelete: "cascade" } ),
	contentUrl: varchar("content_url", { length: 800 }).notNull(),
	status: mysqlEnum(['submitted','approved','rejected']).default('submitted').notNull(),
	reviewedBy: varchar("reviewed_by", { length: 36 }),
	reviewNote: text("review_note"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxSubmissionAffiliate: index("idx_submission_affiliate").on(table.affiliateId),
		idxSubmissionMission: index("idx_submission_mission").on(table.missionId, table.status),
		affiliateMissionSubmissionsId: primaryKey({ columns: [table.id], name: "affiliate_mission_submissions_id"}),
	}
});

export const affiliateMissions = mysqlTable("affiliate_missions", {
	id: varchar({ length: 36 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	rewardCop: decimal("reward_cop", { precision: 14, scale: 2 }).notNull(),
	requiredViews: int("required_views"),
	minTier: mysqlEnum("min_tier", ['bronze','silver','gold']).default('bronze').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxMissionActive: index("idx_mission_active").on(table.isActive),
		affiliateMissionsId: primaryKey({ columns: [table.id], name: "affiliate_missions_id"}),
	}
});

export const affiliatePackageOrders = mysqlTable("affiliate_package_orders", {
	id: varchar({ length: 36 }).notNull(),
	packageId: varchar("package_id", { length: 36 }).notNull().references(() => affiliatePackages.id, { onDelete: "restrict" } ),
	affiliateId: varchar("affiliate_id", { length: 36 }).notNull().references(() => affiliates.id, { onDelete: "cascade" } ),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	entityType: mysqlEnum("entity_type", ['store','event','service']).default('store').notNull(),
	entityId: varchar("entity_id", { length: 36 }),
	status: mysqlEnum(['pending_payment','paid','in_progress','completed','cancelled']).default('pending_payment').notNull(),
	totalCop: decimal("total_cop", { precision: 14, scale: 2 }).notNull(),
	affiliateCop: decimal("affiliate_cop", { precision: 14, scale: 2 }).notNull(),
	platformCop: decimal("platform_cop", { precision: 14, scale: 2 }).notNull(),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	contentDeadline: timestamp("content_deadline", { mode: 'string' }),
	contentDelivered: json("content_delivered"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxPkgorderAffiliate: index("idx_pkgorder_affiliate").on(table.affiliateId, table.status),
		idxPkgorderTenant: index("idx_pkgorder_tenant").on(table.tenantId, table.status),
		packageId: index("package_id").on(table.packageId),
		affiliatePackageOrdersId: primaryKey({ columns: [table.id], name: "affiliate_package_orders_id"}),
	}
});

export const affiliatePackages = mysqlTable("affiliate_packages", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	deliverables: json(),
	priceCop: decimal("price_cop", { precision: 14, scale: 2 }).notNull(),
	affiliatePct: decimal("affiliate_pct", { precision: 5, scale: 2 }).notNull(),
	platformPct: decimal("platform_pct", { precision: 5, scale: 2 }).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxAffpkgActive: index("idx_affpkg_active").on(table.isActive),
		affiliatePackagesId: primaryKey({ columns: [table.id], name: "affiliate_packages_id"}),
	}
});

export const affiliateWithdrawals = mysqlTable("affiliate_withdrawals", {
	id: varchar({ length: 36 }).notNull(),
	affiliateId: varchar("affiliate_id", { length: 36 }).notNull().references(() => affiliates.id, { onDelete: "cascade" } ),
	amountCop: decimal("amount_cop", { precision: 14, scale: 2 }).notNull(),
	paymentMethod: varchar("payment_method", { length: 100 }).notNull(),
	status: mysqlEnum(['requested','processing','paid','rejected']).default('requested').notNull(),
	processedBy: varchar("processed_by", { length: 36 }),
	note: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxWithdrawAffiliate: index("idx_withdraw_affiliate").on(table.affiliateId, table.status),
		affiliateWithdrawalsId: primaryKey({ columns: [table.id], name: "affiliate_withdrawals_id"}),
	}
});

export const affiliates = mysqlTable("affiliates", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 50 }),
	handle: varchar({ length: 100 }),
	tier: mysqlEnum(['bronze','silver','gold']).default('bronze').notNull(),
	balanceCop: decimal("balance_cop", { precision: 14, scale: 2 }).default('0.00').notNull(),
	pendingCop: decimal("pending_cop", { precision: 14, scale: 2 }).default('0.00').notNull(),
	monthlySales: int("monthly_sales").default(0).notNull(),
	status: mysqlEnum(['active','suspended']).default('active').notNull(),
	passwordHash: varchar("password_hash", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxAffStatus: index("idx_aff_status").on(table.status),
		affiliatesId: primaryKey({ columns: [table.id], name: "affiliates_id"}),
		idxAffEmail: unique("idx_aff_email").on(table.email),
		idxAffHandle: unique("idx_aff_handle").on(table.handle),
	}
});

export const agentActions = mysqlTable("agent_actions", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	sessionId: varchar("session_id", { length: 36 }),
	channel: mysqlEnum(['chat','whatsapp','voice','web']).default('chat').notNull(),
	toolName: varchar("tool_name", { length: 100 }).notNull(),
	toolInput: json("tool_input"),
	toolOutput: json("tool_output"),
	success: tinyint().default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxAgentActionsCreated: index("idx_agent_actions_created").on(table.tenantId, table.createdAt),
		idxAgentActionsSession: index("idx_agent_actions_session").on(table.sessionId),
		idxAgentActionsTenant: index("idx_agent_actions_tenant").on(table.tenantId),
		idxAgentActionsTool: index("idx_agent_actions_tool").on(table.tenantId, table.toolName),
		agentActionsId: primaryKey({ columns: [table.id], name: "agent_actions_id"}),
	}
});

export const aiUsageLog = mysqlTable("ai_usage_log", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }),
	provider: varchar({ length: 20 }).notNull(),
	model: varchar({ length: 80 }),
	tier: varchar({ length: 16 }),
	promptTokens: int("prompt_tokens").default(0).notNull(),
	completionTokens: int("completion_tokens").default(0).notNull(),
	totalTokens: int("total_tokens").default(0).notNull(),
	estCost: decimal("est_cost", { precision: 12, scale: 6 }).default('0.000000').notNull(),
	ok: tinyint().default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxAulCreated: index("idx_aul_created").on(table.createdAt),
		idxAulProvider: index("idx_aul_provider").on(table.provider),
		aiUsageLogId: primaryKey({ columns: [table.id], name: "ai_usage_log_id"}),
	}
});

export const aiVisionCache = mysqlTable("ai_vision_cache", {
	hash: varchar({ length: 64 }).notNull(),
	text: mediumtext().notNull(),
	provider: varchar({ length: 20 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		aiVisionCacheHash: primaryKey({ columns: [table.hash], name: "ai_vision_cache_hash"}),
	}
});

export const arenaFeed = mysqlTable("arena_feed", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	kind: mysqlEnum(['post','progress','achievement','challenge','milestone']).default('post').notNull(),
	body: varchar({ length: 500 }),
	photoUrl: varchar("photo_url", { length: 800 }),
	metadata: json(),
	likes: int().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	commentsCount: int("comments_count").default(0).notNull(),
},
(table) => {
	return {
		idxAfCreated: index("idx_af_created").on(table.createdAt),
		idxAfUser: index("idx_af_user").on(table.userId, table.createdAt),
		arenaFeedId: primaryKey({ columns: [table.id], name: "arena_feed_id"}),
	}
});

export const arenaFeedComments = mysqlTable("arena_feed_comments", {
	id: varchar({ length: 36 }).notNull(),
	feedId: varchar("feed_id", { length: 36 }).notNull().references(() => arenaFeed.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	body: varchar({ length: 400 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxAfcFeed: index("idx_afc_feed").on(table.feedId, table.createdAt),
		arenaFeedCommentsId: primaryKey({ columns: [table.id], name: "arena_feed_comments_id"}),
	}
});

export const arenaFeedLikes = mysqlTable("arena_feed_likes", {
	id: varchar({ length: 36 }).notNull(),
	feedId: varchar("feed_id", { length: 36 }).notNull().references(() => arenaFeed.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		arenaFeedLikesId: primaryKey({ columns: [table.id], name: "arena_feed_likes_id"}),
		idxAflUnique: unique("idx_afl_unique").on(table.feedId, table.userId),
	}
});

export const auditLog = mysqlTable("audit_log", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "set null" } ),
	userId: varchar("user_id", { length: 36 }),
	userEmail: varchar("user_email", { length: 255 }),
	action: varchar({ length: 100 }).notNull(),
	severity: mysqlEnum(['info','warning','critical']).default('info').notNull(),
	entityType: varchar("entity_type", { length: 50 }),
	entityId: varchar("entity_id", { length: 36 }),
	details: json(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 500 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxAuditAction: index("idx_audit_action").on(table.action),
		idxAuditDate: index("idx_audit_date").on(table.createdAt),
		idxAuditEntity: index("idx_audit_entity").on(table.entityType, table.entityId),
		idxAuditSeverity: index("idx_audit_severity").on(table.severity),
		idxAuditTenant: index("idx_audit_tenant").on(table.tenantId),
		idxAuditTenantAction: index("idx_audit_tenant_action").on(table.tenantId, table.action),
		idxAuditTenantDate: index("idx_audit_tenant_date").on(table.tenantId, table.createdAt),
		idxAuditUser: index("idx_audit_user").on(table.userId),
		auditLogId: primaryKey({ columns: [table.id], name: "audit_log_id"}),
	}
});

export const cartillaActividadOpciones = mysqlTable("cartilla_actividad_opciones", {
	id: varchar({ length: 36 }).notNull(),
	actividadId: varchar("actividad_id", { length: 36 }).notNull().references(() => cartillaActividades.id, { onDelete: "cascade" } ),
	texto: varchar({ length: 255 }).notNull(),
	orden: int().default(0),
},
(table) => {
	return {
		actividadId: index("actividad_id").on(table.actividadId),
		cartillaActividadOpcionesId: primaryKey({ columns: [table.id], name: "cartilla_actividad_opciones_id"}),
	}
});

export const cartillaActividadOrdenar = mysqlTable("cartilla_actividad_ordenar", {
	id: varchar({ length: 36 }).notNull(),
	actividadId: varchar("actividad_id", { length: 36 }).notNull().references(() => cartillaActividades.id, { onDelete: "cascade" } ),
	fragmento: varchar({ length: 500 }).notNull(),
	ordenCorrecto: int("orden_correcto").notNull(),
},
(table) => {
	return {
		actividadId: index("actividad_id").on(table.actividadId),
		cartillaActividadOrdenarId: primaryKey({ columns: [table.id], name: "cartilla_actividad_ordenar_id"}),
	}
});

export const cartillaActividadPares = mysqlTable("cartilla_actividad_pares", {
	id: varchar({ length: 36 }).notNull(),
	actividadId: varchar("actividad_id", { length: 36 }).notNull().references(() => cartillaActividades.id, { onDelete: "cascade" } ),
	inga: varchar({ length: 255 }).notNull(),
	espanol: varchar({ length: 255 }).notNull(),
},
(table) => {
	return {
		actividadId: index("actividad_id").on(table.actividadId),
		cartillaActividadParesId: primaryKey({ columns: [table.id], name: "cartilla_actividad_pares_id"}),
	}
});

export const cartillaActividadVf = mysqlTable("cartilla_actividad_vf", {
	id: varchar({ length: 36 }).notNull(),
	actividadId: varchar("actividad_id", { length: 36 }).notNull().references(() => cartillaActividades.id, { onDelete: "cascade" } ),
	enunciado: text().notNull(),
	esVerdadero: tinyint("es_verdadero").notNull(),
	orden: int().default(0),
},
(table) => {
	return {
		actividadId: index("actividad_id").on(table.actividadId),
		cartillaActividadVfId: primaryKey({ columns: [table.id], name: "cartilla_actividad_vf_id"}),
	}
});

export const cartillaActividades = mysqlTable("cartilla_actividades", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	moduloId: varchar("modulo_id", { length: 36 }).notNull().references(() => cartillaModulos.id, { onDelete: "cascade" } ),
	tipo: mysqlEnum(['completar','emparejar','verdadero_falso','ordenar']).notNull(),
	pregunta: text().notNull(),
	respuestaCorrecta: varchar("respuesta_correcta", { length: 255 }),
	orden: int().default(0),
},
(table) => {
	return {
		idxActModulo: index("idx_act_modulo").on(table.moduloId),
		cartillaActividadesId: primaryKey({ columns: [table.id], name: "cartilla_actividades_id"}),
	}
});

export const cartillaComentarios = mysqlTable("cartilla_comentarios", {
	id: varchar({ length: 36 }).notNull(),
	publicacionId: varchar("publicacion_id", { length: 36 }).notNull().references(() => cartillaPublicaciones.id, { onDelete: "cascade" } ),
	usuarioId: varchar("usuario_id", { length: 36 }).notNull(),
	contenido: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		publicacionId: index("publicacion_id").on(table.publicacionId),
		cartillaComentariosId: primaryKey({ columns: [table.id], name: "cartilla_comentarios_id"}),
	}
});

export const cartillaCompras = mysqlTable("cartilla_compras", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	cartillaId: varchar("cartilla_id", { length: 36 }).notNull().references(() => cartillas.id, { onDelete: "cascade" } ),
	usuarioId: varchar("usuario_id", { length: 36 }),
	precio: decimal({ precision: 10, scale: 2 }).default('0.00').notNull(),
	moneda: varchar({ length: 8 }).default('COP').notNull(),
	estado: mysqlEnum(['gratis','pendiente','pagado','reembolsado']).default('pendiente').notNull(),
	metodo: mysqlEnum(['gratis','stripe','credito','efectivo','manual','wompi']).default('manual').notNull(),
	referencia: varchar({ length: 255 }),
	// Compra como invitado (sin cuenta): datos del comprador + token público para
	// recuperar el estado y las descargas en la pantalla de éxito tras pagar por Wompi.
	guestNombre: varchar("guest_nombre", { length: 120 }),
	guestEmail: varchar("guest_email", { length: 160 }),
	guestTelefono: varchar("guest_telefono", { length: 40 }),
	token: varchar({ length: 64 }),
	pagadoEn: timestamp("pagado_en", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxCompraCartilla: index("idx_compra_cartilla").on(table.cartillaId),
		idxCompraTenant: index("idx_compra_tenant").on(table.tenantId),
		idxCompraToken: index("idx_compra_token").on(table.token),
		cartillaComprasId: primaryKey({ columns: [table.id], name: "cartilla_compras_id"}),
		uqCompraUsuarioCartilla: unique("uq_compra_usuario_cartilla").on(table.usuarioId, table.cartillaId),
	}
});

export const cartillaModuloAudios = mysqlTable("cartilla_modulo_audios", {
	id: varchar({ length: 36 }).notNull(),
	moduloId: varchar("modulo_id", { length: 36 }).notNull().references(() => cartillaModulos.id, { onDelete: "cascade" } ),
	titulo: varchar({ length: 255 }).notNull(),
	url: varchar({ length: 500 }).notNull(),
	descripcion: text(),
	orden: int().default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		moduloId: index("modulo_id").on(table.moduloId),
		cartillaModuloAudiosId: primaryKey({ columns: [table.id], name: "cartilla_modulo_audios_id"}),
	}
});

export const cartillaModuloImagenes = mysqlTable("cartilla_modulo_imagenes", {
	id: varchar({ length: 36 }).notNull(),
	moduloId: varchar("modulo_id", { length: 36 }).notNull().references(() => cartillaModulos.id, { onDelete: "cascade" } ),
	url: varchar({ length: 500 }).notNull(),
	alt: varchar({ length: 255 }),
	caption: text(),
	orden: int().default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		moduloId: index("modulo_id").on(table.moduloId),
		cartillaModuloImagenesId: primaryKey({ columns: [table.id], name: "cartilla_modulo_imagenes_id"}),
	}
});

export const cartillaModuloSecciones = mysqlTable("cartilla_modulo_secciones", {
	id: varchar({ length: 36 }).notNull(),
	moduloId: varchar("modulo_id", { length: 36 }).notNull().references(() => cartillaModulos.id, { onDelete: "cascade" } ),
	titulo: varchar({ length: 255 }).notNull(),
	contenido: text(),
	tipo: mysqlEnum(['texto','vocabulario','cultural','pronunciacion','gramatica']).default('texto'),
	orden: int().default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		moduloId: index("modulo_id").on(table.moduloId),
		cartillaModuloSeccionesId: primaryKey({ columns: [table.id], name: "cartilla_modulo_secciones_id"}),
	}
});

export const cartillaModulos = mysqlTable("cartilla_modulos", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	cartillaId: varchar("cartilla_id", { length: 36 }).notNull().references(() => cartillas.id, { onDelete: "cascade" } ),
	clave: varchar({ length: 60 }).notNull(),
	titulo: varchar({ length: 160 }).notNull(),
	icono: varchar({ length: 40 }).default('Book').notNull(),
	color: mysqlEnum(['emerald','green','amber','purple','pink']).default('emerald').notNull(),
	descripcion: text(),
	videoUrl: varchar("video_url", { length: 500 }),
	frase: varchar({ length: 255 }),
	traduccion: varchar({ length: 255 }),
	orden: int().default(0),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxModuloCartilla: index("idx_modulo_cartilla").on(table.cartillaId),
		idxModuloTenant: index("idx_modulo_tenant").on(table.tenantId),
		cartillaModulosId: primaryKey({ columns: [table.id], name: "cartilla_modulos_id"}),
		uqModuloCartillaClave: unique("uq_modulo_cartilla_clave").on(table.cartillaId, table.clave),
	}
});

export const cartillaProgreso = mysqlTable("cartilla_progreso", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	usuarioId: varchar("usuario_id", { length: 36 }).notNull(),
	cartillaId: varchar("cartilla_id", { length: 36 }).notNull().references(() => cartillas.id, { onDelete: "cascade" } ),
	puntos: int().default(0),
	diasSeguidos: int("dias_seguidos").default(0),
	palabrasAprendidas: int("palabras_aprendidas").default(0),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	ultimoAcceso: date("ultimo_acceso", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxProgresoCartilla: index("idx_progreso_cartilla").on(table.cartillaId),
		cartillaProgresoId: primaryKey({ columns: [table.id], name: "cartilla_progreso_id"}),
		uqProgresoUsuarioCartilla: unique("uq_progreso_usuario_cartilla").on(table.usuarioId, table.cartillaId),
	}
});

export const cartillaPublicacionLikes = mysqlTable("cartilla_publicacion_likes", {
	id: varchar({ length: 36 }).notNull(),
	publicacionId: varchar("publicacion_id", { length: 36 }).notNull().references(() => cartillaPublicaciones.id, { onDelete: "cascade" } ),
	usuarioId: varchar("usuario_id", { length: 36 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		cartillaPublicacionLikesId: primaryKey({ columns: [table.id], name: "cartilla_publicacion_likes_id"}),
		uqPubLike: unique("uq_pub_like").on(table.publicacionId, table.usuarioId),
	}
});

export const cartillaPublicaciones = mysqlTable("cartilla_publicaciones", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	cartillaId: varchar("cartilla_id", { length: 36 }),
	usuarioId: varchar("usuario_id", { length: 36 }).notNull(),
	contenido: text().notNull(),
	likes: int().default(0),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxPubCartilla: index("idx_pub_cartilla").on(table.cartillaId),
		idxPubTenant: index("idx_pub_tenant").on(table.tenantId),
		cartillaPublicacionesId: primaryKey({ columns: [table.id], name: "cartilla_publicaciones_id"}),
	}
});

export const cartillaRetos = mysqlTable("cartilla_retos", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	cartillaId: varchar("cartilla_id", { length: 36 }),
	titulo: varchar({ length: 150 }).notNull(),
	descripcion: text().notNull(),
	puntos: int().default(0).notNull(),
	dificultad: mysqlEnum(['facil','medio','dificil']).default('facil').notNull(),
	categoria: mysqlEnum(['vocabulario','conversacion','modulo','comunidad']).notNull(),
	meta: int().default(1),
	activo: tinyint().default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxRetoCartilla: index("idx_reto_cartilla").on(table.cartillaId),
		idxRetoTenant: index("idx_reto_tenant").on(table.tenantId),
		cartillaRetosId: primaryKey({ columns: [table.id], name: "cartilla_retos_id"}),
	}
});

export const cartillaUsuarioModulos = mysqlTable("cartilla_usuario_modulos", {
	id: varchar({ length: 36 }).notNull(),
	usuarioId: varchar("usuario_id", { length: 36 }).notNull(),
	moduloId: varchar("modulo_id", { length: 36 }).notNull().references(() => cartillaModulos.id, { onDelete: "cascade" } ),
	completado: tinyint().default(0),
	puntosObtenidos: int("puntos_obtenidos").default(0),
	completadoEn: timestamp("completado_en", { mode: 'string' }),
},
(table) => {
	return {
		moduloId: index("modulo_id").on(table.moduloId),
		cartillaUsuarioModulosId: primaryKey({ columns: [table.id], name: "cartilla_usuario_modulos_id"}),
		uqUsuarioModulo: unique("uq_usuario_modulo").on(table.usuarioId, table.moduloId),
	}
});

export const cartillaUsuarioRespuestas = mysqlTable("cartilla_usuario_respuestas", {
	id: varchar({ length: 36 }).notNull(),
	usuarioId: varchar("usuario_id", { length: 36 }).notNull(),
	actividadId: varchar("actividad_id", { length: 36 }).notNull().references(() => cartillaActividades.id, { onDelete: "cascade" } ),
	respuesta: varchar({ length: 255 }).notNull(),
	esCorrecta: tinyint("es_correcta").notNull(),
	puntosObtenidos: int("puntos_obtenidos").default(0),
	respondidoEn: timestamp("respondido_en", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		actividadId: index("actividad_id").on(table.actividadId),
		cartillaUsuarioRespuestasId: primaryKey({ columns: [table.id], name: "cartilla_usuario_respuestas_id"}),
	}
});

export const cartillaUsuarioRetos = mysqlTable("cartilla_usuario_retos", {
	id: varchar({ length: 36 }).notNull(),
	usuarioId: varchar("usuario_id", { length: 36 }).notNull(),
	retoId: varchar("reto_id", { length: 36 }).notNull().references(() => cartillaRetos.id, { onDelete: "cascade" } ),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	fecha: date({ mode: 'string' }).notNull(),
	completado: tinyint().default(0),
	actual: int().default(0),
	progreso: int().default(0),
	completadoEn: timestamp("completado_en", { mode: 'string' }),
},
(table) => {
	return {
		retoId: index("reto_id").on(table.retoId),
		cartillaUsuarioRetosId: primaryKey({ columns: [table.id], name: "cartilla_usuario_retos_id"}),
		uqUsuarioRetoFecha: unique("uq_usuario_reto_fecha").on(table.usuarioId, table.retoId, table.fecha),
	}
});

export const cartillaVocabulario = mysqlTable("cartilla_vocabulario", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	cartillaId: varchar("cartilla_id", { length: 36 }).references(() => cartillas.id, { onDelete: "cascade" } ),
	moduloId: varchar("modulo_id", { length: 36 }),
	espanol: varchar({ length: 200 }).notNull(),
	inga: varchar({ length: 200 }).notNull(),
	categoria: varchar({ length: 50 }).default('general'),
	notas: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxVocabCartilla: index("idx_vocab_cartilla").on(table.cartillaId),
		idxVocabTenant: index("idx_vocab_tenant").on(table.tenantId),
		cartillaVocabularioId: primaryKey({ columns: [table.id], name: "cartilla_vocabulario_id"}),
	}
});

export const cartillas = mysqlTable("cartillas", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	slug: varchar({ length: 120 }).notNull(),
	titulo: varchar({ length: 160 }).notNull(),
	tipo: mysqlEnum(['cartilla','libro','curso']).default('cartilla').notNull(),
	descripcion: text(),
	portadaUrl: varchar("portada_url", { length: 500 }),
	color: mysqlEnum(['emerald','green','amber','purple','pink']).default('emerald').notNull(),
	autor: varchar({ length: 160 }),
	idioma: varchar({ length: 60 }).default('Inga'),
	nivel: varchar({ length: 60 }),
	frase: varchar({ length: 255 }),
	traduccion: varchar({ length: 255 }),
	esGratis: tinyint("es_gratis").default(1).notNull(),
	precio: decimal({ precision: 10, scale: 2 }).default('0.00').notNull(),
	moneda: varchar({ length: 8 }).default('COP').notNull(),
	publicado: tinyint().default(0).notNull(),
	destacado: tinyint().default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxCartillaPublicado: index("idx_cartilla_publicado").on(table.publicado, table.isActive),
		idxCartillaTenant: index("idx_cartilla_tenant").on(table.tenantId),
		cartillasId: primaryKey({ columns: [table.id], name: "cartillas_id"}),
		uqCartillaTenantSlug: unique("uq_cartilla_tenant_slug").on(table.tenantId, table.slug),
	}
});

// Archivos descargables adjuntos a una cartilla / producto digital (PDF, Excel, ZIP, TXT, MD…).
// El acceso se gatea según es_gratis / compra del usuario (Fase C).
export const cartillaArchivos = mysqlTable("cartilla_archivos", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	cartillaId: varchar("cartilla_id", { length: 36 }).notNull(),
	nombre: varchar({ length: 200 }).notNull(),
	url: varchar({ length: 500 }).notNull(),
	tipo: varchar({ length: 30 }),
	sizeBytes: int("size_bytes"),
	sortOrder: int("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCaCartilla: index("idx_ca_cartilla").on(table.cartillaId),
		cartillaArchivosId: primaryKey({ columns: [table.id], name: "cartilla_archivos_id"}),
	}
});

export const cashMovements = mysqlTable("cash_movements", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	sessionId: varchar("session_id", { length: 36 }).notNull().references(() => cashSessions.id, { onDelete: "restrict" } ),
	type: mysqlEnum(['entrada','salida']).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	reason: varchar({ length: 255 }).notNull(),
	notes: text(),
	createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id, { onDelete: "restrict" } ),
	createdByName: varchar("created_by_name", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		createdBy: index("created_by").on(table.createdBy),
		idxCashMovementSession: index("idx_cash_movement_session").on(table.sessionId),
		idxCashMovementTenant: index("idx_cash_movement_tenant").on(table.tenantId),
		cashMovementsId: primaryKey({ columns: [table.id], name: "cash_movements_id"}),
	}
});

export const cashSessions = mysqlTable("cash_sessions", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	openedBy: varchar("opened_by", { length: 36 }).notNull().references(() => users.id, { onDelete: "restrict" } ),
	openedByName: varchar("opened_by_name", { length: 255 }).notNull(),
	openingAmount: decimal("opening_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	openedAt: timestamp("opened_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	closedBy: varchar("closed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	closedByName: varchar("closed_by_name", { length: 255 }),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	totalCashSales: decimal("total_cash_sales", { precision: 12, scale: 2 }).default('0.00'),
	totalCardSales: decimal("total_card_sales", { precision: 12, scale: 2 }).default('0.00'),
	totalTransferSales: decimal("total_transfer_sales", { precision: 12, scale: 2 }).default('0.00'),
	totalFiadoSales: decimal("total_fiado_sales", { precision: 12, scale: 2 }).default('0.00'),
	totalSalesCount: int("total_sales_count").default(0),
	totalChangeGiven: decimal("total_change_given", { precision: 12, scale: 2 }).default('0.00'),
	totalCashEntries: decimal("total_cash_entries", { precision: 12, scale: 2 }).default('0.00'),
	totalCashWithdrawals: decimal("total_cash_withdrawals", { precision: 12, scale: 2 }).default('0.00'),
	totalCreditPaymentsEfectivo: decimal("total_credit_payments_efectivo", { precision: 12, scale: 2 }).default('0.00'),
	totalCreditPaymentsTarjeta: decimal("total_credit_payments_tarjeta", { precision: 12, scale: 2 }).default('0.00'),
	totalCreditPaymentsTransfer: decimal("total_credit_payments_transfer", { precision: 12, scale: 2 }).default('0.00'),
	expectedCash: decimal("expected_cash", { precision: 12, scale: 2 }),
	actualCash: decimal("actual_cash", { precision: 12, scale: 2 }),
	difference: decimal({ precision: 12, scale: 2 }),
	status: mysqlEnum(['abierta','cerrada']).default('abierta').notNull(),
	closingStatus: mysqlEnum("closing_status", ['cuadrado','sobrante','faltante']),
	observations: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	shiftType: mysqlEnum("shift_type", ['ma??ana','tarde','unico']).default('unico').notNull(),
	shiftLabel: varchar("shift_label", { length: 50 }),
},
(table) => {
	return {
		closedBy: index("closed_by").on(table.closedBy),
		idxCashSessionOpened: index("idx_cash_session_opened").on(table.openedAt),
		idxCashSessionStatus: index("idx_cash_session_status").on(table.status),
		idxCashSessionTenant: index("idx_cash_session_tenant").on(table.tenantId),
		openedBy: index("opened_by").on(table.openedBy),
		cashSessionsId: primaryKey({ columns: [table.id], name: "cash_sessions_id"}),
	}
});

export const categories = mysqlTable("categories", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 100 }).notNull(),
	description: varchar({ length: 255 }),
	imageUrl: varchar("image_url", { length: 500 }),
	hiddenInStore: tinyint("hidden_in_store").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	color: varchar({ length: 7 }),
	sortOrder: int("sort_order").default(0).notNull(),
},
(table) => {
	return {
		idxCategoryTenant: index("idx_category_tenant").on(table.tenantId),
		categoriesTenantIdId: primaryKey({ columns: [table.tenantId, table.id], name: "categories_tenant_id_id"}),
		idxCategoryTenantName: unique("idx_category_tenant_name").on(table.tenantId, table.name),
	}
});

export const challengeParticipants = mysqlTable("challenge_participants", {
	id: varchar({ length: 36 }).notNull(),
	challengeId: varchar("challenge_id", { length: 36 }).notNull().references(() => seasonalChallenges.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	joinedAt: timestamp("joined_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCpUser: index("idx_cp_user").on(table.userId),
		challengeParticipantsId: primaryKey({ columns: [table.id], name: "challenge_participants_id"}),
		idxCpUnique: unique("idx_cp_unique").on(table.challengeId, table.userId),
	}
});

export const chatbotConfig = mysqlTable("chatbot_config", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	isEnabled: tinyint("is_enabled").default(0).notNull(),
	botName: varchar("bot_name", { length: 100 }).default('Asistente').notNull(),
	botAvatarUrl: varchar("bot_avatar_url", { length: 500 }),
	systemPrompt: text("system_prompt"),
	businessInfo: text("business_info"),
	faqs: text(),
	tone: mysqlEnum(['profesional','amigable','formal','casual']).default('amigable').notNull(),
	notifyEmail: tinyint("notify_email").default(1).notNull(),
	notifyWhatsapp: tinyint("notify_whatsapp").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	whatsappEnabled: tinyint("whatsapp_enabled").default(0).notNull(),
	whatsappNumber: varchar("whatsapp_number", { length: 50 }),
	evolutionInstance: varchar("evolution_instance", { length: 100 }),
	agentTools: json("agent_tools"),
	workingHours: json("working_hours"),
	accentColor: varchar("accent_color", { length: 20 }).default('#f59e0b'),
},
(table) => {
	return {
		idxChatbotTenant: index("idx_chatbot_tenant").on(table.tenantId),
		chatbotConfigId: primaryKey({ columns: [table.id], name: "chatbot_config_id"}),
		tenantId: unique("tenant_id").on(table.tenantId),
	}
});

export const chatbotMessages = mysqlTable("chatbot_messages", {
	id: int().autoincrement().notNull(),
	sessionId: varchar("session_id", { length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	role: mysqlEnum(['user','assistant']).notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxMsgSession: index("idx_msg_session").on(table.sessionId),
		idxMsgTenant: index("idx_msg_tenant").on(table.tenantId),
		chatbotMessagesId: primaryKey({ columns: [table.id], name: "chatbot_messages_id"}),
	}
});

export const chatbotSessions = mysqlTable("chatbot_sessions", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	sessionToken: varchar("session_token", { length: 100 }).notNull(),
	customerName: varchar("customer_name", { length: 255 }),
	customerPhone: varchar("customer_phone", { length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	lastActivity: timestamp("last_activity", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	humanTakeover: tinyint("human_takeover").default(0).notNull(),
	channel: mysqlEnum(['web','whatsapp','voice','api']).default('web').notNull(),
},
(table) => {
	return {
		idxSessionTenant: index("idx_session_tenant").on(table.tenantId),
		chatbotSessionsId: primaryKey({ columns: [table.id], name: "chatbot_sessions_id"}),
		idxSessionToken: unique("idx_session_token").on(table.sessionToken),
	}
});

export const coachFeedEntries = mysqlTable("coach_feed_entries", {
	id: varchar({ length: 36 }).notNull(),
	bookingId: varchar("booking_id", { length: 36 }).notNull().references(() => trainerBookings.id, { onDelete: "cascade" } ),
	author: mysqlEnum(['coach','user']).notNull(),
	kind: mysqlEnum(['feedback','checkin','adjustment','audio','photo','task','announcement','reply']).default('feedback').notNull(),
	body: text(),
	mediaUrl: varchar("media_url", { length: 800 }),
	metadata: json(),
	isRead: tinyint("is_read").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCfeBooking: index("idx_cfe_booking").on(table.bookingId, table.createdAt),
		coachFeedEntriesId: primaryKey({ columns: [table.id], name: "coach_feed_entries_id"}),
	}
});

export const communityComments = mysqlTable("community_comments", {
	id: varchar({ length: 36 }).notNull(),
	postId: varchar("post_id", { length: 36 }).notNull().references(() => communityPosts.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }),
	body: text().notNull(),
	parentId: varchar("parent_id", { length: 36 }),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	authorName: varchar("author_name", { length: 160 }),
},
(table) => {
	return {
		idxCommentParent: index("idx_comment_parent").on(table.parentId),
		idxCommentPost: index("idx_comment_post").on(table.postId, table.isActive, table.createdAt),
		communityCommentsId: primaryKey({ columns: [table.id], name: "community_comments_id"}),
	}
});

export const communityPostAds = mysqlTable("community_post_ads", {
	id: varchar({ length: 36 }).notNull(),
	postId: varchar("post_id", { length: 36 }).notNull().references(() => communityPosts.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	orderIndex: int("order_index").default(0).notNull(),
},
(table) => {
	return {
		idxAdPost: index("idx_ad_post").on(table.postId, table.orderIndex),
		idxAdProduct: index("idx_ad_product").on(table.productId),
		communityPostAdsId: primaryKey({ columns: [table.id], name: "community_post_ads_id"}),
	}
});

export const communityPostMedia = mysqlTable("community_post_media", {
	id: varchar({ length: 36 }).notNull(),
	postId: varchar("post_id", { length: 36 }).notNull().references(() => communityPosts.id, { onDelete: "cascade" } ),
	mediaType: mysqlEnum("media_type", ['image','video','gif']).default('image').notNull(),
	url: varchar({ length: 500 }).notNull(),
	orderIndex: int("order_index").default(0).notNull(),
},
(table) => {
	return {
		idxMediaPost: index("idx_media_post").on(table.postId, table.orderIndex),
		communityPostMediaId: primaryKey({ columns: [table.id], name: "community_post_media_id"}),
	}
});

export const communityPosts = mysqlTable("community_posts", {
	id: varchar({ length: 36 }).notNull(),
	authorId: varchar("author_id", { length: 36 }).notNull(),
	title: varchar({ length: 200 }).notNull(),
	body: text(),
	category: mysqlEnum(['noticia','video','tutorial','app','oferta']).default('noticia').notNull(),
	status: mysqlEnum(['draft','published']).default('draft').notNull(),
	coverUrl: varchar("cover_url", { length: 500 }),
	likesCount: int("likes_count").default(0).notNull(),
	savesCount: int("saves_count").default(0).notNull(),
	commentsCount: int("comments_count").default(0).notNull(),
	sharesCount: int("shares_count").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	publishedAt: timestamp("published_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxPostAuthor: index("idx_post_author").on(table.authorId),
		idxPostCategory: index("idx_post_category").on(table.category),
		idxPostStatus: index("idx_post_status").on(table.status, table.isActive, table.publishedAt),
		communityPostsId: primaryKey({ columns: [table.id], name: "community_posts_id"}),
	}
});

export const communityReactions = mysqlTable("community_reactions", {
	id: varchar({ length: 36 }).notNull(),
	postId: varchar("post_id", { length: 36 }).notNull().references(() => communityPosts.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }),
	deviceId: varchar("device_id", { length: 64 }),
	type: mysqlEnum(['like','save']).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxReactionDevice: index("idx_reaction_device").on(table.deviceId),
		idxReactionPost: index("idx_reaction_post").on(table.postId, table.type),
		communityReactionsId: primaryKey({ columns: [table.id], name: "community_reactions_id"}),
		uqReactDevice: unique("uq_react_device").on(table.postId, table.deviceId, table.type),
		uqReaction: unique("uq_reaction").on(table.postId, table.userId, table.type),
	}
});

export const communitySettings = mysqlTable("community_settings", {
	settingKey: varchar("setting_key", { length: 100 }).notNull(),
	settingValue: text("setting_value"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		communitySettingsSettingKey: primaryKey({ columns: [table.settingKey], name: "community_settings_setting_key"}),
	}
});

export const consumerAccessCodes = mysqlTable("consumer_access_codes", {
	id: varchar({ length: 36 }).notNull(),
	codeHash: varchar("code_hash", { length: 255 }).notNull(),
	codePreview: varchar("code_preview", { length: 30 }).notNull(),
	tier: varchar({ length: 50 }).default('legend').notNull(),
	durationValue: int("duration_value").notNull(),
	durationUnit: mysqlEnum("duration_unit", ['day','month']).default('day').notNull(),
	stackPolicy: mysqlEnum("stack_policy", ['extend','replace','block']).default('extend').notNull(),
	maxRedemptions: int("max_redemptions"),
	redemptions: int().default(0).notNull(),
	validFrom: datetime("valid_from", { mode: 'string'}),
	validUntil: datetime("valid_until", { mode: 'string'}),
	scope: mysqlEnum(['global','tenant']).default('global').notNull(),
	tenantId: varchar("tenant_id", { length: 36 }),
	metadata: json(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxCacActive: index("idx_cac_active").on(table.isActive, table.scope, table.tier),
		consumerAccessCodesId: primaryKey({ columns: [table.id], name: "consumer_access_codes_id"}),
		idxCacHash: unique("idx_cac_hash").on(table.codeHash),
	}
});

export const consumerAccessLedger = mysqlTable("consumer_access_ledger", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	codeId: varchar("code_id", { length: 36 }),
	grantId: varchar("grant_id", { length: 36 }),
	action: mysqlEnum(['redeem','extend','replace','expire','revoke']).notNull(),
	oldExpiresAt: datetime("old_expires_at", { mode: 'string'}),
	newExpiresAt: datetime("new_expires_at", { mode: 'string'}),
	metadata: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCalCode: index("idx_cal_code").on(table.codeId),
		idxCalUser: index("idx_cal_user").on(table.userId, table.createdAt),
		consumerAccessLedgerId: primaryKey({ columns: [table.id], name: "consumer_access_ledger_id"}),
	}
});

export const consumerAchievements = mysqlTable("consumer_achievements", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	achievementCode: varchar("achievement_code", { length: 60 }).notNull(),
	source: varchar({ length: 40 }),
	unlockedAt: timestamp("unlocked_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxAchUser: index("idx_ach_user").on(table.userId),
		consumerAchievementsId: primaryKey({ columns: [table.id], name: "consumer_achievements_id"}),
		idxAchUnique: unique("idx_ach_unique").on(table.userId, table.achievementCode),
	}
});

export const consumerBodyLogs = mysqlTable("consumer_body_logs", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	loggedOn: date("logged_on", { mode: 'string' }).notNull(),
	weightKg: decimal("weight_kg", { precision: 6, scale: 2 }),
	bodyFat: decimal("body_fat", { precision: 5, scale: 2 }),
	measurements: json(),
	photoUrl: varchar("photo_url", { length: 800 }),
	note: varchar({ length: 300 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxBlUser: index("idx_bl_user").on(table.userId, table.loggedOn),
		consumerBodyLogsId: primaryKey({ columns: [table.id], name: "consumer_body_logs_id"}),
		idxBlUnique: unique("idx_bl_unique").on(table.userId, table.loggedOn),
	}
});

export const consumerDailyChecks = mysqlTable("consumer_daily_checks", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	day: date({ mode: 'string' }).notNull(),
	itemKey: varchar("item_key", { length: 30 }).notNull(),
	done: tinyint().default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxDcUser: index("idx_dc_user").on(table.userId, table.day),
		consumerDailyChecksId: primaryKey({ columns: [table.id], name: "consumer_daily_checks_id"}),
		idxDcUnique: unique("idx_dc_unique").on(table.userId, table.day, table.itemKey),
	}
});

export const consumerDiscountRules = mysqlTable("consumer_discount_rules", {
	id: varchar({ length: 36 }).notNull(),
	tier: varchar({ length: 50 }).default('legend').notNull(),
	kind: mysqlEnum(['percent','free_shipping','preventa']).default('percent').notNull(),
	percentOff: decimal("percent_off", { precision: 5, scale: 2 }),
	scope: mysqlEnum(['all','category']).default('all').notNull(),
	category: varchar({ length: 120 }),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCdrTier: index("idx_cdr_tier").on(table.tier, table.isActive),
		consumerDiscountRulesId: primaryKey({ columns: [table.id], name: "consumer_discount_rules_id"}),
	}
});

export const consumerEntitlements = mysqlTable("consumer_entitlements", {
	id: varchar({ length: 36 }).notNull(),
	tier: varchar({ length: 50 }).notNull(),
	entitlementKey: varchar("entitlement_key", { length: 100 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		consumerEntitlementsId: primaryKey({ columns: [table.id], name: "consumer_entitlements_id"}),
		idxCentTierKey: unique("idx_cent_tier_key").on(table.tier, table.entitlementKey),
	}
});

export const consumerEvents = mysqlTable("consumer_events", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }),
	event: varchar({ length: 80 }).notNull(),
	metadata: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCevEvent: index("idx_cev_event").on(table.event, table.createdAt),
		idxCevUser: index("idx_cev_user").on(table.userId, table.createdAt),
		consumerEventsId: primaryKey({ columns: [table.id], name: "consumer_events_id"}),
	}
});

export const consumerPlanGrants = mysqlTable("consumer_plan_grants", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	tier: varchar({ length: 50 }).default('legend').notNull(),
	status: mysqlEnum(['active','expired','revoked']).default('active').notNull(),
	startedAt: datetime("started_at", { mode: 'string'}).notNull(),
	expiresAt: datetime("expires_at", { mode: 'string'}).notNull(),
	sourceLedgerId: varchar("source_ledger_id", { length: 36 }),
	lastCheckedAt: datetime("last_checked_at", { mode: 'string'}),
	metadata: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxCpgUserActive: index("idx_cpg_user_active").on(table.userId, table.status, table.expiresAt),
		consumerPlanGrantsId: primaryKey({ columns: [table.id], name: "consumer_plan_grants_id"}),
	}
});

export const consumerStreakDays = mysqlTable("consumer_streak_days", {
	userId: varchar("user_id", { length: 36 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	day: date({ mode: 'string' }).notNull(),
},
(table) => {
	return {
		consumerStreakDaysUserIdDay: primaryKey({ columns: [table.userId, table.day], name: "consumer_streak_days_user_id_day"}),
	}
});

export const consumerVaultUnlocks = mysqlTable("consumer_vault_unlocks", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	unlockKey: varchar("unlock_key", { length: 80 }).notNull(),
	vaultKeyId: varchar("vault_key_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCvuUser: index("idx_cvu_user").on(table.userId),
		consumerVaultUnlocksId: primaryKey({ columns: [table.id], name: "consumer_vault_unlocks_id"}),
		idxCvuUnique: unique("idx_cvu_unique").on(table.userId, table.unlockKey),
	}
});

export const consumerXpLog = mysqlTable("consumer_xp_log", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	amount: int().notNull(),
	reason: varchar({ length: 40 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxXpUser: index("idx_xp_user").on(table.userId, table.createdAt),
		consumerXpLogId: primaryKey({ columns: [table.id], name: "consumer_xp_log_id"}),
	}
});

export const creditPayments = mysqlTable("credit_payments", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	saleId: varchar("sale_id", { length: 36 }).notNull().references(() => sales.id, { onDelete: "restrict" } ),
	customerId: varchar("customer_id", { length: 36 }).notNull().references(() => customers.id, { onDelete: "restrict" } ),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	paymentMethod: mysqlEnum("payment_method", ['efectivo','tarjeta','transferencia']).notNull(),
	receiptNumber: varchar("receipt_number", { length: 20 }),
	notes: text(),
	receivedBy: varchar("received_by", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCreditPaymentsCustomer: index("idx_credit_payments_customer").on(table.customerId),
		idxCreditPaymentsDate: index("idx_credit_payments_date").on(table.createdAt),
		idxCreditPaymentsSale: index("idx_credit_payments_sale").on(table.saleId),
		idxCreditPaymentsTenant: index("idx_credit_payments_tenant").on(table.tenantId),
		receivedBy: index("received_by").on(table.receivedBy),
		creditPaymentsId: primaryKey({ columns: [table.id], name: "credit_payments_id"}),
	}
});

export const customers = mysqlTable("customers", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	cedula: varchar({ length: 20 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 50 }),
	email: varchar({ length: 255 }),
	address: varchar({ length: 500 }),
	creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }).default('0.00').notNull(),
	notes: text(),
	isActive: tinyint("is_active").default(1).notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	// Ley 1581: marca de derecho al olvido — el registro persiste sin PII para integridad de ventas
	anonymizedAt: timestamp("anonymized_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxCustomerTenant: index("idx_customer_tenant").on(table.tenantId),
		idxCustomersName: index("idx_customers_name").on(table.name),
		customersId: primaryKey({ columns: [table.id], name: "customers_id"}),
		idxCustomerTenantCedula: unique("idx_customer_tenant_cedula").on(table.tenantId, table.cedula),
	}
});

// ── Ley 1581 / RGPD: registro inmutable de consentimientos ─────────────────────
// Solo INSERT: revocar = nuevo registro con granted=0. El último registro por
// (identifier, consent_type) es el estado vigente.
export const consentRecords = mysqlTable("consent_records", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	subjectType: mysqlEnum("subject_type", ['customer','guest','chat_contact']).default('guest').notNull(),
	subjectId: varchar("subject_id", { length: 36 }),
	identifier: varchar({ length: 255 }).notNull(),
	consentType: mysqlEnum("consent_type", ['data_processing','terms','marketing_whatsapp','marketing_email','analytics_tracking']).notNull(),
	granted: tinyint().default(1).notNull(),
	policyVersion: varchar("policy_version", { length: 20 }).default('1.0').notNull(),
	source: mysqlEnum(['checkout','cookie_banner','whatsapp','admin','signup']).notNull(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 500 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxConsentTenantIdentifier: index("idx_consent_tenant_identifier").on(table.tenantId, table.identifier),
		idxConsentTenantType: index("idx_consent_tenant_type").on(table.tenantId, table.consentType),
		consentRecordsId: primaryKey({ columns: [table.id], name: "consent_records_id"}),
	}
});

// ── Ley 1581 arts. 14-15: solicitudes de titulares (acceso, rectificación,
// borrado, revocación). SLA legal: 10 días hábiles → due_at. ───────────────────
export const dataSubjectRequests = mysqlTable("data_subject_requests", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	requestType: mysqlEnum("request_type", ['access','rectify','erase','revoke_consent']).notNull(),
	status: mysqlEnum(['pending','in_progress','completed','denied']).default('pending').notNull(),
	identifier: varchar({ length: 255 }).notNull(),
	requesterName: varchar("requester_name", { length: 255 }).notNull(),
	verificationMethod: varchar("verification_method", { length: 100 }),
	details: text(),
	requestedAt: timestamp("requested_at", { mode: 'string' }).default(sql`(now())`),
	dueAt: timestamp("due_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	handledBy: varchar("handled_by", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	notes: text(),
},
(table) => {
	return {
		idxDsrTenantStatus: index("idx_dsr_tenant_status").on(table.tenantId, table.status),
		idxDsrIdentifier: index("idx_dsr_identifier").on(table.tenantId, table.identifier),
		dataSubjectRequestsId: primaryKey({ columns: [table.id], name: "data_subject_requests_id"}),
	}
});

export const devRequests = mysqlTable("dev_requests", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "restrict" } ),
	tenantName: varchar("tenant_name", { length: 255 }),
	requesterName: varchar("requester_name", { length: 255 }).notNull(),
	title: varchar({ length: 300 }).notNull(),
	description: text().notNull(),
	type: mysqlEnum(['objetivo','mejora','actualizacion','bug','otro']).default('mejora').notNull(),
	priority: mysqlEnum(['baja','media','alta']).default('media').notNull(),
	status: mysqlEnum(['pendiente','en_revision','cotizado','aprobado','en_progreso','completado','rechazado']).default('pendiente').notNull(),
	estimatedHours: decimal("estimated_hours", { precision: 6, scale: 2 }),
	pricePerHour: decimal("price_per_hour", { precision: 10, scale: 2 }),
	totalPrice: decimal("total_price", { precision: 12, scale: 2 }),
	adminNotes: text("admin_notes"),
	rejectionReason: varchar("rejection_reason", { length: 500 }),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxDevReqCreated: index("idx_dev_req_created").on(table.createdAt),
		idxDevReqStatus: index("idx_dev_req_status").on(table.status),
		idxDevReqTenant: index("idx_dev_req_tenant").on(table.tenantId),
		userId: index("user_id").on(table.userId),
		devRequestsId: primaryKey({ columns: [table.id], name: "dev_requests_id"}),
	}
});

export const discountCoupons = mysqlTable("discount_coupons", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	code: varchar({ length: 50 }).notNull(),
	description: varchar({ length: 255 }),
	discountType: mysqlEnum("discount_type", ['porcentaje','fijo']).default('porcentaje').notNull(),
	discountValue: decimal("discount_value", { precision: 12, scale: 2 }).notNull(),
	minPurchase: decimal("min_purchase", { precision: 12, scale: 2 }),
	maxUses: int("max_uses"),
	timesUsed: int("times_used").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxCouponActive: index("idx_coupon_active").on(table.isActive),
		idxCouponTenant: index("idx_coupon_tenant").on(table.tenantId),
		discountCouponsId: primaryKey({ columns: [table.id], name: "discount_coupons_id"}),
		idxCouponTenantCode: unique("idx_coupon_tenant_code").on(table.tenantId, table.code),
	}
});

export const dropClaims = mysqlTable("drop_claims", {
	id: varchar({ length: 36 }).notNull(),
	dropId: varchar("drop_id", { length: 36 }).notNull().references(() => drops.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	status: mysqlEnum(['reserved','converted']).default('reserved').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxDcUser: index("idx_dc_user").on(table.userId),
		dropClaimsId: primaryKey({ columns: [table.id], name: "drop_claims_id"}),
		idxDcUnique: unique("idx_dc_unique").on(table.dropId, table.userId),
	}
});

export const drops = mysqlTable("drops", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }),
	title: varchar({ length: 200 }).notNull(),
	subtitle: varchar({ length: 300 }),
	imageUrl: varchar("image_url", { length: 800 }),
	requiresUnlock: varchar("requires_unlock", { length: 80 }),
	startsAt: datetime("starts_at", { mode: 'string'}).notNull(),
	endsAt: datetime("ends_at", { mode: 'string'}).notNull(),
	totalSlots: int("total_slots").notNull(),
	slotsTaken: int("slots_taken").default(0).notNull(),
	productRef: json("product_ref"),
	status: mysqlEnum(['scheduled','cancelled']).default('scheduled').notNull(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxDropStatus: index("idx_drop_status").on(table.status),
		idxDropWindow: index("idx_drop_window").on(table.startsAt, table.endsAt),
		dropsId: primaryKey({ columns: [table.id], name: "drops_id"}),
	}
});

export const employeeCargos = mysqlTable("employee_cargos", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 100 }).notNull(),
	description: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	permissions: json(),
},
(table) => {
	return {
		idxCargosTenant: index("idx_cargos_tenant").on(table.tenantId),
		employeeCargosId: primaryKey({ columns: [table.id], name: "employee_cargos_id"}),
	}
});

export const employeeNovelties = mysqlTable("employee_novelties", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" } ),
	userName: varchar("user_name", { length: 255 }).notNull(),
	type: mysqlEnum(['vacaciones','permiso_remunerado','permiso_no_remunerado','incapacidad','calamidad','licencia_maternidad','suspension','otro']).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	startDate: date("start_date", { mode: 'string' }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	endDate: date("end_date", { mode: 'string' }).notNull(),
	daysCount: int("days_count").default(1).notNull(),
	deductsSalary: tinyint("deducts_salary").default(0).notNull(),
	deductAmount: decimal("deduct_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	deductsVacation: tinyint("deducts_vacation").default(0).notNull(),
	description: text(),
	attachmentUrl: varchar("attachment_url", { length: 500 }),
	status: mysqlEnum(['pendiente','aprobado','rechazado']).default('pendiente').notNull(),
	rejectionReason: varchar("rejection_reason", { length: 500 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxNoveltiesDate: index("idx_novelties_date").on(table.tenantId, table.startDate),
		idxNoveltiesStatus: index("idx_novelties_status").on(table.tenantId, table.status),
		idxNoveltiesTenant: index("idx_novelties_tenant").on(table.tenantId),
		idxNoveltiesType: index("idx_novelties_type").on(table.tenantId, table.type),
		idxNoveltiesUser: index("idx_novelties_user").on(table.userId),
		employeeNoveltiesId: primaryKey({ columns: [table.id], name: "employee_novelties_id"}),
	}
});

export const employeeVacationBalances = mysqlTable("employee_vacation_balances", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" } ),
	year: int().notNull(),
	daysGranted: int("days_granted").default(15).notNull(),
	daysUsed: int("days_used").default(0).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxVacationTenant: index("idx_vacation_tenant").on(table.tenantId),
		userId: index("user_id").on(table.userId),
		employeeVacationBalancesId: primaryKey({ columns: [table.id], name: "employee_vacation_balances_id"}),
		idxVacationUserYear: unique("idx_vacation_user_year").on(table.tenantId, table.userId, table.year),
	}
});

export const exerciseProgressions = mysqlTable("exercise_progressions", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	exerciseId: varchar("exercise_id", { length: 80 }).notNull(),
	currentWeight: decimal("current_weight", { precision: 8, scale: 2 }).default('0.00').notNull(),
	nextWeight: decimal("next_weight", { precision: 8, scale: 2 }).default('0.00').notNull(),
	bestWeight: decimal("best_weight", { precision: 8, scale: 2 }).default('0.00').notNull(),
	lastAction: varchar("last_action", { length: 12 }),
	completionRate: decimal("completion_rate", { precision: 5, scale: 3 }),
	estimated1Rm: decimal("estimated_1rm", { precision: 8, scale: 2 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		exerciseProgressionsId: primaryKey({ columns: [table.id], name: "exercise_progressions_id"}),
		idxEpUserEx: unique("idx_ep_user_ex").on(table.userId, table.exerciseId),
	}
});

export const financeBudgets = mysqlTable("finance_budgets", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	categoryId: varchar("category_id", { length: 36 }).notNull().references(() => financeCategories.id, { onDelete: "cascade" } ),
	year: smallint().notNull(),
	month: tinyint().notNull(),
	budgetedAmount: decimal("budgeted_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		categoryId: index("category_id").on(table.categoryId),
		idxBudgetPeriod: index("idx_budget_period").on(table.tenantId, table.year, table.month),
		financeBudgetsId: primaryKey({ columns: [table.id], name: "finance_budgets_id"}),
		idxBudgetUnique: unique("idx_budget_unique").on(table.tenantId, table.categoryId, table.year, table.month),
	}
});

export const financeCategories = mysqlTable("finance_categories", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	type: mysqlEnum(['ingreso','egreso']).notNull(),
	name: varchar({ length: 100 }).notNull(),
	icon: varchar({ length: 50 }),
	color: varchar({ length: 7 }),
	isSystem: tinyint("is_system").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxFinCatTenant: index("idx_fin_cat_tenant").on(table.tenantId, table.type),
		financeCategoriesId: primaryKey({ columns: [table.id], name: "finance_categories_id"}),
		idxFinCatName: unique("idx_fin_cat_name").on(table.tenantId, table.type, table.name),
	}
});

export const financeTransactions = mysqlTable("finance_transactions", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	type: mysqlEnum(['ingreso','egreso']).notNull(),
	categoryId: varchar("category_id", { length: 36 }).notNull().references(() => financeCategories.id, { onDelete: "restrict" } ),
	categoryName: varchar("category_name", { length: 100 }).notNull(),
	description: varchar({ length: 500 }).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	transactionDate: date("transaction_date", { mode: 'string' }).notNull(),
	paymentMethod: mysqlEnum("payment_method", ['efectivo','tarjeta','transferencia','nequi','daviplata','cheque','otro']).default('efectivo').notNull(),
	receiptUrl: varchar("receipt_url", { length: 500 }),
	receiptNumber: varchar("receipt_number", { length: 100 }),
	isRecurring: tinyint("is_recurring").default(0).notNull(),
	recurrenceType: mysqlEnum("recurrence_type", ['diario','semanal','quincenal','mensual','bimestral','anual']),
	recurrenceDay: tinyint("recurrence_day"),
	sourceType: mysqlEnum("source_type", ['manual','sale','purchase_invoice','payroll','cash_movement']).default('manual').notNull(),
	sourceId: varchar("source_id", { length: 36 }),
	notes: text(),
	tags: json(),
	createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	createdByName: varchar("created_by_name", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		categoryId: index("category_id").on(table.categoryId),
		createdBy: index("created_by").on(table.createdBy),
		idxFinTxCategory: index("idx_fin_tx_category").on(table.tenantId, table.categoryId),
		idxFinTxDate: index("idx_fin_tx_date").on(table.tenantId, table.transactionDate),
		idxFinTxRecurring: index("idx_fin_tx_recurring").on(table.tenantId, table.isRecurring),
		idxFinTxSource: index("idx_fin_tx_source").on(table.sourceType, table.sourceId),
		idxFinTxTenant: index("idx_fin_tx_tenant").on(table.tenantId),
		idxFinTxType: index("idx_fin_tx_type").on(table.tenantId, table.type),
		financeTransactionsId: primaryKey({ columns: [table.id], name: "finance_transactions_id"}),
	}
});

export const fleetMaintenance = mysqlTable("fleet_maintenance", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	vehicleId: varchar("vehicle_id", { length: 36 }).notNull().references(() => fleetVehicles.id, { onDelete: "cascade" } ),
	type: mysqlEnum(['preventivo','correctivo','revision']).default('preventivo').notNull(),
	description: text().notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	scheduledDate: date("scheduled_date", { mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	completedDate: date("completed_date", { mode: 'string' }),
	cost: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	status: mysqlEnum(['pendiente','en_proceso','completado','cancelado']).default('pendiente').notNull(),
	notes: text(),
	createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		createdBy: index("created_by").on(table.createdBy),
		idxMaintenanceScheduled: index("idx_maintenance_scheduled").on(table.scheduledDate),
		idxMaintenanceStatus: index("idx_maintenance_status").on(table.status),
		idxMaintenanceTenant: index("idx_maintenance_tenant").on(table.tenantId),
		idxMaintenanceVehicle: index("idx_maintenance_vehicle").on(table.vehicleId),
		fleetMaintenanceId: primaryKey({ columns: [table.id], name: "fleet_maintenance_id"}),
	}
});

export const fleetVehicles = mysqlTable("fleet_vehicles", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 100 }).notNull(),
	plate: varchar({ length: 20 }),
	type: mysqlEnum(['planta','ligera','moto']).default('ligera').notNull(),
	maxWeightKg: decimal("max_weight_kg", { precision: 10, scale: 2 }).default('500.00').notNull(),
	status: mysqlEnum(['disponible','en_ruta','mantenimiento','inactivo']).default('disponible').notNull(),
	year: int(),
	brand: varchar({ length: 50 }),
	model: varchar({ length: 50 }),
	notes: text(),
	// ── Perfil empresarial del vehículo (documentos, odómetro, consumo) ─────────
	soatExpiry: date("soat_expiry", { mode: 'string' }),
	tecnoExpiry: date("tecno_expiry", { mode: 'string' }),
	insuranceExpiry: date("insurance_expiry", { mode: 'string' }),
	odometerKm: int("odometer_km").default(0).notNull(),
	fuelType: varchar("fuel_type", { length: 20 }),
	volumeM3: decimal("volume_m3", { precision: 8, scale: 2 }),
	/** Mantenimiento preventivo cada N km (0 = sin regla) */
	maintenanceEveryKm: int("maintenance_every_km").default(0).notNull(),
	/** Odómetro del último mantenimiento completado (para la alerta por km) */
	lastMaintenanceKm: int("last_maintenance_km").default(0).notNull(),
	/** Mantenimiento preventivo por fecha: próximo servicio programado */
	nextMaintenanceDate: date("next_maintenance_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxFleetStatus: index("idx_fleet_status").on(table.status),
		idxFleetTenant: index("idx_fleet_tenant").on(table.tenantId),
		idxFleetType: index("idx_fleet_type").on(table.type),
		fleetVehiclesId: primaryKey({ columns: [table.id], name: "fleet_vehicles_id"}),
	}
});

// ── Gastos reales por vehículo (combustible, peajes, repuestos) ────────────────
// Los reporta el conductor o el despachador; alimentan consumo/km y rentabilidad.
export const fleetVehicleExpenses = mysqlTable("fleet_vehicle_expenses", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	vehicleId: varchar("vehicle_id", { length: 36 }).notNull().references(() => fleetVehicles.id, { onDelete: "cascade" } ),
	type: mysqlEnum(['combustible','peaje','repuesto','lavado','otro']).default('combustible').notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	/** Galones tanqueados (solo combustible) para calcular consumo/km */
	gallons: decimal({ precision: 8, scale: 2 }),
	odometerKm: int("odometer_km"),
	routeId: varchar("route_id", { length: 36 }),
	notes: varchar({ length: 300 }),
	createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxFvexpTenantVehicle: index("idx_fvexp_tenant_vehicle").on(table.tenantId, table.vehicleId),
		idxFvexpDate: index("idx_fvexp_date").on(table.tenantId, table.createdAt),
		fleetVehicleExpensesId: primaryKey({ columns: [table.id], name: "fleet_vehicle_expenses_id"}),
	}
});

// ── Rutas de despacho: varios pedidos agrupados en un vehículo+conductor ───────
export const dispatchRoutes = mysqlTable("dispatch_routes", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	routeNumber: varchar("route_number", { length: 20 }).notNull(),
	vehicleId: varchar("vehicle_id", { length: 36 }).references(() => fleetVehicles.id, { onDelete: "set null" } ),
	driverId: varchar("driver_id", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	/** [{ name }] — auxiliares sugeridos/asignados al cargue */
	auxiliaries: json(),
	status: mysqlEnum(['planificada','cargando','en_ruta','retornando','cerrada','cancelada']).default('planificada').notNull(),
	totalWeightKg: decimal("total_weight_kg", { precision: 10, scale: 3 }).default('0.000').notNull(),
	stopsCount: int("stops_count").default(0).notNull(),
	zoneLabel: varchar("zone_label", { length: 120 }),
	sedeId: varchar("sede_id", { length: 36 }),
	startedAt: timestamp("started_at", { mode: 'string' }),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	notes: varchar({ length: 300 }),
	// Tracking (F5): última posición reportada por el teléfono del conductor
	lastLat: decimal("last_lat", { precision: 10, scale: 7 }),
	lastLng: decimal("last_lng", { precision: 10, scale: 7 }),
	lastPingAt: timestamp("last_ping_at", { mode: 'string' }),
	createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxDrouteTenantStatus: index("idx_droute_tenant_status").on(table.tenantId, table.status),
		idxDrouteVehicle: index("idx_droute_vehicle").on(table.vehicleId),
		idxDrouteDriver: index("idx_droute_driver").on(table.driverId),
		dispatchRoutesId: primaryKey({ columns: [table.id], name: "dispatch_routes_id"}),
	}
});

export const guildMembers = mysqlTable("guild_members", {
	id: varchar({ length: 36 }).notNull(),
	guildId: varchar("guild_id", { length: 36 }).notNull().references(() => guilds.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	joinedAt: timestamp("joined_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxGmGuild: index("idx_gm_guild").on(table.guildId),
		guildMembersId: primaryKey({ columns: [table.id], name: "guild_members_id"}),
		idxGmUser: unique("idx_gm_user").on(table.userId),
	}
});

export const guilds = mysqlTable("guilds", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 120 }).notNull(),
	tagline: varchar({ length: 200 }),
	emoji: varchar({ length: 12 }),
	ownerUserId: varchar("owner_user_id", { length: 36 }),
	membersCount: int("members_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		guildsId: primaryKey({ columns: [table.id], name: "guilds_id"}),
		idxGuildName: unique("idx_guild_name").on(table.name),
	}
});

export const hormaColors = mysqlTable("horma_colors", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	hormaId: varchar("horma_id", { length: 36 }).notNull(),
	color: varchar({ length: 100 }).notNull(),
	hex: varchar({ length: 9 }),
	shelf: json(),
	sortOrder: int("sort_order").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow(),
},
(table) => {
	return {
		idxHcHorma: index("idx_hc_horma").on(table.hormaId, table.tenantId),
		idxHcTenant: index("idx_hc_tenant").on(table.tenantId),
		hormaColorsId: primaryKey({ columns: [table.id], name: "horma_colors_id"}),
		ukHormaColor: unique("uk_horma_color").on(table.hormaId, table.color),
	}
});

export const hormas = mysqlTable("hormas", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	name: varchar({ length: 150 }).notNull(),
	slug: varchar({ length: 150 }).notNull(),
	baseCost: decimal("base_cost", { precision: 12, scale: 2 }).default('0.00').notNull(),
	basePrice: decimal("base_price", { precision: 12, scale: 2 }).default('0.00').notNull(),
	sizeChart: json("size_chart"),
	hasSleeves: tinyint("has_sleeves").default(1).notNull(),
	sexo: mysqlEnum(['unisex','hombre','mujer']).default('unisex').notNull(),
	composition: varchar({ length: 150 }),
	weightGrams: int("weight_grams"),
	shelf: json(),
	sortOrder: int("sort_order").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow(),
},
(table) => {
	return {
		idxHormasTenant: index("idx_hormas_tenant").on(table.tenantId, table.isActive),
		hormasId: primaryKey({ columns: [table.id], name: "hormas_id"}),
		ukHormaSlugTenant: unique("uk_horma_slug_tenant").on(table.tenantId, table.slug),
	}
});

export const inventoryHolds = mysqlTable("inventory_holds", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	productId: varchar("product_id", { length: 36 }).notNull(),
	quantity: int().default(1).notNull(),
	expiresAt: datetime("expires_at", { mode: 'string'}).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(now())`).notNull(),
},
(table) => {
	return {
		idxIhExpires: index("idx_ih_expires").on(table.expiresAt),
		idxIhOrder: index("idx_ih_order").on(table.orderId),
		idxIhProductTenant: index("idx_ih_product_tenant").on(table.productId, table.tenantId),
		idxIhTenant: index("idx_ih_tenant").on(table.tenantId),
		inventoryHoldsId: primaryKey({ columns: [table.id], name: "inventory_holds_id"}),
	}
});

export const inventoryMovements = mysqlTable("inventory_movements", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	variantId: varchar("variant_id", { length: 36 }),
	productId: varchar("product_id", { length: 36 }).notNull(),
	type: mysqlEnum(['entrada','salida','ajuste','merma','transferencia','reserva','liberacion']).notNull(),
	quantity: int().notNull(),
	reason: text().notNull(),
	referenceType: varchar("reference_type", { length: 50 }),
	referenceId: varchar("reference_id", { length: 36 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxImCreated: index("idx_im_created").on(table.tenantId, table.createdAt),
		idxImProduct: index("idx_im_product").on(table.productId),
		idxImTenant: index("idx_im_tenant").on(table.tenantId),
		idxImVariant: index("idx_im_variant").on(table.variantId),
		inventoryMovementsId: primaryKey({ columns: [table.id], name: "inventory_movements_id"}),
	}
});

export const invoiceSequence = mysqlTable("invoice_sequence", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	prefix: varchar({ length: 10 }).default('FAC').notNull(),
	currentNumber: int("current_number").default(0).notNull(),
},
(table) => {
	return {
		invoiceSequenceId: primaryKey({ columns: [table.id], name: "invoice_sequence_id"}),
		idxInvoiceSeqTenant: unique("idx_invoice_seq_tenant").on(table.tenantId),
	}
});

export const legendPurchases = mysqlTable("legend_purchases", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	planKey: varchar("plan_key", { length: 20 }).notNull(),
	months: int().notNull(),
	amountCop: decimal("amount_cop", { precision: 14, scale: 2 }).notNull(),
	status: mysqlEnum(['pending','paid','cancelled']).default('pending').notNull(),
	gatewayPaymentId: varchar("gateway_payment_id", { length: 120 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxLpUser: index("idx_lp_user").on(table.userId, table.status),
		legendPurchasesId: primaryKey({ columns: [table.id], name: "legend_purchases_id"}),
	}
});

export const loginAttempts = mysqlTable("login_attempts", {
	id: int().autoincrement().notNull(),
	email: varchar({ length: 255 }).notNull(),
	ipAddress: varchar("ip_address", { length: 45 }).notNull(),
	success: tinyint().default(0).notNull(),
	failureReason: varchar("failure_reason", { length: 100 }),
	attemptedAt: timestamp("attempted_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxLaEmailTime: index("idx_la_email_time").on(table.email, table.attemptedAt),
		idxLaIpTime: index("idx_la_ip_time").on(table.ipAddress, table.attemptedAt),
		loginAttemptsId: primaryKey({ columns: [table.id], name: "login_attempts_id"}),
	}
});

export const lopbukLanding = mysqlTable("lopbuk_landing", {
	id: int().default(1).notNull(),
	config: json(),
	updatedBy: varchar("updated_by", { length: 120 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		lopbukLandingId: primaryKey({ columns: [table.id], name: "lopbuk_landing_id"}),
	}
});

export const loyaltyAccounts = mysqlTable("loyalty_accounts", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	customerName: varchar("customer_name", { length: 120 }),
	customerPhone: varchar("customer_phone", { length: 40 }).notNull(),
	pointsBalance: int("points_balance").default(0).notNull(),
	totalEarned: int("total_earned").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		loyaltyAccountsId: primaryKey({ columns: [table.id], name: "loyalty_accounts_id"}),
		idxLoyaltyAcct: unique("idx_loyalty_acct").on(table.tenantId, table.customerPhone),
	}
});

export const loyaltyConfig = mysqlTable("loyalty_config", {
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	enabled: tinyint().default(1).notNull(),
	pointsPerThousand: decimal("points_per_thousand", { precision: 8, scale: 2 }).default('1.00').notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		loyaltyConfigTenantId: primaryKey({ columns: [table.tenantId], name: "loyalty_config_tenant_id"}),
	}
});

export const loyaltyRewards = mysqlTable("loyalty_rewards", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	name: varchar({ length: 120 }).notNull(),
	description: varchar({ length: 300 }),
	pointsCost: int("points_cost").notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxLoyaltyReward: index("idx_loyalty_reward").on(table.tenantId, table.isActive),
		loyaltyRewardsId: primaryKey({ columns: [table.id], name: "loyalty_rewards_id"}),
	}
});

export const loyaltyTransactions = mysqlTable("loyalty_transactions", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	accountId: varchar("account_id", { length: 36 }).notNull(),
	type: mysqlEnum(['earn','redeem','adjust']).notNull(),
	points: int().notNull(),
	reason: varchar({ length: 200 }),
	orderId: varchar("order_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxLoyaltyTx: index("idx_loyalty_tx").on(table.tenantId, table.accountId, table.createdAt),
		loyaltyTransactionsId: primaryKey({ columns: [table.id], name: "loyalty_transactions_id"}),
	}
});

export const marketplaceExternalCards = mysqlTable("marketplace_external_cards", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }),
	logoUrl: varchar("logo_url", { length: 800 }),
	coverUrl: varchar("cover_url", { length: 800 }),
	description: varchar({ length: 500 }),
	externalUrl: varchar("external_url", { length: 1000 }).notNull(),
	city: varchar({ length: 255 }),
	isVerified: tinyint("is_verified").default(0).notNull(),
	isVisible: tinyint("is_visible").default(1).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxMecVisible: index("idx_mec_visible").on(table.isVisible, table.sortOrder),
		marketplaceExternalCardsId: primaryKey({ columns: [table.id], name: "marketplace_external_cards_id"}),
	}
});

export const menuLikes = mysqlTable("menu_likes", {
	id: int().autoincrement().notNull(),
	productId: int("product_id").notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	deviceId: varchar("device_id", { length: 64 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxMlProduct: index("idx_ml_product").on(table.productId),
		idxMlTenant: index("idx_ml_tenant").on(table.tenantId),
		menuLikesId: primaryKey({ columns: [table.id], name: "menu_likes_id"}),
		uqDeviceProduct: unique("uq_device_product").on(table.deviceId, table.productId),
	}
});

export const merchantEvents = mysqlTable("merchant_events", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	eventDate: datetime("event_date", { mode: 'string'}).notNull(),
	location: varchar({ length: 255 }),
	coverImage: varchar("cover_image", { length: 800 }),
	ticketPrice: decimal("ticket_price", { precision: 14, scale: 2 }),
	capacity: int(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxMeventTenant: index("idx_mevent_tenant").on(table.tenantId, table.isActive, table.eventDate),
		merchantEventsId: primaryKey({ columns: [table.id], name: "merchant_events_id"}),
	}
});

export const merchantNotifications = mysqlTable("merchant_notifications", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	type: mysqlEnum(['new_order','new_booking','chatbot_lead','new_service_booking','fleet_alert']).default('new_order').notNull(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	data: json(),
	isRead: tinyint("is_read").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxNotifCreated: index("idx_notif_created").on(table.createdAt),
		idxNotifTenantRead: index("idx_notif_tenant_read").on(table.tenantId, table.isRead),
		merchantNotificationsId: primaryKey({ columns: [table.id], name: "merchant_notifications_id"}),
	}
});

export const notifications = mysqlTable("notifications", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	type: varchar({ length: 40 }).default('general').notNull(),
	title: varchar({ length: 200 }).notNull(),
	body: varchar({ length: 500 }),
	link: varchar({ length: 500 }),
	isRead: tinyint("is_read").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxNotifTenant: index("idx_notif_tenant").on(table.tenantId, table.isRead, table.createdAt),
		notificationsId: primaryKey({ columns: [table.id], name: "notifications_id"}),
	}
});

export const orderStatusHistory = mysqlTable("order_status_history", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	fromStatus: varchar("from_status", { length: 30 }),
	toStatus: varchar("to_status", { length: 30 }).notNull(),
	changedBy: varchar("changed_by", { length: 36 }).notNull(),
	note: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxOshOrder: index("idx_osh_order").on(table.orderId),
		idxOshTenant: index("idx_osh_tenant").on(table.tenantId),
		orderStatusHistoryId: primaryKey({ columns: [table.id], name: "order_status_history_id"}),
	}
});

// Tiempos por etapa (ferretería F4): línea de tiempo canónica de cada pedido para
// medir CUELLOS DE BOTELLA. Se escribe un evento en cada transición con
// duration_seconds = tiempo desde la etapa anterior (precalculado → analítica trivial).
// Etapas: confirmado → en_picking → preparado → cargado → despachado → entregado.
export const orderStageEvents = mysqlTable("order_stage_events", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	stage: mysqlEnum(['confirmado','en_picking','preparado','cargado','despachado','entregado','cancelado']).notNull(),
	fromStage: varchar("from_stage", { length: 30 }),
	durationSeconds: int("duration_seconds"),
	sedeId: varchar("sede_id", { length: 36 }),
	userId: varchar("user_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxStageEventsOrder: index("idx_stage_events_order").on(table.orderId),
		idxStageEventsTenantStage: index("idx_stage_events_tenant_stage").on(table.tenantId, table.stage),
		idxStageEventsTenantDate: index("idx_stage_events_tenant_date").on(table.tenantId, table.createdAt),
		orderStageEventsId: primaryKey({ columns: [table.id], name: "order_stage_events_id"}),
	}
});

export const parLevels = mysqlTable("par_levels", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	productId: varchar("product_id", { length: 36 }).notNull(),
	dailyUsage: decimal("daily_usage", { precision: 10, scale: 3 }).default('0.000').notNull(),
	daysBetweenOrders: int("days_between_orders").default(1).notNull(),
	safetyStock: decimal("safety_stock", { precision: 10, scale: 3 }).default('0.000').notNull(),
	area: mysqlEnum(['cocina','bar','general']).default('cocina').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => {
	return {
		idxPlTenant: index("idx_pl_tenant").on(table.tenantId),
		parLevelsId: primaryKey({ columns: [table.id], name: "par_levels_id"}),
		ukPlTenantProduct: unique("uk_pl_tenant_product").on(table.tenantId, table.productId),
	}
});

export const paymentReceiptSequence = mysqlTable("payment_receipt_sequence", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	prefix: varchar({ length: 10 }).default('REC').notNull(),
	currentNumber: int("current_number").default(0).notNull(),
},
(table) => {
	return {
		paymentReceiptSequenceId: primaryKey({ columns: [table.id], name: "payment_receipt_sequence_id"}),
		idxReceiptSeqTenant: unique("idx_receipt_seq_tenant").on(table.tenantId),
	}
});

export const payrollAdjustments = mysqlTable("payroll_adjustments", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	sellerId: varchar("seller_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" } ),
	sellerName: varchar("seller_name", { length: 255 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	periodFrom: date("period_from", { mode: 'string' }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	periodTo: date("period_to", { mode: 'string' }).notNull(),
	type: mysqlEnum(['bono','descuento']).notNull(),
	concept: varchar({ length: 255 }).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxAdjPeriod: index("idx_adj_period").on(table.tenantId, table.periodFrom, table.periodTo),
		idxAdjTenantSeller: index("idx_adj_tenant_seller").on(table.tenantId, table.sellerId),
		sellerId: index("seller_id").on(table.sellerId),
		payrollAdjustmentsId: primaryKey({ columns: [table.id], name: "payroll_adjustments_id"}),
	}
});

export const payrollRecords = mysqlTable("payroll_records", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	periodFrom: date("period_from", { mode: 'string' }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	periodTo: date("period_to", { mode: 'string' }).notNull(),
	periodLabel: varchar("period_label", { length: 100 }).notNull(),
	sellerId: varchar("seller_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" } ),
	sellerName: varchar("seller_name", { length: 255 }).notNull(),
	totalVentas: int("total_ventas").default(0).notNull(),
	totalMonto: decimal("total_monto", { precision: 12, scale: 2 }).default('0.00').notNull(),
	salaryBase: decimal("salary_base", { precision: 12, scale: 2 }).default('0.00').notNull(),
	commissionType: varchar("commission_type", { length: 50 }).default('sin_comision').notNull(),
	commissionValue: decimal("commission_value", { precision: 10, scale: 2 }).default('0.00').notNull(),
	commissionEarned: decimal("commission_earned", { precision: 12, scale: 2 }).default('0.00').notNull(),
	monthlyGoal: decimal("monthly_goal", { precision: 12, scale: 2 }).default('0.00').notNull(),
	goalBonusEarned: decimal("goal_bonus_earned", { precision: 12, scale: 2 }).default('0.00').notNull(),
	totalBonos: decimal("total_bonos", { precision: 12, scale: 2 }).default('0.00').notNull(),
	totalDescuentos: decimal("total_descuentos", { precision: 12, scale: 2 }).default('0.00').notNull(),
	totalPagar: decimal("total_pagar", { precision: 12, scale: 2 }).default('0.00').notNull(),
	status: mysqlEnum(['borrador','pagado']).default('borrador').notNull(),
	notes: text(),
	generatedBy: varchar("generated_by", { length: 36 }),
	generatedAt: timestamp("generated_at", { mode: 'string' }).default(sql`(now())`),
	paidAt: timestamp("paid_at", { mode: 'string' }),
},
(table) => {
	return {
		idxPayrollPeriod: index("idx_payroll_period").on(table.tenantId, table.periodFrom, table.periodTo),
		idxPayrollSeller: index("idx_payroll_seller").on(table.sellerId),
		idxPayrollStatus: index("idx_payroll_status").on(table.tenantId, table.status),
		idxPayrollTenant: index("idx_payroll_tenant").on(table.tenantId),
		payrollRecordsId: primaryKey({ columns: [table.id], name: "payroll_records_id"}),
	}
});

export const platformPaymentGateways = mysqlTable("platform_payment_gateways", {
	provider: varchar({ length: 20 }).notNull(),
	environment: varchar({ length: 20 }).default('sandbox').notNull(),
	publicKey: text("public_key"),
	privateKey: text("private_key"),
	integritySecret: text("integrity_secret"),
	eventsSecret: text("events_secret"),
	isActive: tinyint("is_active").default(0).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		platformPaymentGatewaysProvider: primaryKey({ columns: [table.provider], name: "platform_payment_gateways_provider"}),
	}
});

export const platformSettings = mysqlTable("platform_settings", {
	settingKey: varchar("setting_key", { length: 100 }).notNull(),
	settingValue: text("setting_value"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		platformSettingsSettingKey: primaryKey({ columns: [table.settingKey], name: "platform_settings_setting_key"}),
	}
});

export const portfolioConfig = mysqlTable("portfolio_config", {
	id: int().default(1).notNull(),
	heroTitle: varchar("hero_title", { length: 255 }).default('DAIMUZ').notNull(),
	heroSubtitle: text("hero_subtitle"),
	heroImageUrl: text("hero_image_url"),
	brandDescription: text("brand_description"),
	showPricing: tinyint("show_pricing").default(1).notNull(),
	showFeaturedStores: tinyint("show_featured_stores").default(1).notNull(),
	featuredTenantIds: json("featured_tenant_ids"),
	contactEmail: varchar("contact_email", { length: 255 }),
	contactWhatsapp: varchar("contact_whatsapp", { length: 50 }),
	contactInstagram: varchar("contact_instagram", { length: 255 }),
	accentColor: varchar("accent_color", { length: 30 }).default('#6366f1').notNull(),
	isPublished: tinyint("is_published").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	robotSplineUrl: text("robot_spline_url"),
	lanyardOffsetX: int("lanyard_offset_x").default(0).notNull(),
	lanyardOffsetY: int("lanyard_offset_y").default(0).notNull(),
	lanyardScale: int("lanyard_scale").default(100).notNull(),
},
(table) => {
	return {
		portfolioConfigId: primaryKey({ columns: [table.id], name: "portfolio_config_id"}),
	}
});

export const portfolioFeatureCards = mysqlTable("portfolio_feature_cards", {
	id: int().autoincrement().notNull(),
	icon: varchar({ length: 10 }).default('???').notNull(),
	title: varchar({ length: 120 }).notNull(),
	description: text(),
	sortOrder: int("sort_order").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		portfolioFeatureCardsId: primaryKey({ columns: [table.id], name: "portfolio_feature_cards_id"}),
	}
});

export const portfolioServiceCategories = mysqlTable("portfolio_service_categories", {
	id: int().autoincrement().notNull(),
	icon: varchar({ length: 10 }).default('????').notNull(),
	label: varchar({ length: 120 }).notNull(),
	type: mysqlEnum(['package','subscription','addon']).default('package').notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		portfolioServiceCategoriesId: primaryKey({ columns: [table.id], name: "portfolio_service_categories_id"}),
	}
});

export const portfolioServiceOptions = mysqlTable("portfolio_service_options", {
	id: int().autoincrement().notNull(),
	categoryId: int("category_id").notNull().references(() => portfolioServiceCategories.id, { onDelete: "cascade" } ),
	title: varchar({ length: 120 }).notNull(),
	description: text(),
	savings: varchar({ length: 50 }),
	price: decimal({ precision: 12, scale: 0 }).default('0').notNull(),
	isPopular: tinyint("is_popular").default(0).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		categoryId: index("category_id").on(table.categoryId),
		portfolioServiceOptionsId: primaryKey({ columns: [table.id], name: "portfolio_service_options_id"}),
	}
});

export const portfolioTeamCards = mysqlTable("portfolio_team_cards", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 120 }).notNull(),
	role: varchar({ length: 120 }).notNull(),
	bio: text(),
	photoUrl: text("photo_url"),
	accentColor: varchar("accent_color", { length: 30 }).default('#06b6d4').notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	githubUrl: varchar("github_url", { length: 255 }),
	linkedinUrl: varchar("linkedin_url", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	bandImageUrl: text("band_image_url"),
},
(table) => {
	return {
		portfolioTeamCardsId: primaryKey({ columns: [table.id], name: "portfolio_team_cards_id"}),
	}
});

export const priceHistory = mysqlTable("price_history", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 50 }).notNull().references(() => products.id, { onDelete: "cascade" } ),
	oldCostPrice: decimal("old_cost_price", { precision: 10, scale: 2 }),
	newCostPrice: decimal("new_cost_price", { precision: 10, scale: 2 }),
	oldSalePrice: decimal("old_sale_price", { precision: 10, scale: 2 }),
	newSalePrice: decimal("new_sale_price", { precision: 10, scale: 2 }),
	reason: varchar({ length: 200 }),
	changedBy: varchar("changed_by", { length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxPriceProductDate: index("idx_price_product_date").on(table.productId, table.createdAt),
		idxPriceTenant: index("idx_price_tenant").on(table.tenantId),
		priceHistoryId: primaryKey({ columns: [table.id], name: "price_history_id"}),
	}
});

export const printers = mysqlTable("printers", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	connectionType: mysqlEnum("connection_type", ['lan','usb','bluetooth']).default('usb').notNull(),
	ip: varchar({ length: 45 }),
	port: int().default(9100).notNull(),
	paperWidth: tinyint("paper_width").default(80).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	assignedModule: mysqlEnum("assigned_module", ['caja','cocina','bar','factura']),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`(now())`).notNull(),
	updatedAt: datetime("updated_at", { mode: 'string'}).default(sql`(now())`).notNull(),
},
(table) => {
	return {
		idxPrintersModule: index("idx_printers_module").on(table.tenantId, table.assignedModule),
		idxPrintersTenant: index("idx_printers_tenant").on(table.tenantId),
		printersId: primaryKey({ columns: [table.id], name: "printers_id"}),
	}
});

// Agente de impresión local: un programa que corre en un PC del local (misma LAN que las
// impresoras Ethernet) y recibe los trabajos de impresión desde la nube. Cada fila = un
// agente vinculado a un tenant vía un código corto (pairing_code) que se canjea por un token.
export const printAgents = mysqlTable("print_agents", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
	name: varchar({ length: 100 }),
	pairingCode: varchar("pairing_code", { length: 12 }).notNull(),
	token: varchar({ length: 64 }).notNull(),
	pairedAt: datetime("paired_at", { mode: 'string' }),
	lastSeenAt: datetime("last_seen_at", { mode: 'string' }),
	createdAt: datetime("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => {
	return {
		idxPrintAgentsTenant: index("idx_print_agents_tenant").on(table.tenantId),
		uniqPrintAgentsCode: unique("uniq_print_agents_code").on(table.pairingCode),
		uniqPrintAgentsToken: unique("uniq_print_agents_token").on(table.token),
		printAgentsId: primaryKey({ columns: [table.id], name: "print_agents_id" }),
	}
});

// Cola de trabajos de impresión. Cada ticket (cocina/bar/caja) se encola con los bytes
// ESC/POS ya armados (base64) + la IP/puerto de la impresora destino. El Agente de Impresión
// local los recoge por heartbeat y los envía a la impresora en su LAN.
export const printJobs = mysqlTable("print_jobs", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
	module: varchar({ length: 20 }).notNull(),          // cocina | bar | caja | factura
	printerIp: varchar("printer_ip", { length: 45 }).notNull(),
	printerPort: int("printer_port").default(9100).notNull(),
	dataBase64: mediumtext("data_base64").notNull(),    // bytes ESC/POS en base64
	status: mysqlEnum(['pending', 'sent', 'done', 'failed']).default('pending').notNull(),
	attempts: int().default(0).notNull(),
	error: varchar({ length: 255 }),
	sentAt: datetime("sent_at", { mode: 'string' }),
	doneAt: datetime("done_at", { mode: 'string' }),
	createdAt: datetime("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => {
	return {
		idxPrintJobsTenantStatus: index("idx_print_jobs_tenant_status").on(table.tenantId, table.status),
		printJobsId: primaryKey({ columns: [table.id], name: "print_jobs_id" }),
	}
});

export const productAlerts = mysqlTable("product_alerts", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 50 }).notNull().references(() => products.id, { onDelete: "cascade" } ),
	alertType: mysqlEnum("alert_type", ['vencimiento','stock_bajo','garantia_proxima','reorden','otro']).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	alertDate: date("alert_date", { mode: 'string' }).notNull(),
	priority: mysqlEnum(['baja','media','alta','critica']).default('media'),
	message: text(),
	isResolved: tinyint("is_resolved").default(0),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	resolvedBy: varchar("resolved_by", { length: 50 }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxAlertDate: index("idx_alert_date").on(table.alertDate, table.isResolved),
		idxAlertPriority: index("idx_alert_priority").on(table.priority, table.isResolved),
		idxAlertTenant: index("idx_alert_tenant").on(table.tenantId),
		idxAlertType: index("idx_alert_type").on(table.alertType),
		productId: index("product_id").on(table.productId),
		productAlertsId: primaryKey({ columns: [table.id], name: "product_alerts_id"}),
	}
});

export const productModifierGroups = mysqlTable("product_modifier_groups", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	productId: varchar("product_id", { length: 36 }).notNull(),
	name: varchar({ length: 150 }).notNull(),
	selectionType: mysqlEnum("selection_type", ['single','multiple']).default('multiple').notNull(),
	isRequired: tinyint("is_required").default(0).notNull(),
	minSelect: int("min_select").default(0).notNull(),
	maxSelect: int("max_select"),
	sortOrder: int("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxPmgProduct: index("idx_pmg_product").on(table.productId),
		idxPmgTenant: index("idx_pmg_tenant").on(table.tenantId),
		productModifierGroupsId: primaryKey({ columns: [table.id], name: "product_modifier_groups_id"}),
	}
});

export const productModifierOptions = mysqlTable("product_modifier_options", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	groupId: varchar("group_id", { length: 36 }).notNull(),
	name: varchar({ length: 150 }).notNull(),
	imageUrl: varchar("image_url", { length: 500 }),
	priceDelta: decimal("price_delta", { precision: 12, scale: 2 }).default('0.00').notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
},
(table) => {
	return {
		idxPmoGroup: index("idx_pmo_group").on(table.groupId),
		idxPmoTenant: index("idx_pmo_tenant").on(table.tenantId),
		productModifierOptionsId: primaryKey({ columns: [table.id], name: "product_modifier_options_id"}),
	}
});

// Plantilla de modificadores reutilizable: un set de grupos+opciones que el
// comerciante guarda (desde un ítem) y aplica en bloque a categorías completas.
export const modifierTemplates = mysqlTable("modifier_templates", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 150 }).notNull(),
	groups: json().notNull(),   // [{ name, selectionType, isRequired, minSelect, maxSelect, options:[{name,imageUrl,priceDelta,isActive}] }]
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxModTplTenant: index("idx_mod_tpl_tenant").on(table.tenantId),
		modifierTemplatesId: primaryKey({ columns: [table.id], name: "modifier_templates_id"}),
	}
});

export const productRecipes = mysqlTable("product_recipes", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" } ),
	ingredientId: varchar("ingredient_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "restrict" } ),
	quantity: decimal({ precision: 10, scale: 3 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	includeInCost: tinyint("include_in_cost").default(1).notNull(),
},
(table) => {
	return {
		idxRecipeProduct: index("idx_recipe_product").on(table.productId),
		idxRecipeTenant: index("idx_recipe_tenant").on(table.tenantId),
		ingredientId: index("ingredient_id").on(table.ingredientId),
		productRecipesId: primaryKey({ columns: [table.id], name: "product_recipes_id"}),
	}
});

export const productReviews = mysqlTable("product_reviews", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" } ),
	reviewerName: varchar("reviewer_name", { length: 200 }).notNull(),
	reviewerEmail: varchar("reviewer_email", { length: 200 }),
	rating: tinyint().default(5).notNull(),
	title: varchar({ length: 200 }),
	body: text(),
	imageUrl1: varchar("image_url_1", { length: 500 }),
	imageUrl2: varchar("image_url_2", { length: 500 }),
	status: mysqlEnum(['pendiente','aprobado','rechazado']).default('pendiente').notNull(),
	reply: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxReviewsProduct: index("idx_reviews_product").on(table.productId),
		idxReviewsStatus: index("idx_reviews_status").on(table.tenantId, table.status),
		idxReviewsTenant: index("idx_reviews_tenant").on(table.tenantId),
		productReviewsId: primaryKey({ columns: [table.id], name: "product_reviews_id"}),
		chkRating: check("chk_rating", sql`((\`rating\` >= 1) and (\`rating\` <= 5))`),
	}
});

export const productVariants = mysqlTable("product_variants", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	productId: varchar("product_id", { length: 36 }).notNull(),
	sku: varchar({ length: 100 }).notNull(),
	barcode: varchar({ length: 100 }),
	color: varchar({ length: 100 }),
	size: varchar({ length: 50 }),
	material: varchar({ length: 100 }),
	stock: int().default(0),
	reservedStock: int("reserved_stock").default(0),
	minStock: int("min_stock").default(0),
	costPrice: decimal("cost_price", { precision: 12, scale: 2 }).default('0.00'),
	priceOverride: decimal("price_override", { precision: 12, scale: 2 }),
	supplierId: varchar("supplier_id", { length: 36 }),
	images: json(),
	sortOrder: int("sort_order").default(0),
	isActive: tinyint("is_active").default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	preorderLimit: int("preorder_limit"),
	preorderCount: int("preorder_count").default(0).notNull(),
	colorHex: varchar("color_hex", { length: 9 }),
	hormaId: varchar("horma_id", { length: 36 }),
	attributes: json(),
},
(table) => {
	return {
		idxPvHorma: index("idx_pv_horma").on(table.hormaId),
		idxPvProduct: index("idx_pv_product").on(table.productId),
		idxPvSku: index("idx_pv_sku").on(table.tenantId, table.sku),
		idxPvSupplier: index("idx_pv_supplier").on(table.supplierId),
		idxPvTenantProduct: index("idx_pv_tenant_product").on(table.tenantId, table.productId),
		productVariantsId: primaryKey({ columns: [table.id], name: "product_variants_id"}),
		ukPvSkuTenant: unique("uk_pv_sku_tenant").on(table.sku, table.tenantId),
	}
});

export const products = mysqlTable("products", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	articulo: varchar({ length: 255 }),
	category: varchar({ length: 50 }).notNull(),
	productType: mysqlEnum("product_type", ['general','alimentos','bebidas','ropa','electronica','farmacia','ferreteria','libreria','juguetes','cosmetica','perfumes','deportes','hogar','mascotas','otros']).default('general').notNull(),
	brand: varchar({ length: 100 }),
	model: varchar({ length: 100 }),
	description: text(),
	purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).default('0.00').notNull(),
	salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
	sku: varchar({ length: 50 }).notNull(),
	barcode: varchar({ length: 100 }),
	stock: int().default(0).notNull(),
	// Cotizaciones/apartados: unidades comprometidas (disponible = stock - reserved_stock)
	reservedStock: int("reserved_stock").default(0).notNull(),
	reorderPoint: int("reorder_point").default(5).notNull(),
	supplier: varchar({ length: 255 }),
	supplierId: varchar("supplier_id", { length: 50 }).references(() => suppliers.id, { onDelete: "set null" } ),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	entryDate: date("entry_date", { mode: 'string' }).notNull(),
	imageUrl: varchar("image_url", { length: 500 }),
	imageUrls: json("image_urls"),
	locationInStore: varchar("location_in_store", { length: 100 }),
	notes: text(),
	tags: json(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	expiryDate: date("expiry_date", { mode: 'string' }),
	batchNumber: varchar("batch_number", { length: 50 }),
	netWeight: decimal("net_weight", { precision: 10, scale: 3 }),
	weightUnit: mysqlEnum("weight_unit", ['g','kg','ml','l','oz','lb','unidad']),
	sanitaryRegistration: varchar("sanitary_registration", { length: 100 }),
	storageTemperature: varchar("storage_temperature", { length: 50 }),
	ingredients: text(),
	nutritionalInfo: text("nutritional_info"),
	alcoholContent: decimal("alcohol_content", { precision: 5, scale: 2 }),
	allergens: text(),
	size: varchar({ length: 20 }),
	color: varchar({ length: 50 }),
	material: varchar({ length: 100 }),
	gender: mysqlEnum(['hombre','mujer','unisex','ni??o','ni??a']),
	season: mysqlEnum(['verano','invierno','primavera','oto??o','todo_a??o']),
	garmentType: varchar("garment_type", { length: 50 }),
	washingInstructions: text("washing_instructions"),
	countryOfOrigin: varchar("country_of_origin", { length: 50 }),
	serialNumber: varchar("serial_number", { length: 100 }),
	warrantyMonths: int("warranty_months"),
	technicalSpecs: text("technical_specs"),
	voltage: varchar({ length: 20 }),
	powerWatts: int("power_watts"),
	compatibility: text(),
	includesAccessories: text("includes_accessories"),
	productCondition: mysqlEnum("product_condition", ['nuevo','reacondicionado','usado','exhibici??n']).default('nuevo'),
	activeIngredient: varchar("active_ingredient", { length: 200 }),
	concentration: varchar({ length: 50 }),
	requiresPrescription: tinyint("requires_prescription").default(0),
	administrationRoute: varchar("administration_route", { length: 50 }),
	presentation: varchar({ length: 50 }),
	unitsPerPackage: int("units_per_package"),
	laboratory: varchar({ length: 100 }),
	contraindications: text(),
	dimensions: varchar({ length: 50 }),
	weight: decimal({ precision: 10, scale: 3 }),
	hardwareWeightUnit: mysqlEnum("hardware_weight_unit", ['kg','ton','lb','g']).default('kg'),
	caliber: varchar({ length: 20 }),
	resistance: varchar({ length: 50 }),
	finish: varchar({ length: 50 }),
	recommendedUse: text("recommended_use"),
	author: varchar({ length: 200 }),
	publisher: varchar({ length: 100 }),
	isbn: varchar({ length: 20 }),
	pages: int(),
	language: varchar({ length: 50 }),
	publicationYear: int("publication_year"),
	edition: varchar({ length: 50 }),
	bookFormat: mysqlEnum("book_format", ['pasta_dura','pasta_blanda','digital','audio']),
	recommendedAge: varchar("recommended_age", { length: 50 }),
	numberOfPlayers: varchar("number_of_players", { length: 20 }),
	gameType: varchar("game_type", { length: 50 }),
	requiresBatteries: tinyint("requires_batteries"),
	packageDimensions: varchar("package_dimensions", { length: 50 }),
	packageContents: text("package_contents"),
	safetyWarnings: text("safety_warnings"),
	publishedInStore: tinyint("published_in_store").default(0).notNull(),
	availableForDelivery: tinyint("available_for_delivery").default(0).notNull(),
	deliveryType: mysqlEnum("delivery_type", ['domicilio','envio','ambos']),
	isNewLaunch: tinyint("is_new_launch").default(0).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	launchDate: date("launch_date", { mode: 'string' }),
	isPreorder: tinyint("is_preorder").default(0).notNull(),
	preorderWindowEnd: datetime("preorder_window_end", { mode: 'string'}),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipStart: date("preorder_ship_start", { mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipEnd: date("preorder_ship_end", { mode: 'string' }),
	preorderBadgeText: varchar("preorder_badge_text", { length: 60 }).default('Pre-orden').notNull(),
	preorderPolicyText: text("preorder_policy_text"),
	isOnOffer: tinyint("is_on_offer").default(0).notNull(),
	offerPrice: decimal("offer_price", { precision: 12, scale: 2 }),
	offerLabel: varchar("offer_label", { length: 100 }),
	offerStart: datetime("offer_start", { mode: 'string'}),
	offerEnd: datetime("offer_end", { mode: 'string'}),
	sedeId: varchar("sede_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	createdBy: varchar("created_by", { length: 50 }),
	updatedBy: varchar("updated_by", { length: 50 }),
	isMenuItem: tinyint("is_menu_item").default(0).notNull(),
	isIngredient: tinyint("is_ingredient").default(0).notNull(),
	preparationArea: mysqlEnum("preparation_area", ['bar','cocina','ambos']),
	prepTimeMinutes: int("prep_time_minutes"),
	availableInMenu: tinyint("available_in_menu").default(1).notNull(),
	qtyPromo: text("qty_promo"),
	images: text(),
	hormaId: varchar("horma_id", { length: 36 }),
	basePrice: decimal("base_price", { precision: 12, scale: 2 }),
	// ── Plantillas dinámicas de producto (landing de venta JSON-driven) ─────────
	templateId: varchar("template_id", { length: 36 }),
	// Contenido único del producto que consumen las secciones de la plantilla
	// (videoUrl, beneficios propios, faqs, testimonios manuales, comparación)
	pageContent: json("page_content"),
},
(table) => {
	return {
		idxCategory: index("idx_category").on(table.category),
		idxMenuItem: index("idx_menu_item").on(table.tenantId, table.isMenuItem, table.availableInMenu),
		idxPrepArea: index("idx_prep_area").on(table.tenantId, table.preparationArea),
		idxProductTenant: index("idx_product_tenant").on(table.tenantId),
		idxProductsDelivery: index("idx_products_delivery").on(table.tenantId, table.deliveryType),
		idxProductsExpiry: index("idx_products_expiry").on(table.tenantId, table.expiryDate),
		idxProductsHorma: index("idx_products_horma").on(table.hormaId),
		idxProductsOffer: index("idx_products_offer").on(table.tenantId, table.isOnOffer),
		idxProductsPreorder: index("idx_products_preorder").on(table.tenantId, table.isPreorder),
		idxProductsStore: index("idx_products_store").on(table.tenantId, table.publishedInStore),
		idxProductsTemplate: index("idx_products_template").on(table.tenantId, table.templateId),
		supplierId: index("supplier_id").on(table.supplierId),
		productsId: primaryKey({ columns: [table.id], name: "products_id"}),
		idxProductTenantBarcode: unique("idx_product_tenant_barcode").on(table.tenantId, table.barcode),
		idxProductTenantSku: unique("idx_product_tenant_sku").on(table.tenantId, table.sku),
	}
});

// ── Plantillas dinámicas de producto (tipo Shopify product templates) ──────────
// sections = JSON array de { id, type, settings, order, visible }. La plantilla NO
// guarda contenido del producto: las secciones consumen {{product.*}} + page_content.
export const productTemplates = mysqlTable("product_templates", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 120 }).notNull(),
	description: varchar({ length: 300 }),
	sections: json().notNull(),
	status: mysqlEnum(['draft','published','archived']).default('draft').notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxPtplTenantStatus: index("idx_ptpl_tenant_status").on(table.tenantId, table.status),
		productTemplatesId: primaryKey({ columns: [table.id], name: "product_templates_id"}),
	}
});

export const profileSections = mysqlTable("profile_sections", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	sectionType: mysqlEnum("section_type", ['image_text','video','gif','description','gallery']).notNull(),
	orderIndex: int("order_index").default(0).notNull(),
	content: json(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxPsectionActive: index("idx_psection_active").on(table.tenantId, table.isActive),
		idxPsectionTenant: index("idx_psection_tenant").on(table.tenantId, table.orderIndex),
		profileSectionsId: primaryKey({ columns: [table.id], name: "profile_sections_id"}),
	}
});

export const purchaseInvoiceItems = mysqlTable("purchase_invoice_items", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	invoiceId: varchar("invoice_id", { length: 50 }).notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "restrict" } ),
	productName: varchar("product_name", { length: 200 }).notNull(),
	productSku: varchar("product_sku", { length: 100 }).notNull(),
	quantity: decimal({ precision: 10, scale: 3 }).notNull(),
	unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).notNull(),
	salePrice: decimal("sale_price", { precision: 12, scale: 2 }),
	subtotal: decimal({ precision: 12, scale: 2 }).notNull(),
},
(table) => {
	return {
		idxPurchaseItemsInvoice: index("idx_purchase_items_invoice").on(table.invoiceId),
		idxPurchaseItemsProduct: index("idx_purchase_items_product").on(table.productId),
		tenantId: index("tenant_id").on(table.tenantId),
		purchaseInvoiceItemsId: primaryKey({ columns: [table.id], name: "purchase_invoice_items_id"}),
	}
});

export const purchaseInvoices = mysqlTable("purchase_invoices", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
	supplierId: varchar("supplier_id", { length: 50 }).references(() => suppliers.id, { onDelete: "set null" } ),
	supplierName: varchar("supplier_name", { length: 200 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	purchaseDate: date("purchase_date", { mode: 'string' }).notNull(),
	documentType: mysqlEnum("document_type", ['factura','remision','orden_compra','nota_credito']).default('factura').notNull(),
	subtotal: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	discount: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	tax: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	total: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	paymentMethod: mysqlEnum("payment_method", ['efectivo','tarjeta','transferencia','credito','nequi','daviplata','credito_proveedor','mixto']).default('efectivo').notNull(),
	paymentStatus: mysqlEnum("payment_status", ['pagado','pendiente','parcial']).default('pagado').notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	dueDate: date("due_date", { mode: 'string' }),
	fileUrl: varchar("file_url", { length: 500 }),
	notes: text(),
	mixedEfectivoAmount: decimal("mixed_efectivo_amount", { precision: 12, scale: 2 }),
	mixedTransferenciaAmount: decimal("mixed_transferencia_amount", { precision: 12, scale: 2 }),
	// Recepción de mercancía (F4): mide el tiempo llegada→almacenado por proveedor.
	arrivalAt: timestamp("arrival_at", { mode: 'string' }),
	receivedAt: timestamp("received_at", { mode: 'string' }),
	receivedBy: varchar("received_by", { length: 36 }),
	// Bodega destino de la compra (multibodega): al recibir, el stock entra a esta sede.
	sedeId: varchar("sede_id", { length: 36 }),
	createdBy: varchar("created_by", { length: 50 }).references(() => users.id, { onDelete: "set null" } ),
	synced: tinyint().default(1).notNull(),
	syncedAt: timestamp("synced_at", { mode: 'string' }),
	origin: mysqlEnum(['local','cloud']).default('cloud').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		createdBy: index("created_by").on(table.createdBy),
		idxPurchaseInvoicesDate: index("idx_purchase_invoices_date").on(table.purchaseDate),
		idxPurchaseInvoicesStatus: index("idx_purchase_invoices_status").on(table.tenantId, table.paymentStatus),
		idxPurchaseInvoicesSupplier: index("idx_purchase_invoices_supplier").on(table.supplierId),
		idxPurchaseInvoicesTenant: index("idx_purchase_invoices_tenant").on(table.tenantId),
		idxPurchasesSynced: index("idx_purchases_synced").on(table.synced),
		purchaseInvoicesId: primaryKey({ columns: [table.id], name: "purchase_invoices_id"}),
	}
});

export const pushSubscriptions = mysqlTable("push_subscriptions", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	endpoint: varchar({ length: 500 }).notNull(),
	p256Dh: varchar({ length: 200 }).notNull(),
	auth: varchar({ length: 100 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxPushUser: index("idx_push_user").on(table.userId),
		pushSubscriptionsId: primaryKey({ columns: [table.id], name: "push_subscriptions_id"}),
		idxPushEndpoint: unique("idx_push_endpoint").on(table.endpoint),
	}
});

export const rbGastos = mysqlTable("rb_gastos", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	concepto: varchar({ length: 255 }).notNull(),
	categoria: varchar({ length: 50 }).default('egreso').notNull(),
	cantidad: decimal({ precision: 10, scale: 2 }).default('1.00').notNull(),
	valorUnitario: decimal("valor_unitario", { precision: 12, scale: 2 }).notNull(),
	total: decimal({ precision: 12, scale: 2 }).notNull(),
	notas: text(),
	registeredAt: timestamp("registered_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	createdBy: varchar("created_by", { length: 36 }),
},
(table) => {
	return {
		idxRbGastosTenantDate: index("idx_rb_gastos_tenant_date").on(table.tenantId, table.registeredAt),
		rbGastosId: primaryKey({ columns: [table.id], name: "rb_gastos_id"}),
	}
});

export const rbGastosFijos = mysqlTable("rb_gastos_fijos", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	nombre: varchar({ length: 255 }).notNull(),
	valor: decimal({ precision: 12, scale: 2 }).notNull(),
	periodo: mysqlEnum(['quincenal','semanal','mensual']).default('quincenal').notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxRbGastosFijosTenant: index("idx_rb_gastos_fijos_tenant").on(table.tenantId, table.isActive),
		rbGastosFijosId: primaryKey({ columns: [table.id], name: "rb_gastos_fijos_id"}),
	}
});

export const rbIngresosDiarios = mysqlTable("rb_ingresos_diarios", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	fecha: date({ mode: 'string' }).notNull(),
	numPedidos: int("num_pedidos").default(0).notNull(),
	valorVentas: decimal("valor_ventas", { precision: 12, scale: 2 }).default('0.00').notNull(),
	ganancia: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	notas: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		rbIngresosDiariosId: primaryKey({ columns: [table.id], name: "rb_ingresos_diarios_id"}),
		idxRbIngTenantFecha: unique("idx_rb_ing_tenant_fecha").on(table.tenantId, table.fecha),
	}
});

export const rbJukeboxConfig = mysqlTable("rb_jukebox_config", {
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	enabled: tinyint().default(1).notNull(),
	threshold: decimal({ precision: 12, scale: 2 }).default('50000.00').notNull(),
},
(table) => {
	return {
		rbJukeboxConfigTenantId: primaryKey({ columns: [table.tenantId], name: "rb_jukebox_config_tenant_id"}),
	}
});

export const rbJukeboxQueue = mysqlTable("rb_jukebox_queue", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	tableSessionId: varchar("table_session_id", { length: 36 }),
	title: varchar({ length: 200 }).notNull(),
	url: varchar({ length: 500 }),
	requestedBy: varchar("requested_by", { length: 120 }),
	status: mysqlEnum(['queued','playing','played','skipped']).default('queued').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxJukeboxTenant: index("idx_jukebox_tenant").on(table.tenantId, table.status, table.createdAt),
		rbJukeboxQueueId: primaryKey({ columns: [table.id], name: "rb_jukebox_queue_id"}),
	}
});

export const rbOrderItems = mysqlTable("rb_order_items", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	orderId: varchar("order_id", { length: 36 }).notNull().references(() => rbOrders.id, { onDelete: "cascade" } ),
	menuItemId: varchar("menu_item_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "restrict" } ),
	menuItemName: varchar("menu_item_name", { length: 255 }).notNull(),
	preparationArea: mysqlEnum("preparation_area", ['bar','cocina','ambos']).notNull(),
	quantity: int().default(1).notNull(),
	unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
	subtotal: decimal({ precision: 12, scale: 2 }).notNull(),
	discount: decimal({ precision: 5, scale: 2 }).default('0.00').notNull(),
	status: mysqlEnum(['pendiente','en_preparacion','listo','entregado','cancelado']).default('pendiente').notNull(),
	guestNumber: tinyint("guest_number"),
	itemNotes: text("item_notes"),
	sentToKitchenAt: timestamp("sent_to_kitchen_at", { mode: 'string' }),
	readyAt: timestamp("ready_at", { mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxRbItemArea: index("idx_rb_item_area").on(table.tenantId, table.preparationArea, table.status),
		idxRbItemOrder: index("idx_rb_item_order").on(table.orderId),
		idxRbItemStatus: index("idx_rb_item_status").on(table.tenantId, table.status),
		menuItemId: index("menu_item_id").on(table.menuItemId),
		rbOrderItemsId: primaryKey({ columns: [table.id], name: "rb_order_items_id"}),
	}
});

export const rbOrderSequence = mysqlTable("rb_order_sequence", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	prefix: varchar({ length: 10 }).default('C').notNull(),
	currentNumber: int("current_number").default(0).notNull(),
},
(table) => {
	return {
		rbOrderSequenceId: primaryKey({ columns: [table.id], name: "rb_order_sequence_id"}),
		idxRbOrderSeq: unique("idx_rb_order_seq").on(table.tenantId),
	}
});

export const rbOrders = mysqlTable("rb_orders", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	tableId: varchar("table_id", { length: 36 }).notNull().references(() => rbTables.id, { onDelete: "restrict" } ),
	orderNumber: varchar("order_number", { length: 20 }).notNull(),
	waiterId: varchar("waiter_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "restrict" } ),
	waiterName: varchar("waiter_name", { length: 255 }).notNull(),
	guestsCount: int("guests_count").default(1).notNull(),
	status: mysqlEnum(['abierta','en_proceso','lista','entregada','cerrada','cancelada']).default('abierta').notNull(),
	notes: text(),
	subtotal: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	tax: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	discount: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	total: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	saleId: varchar("sale_id", { length: 36 }).references(() => sales.id, { onDelete: "set null" } ),
	openedAt: timestamp("opened_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	priority: mysqlEnum(['normal','urgente']).default('normal').notNull(),
},
(table) => {
	return {
		idxRbOrderStatus: index("idx_rb_order_status").on(table.tenantId, table.status),
		idxRbOrderTable: index("idx_rb_order_table").on(table.tableId, table.status),
		idxRbOrderWaiter: index("idx_rb_order_waiter").on(table.tenantId, table.waiterId),
		saleId: index("sale_id").on(table.saleId),
		waiterId: index("waiter_id").on(table.waiterId),
		rbOrdersId: primaryKey({ columns: [table.id], name: "rb_orders_id"}),
		idxRbOrderNumber: unique("idx_rb_order_number").on(table.tenantId, table.orderNumber),
	}
});

export const rbPayments = mysqlTable("rb_payments", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	orderId: varchar("order_id", { length: 36 }).notNull().references(() => rbOrders.id, { onDelete: "restrict" } ),
	guestNumber: tinyint("guest_number"),
	paymentMethod: mysqlEnum("payment_method", ['efectivo','tarjeta','nequi','bancolombia','bbva','transferencia','mixto']).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull(),
	changeAmount: decimal("change_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	cashierId: varchar("cashier_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "restrict" } ),
	cashierName: varchar("cashier_name", { length: 255 }).notNull(),
	cashSessionId: varchar("cash_session_id", { length: 36 }).references(() => cashSessions.id, { onDelete: "set null" } ),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		cashierId: index("cashier_id").on(table.cashierId),
		idxRbPaymentOrder: index("idx_rb_payment_order").on(table.orderId),
		idxRbPaymentSession: index("idx_rb_payment_session").on(table.cashSessionId),
		idxRbPaymentTenant: index("idx_rb_payment_tenant").on(table.tenantId),
		rbPaymentsId: primaryKey({ columns: [table.id], name: "rb_payments_id"}),
	}
});

export const rbReservationSequence = mysqlTable("rb_reservation_sequence", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	prefix: varchar({ length: 10 }).default('R').notNull(),
	currentNumber: int("current_number").default(0).notNull(),
},
(table) => {
	return {
		rbReservationSequenceId: primaryKey({ columns: [table.id], name: "rb_reservation_sequence_id"}),
		idxRbResSeq: unique("idx_rb_res_seq").on(table.tenantId),
	}
});

export const rbReservations = mysqlTable("rb_reservations", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	tableId: varchar("table_id", { length: 36 }).references(() => rbTables.id, { onDelete: "set null" } ),
	reservationNumber: varchar("reservation_number", { length: 20 }).notNull(),
	customerName: varchar("customer_name", { length: 255 }).notNull(),
	customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
	customerEmail: varchar("customer_email", { length: 255 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	reservationDate: date("reservation_date", { mode: 'string' }).notNull(),
	reservationTime: time("reservation_time").notNull(),
	guestsCount: int("guests_count").default(2).notNull(),
	occasion: varchar({ length: 100 }),
	notes: text(),
	preOrderItems: json("pre_order_items"),
	preOrderNotes: text("pre_order_notes"),
	status: mysqlEnum(['pendiente','confirmada','cancelada','completada','no_show']).default('pendiente').notNull(),
	rejectionReason: text("rejection_reason"),
	notifiedWhatsapp: tinyint("notified_whatsapp").default(0).notNull(),
	confirmedAt: timestamp("confirmed_at", { mode: 'string' }),
	cancelledAt: timestamp("cancelled_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxRbResDate: index("idx_rb_res_date").on(table.tenantId, table.reservationDate),
		idxRbResTableDate: index("idx_rb_res_table_date").on(table.tableId, table.reservationDate),
		idxRbResTenantDateStatus: index("idx_rb_res_tenant_date_status").on(table.tenantId, table.reservationDate, table.status),
		idxRbResTenantStatus: index("idx_rb_res_tenant_status").on(table.tenantId, table.status),
		rbReservationsId: primaryKey({ columns: [table.id], name: "rb_reservations_id"}),
	}
});

export const rbTableGuests = mysqlTable("rb_table_guests", {
	id: varchar({ length: 36 }).notNull(),
	sessionId: varchar("session_id", { length: 36 }).notNull(),
	name: varchar({ length: 120 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxRbtgSession: index("idx_rbtg_session").on(table.sessionId),
		rbTableGuestsId: primaryKey({ columns: [table.id], name: "rb_table_guests_id"}),
	}
});

export const rbTableSessions = mysqlTable("rb_table_sessions", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	tableId: varchar("table_id", { length: 36 }).notNull(),
	token: varchar({ length: 48 }).notNull(),
	waiterId: varchar("waiter_id", { length: 36 }).notNull(),
	waiterName: varchar("waiter_name", { length: 255 }).notNull(),
	orderId: varchar("order_id", { length: 36 }),
	status: mysqlEnum(['active','closed']).default('active').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxRbtsTable: index("idx_rbts_table").on(table.tableId, table.status),
		rbTableSessionsId: primaryKey({ columns: [table.id], name: "rb_table_sessions_id"}),
		idxRbtsToken: unique("idx_rbts_token").on(table.token),
	}
});

export const rbTables = mysqlTable("rb_tables", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	number: varchar({ length: 20 }).notNull(),
	capacity: int().default(4).notNull(),
	area: varchar({ length: 100 }),
	status: mysqlEnum(['libre','ocupada','reservada','inactiva']).default('libre').notNull(),
	qrCode: varchar("qr_code", { length: 500 }),
	notes: text(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	mergeGroup: varchar("merge_group", { length: 36 }),
},
(table) => {
	return {
		idxRbTableStatus: index("idx_rb_table_status").on(table.tenantId, table.status),
		rbTablesId: primaryKey({ columns: [table.id], name: "rb_tables_id"}),
		idxRbTableNumber: unique("idx_rb_table_number").on(table.tenantId, table.number),
	}
});

export const reClients = mysqlTable("re_clients", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	fullName: varchar("full_name", { length: 255 }).notNull(),
	documentType: mysqlEnum("document_type", ['cedula','nit','pasaporte','otro']).default('cedula'),
	document: varchar({ length: 30 }),
	phone: varchar({ length: 50 }),
	email: varchar({ length: 255 }),
	clientType: mysqlEnum("client_type", ['comprador','arrendatario','inversionista','propietario','prospecto']).default('prospecto').notNull(),
	source: varchar({ length: 100 }),
	assignedAgentId: varchar("assigned_agent_id", { length: 36 }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxReClientsAgent: index("idx_re_clients_agent").on(table.assignedAgentId),
		idxReClientsTenant: index("idx_re_clients_tenant").on(table.tenantId),
		idxReClientsType: index("idx_re_clients_type").on(table.tenantId, table.clientType),
		reClientsId: primaryKey({ columns: [table.id], name: "re_clients_id"}),
	}
});

export const reContracts = mysqlTable("re_contracts", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	contractNumber: varchar("contract_number", { length: 30 }).notNull(),
	contractType: mysqlEnum("contract_type", ['compraventa','arrendamiento','administracion','reserva','exclusividad']).notNull(),
	propertyId: varchar("property_id", { length: 36 }).notNull().references(() => reProperties.id),
	clientId: varchar("client_id", { length: 36 }).notNull().references(() => reClients.id),
	ownerId: varchar("owner_id", { length: 36 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	startDate: date("start_date", { mode: 'string' }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	endDate: date("end_date", { mode: 'string' }),
	canon: decimal({ precision: 15, scale: 2 }),
	salePrice: decimal("sale_price", { precision: 15, scale: 2 }),
	commissionPct: decimal("commission_pct", { precision: 5, scale: 2 }),
	commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }),
	depositAmount: decimal("deposit_amount", { precision: 15, scale: 2 }),
	status: mysqlEnum(['borrador','activo','vencido','renovado','terminado','cancelado']).default('borrador').notNull(),
	notes: text(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxReConClient: index("idx_re_con_client").on(table.clientId),
		idxReConEnd: index("idx_re_con_end").on(table.endDate),
		idxReConProperty: index("idx_re_con_property").on(table.propertyId),
		idxReConStatus: index("idx_re_con_status").on(table.tenantId, table.status),
		idxReConTenant: index("idx_re_con_tenant").on(table.tenantId),
		idxReConType: index("idx_re_con_type").on(table.tenantId, table.contractType),
		reContractsId: primaryKey({ columns: [table.id], name: "re_contracts_id"}),
		uqReContractNum: unique("uq_re_contract_num").on(table.tenantId, table.contractNumber),
	}
});

export const reLeadActivities = mysqlTable("re_lead_activities", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	leadId: varchar("lead_id", { length: 36 }).notNull().references(() => reLeads.id, { onDelete: "cascade" } ),
	activityType: mysqlEnum("activity_type", ['llamada','whatsapp','email','visita','nota','cambio_etapa','tarea']).default('nota').notNull(),
	description: text().notNull(),
	createdBy: varchar("created_by", { length: 36 }),
	scheduledAt: datetime("scheduled_at", { mode: 'string'}),
	completed: tinyint().default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxReActLead: index("idx_re_act_lead").on(table.leadId),
		idxReActSched: index("idx_re_act_sched").on(table.tenantId, table.scheduledAt),
		idxReActTenant: index("idx_re_act_tenant").on(table.tenantId),
		reLeadActivitiesId: primaryKey({ columns: [table.id], name: "re_lead_activities_id"}),
	}
});

export const reLeads = mysqlTable("re_leads", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	clientId: varchar("client_id", { length: 36 }),
	fullName: varchar("full_name", { length: 255 }).notNull(),
	phone: varchar({ length: 50 }),
	email: varchar({ length: 255 }),
	source: varchar({ length: 100 }),
	interestedIn: mysqlEnum("interested_in", ['venta','arriendo','ambos']).default('venta').notNull(),
	budgetMin: decimal("budget_min", { precision: 15, scale: 2 }),
	budgetMax: decimal("budget_max", { precision: 15, scale: 2 }),
	propertyTypePref: varchar("property_type_pref", { length: 100 }),
	cityPref: varchar("city_pref", { length: 100 }),
	stage: mysqlEnum(['nuevo','contactado','interesado','visita','negociacion','cierre','posventa','perdido']).default('nuevo').notNull(),
	assignedAgentId: varchar("assigned_agent_id", { length: 36 }),
	propertyId: varchar("property_id", { length: 36 }),
	notes: text(),
	lastContactAt: timestamp("last_contact_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxReLeadsAgent: index("idx_re_leads_agent").on(table.assignedAgentId),
		idxReLeadsProp: index("idx_re_leads_prop").on(table.propertyId),
		idxReLeadsStage: index("idx_re_leads_stage").on(table.tenantId, table.stage),
		idxReLeadsTenant: index("idx_re_leads_tenant").on(table.tenantId),
		reLeadsId: primaryKey({ columns: [table.id], name: "re_leads_id"}),
	}
});

export const reMaintenances = mysqlTable("re_maintenances", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	propertyId: varchar("property_id", { length: 36 }).notNull().references(() => reProperties.id, { onDelete: "cascade" } ),
	contractId: varchar("contract_id", { length: 36 }),
	reportedBy: varchar("reported_by", { length: 36 }),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	category: varchar({ length: 100 }),
	priority: mysqlEnum(['baja','media','alta','urgente']).default('media').notNull(),
	status: mysqlEnum(['solicitado','en_revision','aprobado','en_proceso','completado','cancelado']).default('solicitado').notNull(),
	estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
	actualCost: decimal("actual_cost", { precision: 12, scale: 2 }),
	assignedTo: varchar("assigned_to", { length: 255 }),
	scheduledAt: datetime("scheduled_at", { mode: 'string'}),
	completedAt: datetime("completed_at", { mode: 'string'}),
	evidenceUrls: json("evidence_urls"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxReMaintPriority: index("idx_re_maint_priority").on(table.tenantId, table.priority),
		idxReMaintProperty: index("idx_re_maint_property").on(table.propertyId),
		idxReMaintStatus: index("idx_re_maint_status").on(table.tenantId, table.status),
		idxReMaintTenant: index("idx_re_maint_tenant").on(table.tenantId),
		reMaintenancesId: primaryKey({ columns: [table.id], name: "re_maintenances_id"}),
	}
});

export const reOwners = mysqlTable("re_owners", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	fullName: varchar("full_name", { length: 255 }).notNull(),
	documentType: mysqlEnum("document_type", ['cedula','nit','pasaporte','otro']).default('cedula').notNull(),
	document: varchar({ length: 30 }),
	phone: varchar({ length: 50 }),
	email: varchar({ length: 255 }),
	address: text(),
	city: varchar({ length: 100 }),
	bankName: varchar("bank_name", { length: 100 }),
	bankAccount: varchar("bank_account", { length: 50 }),
	bankAccountType: mysqlEnum("bank_account_type", ['ahorros','corriente']),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxReOwnersTenant: index("idx_re_owners_tenant").on(table.tenantId),
		reOwnersId: primaryKey({ columns: [table.id], name: "re_owners_id"}),
	}
});

export const reProperties = mysqlTable("re_properties", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	code: varchar({ length: 50 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	propertyType: mysqlEnum("property_type", ['casa','apartamento','local','oficina','bodega','lote','finca','consultorio','hotel','proyecto']).default('apartamento').notNull(),
	operationType: mysqlEnum("operation_type", ['venta','arriendo','venta_arriendo']).default('venta').notNull(),
	status: mysqlEnum(['disponible','vendido','arrendado','reservado','en_negociacion','en_mantenimiento','inactivo']).default('disponible').notNull(),
	price: decimal({ precision: 15, scale: 2 }).default('0.00').notNull(),
	adminFee: decimal("admin_fee", { precision: 12, scale: 2 }),
	address: varchar({ length: 500 }),
	city: varchar({ length: 100 }),
	neighborhood: varchar({ length: 100 }),
	stateProvince: varchar("state_province", { length: 100 }),
	country: varchar({ length: 100 }).default('Colombia').notNull(),
	lat: decimal({ precision: 10, scale: 8 }),
	lng: decimal({ precision: 11, scale: 8 }),
	stratum: tinyint(),
	areaM2: decimal("area_m2", { precision: 10, scale: 2 }),
	builtAreaM2: decimal("built_area_m2", { precision: 10, scale: 2 }),
	bedrooms: tinyint().default(0),
	bathrooms: tinyint().default(0),
	garages: tinyint().default(0),
	floors: tinyint().default(1),
	ageYears: smallint("age_years"),
	ownerId: varchar("owner_id", { length: 36 }),
	assignedAgentId: varchar("assigned_agent_id", { length: 36 }),
	isFeatured: tinyint("is_featured").default(0).notNull(),
	isPublished: tinyint("is_published").default(0).notNull(),
	publishedAt: timestamp("published_at", { mode: 'string' }),
	coverImageUrl: text("cover_image_url"),
	tags: json(),
	seoSlug: varchar("seo_slug", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxRePropAgent: index("idx_re_prop_agent").on(table.assignedAgentId),
		idxRePropFeatured: index("idx_re_prop_featured").on(table.tenantId, table.isFeatured),
		idxRePropOp: index("idx_re_prop_op").on(table.tenantId, table.operationType),
		idxRePropOwner: index("idx_re_prop_owner").on(table.ownerId),
		idxRePropPublished: index("idx_re_prop_published").on(table.tenantId, table.isPublished),
		idxRePropStatus: index("idx_re_prop_status").on(table.tenantId, table.status),
		idxRePropType: index("idx_re_prop_type").on(table.tenantId, table.propertyType),
		rePropertiesId: primaryKey({ columns: [table.id], name: "re_properties_id"}),
		uqReCode: unique("uq_re_code").on(table.tenantId, table.code),
	}
});

export const rePropertyFeatures = mysqlTable("re_property_features", {
	id: int().autoincrement().notNull(),
	propertyId: varchar("property_id", { length: 36 }).notNull().references(() => reProperties.id, { onDelete: "cascade" } ),
	feature: varchar({ length: 100 }).notNull(),
},
(table) => {
	return {
		idxReFeatProp: index("idx_re_feat_prop").on(table.propertyId),
		rePropertyFeaturesId: primaryKey({ columns: [table.id], name: "re_property_features_id"}),
		uqPropFeat: unique("uq_prop_feat").on(table.propertyId, table.feature),
	}
});

export const rePropertyMedia = mysqlTable("re_property_media", {
	id: int().autoincrement().notNull(),
	propertyId: varchar("property_id", { length: 36 }).notNull().references(() => reProperties.id, { onDelete: "cascade" } ),
	mediaType: mysqlEnum("media_type", ['foto','video','plano','documento','tour_360']).default('foto').notNull(),
	url: text().notNull(),
	caption: varchar({ length: 255 }),
	sortOrder: smallint("sort_order").notNull(),
	isCover: tinyint("is_cover").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxReMediaProp: index("idx_re_media_prop").on(table.propertyId),
		idxReMediaType: index("idx_re_media_type").on(table.propertyId, table.mediaType),
		rePropertyMediaId: primaryKey({ columns: [table.id], name: "re_property_media_id"}),
	}
});

export const reRentPayments = mysqlTable("re_rent_payments", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	contractId: varchar("contract_id", { length: 36 }).notNull().references(() => reContracts.id, { onDelete: "cascade" } ),
	periodMonth: tinyint("period_month").notNull(),
	periodYear: smallint("period_year").notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	dueDate: date("due_date", { mode: 'string' }).notNull(),
	canon: decimal({ precision: 15, scale: 2 }).notNull(),
	lateFee: decimal("late_fee", { precision: 12, scale: 2 }).default('0.00').notNull(),
	totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
	paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default('0.00').notNull(),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	paymentMethod: varchar("payment_method", { length: 30 }),
	status: mysqlEnum(['pendiente','pagado','parcial','vencido']).default('pendiente').notNull(),
	receiptUrl: text("receipt_url"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxRePayContract: index("idx_re_pay_contract").on(table.contractId),
		idxRePayDue: index("idx_re_pay_due").on(table.dueDate),
		idxRePayPeriod: index("idx_re_pay_period").on(table.contractId, table.periodYear, table.periodMonth),
		idxRePayStatus: index("idx_re_pay_status").on(table.tenantId, table.status),
		reRentPaymentsId: primaryKey({ columns: [table.id], name: "re_rent_payments_id"}),
	}
});

export const reVisits = mysqlTable("re_visits", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	propertyId: varchar("property_id", { length: 36 }).notNull().references(() => reProperties.id, { onDelete: "cascade" } ),
	clientId: varchar("client_id", { length: 36 }),
	leadId: varchar("lead_id", { length: 36 }),
	assignedAgentId: varchar("assigned_agent_id", { length: 36 }),
	scheduledAt: datetime("scheduled_at", { mode: 'string'}).notNull(),
	durationMinutes: smallint("duration_minutes").default(30).notNull(),
	visitType: mysqlEnum("visit_type", ['presencial','virtual']).default('presencial').notNull(),
	status: mysqlEnum(['programada','confirmada','realizada','cancelada','no_show']).default('programada').notNull(),
	feedback: text(),
	rating: tinyint(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxReVisAgent: index("idx_re_vis_agent").on(table.assignedAgentId),
		idxReVisDate: index("idx_re_vis_date").on(table.tenantId, table.scheduledAt),
		idxReVisProperty: index("idx_re_vis_property").on(table.propertyId),
		idxReVisStatus: index("idx_re_vis_status").on(table.tenantId, table.status),
		idxReVisTenant: index("idx_re_vis_tenant").on(table.tenantId),
		reVisitsId: primaryKey({ columns: [table.id], name: "re_visits_id"}),
	}
});

export const refreshTokens = mysqlTable("refresh_tokens", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" } ),
	tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" } ),
	tokenHash: varchar("token_hash", { length: 64 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { mode: 'string' }),
	revokeReason: mysqlEnum("revoke_reason", ['logout','password_change','admin_revoke','rotation','suspicious']),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 500 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxRtExpires: index("idx_rt_expires").on(table.expiresAt),
		idxRtUser: index("idx_rt_user").on(table.userId),
		idxRtUserValid: index("idx_rt_user_valid").on(table.userId, table.revokedAt, table.expiresAt),
		tenantId: index("tenant_id").on(table.tenantId),
		refreshTokensId: primaryKey({ columns: [table.id], name: "refresh_tokens_id"}),
		idxRtTokenHash: unique("idx_rt_token_hash").on(table.tokenHash),
	}
});

export const saleItems = mysqlTable("sale_items", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	saleId: varchar("sale_id", { length: 36 }).notNull().references(() => sales.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "restrict" } ),
	variantId: varchar("variant_id", { length: 36 }),
	productName: varchar("product_name", { length: 255 }).notNull(),
	productSku: varchar("product_sku", { length: 50 }).notNull(),
	quantity: int().notNull(),
	unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
	discount: decimal({ precision: 5, scale: 2 }).default('0.00').notNull(),
	subtotal: decimal({ precision: 12, scale: 2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	costPrice: decimal("cost_price", { precision: 12, scale: 2 }),
	marginPct: decimal("margin_pct", { precision: 5, scale: 2 }),
	marginAmount: decimal("margin_amount", { precision: 12, scale: 2 }),
	// Comisión de plataforma congelada para esta línea (modelo comisión). NULL = inactiva.
	platformMarginPct: decimal("platform_margin_pct", { precision: 5, scale: 2 }),
},
(table) => {
	return {
		idxProduct: index("idx_product").on(table.productId),
		idxSale: index("idx_sale").on(table.saleId),
		idxSaleItemsTenant: index("idx_sale_items_tenant").on(table.tenantId),
		idxSaleItemsTenantProduct: index("idx_sale_items_tenant_product").on(table.tenantId, table.productId),
		idxSiVariant: index("idx_si_variant").on(table.variantId),
		saleItemsId: primaryKey({ columns: [table.id], name: "sale_items_id"}),
	}
});

export const sales = mysqlTable("sales", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	invoiceNumber: varchar("invoice_number", { length: 20 }).notNull(),
	customerId: varchar("customer_id", { length: 36 }).references(() => customers.id, { onDelete: "set null" } ),
	customerName: varchar("customer_name", { length: 255 }),
	customerPhone: varchar("customer_phone", { length: 50 }),
	customerEmail: varchar("customer_email", { length: 255 }),
	subtotal: decimal({ precision: 12, scale: 2 }).notNull(),
	tax: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	discount: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	total: decimal({ precision: 12, scale: 2 }).notNull(),
	paymentMethod: mysqlEnum("payment_method", ['efectivo','tarjeta','transferencia','fiado','addi','sistecredito','mixto']).notNull(),
	amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull(),
	changeAmount: decimal("change_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	sellerId: varchar("seller_id", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	sellerName: varchar("seller_name", { length: 255 }).notNull(),
	cashSessionId: varchar("cash_session_id", { length: 36 }),
	status: mysqlEnum(['completada','anulada']).default('completada').notNull(),
	creditStatus: mysqlEnum("credit_status", ['pendiente','parcial','pagado']),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	dueDate: date("due_date", { mode: 'string' }),
	notes: text(),
	mixedEfectivoAmount: decimal("mixed_efectivo_amount", { precision: 12, scale: 2 }),
	mixedSecondMethod: varchar("mixed_second_method", { length: 30 }),
	mixedSecondAmount: decimal("mixed_second_amount", { precision: 12, scale: 2 }),
	sedeId: varchar("sede_id", { length: 36 }),
	vehicleId: varchar("vehicle_id", { length: 36 }).references(() => fleetVehicles.id, { onDelete: "set null" } ),
	dispatchStatus: mysqlEnum("dispatch_status", ['pendiente','en_pista','cargado','despachado','entregado']).default('pendiente').notNull(),
	totalWeightKg: decimal("total_weight_kg", { precision: 10, scale: 3 }),
	synced: tinyint().default(1).notNull(),
	syncedAt: timestamp("synced_at", { mode: 'string' }),
	origin: mysqlEnum(['local','cloud']).default('cloud').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	dispatchNotes: text("dispatch_notes"),
	dispatchedAt: timestamp("dispatched_at", { mode: 'string' }),
},
(table) => {
	return {
		customerId: index("customer_id").on(table.customerId),
		idxCreated: index("idx_created").on(table.createdAt),
		idxInvoice: index("idx_invoice").on(table.invoiceNumber),
		idxSaleTenant: index("idx_sale_tenant").on(table.tenantId),
		idxSalesCreditStatus: index("idx_sales_credit_status").on(table.creditStatus),
		idxSalesDueDate: index("idx_sales_due_date").on(table.dueDate),
		idxSalesPaymentMethod: index("idx_sales_payment_method").on(table.paymentMethod),
		idxSalesSedeId: index("idx_sales_sede_id").on(table.sedeId),
		idxSalesSynced: index("idx_sales_synced").on(table.synced),
		idxSalesTenantCustomer: index("idx_sales_tenant_customer").on(table.tenantId, table.customerId),
		idxSalesTenantDate: index("idx_sales_tenant_date").on(table.tenantId, table.createdAt),
		idxSalesTenantStatusDate: index("idx_sales_tenant_status_date").on(table.tenantId, table.status, table.createdAt),
		idxSalesVehicle: index("idx_sales_vehicle").on(table.vehicleId),
		idxStatus: index("idx_status").on(table.status),
		sellerId: index("seller_id").on(table.sellerId),
		salesId: primaryKey({ columns: [table.id], name: "sales_id"}),
		idxSaleTenantInvoice: unique("idx_sale_tenant_invoice").on(table.tenantId, table.invoiceNumber),
	}
});

export const seasonalChallenges = mysqlTable("seasonal_challenges", {
	id: varchar({ length: 36 }).notNull(),
	title: varchar({ length: 200 }).notNull(),
	description: varchar({ length: 500 }),
	metric: mysqlEnum(['streak','drops','achievements']).default('streak').notNull(),
	goalValue: int("goal_value").default(7).notNull(),
	reward: varchar({ length: 200 }),
	startsAt: datetime("starts_at", { mode: 'string'}).notNull(),
	endsAt: datetime("ends_at", { mode: 'string'}).notNull(),
	status: mysqlEnum(['active','cancelled']).default('active').notNull(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	rewardUnlock: varchar("reward_unlock", { length: 80 }),
	settledAt: datetime("settled_at", { mode: 'string'}),
	scope: varchar({ length: 12 }).default('individual').notNull(),
},
(table) => {
	return {
		idxScWindow: index("idx_sc_window").on(table.startsAt, table.endsAt),
		seasonalChallengesId: primaryKey({ columns: [table.id], name: "seasonal_challenges_id"}),
	}
});

export const sedes = mysqlTable("sedes", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 100 }).notNull(),
	address: varchar({ length: 500 }),
	// Multibodega: tipo de ubicación, contacto y encargado
	type: mysqlEnum(['punto_venta','bodega','mixta']).default('mixta').notNull(),
	phone: varchar({ length: 30 }),
	managerId: varchar("manager_id", { length: 36 }),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxSedesTenant: index("idx_sedes_tenant").on(table.tenantId),
		sedesId: primaryKey({ columns: [table.id], name: "sedes_id"}),
	}
});

// Multibodega: desglose del stock de un producto por sede/bodega.
// products.stock sigue siendo el TOTAL consolidado (fuente de verdad de los flujos
// existentes); sede_stock es la distribución. Transferencias mueven desglose sin
// alterar el total; ventas descuentan total + desglose de su sede.
export const sedeStock = mysqlTable("sede_stock", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	sedeId: varchar("sede_id", { length: 36 }).notNull(),
	productId: varchar("product_id", { length: 36 }).notNull(),
	stock: decimal({ precision: 12, scale: 3 }).default('0.000').notNull(),
	reservedStock: decimal("reserved_stock", { precision: 12, scale: 3 }).default('0.000').notNull(),
	minStock: decimal("min_stock", { precision: 12, scale: 3 }).default('0.000').notNull(),
	// Picking: ubicación física en ESTA bodega (ej. "P2-B3-N1" pasillo-bloque-nivel).
	// Fallback general: products.location_in_store.
	warehouseLocation: varchar("warehouse_location", { length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxSedeStockTenant: index("idx_sede_stock_tenant").on(table.tenantId),
		idxSedeStockProduct: index("idx_sede_stock_product").on(table.productId),
		sedeStockId: primaryKey({ columns: [table.id], name: "sede_stock_id"}),
		uqSedeStock: unique("uq_sede_stock").on(table.sedeId, table.productId),
	}
});

// Idempotencia para acciones encoladas offline (app del conductor/auxiliar).
// El dispositivo genera un clientActionId al ejecutar una acción; si la sube dos
// veces (respuesta perdida / reintento al reconectar), el backend la aplica UNA vez.
export const idempotencyKeys = mysqlTable("idempotency_keys", {
	id: varchar({ length: 64 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	action: varchar({ length: 60 }),
	userId: varchar("user_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxIdempTenant: index("idx_idemp_tenant").on(table.tenantId),
		idempotencyKeysId: primaryKey({ columns: [table.id], name: "idempotency_keys_id"}),
	}
});

// Conteo cíclico de inventario (ferretería, exactitud físico vs. sistema).
// Se abre un conteo por sede que CONGELA el esperado; el auxiliar captura lo
// contado; al cerrar se aplica el ajuste auditado (sede_stock + products.stock +
// stock_movements 'ajuste') y se calcula la exactitud (% de ítems sin diferencia).
export const inventoryCounts = mysqlTable("inventory_counts", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	countNumber: varchar("count_number", { length: 20 }).notNull(),
	sedeId: varchar("sede_id", { length: 36 }),
	status: mysqlEnum(['abierto','cerrado','cancelado']).default('abierto').notNull(),
	accuracyPct: decimal("accuracy_pct", { precision: 5, scale: 2 }),
	itemsTotal: int("items_total").default(0).notNull(),
	itemsCounted: int("items_counted").default(0).notNull(),
	itemsDiff: int("items_diff").default(0).notNull(),
	notes: varchar({ length: 500 }),
	createdBy: varchar("created_by", { length: 36 }),
	closedBy: varchar("closed_by", { length: 36 }),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxInvCountsTenantStatus: index("idx_inv_counts_tenant_status").on(table.tenantId, table.status),
		inventoryCountsId: primaryKey({ columns: [table.id], name: "inventory_counts_id"}),
	}
});

export const inventoryCountItems = mysqlTable("inventory_count_items", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	countId: varchar("count_id", { length: 36 }).notNull(),
	productId: varchar("product_id", { length: 36 }).notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	warehouseLocation: varchar("warehouse_location", { length: 50 }),
	expectedQty: decimal("expected_qty", { precision: 12, scale: 3 }).default('0.000').notNull(),
	countedQty: decimal("counted_qty", { precision: 12, scale: 3 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxInvCountItemsCount: index("idx_inv_count_items_count").on(table.countId),
		inventoryCountItemsId: primaryKey({ columns: [table.id], name: "inventory_count_items_id"}),
		uqInvCountItem: unique("uq_inv_count_item").on(table.countId, table.productId),
	}
});

// Picking (ferretería F3): cola de preparación de pedidos en bodega.
// El auxiliar toma la tarea, recorre la bodega guiado por ubicaciones y la marca
// preparada ANTES de que llegue el vehículo. pendiente → en_preparacion → preparada.
// items: [{ productId, productName, quantity, location }] ordenados por ubicación.
export const pickingTasks = mysqlTable("picking_tasks", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	orderNumber: varchar("order_number", { length: 20 }),
	customerName: varchar("customer_name", { length: 255 }),
	sedeId: varchar("sede_id", { length: 36 }),
	items: json().notNull(),
	status: mysqlEnum(['pendiente','en_preparacion','preparada','cancelada']).default('pendiente').notNull(),
	priority: int().default(0).notNull(),
	assignedTo: varchar("assigned_to", { length: 36 }),
	notes: varchar({ length: 500 }),
	takenAt: timestamp("taken_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxPickingTenantStatus: index("idx_picking_tenant_status").on(table.tenantId, table.status),
		idxPickingAssigned: index("idx_picking_assigned").on(table.assignedTo),
		idxPickingCreated: index("idx_picking_created").on(table.tenantId, table.createdAt),
		pickingTasksId: primaryKey({ columns: [table.id], name: "picking_tasks_id"}),
		uqPickingOrder: unique("uq_picking_order").on(table.orderId),
	}
});

// Multibodega: transferencia de mercancía entre sedes con flujo auditado
// solicitada → en_transito (descuenta origen) → recibida (suma destino) | cancelada
export const stockTransfers = mysqlTable("stock_transfers", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	transferNumber: varchar("transfer_number", { length: 20 }).notNull(),
	fromSedeId: varchar("from_sede_id", { length: 36 }).notNull(),
	toSedeId: varchar("to_sede_id", { length: 36 }).notNull(),
	// items: [{ productId, productName, quantity }]
	items: json().notNull(),
	status: mysqlEnum(['solicitada','en_transito','recibida','cancelada']).default('solicitada').notNull(),
	notes: varchar({ length: 500 }),
	requestedBy: varchar("requested_by", { length: 36 }),
	sentBy: varchar("sent_by", { length: 36 }),
	receivedBy: varchar("received_by", { length: 36 }),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	receivedAt: timestamp("received_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxStockTransfersTenant: index("idx_stock_transfers_tenant").on(table.tenantId),
		idxStockTransfersStatus: index("idx_stock_transfers_status").on(table.tenantId, table.status),
		stockTransfersId: primaryKey({ columns: [table.id], name: "stock_transfers_id"}),
	}
});

// Cotizaciones (ferretería F2): el cliente cotiza su proyecto → se acepta (reserva
// stock por sede) → se convierte en venta con 1 clic (sale_id) o vence/cancela
// (libera la reserva). items: [{ productId, productName, quantity, unitPrice, subtotal }]
export const quotes = mysqlTable("quotes", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	quoteNumber: varchar("quote_number", { length: 20 }).notNull(),
	customerId: varchar("customer_id", { length: 36 }),
	customerName: varchar("customer_name", { length: 255 }),
	customerPhone: varchar("customer_phone", { length: 30 }),
	customerEmail: varchar("customer_email", { length: 255 }),
	sellerId: varchar("seller_id", { length: 36 }),
	sellerName: varchar("seller_name", { length: 255 }),
	sedeId: varchar("sede_id", { length: 36 }),
	items: json().notNull(),
	subtotal: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	discount: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	tax: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	total: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	status: mysqlEnum(['borrador','enviada','aceptada','facturada','vencida','cancelada']).default('borrador').notNull(),
	validUntil: date("valid_until", { mode: 'string' }),
	deliveryPromise: date("delivery_promise", { mode: 'string' }),
	notes: varchar({ length: 1000 }),
	saleId: varchar("sale_id", { length: 36 }),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxQuotesTenant: index("idx_quotes_tenant").on(table.tenantId),
		idxQuotesStatus: index("idx_quotes_status").on(table.tenantId, table.status),
		idxQuotesCreated: index("idx_quotes_created").on(table.tenantId, table.createdAt),
		quotesId: primaryKey({ columns: [table.id], name: "quotes_id"}),
	}
});

export const serviceAvailability = mysqlTable("service_availability", {
	id: varchar({ length: 50 }).notNull(),
	serviceId: varchar("service_id", { length: 50 }).notNull().references(() => services.id, { onDelete: "cascade" } ),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	dayOfWeek: tinyint("day_of_week").notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	slotDurationMinutes: int("slot_duration_minutes").default(30).notNull(),
	maxSimultaneous: int("max_simultaneous").default(1).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
},
(table) => {
	return {
		idxAvailabilityDay: index("idx_availability_day").on(table.serviceId, table.dayOfWeek),
		idxAvailabilityService: index("idx_availability_service").on(table.serviceId),
		tenantId: index("tenant_id").on(table.tenantId),
		serviceAvailabilityId: primaryKey({ columns: [table.id], name: "service_availability_id"}),
	}
});

export const serviceBlockedPeriods = mysqlTable("service_blocked_periods", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	serviceId: varchar("service_id", { length: 50 }).references(() => services.id, { onDelete: "cascade" } ),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	blockedDate: date("blocked_date", { mode: 'string' }).notNull(),
	startTime: time("start_time"),
	endTime: time("end_time"),
	reason: varchar({ length: 200 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxBlockedServiceDate: index("idx_blocked_service_date").on(table.serviceId, table.blockedDate),
		idxBlockedTenantDate: index("idx_blocked_tenant_date").on(table.tenantId, table.blockedDate),
		serviceBlockedPeriodsId: primaryKey({ columns: [table.id], name: "service_blocked_periods_id"}),
	}
});

// Reserva temporal de un cupo mientras el cliente completa sus datos (F2 UX).
// Cuenta como ocupante en la disponibilidad hasta expires_at; se limpia al vencer.
export const serviceSlotHolds = mysqlTable("service_slot_holds", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	serviceId: varchar("service_id", { length: 50 }).notNull(),
	holdToken: varchar("hold_token", { length: 48 }).notNull(),
	bookingDate: date("booking_date", { mode: 'string' }).notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxSlotHoldsLookup: index("idx_slot_holds_lookup").on(table.serviceId, table.bookingDate),
		idxSlotHoldsExpires: index("idx_slot_holds_expires").on(table.expiresAt),
		serviceSlotHoldsId: primaryKey({ columns: [table.id], name: "service_slot_holds_id"}),
		holdToken: unique("uq_slot_hold_token").on(table.holdToken),
	}
});

export const serviceBookings = mysqlTable("service_bookings", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	serviceId: varchar("service_id", { length: 50 }).notNull().references(() => services.id, { onDelete: "restrict" } ),
	serviceName: varchar("service_name", { length: 200 }).notNull(),
	bookingType: mysqlEnum("booking_type", ['cita','asesoria','contacto']).notNull(),
	clientName: varchar("client_name", { length: 200 }).notNull(),
	clientPhone: varchar("client_phone", { length: 50 }).notNull(),
	clientEmail: varchar("client_email", { length: 100 }),
	clientNotes: text("client_notes"),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	bookingDate: date("booking_date", { mode: 'string' }),
	startTime: time("start_time"),
	endTime: time("end_time"),
	preferredDateRange: varchar("preferred_date_range", { length: 200 }),
	projectDescription: text("project_description"),
	budgetRange: varchar("budget_range", { length: 100 }),
	status: mysqlEnum(['pendiente','confirmada','cancelada','completada','no_asistio']).default('pendiente').notNull(),
	paymentStatus: mysqlEnum("payment_status", ['sin_pago','pendiente','pagado']).default('sin_pago').notNull(),
	amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).default('0.00').notNull(),
	addons: json("addons"),
	totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	specialistId: varchar("specialist_id", { length: 36 }),
	specialistName: varchar("specialist_name", { length: 200 }),
	loyaltyAwarded: tinyint("loyalty_awarded").default(0).notNull(),
	merchantNotes: text("merchant_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxBookingsDate: index("idx_bookings_date").on(table.tenantId, table.bookingDate),
		idxBookingsService: index("idx_bookings_service").on(table.serviceId),
		idxBookingsStatus: index("idx_bookings_status").on(table.tenantId, table.status),
		idxBookingsTenant: index("idx_bookings_tenant").on(table.tenantId),
		idxBookingsTenantDate: index("idx_bookings_tenant_date").on(table.tenantId, table.bookingDate),
		serviceBookingsId: primaryKey({ columns: [table.id], name: "service_bookings_id"}),
	}
});

export const serviceWaitlist = mysqlTable("service_waitlist", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	serviceId: varchar("service_id", { length: 50 }).notNull(),
	serviceName: varchar("service_name", { length: 200 }).notNull(),
	clientName: varchar("client_name", { length: 200 }).notNull(),
	clientPhone: varchar("client_phone", { length: 50 }).notNull(),
	desiredDate: date("desired_date", { mode: 'string' }),
	note: text(),
	status: mysqlEnum(['pendiente','notificado','convertido','cancelado']).default('pendiente').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxWaitlistTenant: index("idx_waitlist_tenant").on(table.tenantId, table.status),
		idxWaitlistService: index("idx_waitlist_service").on(table.serviceId, table.desiredDate),
		serviceWaitlistId: primaryKey({ columns: [table.id], name: "service_waitlist_id"}),
	}
});

export const serviceSpecialists = mysqlTable("service_specialists", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 200 }).notNull(),
	title: varchar({ length: 150 }),
	photoUrl: varchar("photo_url", { length: 500 }),
	isActive: tinyint("is_active").default(1).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxSpecialistsTenant: index("idx_specialists_tenant").on(table.tenantId, table.isActive),
		serviceSpecialistsId: primaryKey({ columns: [table.id], name: "service_specialists_id"}),
	}
});

export const services = mysqlTable("services", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	category: varchar({ length: 100 }),
	serviceType: mysqlEnum("service_type", ['cita','asesoria','contacto']).default('cita').notNull(),
	price: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	priceType: mysqlEnum("price_type", ['fijo','desde','gratis','cotizacion']).default('fijo').notNull(),
	durationMinutes: int("duration_minutes"),
	imageUrl: varchar("image_url", { length: 500 }),
	benefits: json("benefits"),
	preparation: text("preparation"),
	addonServiceIds: json("addon_service_ids"),
	specialistIds: json("specialist_ids"),
	requiresPayment: tinyint("requires_payment").default(0).notNull(),
	maxAdvanceDays: int("max_advance_days").default(30).notNull(),
	cancellationHours: int("cancellation_hours").default(24).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	isPublished: tinyint("is_published").default(0).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxServicesPublished: index("idx_services_published").on(table.tenantId, table.isPublished),
		idxServicesTenant: index("idx_services_tenant").on(table.tenantId),
		idxServicesType: index("idx_services_type").on(table.serviceType),
		servicesId: primaryKey({ columns: [table.id], name: "services_id"}),
	}
});

export const shiftEmployeeBonuses = mysqlTable("shift_employee_bonuses", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	sessionId: varchar("session_id", { length: 36 }).notNull().references(() => cashSessions.id, { onDelete: "cascade" } ),
	shiftEmpId: varchar("shift_emp_id", { length: 36 }).notNull().references(() => shiftEmployees.id, { onDelete: "cascade" } ),
	type: mysqlEnum(['bono','descuento']).notNull(),
	amount: decimal({ precision: 10, scale: 2 }).default('0.00').notNull(),
	concept: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxBonusEmp: index("idx_bonus_emp").on(table.shiftEmpId),
		idxBonusSession: index("idx_bonus_session").on(table.sessionId),
		shiftEmployeeBonusesId: primaryKey({ columns: [table.id], name: "shift_employee_bonuses_id"}),
	}
});

export const shiftEmployees = mysqlTable("shift_employees", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	sessionId: varchar("session_id", { length: 36 }).notNull().references(() => cashSessions.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }),
	employeeName: varchar("employee_name", { length: 100 }).notNull(),
	roleLabel: varchar("role_label", { length: 50 }),
	status: mysqlEnum(['activo','baja']).default('activo').notNull(),
	bajaReason: varchar("baja_reason", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxShiftempSession: index("idx_shiftemp_session").on(table.sessionId),
		idxShiftempTenant: index("idx_shiftemp_tenant").on(table.tenantId),
		shiftEmployeesId: primaryKey({ columns: [table.id], name: "shift_employees_id"}),
	}
});

export const stockMovements = mysqlTable("stock_movements", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" } ),
	type: mysqlEnum(['entrada','salida','ajuste','venta','devolucion']).notNull(),
	quantity: int().notNull(),
	previousStock: int("previous_stock").notNull(),
	newStock: int("new_stock").notNull(),
	reason: varchar({ length: 255 }),
	referenceId: varchar("reference_id", { length: 36 }),
	userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxStockCreated: index("idx_stock_created").on(table.createdAt),
		idxStockProduct: index("idx_stock_product").on(table.productId),
		idxStockTenant: index("idx_stock_tenant").on(table.tenantId),
		idxStockTenantDate: index("idx_stock_tenant_date").on(table.tenantId, table.createdAt),
		idxStockType: index("idx_stock_type").on(table.type),
		userId: index("user_id").on(table.userId),
		stockMovementsId: primaryKey({ columns: [table.id], name: "stock_movements_id"}),
	}
});

export const storeAnnouncementBar = mysqlTable("store_announcement_bar", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	text: varchar({ length: 500 }).notNull(),
	linkUrl: varchar("link_url", { length: 500 }),
	bgColor: varchar("bg_color", { length: 20 }).default('#f59e0b'),
	textColor: varchar("text_color", { length: 20 }).default('#000000'),
	isActive: tinyint("is_active").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	scrollSpeed: tinyint("scroll_speed").default(3).notNull(),
},
(table) => {
	return {
		storeAnnouncementBarId: primaryKey({ columns: [table.id], name: "store_announcement_bar_id"}),
		idxAnnouncementTenant: unique("idx_announcement_tenant").on(table.tenantId),
	}
});

export const storeBanners = mysqlTable("store_banners", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	position: varchar({ length: 20 }).notNull(),
	imageUrl: varchar("image_url", { length: 500 }).notNull(),
	videoUrl: varchar("video_url", { length: 500 }),
	title: varchar({ length: 255 }),
	subtitle: varchar({ length: 500 }),
	linkUrl: varchar("link_url", { length: 500 }),
	isActive: tinyint("is_active").default(1),
	sortOrder: int("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxBannerTenantPos: index("idx_banner_tenant_pos").on(table.tenantId, table.position),
		storeBannersId: primaryKey({ columns: [table.id], name: "store_banners_id"}),
	}
});

export const storeCustomSections = mysqlTable("store_custom_sections", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 100 }).notNull(),
	slug: varchar({ length: 100 }).notNull(),
	htmlContent: longtext("html_content"),
	isActive: tinyint("is_active").default(1).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxCustomSectionTenant: index("idx_custom_section_tenant").on(table.tenantId),
		storeCustomSectionsId: primaryKey({ columns: [table.id], name: "store_custom_sections_id"}),
		idxCustomSectionSlug: unique("idx_custom_section_slug").on(table.tenantId, table.slug),
	}
});

export const storeDropProducts = mysqlTable("store_drop_products", {
	id: int().autoincrement().notNull(),
	dropId: int("drop_id").notNull().references(() => storeDrops.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 50 }).notNull().references(() => products.id, { onDelete: "cascade" } ),
	customDiscount: int("custom_discount"),
},
(table) => {
	return {
		productId: index("product_id").on(table.productId),
		storeDropProductsId: primaryKey({ columns: [table.id], name: "store_drop_products_id"}),
		idxDropProduct: unique("idx_drop_product").on(table.dropId, table.productId),
	}
});

export const storeDrops = mysqlTable("store_drops", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	description: varchar({ length: 500 }),
	bannerUrl: varchar("banner_url", { length: 500 }),
	globalDiscount: int("global_discount").default(0),
	startsAt: datetime("starts_at", { mode: 'string'}).notNull(),
	endsAt: datetime("ends_at", { mode: 'string'}).notNull(),
	isActive: tinyint("is_active").default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxDropTenantActive: index("idx_drop_tenant_active").on(table.tenantId, table.isActive, table.endsAt),
		storeDropsId: primaryKey({ columns: [table.id], name: "store_drops_id"}),
	}
});

export const storeFeaturedProducts = mysqlTable("store_featured_products", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 50 }).notNull().references(() => products.id, { onDelete: "cascade" } ),
	sortOrder: int("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		productId: index("product_id").on(table.productId),
		storeFeaturedProductsId: primaryKey({ columns: [table.id], name: "store_featured_products_id"}),
		idxFeaturedTenantProduct: unique("idx_featured_tenant_product").on(table.tenantId, table.productId),
	}
});

export const storeInfo = mysqlTable("store_info", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	address: varchar({ length: 500 }),
	phone: varchar({ length: 50 }),
	taxId: varchar("tax_id", { length: 50 }),
	email: varchar({ length: 255 }),
	logoUrl: varchar("logo_url", { length: 500 }),
	schedule: varchar({ length: 500 }),
	locationMapUrl: varchar("location_map_url", { length: 500 }),
	termsUrl: text("terms_url"),
	privacyUrl: text("privacy_url"),
	shippingTerms: text("shipping_terms"),
	paymentMethods: text("payment_methods"),
	socialInstagram: varchar("social_instagram", { length: 255 }),
	socialFacebook: varchar("social_facebook", { length: 255 }),
	socialTiktok: varchar("social_tiktok", { length: 255 }),
	socialWhatsapp: varchar("social_whatsapp", { length: 50 }),
	latitude: decimal({ precision: 10, scale: 7 }),
	longitude: decimal({ precision: 10, scale: 7 }),
	department: varchar({ length: 100 }),
	municipality: varchar({ length: 100 }),
	invoiceLogo: varchar("invoice_logo", { length: 500 }),
	invoiceGreeting: varchar("invoice_greeting", { length: 255 }).default('??Gracias por su compra!'),
	invoicePolicy: text("invoice_policy"),
	invoiceCopies: tinyint("invoice_copies").default(1).notNull(),
	productCardStyle: varchar("product_card_style", { length: 20 }).default('style1'),
	allowContraentrega: tinyint("allow_contraentrega").default(1).notNull(),
	// Visibilidad y textos editables de los métodos de pago del checkout, por comercio.
	allowWompi: tinyint("allow_wompi").default(1).notNull(),
	contraentregaLabel: varchar("contraentrega_label", { length: 60 }).default('Contra entrega').notNull(),
	contraentregaDesc: varchar("contraentrega_desc", { length: 160 }).default('Paga en efectivo cuando recibas tu pedido').notNull(),
	onlineDiscountEnabled: tinyint("online_discount_enabled").default(0).notNull(),
	ageGateEnabled: tinyint("age_gate_enabled").default(0).notNull(),
	ageGateDescription: text("age_gate_description"),
	contactPageEnabled: tinyint("contact_page_enabled").default(0).notNull(),
	contactPageTitle: varchar("contact_page_title", { length: 255 }),
	contactPageDescription: text("contact_page_description"),
	contactPageImage: varchar("contact_page_image", { length: 500 }),
	contactPageProducts: text("contact_page_products"),
	contactPageLinks: text("contact_page_links"),
	showInfoModule: tinyint("show_info_module").default(0).notNull(),
	infoModuleDescription: text("info_module_description"),
	cartMinPurchase: int("cart_min_purchase").default(0).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	contactPageLinkTheme: varchar("contact_page_link_theme", { length: 20 }).default('theme1'),
	enableIva: tinyint("enable_iva").default(0).notNull(),
	metaPixelId: varchar("meta_pixel_id", { length: 100 }),
	productDetailStyle: varchar("product_detail_style", { length: 20 }).default('default'),
	cardCoverUrl: varchar("card_cover_url", { length: 500 }),
	cardDescription: varchar("card_description", { length: 300 }),
	isVerified: tinyint("is_verified").default(0).notNull(),
	openState: mysqlEnum("open_state", ['open','closed']).default('open').notNull(),
	marketplaceVisible: tinyint("marketplace_visible").default(1).notNull(),
	marketplaceOrder: int("marketplace_order").default(0).notNull(),
	businessHours: json("business_hours"),
	storeTheme: varchar("store_theme", { length: 20 }).default('theme1').notNull(),
	logoSize: smallint("logo_size"),
	cartDeliveryFee: int("cart_delivery_fee").default(0).notNull(),
	socialX: varchar("social_x", { length: 500 }),
	socialSnapchat: varchar("social_snapchat", { length: 500 }),
	// ── Cloudinary por comercio (fallback a platform_settings global) ──────────
	cloudinaryCloudName: varchar("cloudinary_cloud_name", { length: 120 }),
	cloudinaryUploadPreset: varchar("cloudinary_upload_preset", { length: 120 }),
	cloudinaryApiKey: varchar("cloudinary_api_key", { length: 120 }),
	cloudinaryApiSecret: varchar("cloudinary_api_secret", { length: 255 }), // cifrado (crypto.ts)
	// ── Protección de datos (Ley 1581) ──────────────────────────────────────────
	privacyPolicyVersion: varchar("privacy_policy_version", { length: 20 }).default('1.0').notNull(),
	cookiesContent: text("cookies_content"),
},
(table) => {
	return {
		idxStoreMunicipality: index("idx_store_municipality").on(table.municipality),
		storeInfoId: primaryKey({ columns: [table.id], name: "store_info_id"}),
		idxStoreTenant: unique("idx_store_tenant").on(table.tenantId),
	}
});

export const storeLocations = mysqlTable("store_locations", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	code: varchar({ length: 20 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	zone: varchar({ length: 50 }),
	description: text(),
	isActive: tinyint("is_active").default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxLocationTenant: index("idx_location_tenant").on(table.tenantId),
		idxLocationZone: index("idx_location_zone").on(table.zone),
		storeLocationsId: primaryKey({ columns: [table.id], name: "store_locations_id"}),
		idxLocationTenantCode: unique("idx_location_tenant_code").on(table.tenantId, table.code),
	}
});

export const storeOrderBump = mysqlTable("store_order_bump", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	isEnabled: tinyint("is_enabled").default(0).notNull(),
	mode: mysqlEnum(['auto','manual']).default('auto').notNull(),
	title: varchar({ length: 255 }).default('??Tambi??n te puede interesar?').notNull(),
	maxItems: int("max_items").default(3).notNull(),
	productIds: json("product_ids"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		storeOrderBumpId: primaryKey({ columns: [table.id], name: "store_order_bump_id"}),
		idxOrderBumpTenant: unique("idx_order_bump_tenant").on(table.tenantId),
	}
});

export const storefrontOrderItems = mysqlTable("storefront_order_items", {
	id: int().autoincrement().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull().references(() => storefrontOrders.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 36 }).references(() => products.id, { onDelete: "set null" } ),
	productName: varchar("product_name", { length: 255 }).notNull(),
	productImage: varchar("product_image", { length: 500 }),
	quantity: int().default(1).notNull(),
	unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
	originalPrice: decimal("original_price", { precision: 12, scale: 2 }),
	discountPercent: int("discount_percent").default(0),
	totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
	size: varchar({ length: 20 }),
	color: varchar({ length: 50 }),
	isPreorder: tinyint("is_preorder").default(0).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipStart: date("preorder_ship_start", { mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipEnd: date("preorder_ship_end", { mode: 'string' }),
	variantId: varchar("variant_id", { length: 36 }),
	comboData: json("combo_data"),
	costPrice: decimal("cost_price", { precision: 12, scale: 2 }),
	marginPct: decimal("margin_pct", { precision: 5, scale: 2 }),
	marginAmount: decimal("margin_amount", { precision: 12, scale: 2 }),
},
(table) => {
	return {
		idxOrderItemOrder: index("idx_order_item_order").on(table.orderId),
		idxSoiVariant: index("idx_soi_variant").on(table.variantId),
		productId: index("product_id").on(table.productId),
		storefrontOrderItemsId: primaryKey({ columns: [table.id], name: "storefront_order_items_id"}),
	}
});

export const storefrontOrders = mysqlTable("storefront_orders", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	orderNumber: varchar("order_number", { length: 20 }).notNull(),
	customerName: varchar("customer_name", { length: 255 }).notNull(),
	customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
	customerEmail: varchar("customer_email", { length: 255 }),
	customerCedula: varchar("customer_cedula", { length: 50 }),
	department: varchar({ length: 100 }),
	municipality: varchar({ length: 100 }),
	address: text(),
	neighborhood: varchar({ length: 255 }),
	deliveryLatitude: decimal("delivery_latitude", { precision: 10, scale: 7 }),
	deliveryLongitude: decimal("delivery_longitude", { precision: 10, scale: 7 }),
	notes: text(),
	subtotal: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 }).default('0.00').notNull(),
	discount: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	total: decimal({ precision: 12, scale: 2 }).notNull(),
	status: mysqlEnum(['pendiente','confirmado','preparando','enviado','entregado','cancelado']).default('pendiente').notNull(),
	paymentMethod: varchar("payment_method", { length: 50 }),
	deliveryDriverId: varchar("delivery_driver_id", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	deliveryStatus: mysqlEnum("delivery_status", ['sin_asignar','asignado','recogido','en_camino','entregado']).default('sin_asignar'),
	deliveryAssignedAt: timestamp("delivery_assigned_at", { mode: 'string' }),
	deliveryPickedAt: timestamp("delivery_picked_at", { mode: 'string' }),
	deliveryDeliveredAt: timestamp("delivery_delivered_at", { mode: 'string' }),
	vehicleId: varchar("vehicle_id", { length: 36 }).references(() => fleetVehicles.id, { onDelete: "set null" } ),
	dispatchStatus: mysqlEnum("dispatch_status", ['pendiente','en_pista','cargado','despachado','entregado']).default('pendiente').notNull(),
	totalWeightKg: decimal("total_weight_kg", { precision: 10, scale: 3 }),
	dispatchNotes: text("dispatch_notes"),
	dispatchedAt: timestamp("dispatched_at", { mode: 'string' }),
	clientUserId: varchar("client_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	assignedTo: varchar("assigned_to", { length: 36 }).references((): AnyMySqlColumn => users.id, { onDelete: "set null" } ),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	dataEncrypted: tinyint("data_encrypted").default(0).notNull(),
	gatewayPaymentId: varchar("gateway_payment_id", { length: 100 }),
	refundStatus: varchar("refund_status", { length: 30 }),
	// FK lógica a consent_records: prueba del consentimiento capturado en el checkout
	consentId: varchar("consent_id", { length: 36 }),
	// ── Logística: ruta agrupada + orden de parada + bodega origen ──────────────
	routeId: varchar("route_id", { length: 36 }),
	routeSequence: int("route_sequence"),
	sedeId: varchar("sede_id", { length: 36 }),
	// Promesa de entrega al cliente (F4): base para detectar pedidos en riesgo.
	promisedAt: datetime("promised_at", { mode: 'string' }),
	// Tracking público + prueba de entrega (F5)
	trackingToken: varchar("tracking_token", { length: 48 }),
	podPhotoUrl: varchar("pod_photo_url", { length: 500 }),
	podReceivedBy: varchar("pod_received_by", { length: 120 }),
	// Satisfacción post-entrega: el cliente califica desde el portal de seguimiento
	rating: tinyint(),
	ratingComment: varchar("rating_comment", { length: 500 }),
	ratingAt: timestamp("rating_at", { mode: 'string' }),
},
(table) => {
	return {
		idxOrderClient: index("idx_order_client").on(table.clientUserId),
		idxOrderAssigned: index("idx_order_assigned").on(table.assignedTo),
		idxOrderCreated: index("idx_order_created").on(table.createdAt),
		idxOrderDispatchStatus: index("idx_order_dispatch_status").on(table.dispatchStatus),
		idxOrderDriver: index("idx_order_driver").on(table.deliveryDriverId),
		idxOrderNumber: index("idx_order_number").on(table.orderNumber),
		idxOrderTenant: index("idx_order_tenant").on(table.tenantId),
		idxOrderTenantDate: index("idx_order_tenant_date").on(table.tenantId, table.createdAt),
		idxOrderTenantStatus: index("idx_order_tenant_status").on(table.tenantId, table.status),
		idxOrderVehicle: index("idx_order_vehicle").on(table.vehicleId),
		idxOrderTrackingToken: index("idx_order_tracking_token").on(table.trackingToken),
		storefrontOrdersId: primaryKey({ columns: [table.id], name: "storefront_orders_id"}),
	}
});

export const supplierProducts = mysqlTable("supplier_products", {
	id: varchar({ length: 36 }).notNull(),
	supplierId: varchar("supplier_id", { length: 36 }).notNull(),
	productId: varchar("product_id", { length: 36 }).notNull(),
	supplierSku: varchar("supplier_sku", { length: 100 }),
	costPrice: decimal("cost_price", { precision: 12, scale: 2 }).default('0.00'),
	leadTimeDays: int("lead_time_days").default(0),
	isPreferred: tinyint("is_preferred").default(0),
	isActive: tinyint("is_active").default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxSpProduct: index("idx_sp_product").on(table.productId),
		idxSpSupplier: index("idx_sp_supplier").on(table.supplierId),
		idxSpSupplierProduct: index("idx_sp_supplier_product").on(table.supplierId, table.productId),
		supplierProductsId: primaryKey({ columns: [table.id], name: "supplier_products_id"}),
	}
});

export const suppliers = mysqlTable("suppliers", {
	id: varchar({ length: 50 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 200 }).notNull(),
	contactName: varchar("contact_name", { length: 200 }),
	phone: varchar({ length: 20 }),
	email: varchar({ length: 100 }),
	address: text(),
	city: varchar({ length: 100 }),
	country: varchar({ length: 100 }).default('Colombia'),
	taxId: varchar("tax_id", { length: 50 }),
	paymentTerms: varchar("payment_terms", { length: 100 }),
	notes: text(),
	isActive: tinyint("is_active").default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxSupplierActive: index("idx_supplier_active").on(table.isActive),
		idxSupplierName: index("idx_supplier_name").on(table.name),
		idxSupplierTenant: index("idx_supplier_tenant").on(table.tenantId),
		suppliersId: primaryKey({ columns: [table.id], name: "suppliers_id"}),
	}
});

export const tenantProfile = mysqlTable("tenant_profile", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	coverUrl: varchar("cover_url", { length: 500 }),
	profilePhotoUrl: varchar("profile_photo_url", { length: 500 }),
	displayName: varchar("display_name", { length: 160 }),
	tagline: varchar({ length: 255 }),
	aboutText: text("about_text"),
	instagram: varchar({ length: 255 }),
	whatsapp: varchar({ length: 60 }),
	website: varchar({ length: 255 }),
	accentColor: varchar("accent_color", { length: 16 }),
	isPublished: tinyint("is_published").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		tenantProfileId: primaryKey({ columns: [table.id], name: "tenant_profile_id"}),
		uqProfileTenant: unique("uq_profile_tenant").on(table.tenantId),
	}
});

export const tenants = mysqlTable("tenants", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 100 }).notNull(),
	businessType: varchar("business_type", { length: 100 }),
	status: mysqlEnum(['activo','suspendido','cancelado']).default('activo').notNull(),
	plan: mysqlEnum(['basico','profesional','empresarial']).default('basico').notNull(),
	maxUsers: int("max_users").default(5).notNull(),
	maxProducts: int("max_products").default(500).notNull(),
	ownerId: varchar("owner_id", { length: 36 }).references((): AnyMySqlColumn => users.id, { onDelete: "set null" } ),
	bgColor: varchar("bg_color", { length: 7 }).default('#000000'),
	publicMenuEnabled: tinyint("public_menu_enabled").default(0).notNull(),
	trialEndsAt: datetime("trial_ends_at", { mode: 'string'}),
	reservationsEnabled: tinyint("reservations_enabled").default(0).notNull(),
	reservationsWhatsapp: varchar("reservations_whatsapp", { length: 50 }),
	reservationsOpenTime: time("reservations_open_time").default('12:00:00').notNull(),
	reservationsCloseTime: time("reservations_close_time").default('22:00:00').notNull(),
	reservationsSlotMinutes: int("reservations_slot_minutes").default(60).notNull(),
	reservationsMaxAdvanceDays: int("reservations_max_advance_days").default(30).notNull(),
	reservationsMinAdvanceHours: int("reservations_min_advance_hours").default(2).notNull(),
	reservationsOccasions: json("reservations_occasions"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	moduleRealestate: tinyint("module_realestate").default(0).notNull(),
	realestateEnabled: tinyint("realestate_enabled").default(0).notNull(),
	moduleWorkorders: tinyint("module_workorders").default(0).notNull(),
	enabledModules: json("enabled_modules"),
	// ── Hidden Layer (DAIMUZ Hidden Access) ────────────────────────────────
	isHidden: tinyint("is_hidden").default(0).notNull(),
	hiddenAccessToken: varchar("hidden_access_token", { length: 128 }),
	hiddenAccessCode: varchar("hidden_access_code", { length: 32 }),
	hiddenTokenExpiresAt: timestamp("hidden_token_expires_at", { mode: 'string' }),
	allowRegeneration: tinyint("allow_regeneration").default(1).notNull(),
	hiddenTheme: varchar("hidden_theme", { length: 50 }).default('default'),
	vipIntroEnabled: tinyint("vip_intro_enabled").default(1).notNull(),
	// Margen/comisión de plataforma sobre las ventas de este comercio. NULL/0 = inactivo;
	// 8.00 o 12.00 = activo (se aplica como margin_pct al asentar la venta).
	platformMarginPct: decimal("platform_margin_pct", { precision: 5, scale: 2 }),
},
(table) => {
	return {
		idxTenantSlug: index("idx_tenant_slug").on(table.slug),
		idxTenantStatus: index("idx_tenant_status").on(table.status),
		idxTenantHiddenToken: index("idx_tenant_hidden_token").on(table.hiddenAccessToken),
		tenantsId: primaryKey({ columns: [table.id], name: "tenants_id"}),
		slug: unique("slug").on(table.slug),
	}
});

export const theme4Config = mysqlTable("theme4_config", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	businessType: mysqlEnum("business_type", ['transport','software','general']).default('general').notNull(),
	heroVideoUrl: varchar("hero_video_url", { length: 500 }),
	heroImageUrl: varchar("hero_image_url", { length: 500 }),
	heroTitle: varchar("hero_title", { length: 200 }),
	heroSubtitle: varchar("hero_subtitle", { length: 300 }),
	ctaLabel: varchar("cta_label", { length: 80 }),
	ctaUrl: varchar("cta_url", { length: 500 }),
	aboutText: text("about_text"),
	accentColor: varchar("accent_color", { length: 16 }),
	whatsapp: varchar({ length: 60 }),
	email: varchar({ length: 160 }),
	phone: varchar({ length: 60 }),
	address: varchar({ length: 255 }),
	mapUrl: varchar("map_url", { length: 500 }),
	showStats: tinyint("show_stats").default(1).notNull(),
	showServices: tinyint("show_services").default(1).notNull(),
	showProcess: tinyint("show_process").default(1).notNull(),
	showTeam: tinyint("show_team").default(1).notNull(),
	showTestimonials: tinyint("show_testimonials").default(1).notNull(),
	showContact: tinyint("show_contact").default(1).notNull(),
	showCommunity: tinyint("show_community").default(1).notNull(),
	likesCount: int("likes_count").default(0).notNull(),
	savesCount: int("saves_count").default(0).notNull(),
	isPublished: tinyint("is_published").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		theme4ConfigId: primaryKey({ columns: [table.id], name: "theme4_config_id"}),
		uqTheme4Tenant: unique("uq_theme4_tenant").on(table.tenantId),
	}
});

export const theme4Fleet = mysqlTable("theme4_fleet", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	name: varchar({ length: 160 }).notNull(),
	vehicleType: mysqlEnum("vehicle_type", ['bus','van','car','other']).default('other').notNull(),
	capacity: int(),
	photoUrl: varchar("photo_url", { length: 500 }),
	features: json(),
	orderIndex: int("order_index").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
},
(table) => {
	return {
		idxT4FleetTenant: index("idx_t4fleet_tenant").on(table.tenantId, table.isActive),
		theme4FleetId: primaryKey({ columns: [table.id], name: "theme4_fleet_id"}),
	}
});

export const theme4Projects = mysqlTable("theme4_projects", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	title: varchar({ length: 200 }).notNull(),
	description: text(),
	category: varchar({ length: 80 }),
	screenshotUrls: json("screenshot_urls"),
	techStack: json("tech_stack"),
	liveUrl: varchar("live_url", { length: 500 }),
	caseStudyUrl: varchar("case_study_url", { length: 500 }),
	isFeatured: tinyint("is_featured").default(0).notNull(),
	orderIndex: int("order_index").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
},
(table) => {
	return {
		idxT4ProjTenant: index("idx_t4proj_tenant").on(table.tenantId, table.isActive, table.orderIndex),
		theme4ProjectsId: primaryKey({ columns: [table.id], name: "theme4_projects_id"}),
	}
});

export const theme4Reactions = mysqlTable("theme4_reactions", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	type: mysqlEnum(['like','save']).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		theme4ReactionsId: primaryKey({ columns: [table.id], name: "theme4_reactions_id"}),
		uqT4React: unique("uq_t4react").on(table.tenantId, table.userId, table.type),
	}
});

export const theme4Routes = mysqlTable("theme4_routes", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	origin: varchar({ length: 160 }).notNull(),
	destination: varchar({ length: 160 }).notNull(),
	stops: json(),
	departureTime: varchar("departure_time", { length: 40 }),
	arrivalTime: varchar("arrival_time", { length: 40 }),
	vehicleId: varchar("vehicle_id", { length: 36 }),
	price: decimal({ precision: 10, scale: 2 }),
	bookingUrl: varchar("booking_url", { length: 500 }),
	orderIndex: int("order_index").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
},
(table) => {
	return {
		idxT4RoutesTenant: index("idx_t4routes_tenant").on(table.tenantId, table.isActive),
		theme4RoutesId: primaryKey({ columns: [table.id], name: "theme4_routes_id"}),
	}
});

export const theme4Services = mysqlTable("theme4_services", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	icon: varchar({ length: 40 }),
	title: varchar({ length: 160 }).notNull(),
	description: text(),
	priceLabel: varchar("price_label", { length: 80 }),
	isFeatured: tinyint("is_featured").default(0).notNull(),
	orderIndex: int("order_index").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
},
(table) => {
	return {
		idxT4SvcTenant: index("idx_t4svc_tenant").on(table.tenantId, table.isActive, table.orderIndex),
		theme4ServicesId: primaryKey({ columns: [table.id], name: "theme4_services_id"}),
	}
});

export const theme4Stats = mysqlTable("theme4_stats", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	icon: varchar({ length: 40 }),
	label: varchar({ length: 120 }).notNull(),
	value: varchar({ length: 80 }).notNull(),
	orderIndex: int("order_index").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
},
(table) => {
	return {
		idxT4StatsTenant: index("idx_t4stats_tenant").on(table.tenantId, table.isActive, table.orderIndex),
		theme4StatsId: primaryKey({ columns: [table.id], name: "theme4_stats_id"}),
	}
});

export const theme4Steps = mysqlTable("theme4_steps", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	stepNumber: int("step_number").default(1).notNull(),
	title: varchar({ length: 160 }).notNull(),
	description: text(),
	icon: varchar({ length: 40 }),
	isActive: tinyint("is_active").default(1).notNull(),
},
(table) => {
	return {
		idxT4StepsTenant: index("idx_t4steps_tenant").on(table.tenantId, table.isActive, table.stepNumber),
		theme4StepsId: primaryKey({ columns: [table.id], name: "theme4_steps_id"}),
	}
});

export const theme4Team = mysqlTable("theme4_team", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	name: varchar({ length: 160 }).notNull(),
	role: varchar({ length: 160 }),
	photoUrl: varchar("photo_url", { length: 500 }),
	bio: text(),
	linkedinUrl: varchar("linkedin_url", { length: 500 }),
	orderIndex: int("order_index").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
},
(table) => {
	return {
		idxT4TeamTenant: index("idx_t4team_tenant").on(table.tenantId, table.isActive, table.orderIndex),
		theme4TeamId: primaryKey({ columns: [table.id], name: "theme4_team_id"}),
	}
});

export const theme4Testimonials = mysqlTable("theme4_testimonials", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	author: varchar({ length: 160 }).notNull(),
	role: varchar({ length: 160 }),
	avatarUrl: varchar("avatar_url", { length: 500 }),
	rating: tinyint().default(5).notNull(),
	text: text().notNull(),
	orderIndex: int("order_index").default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
},
(table) => {
	return {
		idxT4TestTenant: index("idx_t4test_tenant").on(table.tenantId, table.isActive, table.orderIndex),
		theme4TestimonialsId: primaryKey({ columns: [table.id], name: "theme4_testimonials_id"}),
	}
});

export const trainerBookings = mysqlTable("trainer_bookings", {
	id: varchar({ length: 36 }).notNull(),
	offerId: varchar("offer_id", { length: 36 }).notNull().references(() => trainerOffers.id, { onDelete: "restrict" } ),
	trainerId: varchar("trainer_id", { length: 36 }).notNull().references(() => trainers.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	amountCop: decimal("amount_cop", { precision: 14, scale: 2 }).notNull(),
	platformCop: decimal("platform_cop", { precision: 14, scale: 2 }).default('0.00').notNull(),
	trainerCop: decimal("trainer_cop", { precision: 14, scale: 2 }).default('0.00').notNull(),
	gatewayFeeCop: decimal("gateway_fee_cop", { precision: 14, scale: 2 }).default('0.00').notNull(),
	status: mysqlEnum(['pending','paid','delivered','completed','refunded']).default('pending').notNull(),
	activationStatus: mysqlEnum("activation_status", ['pending','active','paused','completed','cancelled']).default('pending').notNull(),
	currentWeek: int("current_week").default(1).notNull(),
	programSnapshot: json("program_snapshot"),
	wompiReference: varchar("wompi_reference", { length: 120 }),
	gatewayPaymentId: varchar("gateway_payment_id", { length: 255 }),
	startedAt: datetime("started_at", { mode: 'string'}),
	expiresAt: datetime("expires_at", { mode: 'string'}),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxTrbkRef: index("idx_trbk_ref").on(table.wompiReference),
		idxTrbkTrainer: index("idx_trbk_trainer").on(table.trainerId, table.status),
		idxTrbkUser: index("idx_trbk_user").on(table.userId, table.status),
		offerId: index("offer_id").on(table.offerId),
		trainerBookingsId: primaryKey({ columns: [table.id], name: "trainer_bookings_id"}),
	}
});

export const trainerCommissions = mysqlTable("trainer_commissions", {
	id: varchar({ length: 36 }).notNull(),
	bookingId: varchar("booking_id", { length: 36 }).notNull().references(() => trainerBookings.id, { onDelete: "cascade" } ),
	trainerId: varchar("trainer_id", { length: 36 }).notNull().references(() => trainers.id, { onDelete: "cascade" } ),
	grossCop: decimal("gross_cop", { precision: 14, scale: 2 }).notNull(),
	platformCop: decimal("platform_cop", { precision: 14, scale: 2 }).notNull(),
	trainerCop: decimal("trainer_cop", { precision: 14, scale: 2 }).notNull(),
	gatewayFeeCop: decimal("gateway_fee_cop", { precision: 14, scale: 2 }).default('0.00').notNull(),
	status: mysqlEnum(['pending','available','paid']).default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	releaseAt: datetime("release_at", { mode: 'string'}),
},
(table) => {
	return {
		bookingId: index("booking_id").on(table.bookingId),
		idxTrcommTrainer: index("idx_trcomm_trainer").on(table.trainerId, table.status),
		trainerCommissionsId: primaryKey({ columns: [table.id], name: "trainer_commissions_id"}),
	}
});

export const trainerOffers = mysqlTable("trainer_offers", {
	id: varchar({ length: 36 }).notNull(),
	trainerId: varchar("trainer_id", { length: 36 }).notNull().references(() => trainers.id, { onDelete: "cascade" } ),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	kind: mysqlEnum(['programa','sesion','mensual','combo']).default('programa').notNull(),
	priceCop: decimal("price_cop", { precision: 14, scale: 2 }).notNull(),
	durationDays: int("duration_days"),
	deliverables: json(),
	media: json(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxTrofferTrainer: index("idx_troffer_trainer").on(table.trainerId, table.isActive),
		trainerOffersId: primaryKey({ columns: [table.id], name: "trainer_offers_id"}),
	}
});

export const trainerReviews = mysqlTable("trainer_reviews", {
	id: varchar({ length: 36 }).notNull(),
	bookingId: varchar("booking_id", { length: 36 }).notNull(),
	trainerId: varchar("trainer_id", { length: 36 }).notNull().references(() => trainers.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	rating: tinyint().notNull(),
	comment: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxTrrevTrainer: index("idx_trrev_trainer").on(table.trainerId),
		trainerReviewsId: primaryKey({ columns: [table.id], name: "trainer_reviews_id"}),
	}
});

export const trainerWithdrawals = mysqlTable("trainer_withdrawals", {
	id: varchar({ length: 36 }).notNull(),
	trainerId: varchar("trainer_id", { length: 36 }).notNull().references(() => trainers.id, { onDelete: "cascade" } ),
	amountCop: decimal("amount_cop", { precision: 14, scale: 2 }).notNull(),
	paymentMethod: varchar("payment_method", { length: 200 }).notNull(),
	status: mysqlEnum(['requested','processing','paid','rejected']).default('requested').notNull(),
	processedBy: varchar("processed_by", { length: 36 }),
	note: varchar({ length: 500 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxTrwdTrainer: index("idx_trwd_trainer").on(table.trainerId, table.status),
		trainerWithdrawalsId: primaryKey({ columns: [table.id], name: "trainer_withdrawals_id"}),
	}
});

export const trainers = mysqlTable("trainers", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	handle: varchar({ length: 100 }),
	bio: text(),
	photoUrl: varchar("photo_url", { length: 800 }),
	specialties: json(),
	status: mysqlEnum(['pending','active','suspended']).default('pending').notNull(),
	commissionPct: decimal("commission_pct", { precision: 5, scale: 2 }).default('20.00').notNull(),
	minCommissionCop: decimal("min_commission_cop", { precision: 14, scale: 2 }).default('100000.00').notNull(),
	balanceCop: decimal("balance_cop", { precision: 14, scale: 2 }).default('0.00').notNull(),
	pendingCop: decimal("pending_cop", { precision: 14, scale: 2 }).default('0.00').notNull(),
	ratingAvg: decimal("rating_avg", { precision: 3, scale: 2 }).default('0.00').notNull(),
	sessionsCount: int("sessions_count").default(0).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxTrStatus: index("idx_tr_status").on(table.status),
		trainersId: primaryKey({ columns: [table.id], name: "trainers_id"}),
		idxTrEmail: unique("idx_tr_email").on(table.email),
		idxTrHandle: unique("idx_tr_handle").on(table.handle),
	}
});

export const userAddresses = mysqlTable("user_addresses", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" } ),
	label: varchar({ length: 100 }).default('Mi direcci??n').notNull(),
	department: varchar({ length: 500 }),
	municipality: varchar({ length: 500 }),
	address: varchar({ length: 500 }),
	neighborhood: varchar({ length: 500 }),
	deliveryLatitude: decimal("delivery_latitude", { precision: 10, scale: 7 }),
	deliveryLongitude: decimal("delivery_longitude", { precision: 10, scale: 7 }),
	isDefault: tinyint("is_default").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxUaUser: index("idx_ua_user").on(table.userId),
		userAddressesId: primaryKey({ columns: [table.id], name: "user_addresses_id"}),
	}
});

export const users = mysqlTable("users", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).references((): AnyMySqlColumn => tenants.id, { onDelete: "cascade" } ),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }),
	name: varchar({ length: 255 }).notNull(),
	role: mysqlEnum(['superadmin','comerciante','vendedor','cliente','repartidor','auxiliar_bodega','administrador_rb','cajero','mesero','cocinero','bartender','despachador']).default('vendedor').notNull(),
	phone: text(),
	avatar: varchar({ length: 500 }),
	isActive: tinyint("is_active").default(1).notNull(),
	canLogin: tinyint("can_login").default(1).notNull(),
	cargoId: varchar("cargo_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	authProvider: mysqlEnum("auth_provider", ['local','google']).default('local').notNull(),
	googleId: varchar("google_id", { length: 255 }),
	cedula: varchar({ length: 500 }),
	department: varchar({ length: 500 }),
	municipality: varchar({ length: 500 }),
	address: varchar({ length: 500 }),
	neighborhood: varchar({ length: 500 }),
	deliveryLatitude: decimal("delivery_latitude", { precision: 10, scale: 7 }),
	deliveryLongitude: decimal("delivery_longitude", { precision: 10, scale: 7 }),
	profileCompleted: tinyint("profile_completed").default(0).notNull(),
	commissionType: mysqlEnum("commission_type", ['sin_comision','porcentaje','fijo_por_venta','fijo_por_item']).default('sin_comision').notNull(),
	commissionValue: decimal("commission_value", { precision: 10, scale: 2 }).default('0.00').notNull(),
	salaryBase: decimal("salary_base", { precision: 12, scale: 2 }).default('0.00').notNull(),
	monthlyGoal: decimal("monthly_goal", { precision: 12, scale: 2 }).default('0.00').notNull(),
	goalBonus: decimal("goal_bonus", { precision: 12, scale: 2 }).default('0.00').notNull(),
	dataEncrypted: tinyint("data_encrypted").default(0).notNull(),
	// Organigrama: a quién le reporta este colaborador (self-ref, mismo tenant)
	managerId: varchar("manager_id", { length: 36 }),
	// Multibodega: sede a la que pertenece el colaborador (ventas descuentan de aquí)
	sedeId: varchar("sede_id", { length: 36 }),
},
(table) => {
	return {
		idxGoogleId: index("idx_google_id").on(table.googleId),
		idxUsersActive: index("idx_users_active").on(table.isActive),
		idxUsersRole: index("idx_users_role").on(table.role),
		idxUsersTenant: index("idx_users_tenant").on(table.tenantId),
		idxUsersManager: index("idx_users_manager").on(table.managerId),
		usersId: primaryKey({ columns: [table.id], name: "users_id"}),
		email: unique("email").on(table.email),
	}
});

export const variantPriceTiers = mysqlTable("variant_price_tiers", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	variantId: varchar("variant_id", { length: 36 }).notNull(),
	minQty: int("min_qty").default(1).notNull(),
	price: decimal({ precision: 12, scale: 2 }).notNull(),
	tenantMarginPct: decimal("tenant_margin_pct", { precision: 5, scale: 2 }).default('0.00'),
	isActive: tinyint("is_active").default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxVptTenant: index("idx_vpt_tenant").on(table.tenantId),
		idxVptVariant: index("idx_vpt_variant").on(table.variantId),
		idxVptVariantMinqty: index("idx_vpt_variant_minqty").on(table.variantId, table.tenantId, table.minQty),
		variantPriceTiersId: primaryKey({ columns: [table.id], name: "variant_price_tiers_id"}),
	}
});

export const vaultKeyRedemptions = mysqlTable("vault_key_redemptions", {
	id: varchar({ length: 36 }).notNull(),
	vaultKeyId: varchar("vault_key_id", { length: 36 }).notNull().references(() => vaultKeys.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	zeroPartyData: json("zero_party_data"),
	redeemedAt: timestamp("redeemed_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxVkrUser: index("idx_vkr_user").on(table.userId),
		vaultKeyRedemptionsId: primaryKey({ columns: [table.id], name: "vault_key_redemptions_id"}),
		idxVkrUnique: unique("idx_vkr_unique").on(table.vaultKeyId, table.userId),
	}
});

export const vaultKeys = mysqlTable("vault_keys", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }),
	code: varchar({ length: 40 }).notNull(),
	label: varchar({ length: 160 }).notNull(),
	keyType: mysqlEnum("key_type", ['one_use','window','multi']).default('multi').notNull(),
	unlocks: json().notNull(),
	maxRedemptions: int("max_redemptions"),
	redemptions: int().default(0).notNull(),
	startsAt: datetime("starts_at", { mode: 'string'}),
	expiresAt: datetime("expires_at", { mode: 'string'}),
	status: mysqlEnum(['active','disabled']).default('active').notNull(),
	createdBy: varchar("created_by", { length: 36 }),
	createdByAffiliateId: varchar("created_by_affiliate_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxVkStatus: index("idx_vk_status").on(table.status),
		vaultKeysId: primaryKey({ columns: [table.id], name: "vault_keys_id"}),
		idxVkCode: unique("idx_vk_code").on(table.code),
	}
});

export const wasteRecords = mysqlTable("waste_records", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	productId: varchar("product_id", { length: 36 }),
	productName: varchar("product_name", { length: 200 }).notNull(),
	quantity: decimal({ precision: 10, scale: 3 }).notNull(),
	unit: varchar({ length: 20 }).default('unidad').notNull(),
	wasteType: mysqlEnum("waste_type", ['natural','operativa','administrativa','vencimiento']).default('operativa').notNull(),
	reason: mysqlEnum(['quemado','vencido','mal_corte','devolucion','consumo_interno','robo','cortesia','sobreporcion','dano','otro']).default('otro').notNull(),
	costValue: decimal("cost_value", { precision: 12, scale: 2 }).default('0.00').notNull(),
	area: mysqlEnum(['cocina','bar','general']).default('cocina').notNull(),
	responsibleId: varchar("responsible_id", { length: 36 }),
	responsibleName: varchar("responsible_name", { length: 100 }),
	notes: text(),
	photoUrl: varchar("photo_url", { length: 500 }),
	recordedBy: varchar("recorded_by", { length: 36 }).notNull(),
	recordedByName: varchar("recorded_by_name", { length: 100 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
},
(table) => {
	return {
		idxWrArea: index("idx_wr_area").on(table.area),
		idxWrProduct: index("idx_wr_product").on(table.productId),
		idxWrTenantDate: index("idx_wr_tenant_date").on(table.tenantId, table.createdAt),
		wasteRecordsId: primaryKey({ columns: [table.id], name: "waste_records_id"}),
	}
});

export const wompiTransactions = mysqlTable("wompi_transactions", {
	reference: varchar({ length: 64 }).notNull(),
	owner: varchar({ length: 20 }).default('platform').notNull(),
	tenantId: varchar("tenant_id", { length: 36 }),
	context: varchar({ length: 30 }).notNull(),
	contextId: varchar("context_id", { length: 64 }),
	amountInCents: bigint("amount_in_cents", { mode: "number" }).notNull(),
	currency: varchar({ length: 3 }).default('COP').notNull(),
	status: varchar({ length: 20 }).default('PENDING').notNull(),
	wompiId: varchar("wompi_id", { length: 80 }),
	customerEmail: varchar("customer_email", { length: 255 }),
	payload: json(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxWtxContext: index("idx_wtx_context").on(table.context, table.contextId),
		idxWtxStatus: index("idx_wtx_status").on(table.status),
		idxWtxTenant: index("idx_wtx_tenant").on(table.tenantId),
		wompiTransactionsReference: primaryKey({ columns: [table.reference], name: "wompi_transactions_reference"}),
	}
});

export const workOrderMaterials = mysqlTable("work_order_materials", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 36 }),
	productName: varchar("product_name", { length: 255 }).notNull(),
	quantity: decimal({ precision: 10, scale: 3 }).default('1.000').notNull(),
	unit: varchar({ length: 50 }).default('unidad').notNull(),
	unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).default('0.00').notNull(),
	totalCost: decimal("total_cost", { precision: 12, scale: 2 }).default('0.00').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxWoMatOrder: index("idx_wo_mat_order").on(table.workOrderId),
		tenantId: index("tenant_id").on(table.tenantId),
		workOrderMaterialsId: primaryKey({ columns: [table.id], name: "work_order_materials_id"}),
	}
});

export const workOrderPayments = mysqlTable("work_order_payments", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id, { onDelete: "cascade" } ),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	paymentMethod: mysqlEnum("payment_method", ['efectivo','tarjeta','transferencia','nequi','otro']).default('efectivo').notNull(),
	notes: text(),
	receivedBy: varchar("received_by", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxWoPayOrder: index("idx_wo_pay_order").on(table.workOrderId),
		idxWoPayTenant: index("idx_wo_pay_tenant").on(table.tenantId),
		receivedBy: index("received_by").on(table.receivedBy),
		workOrderPaymentsId: primaryKey({ columns: [table.id], name: "work_order_payments_id"}),
	}
});

export const workOrderSequence = mysqlTable("work_order_sequence", {
	id: int().autoincrement().notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	prefix: varchar({ length: 10 }).default('OT').notNull(),
	currentNumber: int("current_number").default(0).notNull(),
},
(table) => {
	return {
		workOrderSequenceId: primaryKey({ columns: [table.id], name: "work_order_sequence_id"}),
		idxWoSeqTenant: unique("idx_wo_seq_tenant").on(table.tenantId),
	}
});

export const workOrders = mysqlTable("work_orders", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	orderNumber: varchar("order_number", { length: 20 }).notNull(),
	customerId: varchar("customer_id", { length: 36 }),
	customerName: varchar("customer_name", { length: 255 }).notNull(),
	customerPhone: varchar("customer_phone", { length: 50 }),
	itemDescription: varchar("item_description", { length: 500 }).notNull(),
	itemType: varchar("item_type", { length: 100 }).default('vehiculo').notNull(),
	jobType: varchar("job_type", { length: 100 }).default('tapizado_completo').notNull(),
	fabricDescription: varchar("fabric_description", { length: 300 }),
	quotedPrice: decimal("quoted_price", { precision: 12, scale: 2 }).default('0.00').notNull(),
	advancePaid: decimal("advance_paid", { precision: 12, scale: 2 }).default('0.00').notNull(),
	receivedAt: timestamp("received_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	promisedAt: date("promised_at", { mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	status: mysqlEnum(['recibido','cotizado','aprobado','en_proceso','listo','entregado','cancelado']).default('recibido').notNull(),
	notes: text(),
	assignedTo: varchar("assigned_to", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	saleId: varchar("sale_id", { length: 36 }),
	photosIn: json("photos_in"),
	photosOut: json("photos_out"),
	createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" } ),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		assignedTo: index("assigned_to").on(table.assignedTo),
		createdBy: index("created_by").on(table.createdBy),
		idxWoCustomer: index("idx_wo_customer").on(table.tenantId, table.customerName),
		idxWoPromised: index("idx_wo_promised").on(table.tenantId, table.promisedAt),
		idxWoTenantStatus: index("idx_wo_tenant_status").on(table.tenantId, table.status),
		workOrdersId: primaryKey({ columns: [table.id], name: "work_orders_id"}),
		idxWoNumber: unique("idx_wo_number").on(table.tenantId, table.orderNumber),
	}
});

export const workoutExercises = mysqlTable("workout_exercises", {
	id: varchar({ length: 36 }).notNull(),
	sessionId: varchar("session_id", { length: 36 }).notNull().references(() => workoutSessions.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	exerciseId: varchar("exercise_id", { length: 80 }).notNull(),
	exerciseName: varchar("exercise_name", { length: 160 }),
	exerciseOrder: int("exercise_order").default(0).notNull(),
	targetSets: int("target_sets").notNull(),
	targetReps: int("target_reps").notNull(),
	suggestedWeight: decimal("suggested_weight", { precision: 8, scale: 2 }).default('0.00').notNull(),
	movementPattern: varchar("movement_pattern", { length: 10 }),
	completed: tinyint().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxWeSession: index("idx_we_session").on(table.sessionId, table.exerciseOrder),
		idxWeUserEx: index("idx_we_user_ex").on(table.userId, table.exerciseId),
		workoutExercisesId: primaryKey({ columns: [table.id], name: "workout_exercises_id"}),
	}
});

export const workoutSessions = mysqlTable("workout_sessions", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	routineId: varchar("routine_id", { length: 36 }),
	goal: varchar({ length: 20 }).default('hypertrophy').notNull(),
	status: mysqlEnum(['pending','active','paused','completed','cancelled']).default('active').notNull(),
	startedAt: datetime("started_at", { mode: 'string'}),
	completedAt: datetime("completed_at", { mode: 'string'}),
	durationSeconds: int("duration_seconds"),
	totalVolume: decimal("total_volume", { precision: 12, scale: 2 }).default('0.00').notNull(),
	currentExerciseIndex: int("current_exercise_index").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxWsUser: index("idx_ws_user").on(table.userId, table.status),
		idxWsUserCreated: index("idx_ws_user_created").on(table.userId, table.createdAt),
		workoutSessionsId: primaryKey({ columns: [table.id], name: "workout_sessions_id"}),
	}
});

export const workoutSets = mysqlTable("workout_sets", {
	id: varchar({ length: 36 }).notNull(),
	exerciseSessionId: varchar("exercise_session_id", { length: 36 }).notNull().references(() => workoutExercises.id, { onDelete: "cascade" } ),
	userId: varchar("user_id", { length: 36 }).notNull(),
	setNumber: int("set_number").notNull(),
	targetReps: int("target_reps").notNull(),
	completedReps: int("completed_reps"),
	targetWeight: decimal("target_weight", { precision: 8, scale: 2 }).default('0.00').notNull(),
	usedWeight: decimal("used_weight", { precision: 8, scale: 2 }),
	completed: tinyint().default(0).notNull(),
	completedAt: datetime("completed_at", { mode: 'string'}),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxWsetExercise: index("idx_wset_exercise").on(table.exerciseSessionId, table.setNumber),
		workoutSetsId: primaryKey({ columns: [table.id], name: "workout_sets_id"}),
	}
});

export const deliveryZones = mysqlTable("delivery_zones", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
	name: varchar({ length: 100 }).notNull(),
	city: varchar({ length: 100 }).notNull(),
	polygon: text(), // JSON: [[lat,lng], ...]
	isActive: tinyint("is_active").default(1).notNull(),
	deliveryFeeBase: decimal("delivery_fee_base", { precision: 10, scale: 2 }).default('0.00').notNull(),
	maxRadiusKm: decimal("max_radius_km", { precision: 5, scale: 2 }),
	minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }).default('0.00').notNull(),
	estimatedMinutes: int("estimated_minutes").default(30).notNull(),
	color: varchar({ length: 20 }).default('#3B82F6'),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxZoneTenant: index("idx_zone_tenant").on(table.tenantId),
		idxZoneCity: index("idx_zone_city").on(table.city),
		idxZoneActive: index("idx_zone_active").on(table.isActive),
		deliveryZonesId: primaryKey({ columns: [table.id], name: "delivery_zones_id"}),
	}
});

export const deliveryChatRooms = mysqlTable("delivery_chat_rooms", {
	id: varchar({ length: 36 }).notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	closedAt: timestamp("closed_at", { mode: 'string' }),
},
(table) => {
	return {
		idxChatRoomOrder: index("idx_chat_room_order").on(table.orderId),
		idxChatRoomTenant: index("idx_chat_room_tenant").on(table.tenantId),
		idxChatRoomStatus: index("idx_chat_room_status").on(table.status),
		deliveryChatRoomsId: primaryKey({ columns: [table.id], name: "delivery_chat_rooms_id"}),
	}
});

export const deliveryChatMessages = mysqlTable("delivery_chat_messages", {
	id: varchar({ length: 36 }).notNull(),
	roomId: varchar("room_id", { length: 36 }).notNull(),
	senderId: varchar("sender_id", { length: 36 }).notNull(),
	senderName: varchar("sender_name", { length: 100 }).notNull(),
	senderRole: varchar("sender_role", { length: 30 }).notNull(),
	message: text().notNull(),
	messageType: varchar("message_type", { length: 20 }).default('text').notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxChatMsgRoom: index("idx_chat_msg_room").on(table.roomId),
		idxChatMsgSender: index("idx_chat_msg_sender").on(table.senderId),
		idxChatMsgCreated: index("idx_chat_msg_created").on(table.createdAt),
		deliveryChatMessagesId: primaryKey({ columns: [table.id], name: "delivery_chat_messages_id"}),
	}
});

export const courierAvailability = mysqlTable("courier_availability", {
	userId: varchar("user_id", { length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	isOnline: tinyint("is_online").default(0).notNull(),
	currentLat: decimal("current_lat", { precision: 10, scale: 7 }),
	currentLng: decimal("current_lng", { precision: 10, scale: 7 }),
	// Estado operativo del personal (asignación inteligente + tablero de bodega)
	status: mysqlEnum(['disponible','en_ruta','descargando','almuerzo','fuera_turno','incapacidad']).default('disponible').notNull(),
	lastSeenAt: timestamp("last_seen_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxAvailTenant: index("idx_avail_tenant").on(table.tenantId, table.isOnline),
		courierAvailabilityUserId: primaryKey({ columns: [table.userId], name: "courier_availability_user_id"}),
	}
});

// Repartidor de plataforma ↔ comercios que puede atender (asignados por superadmin).
// Un repartidor con tenant_id NULL solo ve pedidos de los comercios listados aquí.
export const courierTenants = mysqlTable("courier_tenants", {
	id: varchar({ length: 36 }).notNull(),
	courierUserId: varchar("courier_user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" } ),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	assignedBy: varchar("assigned_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
},
(table) => {
	return {
		idxCourierTenantsCourier: index("idx_courier_tenants_courier").on(table.courierUserId),
		idxCourierTenantsTenant: index("idx_courier_tenants_tenant").on(table.tenantId),
		ukCourierTenant: unique("uk_courier_tenant").on(table.courierUserId, table.tenantId),
		courierTenantsId: primaryKey({ columns: [table.id], name: "courier_tenants_id"}),
	}
});

// Links de campaña compartibles (historias IG/TikTok). El superadmin crea un link
// que redirige a un producto, a una tienda, o a una "colección" filtrada por rubro
// y/o comercios (solo restaurantes, etc.) para no distraer con otras categorías.
// Combos por día (evento recurrente): se activan ciertos días de la semana, se
// arman con ítems elegibles seleccionados (no toda la categoría), con tamaños
// (x2/x3) a precio fijo e inclusiones. Ver combo_items.
export const combos = mysqlTable("combos", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull().references(() => tenants.id, { onDelete: "cascade" } ),
	name: varchar({ length: 150 }).notNull(),
	activeDays: json("active_days").notNull(),   // [0..6] (0=Dom) — días en que se ofrece
	sizes: json().notNull(),                      // [{ count:2, price:45000 }, { count:3, price:62000 }]
	includes: text(),                             // "Papas rústicas + Coca-Cola mini"
	imageUrl: varchar("image_url", { length: 500 }),
	isActive: tinyint("is_active").default(1).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		idxCombosTenant: index("idx_combos_tenant").on(table.tenantId, table.isActive),
		combosId: primaryKey({ columns: [table.id], name: "combos_id"}),
	}
});

export const comboItems = mysqlTable("combo_items", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	comboId: varchar("combo_id", { length: 36 }).notNull().references(() => combos.id, { onDelete: "cascade" } ),
	productId: varchar("product_id", { length: 36 }).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
},
(table) => {
	return {
		idxComboItemsCombo: index("idx_combo_items_combo").on(table.comboId),
		comboItemsId: primaryKey({ columns: [table.id], name: "combo_items_id"}),
	}
});

export const shareLinks = mysqlTable("share_links", {
	id: varchar({ length: 36 }).notNull(),
	code: varchar({ length: 32 }).notNull(),
	type: mysqlEnum(['product','store','collection']).notNull(),
	config: json().notNull(),   // producto:{slug,productId} · tienda:{slug} · colección:{businessTypes:[],tenantIds:[]}
	title: varchar({ length: 200 }),
	clicks: int().default(0).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
},
(table) => {
	return {
		ukShareLinkCode: unique("uk_share_link_code").on(table.code),
		idxShareLinkActive: index("idx_share_link_active").on(table.isActive),
		shareLinksId: primaryKey({ columns: [table.id], name: "share_links_id"}),
	}
});

export const vCustomerBalances = mysqlView("v_customer_balances", {
	customerId: varchar("customer_id", { length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	cedula: varchar({ length: 20 }).notNull(),
	customerName: varchar("customer_name", { length: 255 }).notNull(),
	phone: varchar({ length: 50 }),
	email: varchar({ length: 255 }),
	address: varchar({ length: 500 }),
	creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }).default('0.00').notNull(),
	notes: text(),
	totalCredit: decimal("total_credit", { precision: 34, scale: 2 }).default('0.00').notNull(),
	totalPaid: decimal("total_paid", { precision: 34, scale: 2 }).default('0.00').notNull(),
	balance: decimal({ precision: 35, scale: 2 }).default('0.00').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
}).algorithm("undefined").sqlSecurity("definer").as(sql`select \`c\`.\`id\` AS \`customer_id\`,\`c\`.\`tenant_id\` AS \`tenant_id\`,\`c\`.\`cedula\` AS \`cedula\`,\`c\`.\`name\` AS \`customer_name\`,\`c\`.\`phone\` AS \`phone\`,\`c\`.\`email\` AS \`email\`,\`c\`.\`address\` AS \`address\`,\`c\`.\`credit_limit\` AS \`credit_limit\`,\`c\`.\`notes\` AS \`notes\`,coalesce(\`s_agg\`.\`total_credit\`,0) AS \`total_credit\`,coalesce(\`cp_agg\`.\`total_paid\`,0) AS \`total_paid\`,(coalesce(\`s_agg\`.\`total_credit\`,0) - coalesce(\`cp_agg\`.\`total_paid\`,0)) AS \`balance\`,\`c\`.\`created_at\` AS \`created_at\`,\`c\`.\`updated_at\` AS \`updated_at\` from ((\`lopbuk\`.\`customers\` \`c\` left join (select \`lopbuk\`.\`sales\`.\`customer_id\` AS \`customer_id\`,sum(\`lopbuk\`.\`sales\`.\`total\`) AS \`total_credit\` from \`lopbuk\`.\`sales\` where ((\`lopbuk\`.\`sales\`.\`payment_method\` = 'fiado') and (\`lopbuk\`.\`sales\`.\`status\` = 'completada')) group by \`lopbuk\`.\`sales\`.\`customer_id\`) \`s_agg\` on((\`s_agg\`.\`customer_id\` = \`c\`.\`id\`))) left join (select \`lopbuk\`.\`credit_payments\`.\`customer_id\` AS \`customer_id\`,sum(\`lopbuk\`.\`credit_payments\`.\`amount\`) AS \`total_paid\` from \`lopbuk\`.\`credit_payments\` group by \`lopbuk\`.\`credit_payments\`.\`customer_id\`) \`cp_agg\` on((\`cp_agg\`.\`customer_id\` = \`c\`.\`id\`)))`);

export const vProductsExpiringSoon = mysqlView("v_products_expiring_soon", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	articulo: varchar({ length: 255 }),
	category: varchar({ length: 50 }).notNull(),
	productType: mysqlEnum("product_type", ['general','alimentos','bebidas','ropa','electronica','farmacia','ferreteria','libreria','juguetes','cosmetica','perfumes','deportes','hogar','mascotas','otros']).default('general').notNull(),
	brand: varchar({ length: 100 }),
	model: varchar({ length: 100 }),
	description: text(),
	purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).default('0.00').notNull(),
	salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
	sku: varchar({ length: 50 }).notNull(),
	barcode: varchar({ length: 100 }),
	stock: int().default(0).notNull(),
	reorderPoint: int("reorder_point").default(5).notNull(),
	supplier: varchar({ length: 255 }),
	supplierId: varchar("supplier_id", { length: 50 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	entryDate: date("entry_date", { mode: 'string' }).notNull(),
	imageUrl: varchar("image_url", { length: 500 }),
	imageUrls: json("image_urls"),
	locationInStore: varchar("location_in_store", { length: 100 }),
	notes: text(),
	tags: json(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	expiryDate: date("expiry_date", { mode: 'string' }),
	batchNumber: varchar("batch_number", { length: 50 }),
	netWeight: decimal("net_weight", { precision: 10, scale: 3 }),
	weightUnit: mysqlEnum("weight_unit", ['g','kg','ml','l','oz','lb','unidad']),
	sanitaryRegistration: varchar("sanitary_registration", { length: 100 }),
	storageTemperature: varchar("storage_temperature", { length: 50 }),
	ingredients: text(),
	nutritionalInfo: text("nutritional_info"),
	alcoholContent: decimal("alcohol_content", { precision: 5, scale: 2 }),
	allergens: text(),
	size: varchar({ length: 20 }),
	color: varchar({ length: 50 }),
	material: varchar({ length: 100 }),
	gender: mysqlEnum(['hombre','mujer','unisex','ni??o','ni??a']),
	season: mysqlEnum(['verano','invierno','primavera','oto??o','todo_a??o']),
	garmentType: varchar("garment_type", { length: 50 }),
	washingInstructions: text("washing_instructions"),
	countryOfOrigin: varchar("country_of_origin", { length: 50 }),
	serialNumber: varchar("serial_number", { length: 100 }),
	warrantyMonths: int("warranty_months"),
	technicalSpecs: text("technical_specs"),
	voltage: varchar({ length: 20 }),
	powerWatts: int("power_watts"),
	compatibility: text(),
	includesAccessories: text("includes_accessories"),
	productCondition: mysqlEnum("product_condition", ['nuevo','reacondicionado','usado','exhibici??n']).default('nuevo'),
	activeIngredient: varchar("active_ingredient", { length: 200 }),
	concentration: varchar({ length: 50 }),
	requiresPrescription: tinyint("requires_prescription").default(0),
	administrationRoute: varchar("administration_route", { length: 50 }),
	presentation: varchar({ length: 50 }),
	unitsPerPackage: int("units_per_package"),
	laboratory: varchar({ length: 100 }),
	contraindications: text(),
	dimensions: varchar({ length: 50 }),
	weight: decimal({ precision: 10, scale: 3 }),
	hardwareWeightUnit: mysqlEnum("hardware_weight_unit", ['kg','ton','lb','g']).default('kg'),
	caliber: varchar({ length: 20 }),
	resistance: varchar({ length: 50 }),
	finish: varchar({ length: 50 }),
	recommendedUse: text("recommended_use"),
	author: varchar({ length: 200 }),
	publisher: varchar({ length: 100 }),
	isbn: varchar({ length: 20 }),
	pages: int(),
	language: varchar({ length: 50 }),
	publicationYear: int("publication_year"),
	edition: varchar({ length: 50 }),
	bookFormat: mysqlEnum("book_format", ['pasta_dura','pasta_blanda','digital','audio']),
	recommendedAge: varchar("recommended_age", { length: 50 }),
	numberOfPlayers: varchar("number_of_players", { length: 20 }),
	gameType: varchar("game_type", { length: 50 }),
	requiresBatteries: tinyint("requires_batteries"),
	packageDimensions: varchar("package_dimensions", { length: 50 }),
	packageContents: text("package_contents"),
	safetyWarnings: text("safety_warnings"),
	publishedInStore: tinyint("published_in_store").default(0).notNull(),
	availableForDelivery: tinyint("available_for_delivery").default(0).notNull(),
	deliveryType: mysqlEnum("delivery_type", ['domicilio','envio','ambos']),
	isNewLaunch: tinyint("is_new_launch").default(0).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	launchDate: date("launch_date", { mode: 'string' }),
	isPreorder: tinyint("is_preorder").default(0).notNull(),
	preorderWindowEnd: datetime("preorder_window_end", { mode: 'string'}),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipStart: date("preorder_ship_start", { mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipEnd: date("preorder_ship_end", { mode: 'string' }),
	preorderBadgeText: varchar("preorder_badge_text", { length: 60 }).default('Pre-orden').notNull(),
	preorderPolicyText: text("preorder_policy_text"),
	isOnOffer: tinyint("is_on_offer").default(0).notNull(),
	offerPrice: decimal("offer_price", { precision: 12, scale: 2 }),
	offerLabel: varchar("offer_label", { length: 100 }),
	offerStart: datetime("offer_start", { mode: 'string'}),
	offerEnd: datetime("offer_end", { mode: 'string'}),
	sedeId: varchar("sede_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	createdBy: varchar("created_by", { length: 50 }),
	updatedBy: varchar("updated_by", { length: 50 }),
	isMenuItem: tinyint("is_menu_item").default(0).notNull(),
	isIngredient: tinyint("is_ingredient").default(0).notNull(),
	preparationArea: mysqlEnum("preparation_area", ['bar','cocina','ambos']),
	prepTimeMinutes: int("prep_time_minutes"),
	availableInMenu: tinyint("available_in_menu").default(1).notNull(),
	qtyPromo: text("qty_promo"),
	images: text(),
	hormaId: varchar("horma_id", { length: 36 }),
	basePrice: decimal("base_price", { precision: 12, scale: 2 }),
	categoryName: varchar("category_name", { length: 100 }),
	daysUntilExpiry: int("days_until_expiry"),
}).algorithm("undefined").sqlSecurity("definer").as(sql`select \`p\`.\`id\` AS \`id\`,\`p\`.\`tenant_id\` AS \`tenant_id\`,\`p\`.\`name\` AS \`name\`,\`p\`.\`articulo\` AS \`articulo\`,\`p\`.\`category\` AS \`category\`,\`p\`.\`product_type\` AS \`product_type\`,\`p\`.\`brand\` AS \`brand\`,\`p\`.\`model\` AS \`model\`,\`p\`.\`description\` AS \`description\`,\`p\`.\`purchase_price\` AS \`purchase_price\`,\`p\`.\`sale_price\` AS \`sale_price\`,\`p\`.\`sku\` AS \`sku\`,\`p\`.\`barcode\` AS \`barcode\`,\`p\`.\`stock\` AS \`stock\`,\`p\`.\`reorder_point\` AS \`reorder_point\`,\`p\`.\`supplier\` AS \`supplier\`,\`p\`.\`supplier_id\` AS \`supplier_id\`,\`p\`.\`entry_date\` AS \`entry_date\`,\`p\`.\`image_url\` AS \`image_url\`,\`p\`.\`image_urls\` AS \`image_urls\`,\`p\`.\`location_in_store\` AS \`location_in_store\`,\`p\`.\`notes\` AS \`notes\`,\`p\`.\`tags\` AS \`tags\`,\`p\`.\`expiry_date\` AS \`expiry_date\`,\`p\`.\`batch_number\` AS \`batch_number\`,\`p\`.\`net_weight\` AS \`net_weight\`,\`p\`.\`weight_unit\` AS \`weight_unit\`,\`p\`.\`sanitary_registration\` AS \`sanitary_registration\`,\`p\`.\`storage_temperature\` AS \`storage_temperature\`,\`p\`.\`ingredients\` AS \`ingredients\`,\`p\`.\`nutritional_info\` AS \`nutritional_info\`,\`p\`.\`alcohol_content\` AS \`alcohol_content\`,\`p\`.\`allergens\` AS \`allergens\`,\`p\`.\`size\` AS \`size\`,\`p\`.\`color\` AS \`color\`,\`p\`.\`material\` AS \`material\`,\`p\`.\`gender\` AS \`gender\`,\`p\`.\`season\` AS \`season\`,\`p\`.\`garment_type\` AS \`garment_type\`,\`p\`.\`washing_instructions\` AS \`washing_instructions\`,\`p\`.\`country_of_origin\` AS \`country_of_origin\`,\`p\`.\`serial_number\` AS \`serial_number\`,\`p\`.\`warranty_months\` AS \`warranty_months\`,\`p\`.\`technical_specs\` AS \`technical_specs\`,\`p\`.\`voltage\` AS \`voltage\`,\`p\`.\`power_watts\` AS \`power_watts\`,\`p\`.\`compatibility\` AS \`compatibility\`,\`p\`.\`includes_accessories\` AS \`includes_accessories\`,\`p\`.\`product_condition\` AS \`product_condition\`,\`p\`.\`active_ingredient\` AS \`active_ingredient\`,\`p\`.\`concentration\` AS \`concentration\`,\`p\`.\`requires_prescription\` AS \`requires_prescription\`,\`p\`.\`administration_route\` AS \`administration_route\`,\`p\`.\`presentation\` AS \`presentation\`,\`p\`.\`units_per_package\` AS \`units_per_package\`,\`p\`.\`laboratory\` AS \`laboratory\`,\`p\`.\`contraindications\` AS \`contraindications\`,\`p\`.\`dimensions\` AS \`dimensions\`,\`p\`.\`weight\` AS \`weight\`,\`p\`.\`hardware_weight_unit\` AS \`hardware_weight_unit\`,\`p\`.\`caliber\` AS \`caliber\`,\`p\`.\`resistance\` AS \`resistance\`,\`p\`.\`finish\` AS \`finish\`,\`p\`.\`recommended_use\` AS \`recommended_use\`,\`p\`.\`author\` AS \`author\`,\`p\`.\`publisher\` AS \`publisher\`,\`p\`.\`isbn\` AS \`isbn\`,\`p\`.\`pages\` AS \`pages\`,\`p\`.\`language\` AS \`language\`,\`p\`.\`publication_year\` AS \`publication_year\`,\`p\`.\`edition\` AS \`edition\`,\`p\`.\`book_format\` AS \`book_format\`,\`p\`.\`recommended_age\` AS \`recommended_age\`,\`p\`.\`number_of_players\` AS \`number_of_players\`,\`p\`.\`game_type\` AS \`game_type\`,\`p\`.\`requires_batteries\` AS \`requires_batteries\`,\`p\`.\`package_dimensions\` AS \`package_dimensions\`,\`p\`.\`package_contents\` AS \`package_contents\`,\`p\`.\`safety_warnings\` AS \`safety_warnings\`,\`p\`.\`published_in_store\` AS \`published_in_store\`,\`p\`.\`available_for_delivery\` AS \`available_for_delivery\`,\`p\`.\`delivery_type\` AS \`delivery_type\`,\`p\`.\`is_new_launch\` AS \`is_new_launch\`,\`p\`.\`launch_date\` AS \`launch_date\`,\`p\`.\`is_preorder\` AS \`is_preorder\`,\`p\`.\`preorder_window_end\` AS \`preorder_window_end\`,\`p\`.\`preorder_ship_start\` AS \`preorder_ship_start\`,\`p\`.\`preorder_ship_end\` AS \`preorder_ship_end\`,\`p\`.\`preorder_badge_text\` AS \`preorder_badge_text\`,\`p\`.\`preorder_policy_text\` AS \`preorder_policy_text\`,\`p\`.\`is_on_offer\` AS \`is_on_offer\`,\`p\`.\`offer_price\` AS \`offer_price\`,\`p\`.\`offer_label\` AS \`offer_label\`,\`p\`.\`offer_start\` AS \`offer_start\`,\`p\`.\`offer_end\` AS \`offer_end\`,\`p\`.\`sede_id\` AS \`sede_id\`,\`p\`.\`created_at\` AS \`created_at\`,\`p\`.\`updated_at\` AS \`updated_at\`,\`p\`.\`created_by\` AS \`created_by\`,\`p\`.\`updated_by\` AS \`updated_by\`,\`p\`.\`is_menu_item\` AS \`is_menu_item\`,\`p\`.\`is_ingredient\` AS \`is_ingredient\`,\`p\`.\`preparation_area\` AS \`preparation_area\`,\`p\`.\`prep_time_minutes\` AS \`prep_time_minutes\`,\`p\`.\`available_in_menu\` AS \`available_in_menu\`,\`p\`.\`qty_promo\` AS \`qty_promo\`,\`p\`.\`images\` AS \`images\`,\`p\`.\`horma_id\` AS \`horma_id\`,\`p\`.\`base_price\` AS \`base_price\`,\`c\`.\`name\` AS \`category_name\`,(to_days(\`p\`.\`expiry_date\`) - to_days(curdate())) AS \`days_until_expiry\` from (\`lopbuk\`.\`products\` \`p\` left join \`lopbuk\`.\`categories\` \`c\` on(((\`p\`.\`category\` = \`c\`.\`id\`) and (\`p\`.\`tenant_id\` = \`c\`.\`tenant_id\`)))) where ((\`p\`.\`expiry_date\` is not null) and (\`p\`.\`expiry_date\` <= (curdate() + interval 30 day)) and (\`p\`.\`expiry_date\` >= curdate())) order by \`p\`.\`expiry_date\``);

export const vProductsLowStock = mysqlView("v_products_low_stock", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	articulo: varchar({ length: 255 }),
	category: varchar({ length: 50 }).notNull(),
	productType: mysqlEnum("product_type", ['general','alimentos','bebidas','ropa','electronica','farmacia','ferreteria','libreria','juguetes','cosmetica','perfumes','deportes','hogar','mascotas','otros']).default('general').notNull(),
	brand: varchar({ length: 100 }),
	model: varchar({ length: 100 }),
	description: text(),
	purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).default('0.00').notNull(),
	salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
	sku: varchar({ length: 50 }).notNull(),
	barcode: varchar({ length: 100 }),
	stock: int().default(0).notNull(),
	reorderPoint: int("reorder_point").default(5).notNull(),
	supplier: varchar({ length: 255 }),
	supplierId: varchar("supplier_id", { length: 50 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	entryDate: date("entry_date", { mode: 'string' }).notNull(),
	imageUrl: varchar("image_url", { length: 500 }),
	imageUrls: json("image_urls"),
	locationInStore: varchar("location_in_store", { length: 100 }),
	notes: text(),
	tags: json(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	expiryDate: date("expiry_date", { mode: 'string' }),
	batchNumber: varchar("batch_number", { length: 50 }),
	netWeight: decimal("net_weight", { precision: 10, scale: 3 }),
	weightUnit: mysqlEnum("weight_unit", ['g','kg','ml','l','oz','lb','unidad']),
	sanitaryRegistration: varchar("sanitary_registration", { length: 100 }),
	storageTemperature: varchar("storage_temperature", { length: 50 }),
	ingredients: text(),
	nutritionalInfo: text("nutritional_info"),
	alcoholContent: decimal("alcohol_content", { precision: 5, scale: 2 }),
	allergens: text(),
	size: varchar({ length: 20 }),
	color: varchar({ length: 50 }),
	material: varchar({ length: 100 }),
	gender: mysqlEnum(['hombre','mujer','unisex','ni??o','ni??a']),
	season: mysqlEnum(['verano','invierno','primavera','oto??o','todo_a??o']),
	garmentType: varchar("garment_type", { length: 50 }),
	washingInstructions: text("washing_instructions"),
	countryOfOrigin: varchar("country_of_origin", { length: 50 }),
	serialNumber: varchar("serial_number", { length: 100 }),
	warrantyMonths: int("warranty_months"),
	technicalSpecs: text("technical_specs"),
	voltage: varchar({ length: 20 }),
	powerWatts: int("power_watts"),
	compatibility: text(),
	includesAccessories: text("includes_accessories"),
	productCondition: mysqlEnum("product_condition", ['nuevo','reacondicionado','usado','exhibici??n']).default('nuevo'),
	activeIngredient: varchar("active_ingredient", { length: 200 }),
	concentration: varchar({ length: 50 }),
	requiresPrescription: tinyint("requires_prescription").default(0),
	administrationRoute: varchar("administration_route", { length: 50 }),
	presentation: varchar({ length: 50 }),
	unitsPerPackage: int("units_per_package"),
	laboratory: varchar({ length: 100 }),
	contraindications: text(),
	dimensions: varchar({ length: 50 }),
	weight: decimal({ precision: 10, scale: 3 }),
	hardwareWeightUnit: mysqlEnum("hardware_weight_unit", ['kg','ton','lb','g']).default('kg'),
	caliber: varchar({ length: 20 }),
	resistance: varchar({ length: 50 }),
	finish: varchar({ length: 50 }),
	recommendedUse: text("recommended_use"),
	author: varchar({ length: 200 }),
	publisher: varchar({ length: 100 }),
	isbn: varchar({ length: 20 }),
	pages: int(),
	language: varchar({ length: 50 }),
	publicationYear: int("publication_year"),
	edition: varchar({ length: 50 }),
	bookFormat: mysqlEnum("book_format", ['pasta_dura','pasta_blanda','digital','audio']),
	recommendedAge: varchar("recommended_age", { length: 50 }),
	numberOfPlayers: varchar("number_of_players", { length: 20 }),
	gameType: varchar("game_type", { length: 50 }),
	requiresBatteries: tinyint("requires_batteries"),
	packageDimensions: varchar("package_dimensions", { length: 50 }),
	packageContents: text("package_contents"),
	safetyWarnings: text("safety_warnings"),
	publishedInStore: tinyint("published_in_store").default(0).notNull(),
	availableForDelivery: tinyint("available_for_delivery").default(0).notNull(),
	deliveryType: mysqlEnum("delivery_type", ['domicilio','envio','ambos']),
	isNewLaunch: tinyint("is_new_launch").default(0).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	launchDate: date("launch_date", { mode: 'string' }),
	isPreorder: tinyint("is_preorder").default(0).notNull(),
	preorderWindowEnd: datetime("preorder_window_end", { mode: 'string'}),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipStart: date("preorder_ship_start", { mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipEnd: date("preorder_ship_end", { mode: 'string' }),
	preorderBadgeText: varchar("preorder_badge_text", { length: 60 }).default('Pre-orden').notNull(),
	preorderPolicyText: text("preorder_policy_text"),
	isOnOffer: tinyint("is_on_offer").default(0).notNull(),
	offerPrice: decimal("offer_price", { precision: 12, scale: 2 }),
	offerLabel: varchar("offer_label", { length: 100 }),
	offerStart: datetime("offer_start", { mode: 'string'}),
	offerEnd: datetime("offer_end", { mode: 'string'}),
	sedeId: varchar("sede_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	createdBy: varchar("created_by", { length: 50 }),
	updatedBy: varchar("updated_by", { length: 50 }),
	isMenuItem: tinyint("is_menu_item").default(0).notNull(),
	isIngredient: tinyint("is_ingredient").default(0).notNull(),
	preparationArea: mysqlEnum("preparation_area", ['bar','cocina','ambos']),
	prepTimeMinutes: int("prep_time_minutes"),
	availableInMenu: tinyint("available_in_menu").default(1).notNull(),
	qtyPromo: text("qty_promo"),
	images: text(),
	hormaId: varchar("horma_id", { length: 36 }),
	basePrice: decimal("base_price", { precision: 12, scale: 2 }),
	categoryName: varchar("category_name", { length: 100 }),
}).algorithm("undefined").sqlSecurity("definer").as(sql`select \`p\`.\`id\` AS \`id\`,\`p\`.\`tenant_id\` AS \`tenant_id\`,\`p\`.\`name\` AS \`name\`,\`p\`.\`articulo\` AS \`articulo\`,\`p\`.\`category\` AS \`category\`,\`p\`.\`product_type\` AS \`product_type\`,\`p\`.\`brand\` AS \`brand\`,\`p\`.\`model\` AS \`model\`,\`p\`.\`description\` AS \`description\`,\`p\`.\`purchase_price\` AS \`purchase_price\`,\`p\`.\`sale_price\` AS \`sale_price\`,\`p\`.\`sku\` AS \`sku\`,\`p\`.\`barcode\` AS \`barcode\`,\`p\`.\`stock\` AS \`stock\`,\`p\`.\`reorder_point\` AS \`reorder_point\`,\`p\`.\`supplier\` AS \`supplier\`,\`p\`.\`supplier_id\` AS \`supplier_id\`,\`p\`.\`entry_date\` AS \`entry_date\`,\`p\`.\`image_url\` AS \`image_url\`,\`p\`.\`image_urls\` AS \`image_urls\`,\`p\`.\`location_in_store\` AS \`location_in_store\`,\`p\`.\`notes\` AS \`notes\`,\`p\`.\`tags\` AS \`tags\`,\`p\`.\`expiry_date\` AS \`expiry_date\`,\`p\`.\`batch_number\` AS \`batch_number\`,\`p\`.\`net_weight\` AS \`net_weight\`,\`p\`.\`weight_unit\` AS \`weight_unit\`,\`p\`.\`sanitary_registration\` AS \`sanitary_registration\`,\`p\`.\`storage_temperature\` AS \`storage_temperature\`,\`p\`.\`ingredients\` AS \`ingredients\`,\`p\`.\`nutritional_info\` AS \`nutritional_info\`,\`p\`.\`alcohol_content\` AS \`alcohol_content\`,\`p\`.\`allergens\` AS \`allergens\`,\`p\`.\`size\` AS \`size\`,\`p\`.\`color\` AS \`color\`,\`p\`.\`material\` AS \`material\`,\`p\`.\`gender\` AS \`gender\`,\`p\`.\`season\` AS \`season\`,\`p\`.\`garment_type\` AS \`garment_type\`,\`p\`.\`washing_instructions\` AS \`washing_instructions\`,\`p\`.\`country_of_origin\` AS \`country_of_origin\`,\`p\`.\`serial_number\` AS \`serial_number\`,\`p\`.\`warranty_months\` AS \`warranty_months\`,\`p\`.\`technical_specs\` AS \`technical_specs\`,\`p\`.\`voltage\` AS \`voltage\`,\`p\`.\`power_watts\` AS \`power_watts\`,\`p\`.\`compatibility\` AS \`compatibility\`,\`p\`.\`includes_accessories\` AS \`includes_accessories\`,\`p\`.\`product_condition\` AS \`product_condition\`,\`p\`.\`active_ingredient\` AS \`active_ingredient\`,\`p\`.\`concentration\` AS \`concentration\`,\`p\`.\`requires_prescription\` AS \`requires_prescription\`,\`p\`.\`administration_route\` AS \`administration_route\`,\`p\`.\`presentation\` AS \`presentation\`,\`p\`.\`units_per_package\` AS \`units_per_package\`,\`p\`.\`laboratory\` AS \`laboratory\`,\`p\`.\`contraindications\` AS \`contraindications\`,\`p\`.\`dimensions\` AS \`dimensions\`,\`p\`.\`weight\` AS \`weight\`,\`p\`.\`hardware_weight_unit\` AS \`hardware_weight_unit\`,\`p\`.\`caliber\` AS \`caliber\`,\`p\`.\`resistance\` AS \`resistance\`,\`p\`.\`finish\` AS \`finish\`,\`p\`.\`recommended_use\` AS \`recommended_use\`,\`p\`.\`author\` AS \`author\`,\`p\`.\`publisher\` AS \`publisher\`,\`p\`.\`isbn\` AS \`isbn\`,\`p\`.\`pages\` AS \`pages\`,\`p\`.\`language\` AS \`language\`,\`p\`.\`publication_year\` AS \`publication_year\`,\`p\`.\`edition\` AS \`edition\`,\`p\`.\`book_format\` AS \`book_format\`,\`p\`.\`recommended_age\` AS \`recommended_age\`,\`p\`.\`number_of_players\` AS \`number_of_players\`,\`p\`.\`game_type\` AS \`game_type\`,\`p\`.\`requires_batteries\` AS \`requires_batteries\`,\`p\`.\`package_dimensions\` AS \`package_dimensions\`,\`p\`.\`package_contents\` AS \`package_contents\`,\`p\`.\`safety_warnings\` AS \`safety_warnings\`,\`p\`.\`published_in_store\` AS \`published_in_store\`,\`p\`.\`available_for_delivery\` AS \`available_for_delivery\`,\`p\`.\`delivery_type\` AS \`delivery_type\`,\`p\`.\`is_new_launch\` AS \`is_new_launch\`,\`p\`.\`launch_date\` AS \`launch_date\`,\`p\`.\`is_preorder\` AS \`is_preorder\`,\`p\`.\`preorder_window_end\` AS \`preorder_window_end\`,\`p\`.\`preorder_ship_start\` AS \`preorder_ship_start\`,\`p\`.\`preorder_ship_end\` AS \`preorder_ship_end\`,\`p\`.\`preorder_badge_text\` AS \`preorder_badge_text\`,\`p\`.\`preorder_policy_text\` AS \`preorder_policy_text\`,\`p\`.\`is_on_offer\` AS \`is_on_offer\`,\`p\`.\`offer_price\` AS \`offer_price\`,\`p\`.\`offer_label\` AS \`offer_label\`,\`p\`.\`offer_start\` AS \`offer_start\`,\`p\`.\`offer_end\` AS \`offer_end\`,\`p\`.\`sede_id\` AS \`sede_id\`,\`p\`.\`created_at\` AS \`created_at\`,\`p\`.\`updated_at\` AS \`updated_at\`,\`p\`.\`created_by\` AS \`created_by\`,\`p\`.\`updated_by\` AS \`updated_by\`,\`p\`.\`is_menu_item\` AS \`is_menu_item\`,\`p\`.\`is_ingredient\` AS \`is_ingredient\`,\`p\`.\`preparation_area\` AS \`preparation_area\`,\`p\`.\`prep_time_minutes\` AS \`prep_time_minutes\`,\`p\`.\`available_in_menu\` AS \`available_in_menu\`,\`p\`.\`qty_promo\` AS \`qty_promo\`,\`p\`.\`images\` AS \`images\`,\`p\`.\`horma_id\` AS \`horma_id\`,\`p\`.\`base_price\` AS \`base_price\`,\`c\`.\`name\` AS \`category_name\` from (\`lopbuk\`.\`products\` \`p\` left join \`lopbuk\`.\`categories\` \`c\` on(((\`p\`.\`category\` = \`c\`.\`id\`) and (\`p\`.\`tenant_id\` = \`c\`.\`tenant_id\`)))) where ((\`p\`.\`stock\` <= \`p\`.\`reorder_point\`) and (\`p\`.\`stock\` >= 0)) order by (\`p\`.\`stock\` - \`p\`.\`reorder_point\`)`);

export const vProductsStockStatus = mysqlView("v_products_stock_status", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	articulo: varchar({ length: 255 }),
	category: varchar({ length: 50 }).notNull(),
	productType: mysqlEnum("product_type", ['general','alimentos','bebidas','ropa','electronica','farmacia','ferreteria','libreria','juguetes','cosmetica','perfumes','deportes','hogar','mascotas','otros']).default('general').notNull(),
	brand: varchar({ length: 100 }),
	model: varchar({ length: 100 }),
	description: text(),
	purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).default('0.00').notNull(),
	salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
	sku: varchar({ length: 50 }).notNull(),
	barcode: varchar({ length: 100 }),
	stock: int().default(0).notNull(),
	reorderPoint: int("reorder_point").default(5).notNull(),
	supplier: varchar({ length: 255 }),
	supplierId: varchar("supplier_id", { length: 50 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	entryDate: date("entry_date", { mode: 'string' }).notNull(),
	imageUrl: varchar("image_url", { length: 500 }),
	imageUrls: json("image_urls"),
	locationInStore: varchar("location_in_store", { length: 100 }),
	notes: text(),
	tags: json(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	expiryDate: date("expiry_date", { mode: 'string' }),
	batchNumber: varchar("batch_number", { length: 50 }),
	netWeight: decimal("net_weight", { precision: 10, scale: 3 }),
	weightUnit: mysqlEnum("weight_unit", ['g','kg','ml','l','oz','lb','unidad']),
	sanitaryRegistration: varchar("sanitary_registration", { length: 100 }),
	storageTemperature: varchar("storage_temperature", { length: 50 }),
	ingredients: text(),
	nutritionalInfo: text("nutritional_info"),
	alcoholContent: decimal("alcohol_content", { precision: 5, scale: 2 }),
	allergens: text(),
	size: varchar({ length: 20 }),
	color: varchar({ length: 50 }),
	material: varchar({ length: 100 }),
	gender: mysqlEnum(['hombre','mujer','unisex','ni??o','ni??a']),
	season: mysqlEnum(['verano','invierno','primavera','oto??o','todo_a??o']),
	garmentType: varchar("garment_type", { length: 50 }),
	washingInstructions: text("washing_instructions"),
	countryOfOrigin: varchar("country_of_origin", { length: 50 }),
	serialNumber: varchar("serial_number", { length: 100 }),
	warrantyMonths: int("warranty_months"),
	technicalSpecs: text("technical_specs"),
	voltage: varchar({ length: 20 }),
	powerWatts: int("power_watts"),
	compatibility: text(),
	includesAccessories: text("includes_accessories"),
	productCondition: mysqlEnum("product_condition", ['nuevo','reacondicionado','usado','exhibici??n']).default('nuevo'),
	activeIngredient: varchar("active_ingredient", { length: 200 }),
	concentration: varchar({ length: 50 }),
	requiresPrescription: tinyint("requires_prescription").default(0),
	administrationRoute: varchar("administration_route", { length: 50 }),
	presentation: varchar({ length: 50 }),
	unitsPerPackage: int("units_per_package"),
	laboratory: varchar({ length: 100 }),
	contraindications: text(),
	dimensions: varchar({ length: 50 }),
	weight: decimal({ precision: 10, scale: 3 }),
	hardwareWeightUnit: mysqlEnum("hardware_weight_unit", ['kg','ton','lb','g']).default('kg'),
	caliber: varchar({ length: 20 }),
	resistance: varchar({ length: 50 }),
	finish: varchar({ length: 50 }),
	recommendedUse: text("recommended_use"),
	author: varchar({ length: 200 }),
	publisher: varchar({ length: 100 }),
	isbn: varchar({ length: 20 }),
	pages: int(),
	language: varchar({ length: 50 }),
	publicationYear: int("publication_year"),
	edition: varchar({ length: 50 }),
	bookFormat: mysqlEnum("book_format", ['pasta_dura','pasta_blanda','digital','audio']),
	recommendedAge: varchar("recommended_age", { length: 50 }),
	numberOfPlayers: varchar("number_of_players", { length: 20 }),
	gameType: varchar("game_type", { length: 50 }),
	requiresBatteries: tinyint("requires_batteries"),
	packageDimensions: varchar("package_dimensions", { length: 50 }),
	packageContents: text("package_contents"),
	safetyWarnings: text("safety_warnings"),
	publishedInStore: tinyint("published_in_store").default(0).notNull(),
	availableForDelivery: tinyint("available_for_delivery").default(0).notNull(),
	deliveryType: mysqlEnum("delivery_type", ['domicilio','envio','ambos']),
	isNewLaunch: tinyint("is_new_launch").default(0).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	launchDate: date("launch_date", { mode: 'string' }),
	isPreorder: tinyint("is_preorder").default(0).notNull(),
	preorderWindowEnd: datetime("preorder_window_end", { mode: 'string'}),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipStart: date("preorder_ship_start", { mode: 'string' }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	preorderShipEnd: date("preorder_ship_end", { mode: 'string' }),
	preorderBadgeText: varchar("preorder_badge_text", { length: 60 }).default('Pre-orden').notNull(),
	preorderPolicyText: text("preorder_policy_text"),
	isOnOffer: tinyint("is_on_offer").default(0).notNull(),
	offerPrice: decimal("offer_price", { precision: 12, scale: 2 }),
	offerLabel: varchar("offer_label", { length: 100 }),
	offerStart: datetime("offer_start", { mode: 'string'}),
	offerEnd: datetime("offer_end", { mode: 'string'}),
	sedeId: varchar("sede_id", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	createdBy: varchar("created_by", { length: 50 }),
	updatedBy: varchar("updated_by", { length: 50 }),
	isMenuItem: tinyint("is_menu_item").default(0).notNull(),
	isIngredient: tinyint("is_ingredient").default(0).notNull(),
	preparationArea: mysqlEnum("preparation_area", ['bar','cocina','ambos']),
	prepTimeMinutes: int("prep_time_minutes"),
	availableInMenu: tinyint("available_in_menu").default(1).notNull(),
	qtyPromo: text("qty_promo"),
	images: text(),
	hormaId: varchar("horma_id", { length: 36 }),
	basePrice: decimal("base_price", { precision: 12, scale: 2 }),
	stockStatus: varchar("stock_status", { length: 10 }).notNull(),
}).algorithm("undefined").sqlSecurity("definer").as(sql`select \`p\`.\`id\` AS \`id\`,\`p\`.\`tenant_id\` AS \`tenant_id\`,\`p\`.\`name\` AS \`name\`,\`p\`.\`articulo\` AS \`articulo\`,\`p\`.\`category\` AS \`category\`,\`p\`.\`product_type\` AS \`product_type\`,\`p\`.\`brand\` AS \`brand\`,\`p\`.\`model\` AS \`model\`,\`p\`.\`description\` AS \`description\`,\`p\`.\`purchase_price\` AS \`purchase_price\`,\`p\`.\`sale_price\` AS \`sale_price\`,\`p\`.\`sku\` AS \`sku\`,\`p\`.\`barcode\` AS \`barcode\`,\`p\`.\`stock\` AS \`stock\`,\`p\`.\`reorder_point\` AS \`reorder_point\`,\`p\`.\`supplier\` AS \`supplier\`,\`p\`.\`supplier_id\` AS \`supplier_id\`,\`p\`.\`entry_date\` AS \`entry_date\`,\`p\`.\`image_url\` AS \`image_url\`,\`p\`.\`image_urls\` AS \`image_urls\`,\`p\`.\`location_in_store\` AS \`location_in_store\`,\`p\`.\`notes\` AS \`notes\`,\`p\`.\`tags\` AS \`tags\`,\`p\`.\`expiry_date\` AS \`expiry_date\`,\`p\`.\`batch_number\` AS \`batch_number\`,\`p\`.\`net_weight\` AS \`net_weight\`,\`p\`.\`weight_unit\` AS \`weight_unit\`,\`p\`.\`sanitary_registration\` AS \`sanitary_registration\`,\`p\`.\`storage_temperature\` AS \`storage_temperature\`,\`p\`.\`ingredients\` AS \`ingredients\`,\`p\`.\`nutritional_info\` AS \`nutritional_info\`,\`p\`.\`alcohol_content\` AS \`alcohol_content\`,\`p\`.\`allergens\` AS \`allergens\`,\`p\`.\`size\` AS \`size\`,\`p\`.\`color\` AS \`color\`,\`p\`.\`material\` AS \`material\`,\`p\`.\`gender\` AS \`gender\`,\`p\`.\`season\` AS \`season\`,\`p\`.\`garment_type\` AS \`garment_type\`,\`p\`.\`washing_instructions\` AS \`washing_instructions\`,\`p\`.\`country_of_origin\` AS \`country_of_origin\`,\`p\`.\`serial_number\` AS \`serial_number\`,\`p\`.\`warranty_months\` AS \`warranty_months\`,\`p\`.\`technical_specs\` AS \`technical_specs\`,\`p\`.\`voltage\` AS \`voltage\`,\`p\`.\`power_watts\` AS \`power_watts\`,\`p\`.\`compatibility\` AS \`compatibility\`,\`p\`.\`includes_accessories\` AS \`includes_accessories\`,\`p\`.\`product_condition\` AS \`product_condition\`,\`p\`.\`active_ingredient\` AS \`active_ingredient\`,\`p\`.\`concentration\` AS \`concentration\`,\`p\`.\`requires_prescription\` AS \`requires_prescription\`,\`p\`.\`administration_route\` AS \`administration_route\`,\`p\`.\`presentation\` AS \`presentation\`,\`p\`.\`units_per_package\` AS \`units_per_package\`,\`p\`.\`laboratory\` AS \`laboratory\`,\`p\`.\`contraindications\` AS \`contraindications\`,\`p\`.\`dimensions\` AS \`dimensions\`,\`p\`.\`weight\` AS \`weight\`,\`p\`.\`hardware_weight_unit\` AS \`hardware_weight_unit\`,\`p\`.\`caliber\` AS \`caliber\`,\`p\`.\`resistance\` AS \`resistance\`,\`p\`.\`finish\` AS \`finish\`,\`p\`.\`recommended_use\` AS \`recommended_use\`,\`p\`.\`author\` AS \`author\`,\`p\`.\`publisher\` AS \`publisher\`,\`p\`.\`isbn\` AS \`isbn\`,\`p\`.\`pages\` AS \`pages\`,\`p\`.\`language\` AS \`language\`,\`p\`.\`publication_year\` AS \`publication_year\`,\`p\`.\`edition\` AS \`edition\`,\`p\`.\`book_format\` AS \`book_format\`,\`p\`.\`recommended_age\` AS \`recommended_age\`,\`p\`.\`number_of_players\` AS \`number_of_players\`,\`p\`.\`game_type\` AS \`game_type\`,\`p\`.\`requires_batteries\` AS \`requires_batteries\`,\`p\`.\`package_dimensions\` AS \`package_dimensions\`,\`p\`.\`package_contents\` AS \`package_contents\`,\`p\`.\`safety_warnings\` AS \`safety_warnings\`,\`p\`.\`published_in_store\` AS \`published_in_store\`,\`p\`.\`available_for_delivery\` AS \`available_for_delivery\`,\`p\`.\`delivery_type\` AS \`delivery_type\`,\`p\`.\`is_new_launch\` AS \`is_new_launch\`,\`p\`.\`launch_date\` AS \`launch_date\`,\`p\`.\`is_preorder\` AS \`is_preorder\`,\`p\`.\`preorder_window_end\` AS \`preorder_window_end\`,\`p\`.\`preorder_ship_start\` AS \`preorder_ship_start\`,\`p\`.\`preorder_ship_end\` AS \`preorder_ship_end\`,\`p\`.\`preorder_badge_text\` AS \`preorder_badge_text\`,\`p\`.\`preorder_policy_text\` AS \`preorder_policy_text\`,\`p\`.\`is_on_offer\` AS \`is_on_offer\`,\`p\`.\`offer_price\` AS \`offer_price\`,\`p\`.\`offer_label\` AS \`offer_label\`,\`p\`.\`offer_start\` AS \`offer_start\`,\`p\`.\`offer_end\` AS \`offer_end\`,\`p\`.\`sede_id\` AS \`sede_id\`,\`p\`.\`created_at\` AS \`created_at\`,\`p\`.\`updated_at\` AS \`updated_at\`,\`p\`.\`created_by\` AS \`created_by\`,\`p\`.\`updated_by\` AS \`updated_by\`,\`p\`.\`is_menu_item\` AS \`is_menu_item\`,\`p\`.\`is_ingredient\` AS \`is_ingredient\`,\`p\`.\`preparation_area\` AS \`preparation_area\`,\`p\`.\`prep_time_minutes\` AS \`prep_time_minutes\`,\`p\`.\`available_in_menu\` AS \`available_in_menu\`,\`p\`.\`qty_promo\` AS \`qty_promo\`,\`p\`.\`images\` AS \`images\`,\`p\`.\`horma_id\` AS \`horma_id\`,\`p\`.\`base_price\` AS \`base_price\`,(case when (\`p\`.\`stock\` = 0) then 'agotado' when (\`p\`.\`stock\` <= \`p\`.\`reorder_point\`) then 'bajo' else 'suficiente' end) AS \`stock_status\` from \`lopbuk\`.\`products\` \`p\``);

export const vSalesDetail = mysqlView("v_sales_detail", {
	id: varchar({ length: 36 }).notNull(),
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	invoiceNumber: varchar("invoice_number", { length: 20 }).notNull(),
	customerId: varchar("customer_id", { length: 36 }),
	customerName: varchar("customer_name", { length: 255 }),
	customerPhone: varchar("customer_phone", { length: 50 }),
	customerEmail: varchar("customer_email", { length: 255 }),
	subtotal: decimal({ precision: 12, scale: 2 }).notNull(),
	tax: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	discount: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	total: decimal({ precision: 12, scale: 2 }).notNull(),
	paymentMethod: mysqlEnum("payment_method", ['efectivo','tarjeta','transferencia','fiado','addi','sistecredito','mixto']).notNull(),
	amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull(),
	changeAmount: decimal("change_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	sellerId: varchar("seller_id", { length: 36 }),
	sellerName: varchar("seller_name", { length: 255 }).notNull(),
	cashSessionId: varchar("cash_session_id", { length: 36 }),
	status: mysqlEnum(['completada','anulada']).default('completada').notNull(),
	creditStatus: mysqlEnum("credit_status", ['pendiente','parcial','pagado']),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	dueDate: date("due_date", { mode: 'string' }),
	notes: text(),
	mixedEfectivoAmount: decimal("mixed_efectivo_amount", { precision: 12, scale: 2 }),
	mixedSecondMethod: varchar("mixed_second_method", { length: 30 }),
	mixedSecondAmount: decimal("mixed_second_amount", { precision: 12, scale: 2 }),
	sedeId: varchar("sede_id", { length: 36 }),
	vehicleId: varchar("vehicle_id", { length: 36 }),
	dispatchStatus: mysqlEnum("dispatch_status", ['pendiente','en_pista','cargado','despachado','entregado']).default('pendiente').notNull(),
	totalWeightKg: decimal("total_weight_kg", { precision: 10, scale: 3 }),
	synced: tinyint().default(1).notNull(),
	syncedAt: timestamp("synced_at", { mode: 'string' }),
	origin: mysqlEnum(['local','cloud']).default('cloud').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`(now())`).onUpdateNow(),
	dispatchNotes: text("dispatch_notes"),
	dispatchedAt: timestamp("dispatched_at", { mode: 'string' }),
	totalItems: bigint("total_items", { mode: "number" }).notNull(),
	totalQuantity: decimal("total_quantity", { precision: 32, scale: 0 }),
}).algorithm("undefined").sqlSecurity("definer").as(sql`select \`s\`.\`id\` AS \`id\`,\`s\`.\`tenant_id\` AS \`tenant_id\`,\`s\`.\`invoice_number\` AS \`invoice_number\`,\`s\`.\`customer_id\` AS \`customer_id\`,\`s\`.\`customer_name\` AS \`customer_name\`,\`s\`.\`customer_phone\` AS \`customer_phone\`,\`s\`.\`customer_email\` AS \`customer_email\`,\`s\`.\`subtotal\` AS \`subtotal\`,\`s\`.\`tax\` AS \`tax\`,\`s\`.\`discount\` AS \`discount\`,\`s\`.\`total\` AS \`total\`,\`s\`.\`payment_method\` AS \`payment_method\`,\`s\`.\`amount_paid\` AS \`amount_paid\`,\`s\`.\`change_amount\` AS \`change_amount\`,\`s\`.\`seller_id\` AS \`seller_id\`,\`s\`.\`seller_name\` AS \`seller_name\`,\`s\`.\`cash_session_id\` AS \`cash_session_id\`,\`s\`.\`status\` AS \`status\`,\`s\`.\`credit_status\` AS \`credit_status\`,\`s\`.\`due_date\` AS \`due_date\`,\`s\`.\`notes\` AS \`notes\`,\`s\`.\`mixed_efectivo_amount\` AS \`mixed_efectivo_amount\`,\`s\`.\`mixed_second_method\` AS \`mixed_second_method\`,\`s\`.\`mixed_second_amount\` AS \`mixed_second_amount\`,\`s\`.\`sede_id\` AS \`sede_id\`,\`s\`.\`vehicle_id\` AS \`vehicle_id\`,\`s\`.\`dispatch_status\` AS \`dispatch_status\`,\`s\`.\`total_weight_kg\` AS \`total_weight_kg\`,\`s\`.\`synced\` AS \`synced\`,\`s\`.\`synced_at\` AS \`synced_at\`,\`s\`.\`origin\` AS \`origin\`,\`s\`.\`created_at\` AS \`created_at\`,\`s\`.\`updated_at\` AS \`updated_at\`,\`s\`.\`dispatch_notes\` AS \`dispatch_notes\`,\`s\`.\`dispatched_at\` AS \`dispatched_at\`,count(\`si\`.\`id\`) AS \`total_items\`,sum(\`si\`.\`quantity\`) AS \`total_quantity\` from (\`lopbuk\`.\`sales\` \`s\` left join \`lopbuk\`.\`sale_items\` \`si\` on((\`s\`.\`id\` = \`si\`.\`sale_id\`))) group by \`s\`.\`id\``);

export const vTenantsSummary = mysqlView("v_tenants_summary", {
	tenantId: varchar("tenant_id", { length: 36 }).notNull(),
	tenantName: varchar("tenant_name", { length: 255 }).notNull(),
	slug: varchar({ length: 100 }).notNull(),
	businessType: varchar("business_type", { length: 100 }),
	status: mysqlEnum(['activo','suspendido','cancelado']).default('activo').notNull(),
	plan: mysqlEnum(['basico','profesional','empresarial']).default('basico').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`),
	ownerName: varchar("owner_name", { length: 255 }),
	ownerEmail: varchar("owner_email", { length: 255 }),
	totalUsers: bigint("total_users", { mode: "number" }).notNull(),
	totalProducts: bigint("total_products", { mode: "number" }).notNull(),
	inventoryValue: decimal("inventory_value", { precision: 44, scale: 2 }).default('0.00').notNull(),
	totalCustomers: bigint("total_customers", { mode: "number" }).notNull(),
	totalSalesCount: bigint("total_sales_count", { mode: "number" }).notNull(),
	totalSalesAmount: decimal("total_sales_amount", { precision: 34, scale: 2 }).default('0.00').notNull(),
}).algorithm("undefined").sqlSecurity("definer").as(sql`select \`t\`.\`id\` AS \`tenant_id\`,\`t\`.\`name\` AS \`tenant_name\`,\`t\`.\`slug\` AS \`slug\`,\`t\`.\`business_type\` AS \`business_type\`,\`t\`.\`status\` AS \`status\`,\`t\`.\`plan\` AS \`plan\`,\`t\`.\`created_at\` AS \`created_at\`,\`u\`.\`name\` AS \`owner_name\`,\`u\`.\`email\` AS \`owner_email\`,coalesce(\`usr_agg\`.\`total_users\`,0) AS \`total_users\`,coalesce(\`prod_agg\`.\`total_products\`,0) AS \`total_products\`,coalesce(\`prod_agg\`.\`inventory_value\`,0) AS \`inventory_value\`,coalesce(\`cust_agg\`.\`total_customers\`,0) AS \`total_customers\`,coalesce(\`sale_agg\`.\`total_sales_count\`,0) AS \`total_sales_count\`,coalesce(\`sale_agg\`.\`total_sales_amount\`,0) AS \`total_sales_amount\` from (((((\`lopbuk\`.\`tenants\` \`t\` left join \`lopbuk\`.\`users\` \`u\` on((\`t\`.\`owner_id\` = \`u\`.\`id\`))) left join (select \`lopbuk\`.\`users\`.\`tenant_id\` AS \`tenant_id\`,count(0) AS \`total_users\` from \`lopbuk\`.\`users\` group by \`lopbuk\`.\`users\`.\`tenant_id\`) \`usr_agg\` on((\`usr_agg\`.\`tenant_id\` = \`t\`.\`id\`))) left join (select \`lopbuk\`.\`products\`.\`tenant_id\` AS \`tenant_id\`,count(0) AS \`total_products\`,sum((\`lopbuk\`.\`products\`.\`stock\` * \`lopbuk\`.\`products\`.\`sale_price\`)) AS \`inventory_value\` from \`lopbuk\`.\`products\` group by \`lopbuk\`.\`products\`.\`tenant_id\`) \`prod_agg\` on((\`prod_agg\`.\`tenant_id\` = \`t\`.\`id\`))) left join (select \`lopbuk\`.\`customers\`.\`tenant_id\` AS \`tenant_id\`,count(0) AS \`total_customers\` from \`lopbuk\`.\`customers\` group by \`lopbuk\`.\`customers\`.\`tenant_id\`) \`cust_agg\` on((\`cust_agg\`.\`tenant_id\` = \`t\`.\`id\`))) left join (select \`lopbuk\`.\`sales\`.\`tenant_id\` AS \`tenant_id\`,count(0) AS \`total_sales_count\`,sum(\`lopbuk\`.\`sales\`.\`total\`) AS \`total_sales_amount\` from \`lopbuk\`.\`sales\` where (\`lopbuk\`.\`sales\`.\`status\` = 'completada') group by \`lopbuk\`.\`sales\`.\`tenant_id\`) \`sale_agg\` on((\`sale_agg\`.\`tenant_id\` = \`t\`.\`id\`)))`);