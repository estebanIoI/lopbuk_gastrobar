import { relations } from "drizzle-orm/relations";
import { affiliates, affiliateCampaigns, tenants, affiliateCommissions, affiliateConversions, affiliateMissions, affiliateMissionSubmissions, affiliatePackages, affiliatePackageOrders, affiliateWithdrawals, agentActions, arenaFeed, arenaFeedComments, arenaFeedLikes, auditLog, cartillaActividades, cartillaActividadOpciones, cartillaActividadOrdenar, cartillaActividadPares, cartillaActividadVf, cartillaModulos, cartillaPublicaciones, cartillaComentarios, cartillas, cartillaCompras, cartillaModuloAudios, cartillaModuloImagenes, cartillaModuloSecciones, cartillaProgreso, cartillaPublicacionLikes, cartillaUsuarioModulos, cartillaUsuarioRespuestas, cartillaRetos, cartillaUsuarioRetos, cartillaVocabulario, cashMovements, cashSessions, users, categories, seasonalChallenges, challengeParticipants, chatbotConfig, chatbotSessions, trainerBookings, coachFeedEntries, communityPosts, communityComments, communityPostAds, communityPostMedia, communityReactions, creditPayments, sales, customers, devRequests, discountCoupons, drops, dropClaims, employeeCargos, employeeNovelties, employeeVacationBalances, financeBudgets, financeCategories, financeTransactions, fleetMaintenance, fleetVehicles, guilds, guildMembers, invoiceSequence, merchantEvents, merchantNotifications, paymentReceiptSequence, payrollAdjustments, payrollRecords, portfolioServiceCategories, portfolioServiceOptions, priceHistory, products, productAlerts, productRecipes, productReviews, suppliers, purchaseInvoiceItems, purchaseInvoices, rbGastos, rbGastosFijos, rbIngresosDiarios, rbOrderItems, rbOrders, rbOrderSequence, rbTables, rbPayments, rbReservationSequence, rbReservations, reClients, reContracts, reProperties, reLeads, reLeadActivities, reMaintenances, reOwners, rePropertyFeatures, rePropertyMedia, reRentPayments, reVisits, refreshTokens, saleItems, sedes, services, serviceAvailability, serviceBlockedPeriods, serviceBookings, shiftEmployeeBonuses, shiftEmployees, stockMovements, storeAnnouncementBar, storeBanners, storeCustomSections, storeDrops, storeDropProducts, storeFeaturedProducts, storeInfo, storeLocations, storeOrderBump, storefrontOrders, storefrontOrderItems, trainerOffers, trainers, trainerCommissions, trainerReviews, trainerWithdrawals, userAddresses, vaultKeys, vaultKeyRedemptions, workOrderMaterials, workOrders, workOrderPayments, workOrderSequence, workoutSessions, workoutExercises, workoutSets } from "./schema";

export const affiliateCampaignsRelations = relations(affiliateCampaigns, ({one, many}) => ({
	affiliate: one(affiliates, {
		fields: [affiliateCampaigns.affiliateId],
		references: [affiliates.id]
	}),
	tenant: one(tenants, {
		fields: [affiliateCampaigns.tenantId],
		references: [tenants.id]
	}),
	affiliateConversions: many(affiliateConversions),
}));

export const affiliatesRelations = relations(affiliates, ({many}) => ({
	affiliateCampaigns: many(affiliateCampaigns),
	affiliateCommissions: many(affiliateCommissions),
	affiliateMissionSubmissions: many(affiliateMissionSubmissions),
	affiliatePackageOrders: many(affiliatePackageOrders),
	affiliateWithdrawals: many(affiliateWithdrawals),
}));

export const tenantsRelations = relations(tenants, ({one, many}) => ({
	affiliateCampaigns: many(affiliateCampaigns),
	affiliatePackageOrders: many(affiliatePackageOrders),
	agentActions: many(agentActions),
	auditLogs: many(auditLog),
	cashMovements: many(cashMovements),
	cashSessions: many(cashSessions),
	categories: many(categories),
	chatbotConfigs: many(chatbotConfig),
	chatbotSessions: many(chatbotSessions),
	creditPayments: many(creditPayments),
	customers: many(customers),
	devRequests: many(devRequests),
	discountCoupons: many(discountCoupons),
	employeeCargos: many(employeeCargos),
	employeeNovelties: many(employeeNovelties),
	employeeVacationBalances: many(employeeVacationBalances),
	financeBudgets: many(financeBudgets),
	financeCategories: many(financeCategories),
	financeTransactions: many(financeTransactions),
	fleetMaintenances: many(fleetMaintenance),
	fleetVehicles: many(fleetVehicles),
	invoiceSequences: many(invoiceSequence),
	merchantEvents: many(merchantEvents),
	merchantNotifications: many(merchantNotifications),
	paymentReceiptSequences: many(paymentReceiptSequence),
	payrollAdjustments: many(payrollAdjustments),
	payrollRecords: many(payrollRecords),
	priceHistories: many(priceHistory),
	productAlerts: many(productAlerts),
	productRecipes: many(productRecipes),
	productReviews: many(productReviews),
	products: many(products),
	purchaseInvoiceItems: many(purchaseInvoiceItems),
	purchaseInvoices: many(purchaseInvoices),
	rbGastos: many(rbGastos),
	rbGastosFijos: many(rbGastosFijos),
	rbIngresosDiarios: many(rbIngresosDiarios),
	rbOrderItems: many(rbOrderItems),
	rbOrderSequences: many(rbOrderSequence),
	rbOrders: many(rbOrders),
	rbPayments: many(rbPayments),
	rbReservationSequences: many(rbReservationSequence),
	rbReservations: many(rbReservations),
	rbTables: many(rbTables),
	reClients: many(reClients),
	reContracts: many(reContracts),
	reLeadActivities: many(reLeadActivities),
	reLeads: many(reLeads),
	reMaintenances: many(reMaintenances),
	reOwners: many(reOwners),
	reProperties: many(reProperties),
	reRentPayments: many(reRentPayments),
	reVisits: many(reVisits),
	refreshTokens: many(refreshTokens),
	saleItems: many(saleItems),
	sales: many(sales),
	sedes: many(sedes),
	serviceAvailabilities: many(serviceAvailability),
	serviceBlockedPeriods: many(serviceBlockedPeriods),
	serviceBookings: many(serviceBookings),
	services: many(services),
	stockMovements: many(stockMovements),
	storeAnnouncementBars: many(storeAnnouncementBar),
	storeBanners: many(storeBanners),
	storeCustomSections: many(storeCustomSections),
	storeDrops: many(storeDrops),
	storeFeaturedProducts: many(storeFeaturedProducts),
	storeInfos: many(storeInfo),
	storeLocations: many(storeLocations),
	storeOrderBumps: many(storeOrderBump),
	storefrontOrders: many(storefrontOrders),
	suppliers: many(suppliers),
	user: one(users, {
		fields: [tenants.ownerId],
		references: [users.id],
		relationName: "tenants_ownerId_users_id"
	}),
	users: many(users, {
		relationName: "users_tenantId_tenants_id"
	}),
	workOrderMaterials: many(workOrderMaterials),
	workOrderPayments: many(workOrderPayments),
	workOrderSequences: many(workOrderSequence),
	workOrders: many(workOrders),
}));

export const affiliateCommissionsRelations = relations(affiliateCommissions, ({one}) => ({
	affiliate: one(affiliates, {
		fields: [affiliateCommissions.affiliateId],
		references: [affiliates.id]
	}),
}));

export const affiliateConversionsRelations = relations(affiliateConversions, ({one}) => ({
	affiliateCampaign: one(affiliateCampaigns, {
		fields: [affiliateConversions.campaignId],
		references: [affiliateCampaigns.id]
	}),
}));

export const affiliateMissionSubmissionsRelations = relations(affiliateMissionSubmissions, ({one}) => ({
	affiliateMission: one(affiliateMissions, {
		fields: [affiliateMissionSubmissions.missionId],
		references: [affiliateMissions.id]
	}),
	affiliate: one(affiliates, {
		fields: [affiliateMissionSubmissions.affiliateId],
		references: [affiliates.id]
	}),
}));

export const affiliateMissionsRelations = relations(affiliateMissions, ({many}) => ({
	affiliateMissionSubmissions: many(affiliateMissionSubmissions),
}));

export const affiliatePackageOrdersRelations = relations(affiliatePackageOrders, ({one}) => ({
	affiliatePackage: one(affiliatePackages, {
		fields: [affiliatePackageOrders.packageId],
		references: [affiliatePackages.id]
	}),
	affiliate: one(affiliates, {
		fields: [affiliatePackageOrders.affiliateId],
		references: [affiliates.id]
	}),
	tenant: one(tenants, {
		fields: [affiliatePackageOrders.tenantId],
		references: [tenants.id]
	}),
}));

export const affiliatePackagesRelations = relations(affiliatePackages, ({many}) => ({
	affiliatePackageOrders: many(affiliatePackageOrders),
}));

export const affiliateWithdrawalsRelations = relations(affiliateWithdrawals, ({one}) => ({
	affiliate: one(affiliates, {
		fields: [affiliateWithdrawals.affiliateId],
		references: [affiliates.id]
	}),
}));

export const agentActionsRelations = relations(agentActions, ({one}) => ({
	tenant: one(tenants, {
		fields: [agentActions.tenantId],
		references: [tenants.id]
	}),
}));

export const arenaFeedCommentsRelations = relations(arenaFeedComments, ({one}) => ({
	arenaFeed: one(arenaFeed, {
		fields: [arenaFeedComments.feedId],
		references: [arenaFeed.id]
	}),
}));

export const arenaFeedRelations = relations(arenaFeed, ({many}) => ({
	arenaFeedComments: many(arenaFeedComments),
	arenaFeedLikes: many(arenaFeedLikes),
}));

export const arenaFeedLikesRelations = relations(arenaFeedLikes, ({one}) => ({
	arenaFeed: one(arenaFeed, {
		fields: [arenaFeedLikes.feedId],
		references: [arenaFeed.id]
	}),
}));

export const auditLogRelations = relations(auditLog, ({one}) => ({
	tenant: one(tenants, {
		fields: [auditLog.tenantId],
		references: [tenants.id]
	}),
}));

export const cartillaActividadOpcionesRelations = relations(cartillaActividadOpciones, ({one}) => ({
	cartillaActividade: one(cartillaActividades, {
		fields: [cartillaActividadOpciones.actividadId],
		references: [cartillaActividades.id]
	}),
}));

export const cartillaActividadesRelations = relations(cartillaActividades, ({one, many}) => ({
	cartillaActividadOpciones: many(cartillaActividadOpciones),
	cartillaActividadOrdenars: many(cartillaActividadOrdenar),
	cartillaActividadPares: many(cartillaActividadPares),
	cartillaActividadVfs: many(cartillaActividadVf),
	cartillaModulo: one(cartillaModulos, {
		fields: [cartillaActividades.moduloId],
		references: [cartillaModulos.id]
	}),
	cartillaUsuarioRespuestas: many(cartillaUsuarioRespuestas),
}));

export const cartillaActividadOrdenarRelations = relations(cartillaActividadOrdenar, ({one}) => ({
	cartillaActividade: one(cartillaActividades, {
		fields: [cartillaActividadOrdenar.actividadId],
		references: [cartillaActividades.id]
	}),
}));

export const cartillaActividadParesRelations = relations(cartillaActividadPares, ({one}) => ({
	cartillaActividade: one(cartillaActividades, {
		fields: [cartillaActividadPares.actividadId],
		references: [cartillaActividades.id]
	}),
}));

export const cartillaActividadVfRelations = relations(cartillaActividadVf, ({one}) => ({
	cartillaActividade: one(cartillaActividades, {
		fields: [cartillaActividadVf.actividadId],
		references: [cartillaActividades.id]
	}),
}));

export const cartillaModulosRelations = relations(cartillaModulos, ({one, many}) => ({
	cartillaActividades: many(cartillaActividades),
	cartillaModuloAudios: many(cartillaModuloAudios),
	cartillaModuloImagenes: many(cartillaModuloImagenes),
	cartillaModuloSecciones: many(cartillaModuloSecciones),
	cartilla: one(cartillas, {
		fields: [cartillaModulos.cartillaId],
		references: [cartillas.id]
	}),
	cartillaUsuarioModulos: many(cartillaUsuarioModulos),
}));

export const cartillaComentariosRelations = relations(cartillaComentarios, ({one}) => ({
	cartillaPublicacione: one(cartillaPublicaciones, {
		fields: [cartillaComentarios.publicacionId],
		references: [cartillaPublicaciones.id]
	}),
}));

export const cartillaPublicacionesRelations = relations(cartillaPublicaciones, ({many}) => ({
	cartillaComentarios: many(cartillaComentarios),
	cartillaPublicacionLikes: many(cartillaPublicacionLikes),
}));

export const cartillaComprasRelations = relations(cartillaCompras, ({one}) => ({
	cartilla: one(cartillas, {
		fields: [cartillaCompras.cartillaId],
		references: [cartillas.id]
	}),
}));

export const cartillasRelations = relations(cartillas, ({many}) => ({
	cartillaCompras: many(cartillaCompras),
	cartillaModulos: many(cartillaModulos),
	cartillaProgresos: many(cartillaProgreso),
	cartillaVocabularios: many(cartillaVocabulario),
}));

export const cartillaModuloAudiosRelations = relations(cartillaModuloAudios, ({one}) => ({
	cartillaModulo: one(cartillaModulos, {
		fields: [cartillaModuloAudios.moduloId],
		references: [cartillaModulos.id]
	}),
}));

export const cartillaModuloImagenesRelations = relations(cartillaModuloImagenes, ({one}) => ({
	cartillaModulo: one(cartillaModulos, {
		fields: [cartillaModuloImagenes.moduloId],
		references: [cartillaModulos.id]
	}),
}));

export const cartillaModuloSeccionesRelations = relations(cartillaModuloSecciones, ({one}) => ({
	cartillaModulo: one(cartillaModulos, {
		fields: [cartillaModuloSecciones.moduloId],
		references: [cartillaModulos.id]
	}),
}));

export const cartillaProgresoRelations = relations(cartillaProgreso, ({one}) => ({
	cartilla: one(cartillas, {
		fields: [cartillaProgreso.cartillaId],
		references: [cartillas.id]
	}),
}));

export const cartillaPublicacionLikesRelations = relations(cartillaPublicacionLikes, ({one}) => ({
	cartillaPublicacione: one(cartillaPublicaciones, {
		fields: [cartillaPublicacionLikes.publicacionId],
		references: [cartillaPublicaciones.id]
	}),
}));

export const cartillaUsuarioModulosRelations = relations(cartillaUsuarioModulos, ({one}) => ({
	cartillaModulo: one(cartillaModulos, {
		fields: [cartillaUsuarioModulos.moduloId],
		references: [cartillaModulos.id]
	}),
}));

export const cartillaUsuarioRespuestasRelations = relations(cartillaUsuarioRespuestas, ({one}) => ({
	cartillaActividade: one(cartillaActividades, {
		fields: [cartillaUsuarioRespuestas.actividadId],
		references: [cartillaActividades.id]
	}),
}));

export const cartillaUsuarioRetosRelations = relations(cartillaUsuarioRetos, ({one}) => ({
	cartillaReto: one(cartillaRetos, {
		fields: [cartillaUsuarioRetos.retoId],
		references: [cartillaRetos.id]
	}),
}));

export const cartillaRetosRelations = relations(cartillaRetos, ({many}) => ({
	cartillaUsuarioRetos: many(cartillaUsuarioRetos),
}));

export const cartillaVocabularioRelations = relations(cartillaVocabulario, ({one}) => ({
	cartilla: one(cartillas, {
		fields: [cartillaVocabulario.cartillaId],
		references: [cartillas.id]
	}),
}));

export const cashMovementsRelations = relations(cashMovements, ({one}) => ({
	tenant: one(tenants, {
		fields: [cashMovements.tenantId],
		references: [tenants.id]
	}),
	cashSession: one(cashSessions, {
		fields: [cashMovements.sessionId],
		references: [cashSessions.id]
	}),
	user: one(users, {
		fields: [cashMovements.createdBy],
		references: [users.id]
	}),
}));

export const cashSessionsRelations = relations(cashSessions, ({one, many}) => ({
	cashMovements: many(cashMovements),
	tenant: one(tenants, {
		fields: [cashSessions.tenantId],
		references: [tenants.id]
	}),
	user_openedBy: one(users, {
		fields: [cashSessions.openedBy],
		references: [users.id],
		relationName: "cashSessions_openedBy_users_id"
	}),
	user_closedBy: one(users, {
		fields: [cashSessions.closedBy],
		references: [users.id],
		relationName: "cashSessions_closedBy_users_id"
	}),
	rbPayments: many(rbPayments),
	shiftEmployeeBonuses: many(shiftEmployeeBonuses),
	shiftEmployees: many(shiftEmployees),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	cashMovements: many(cashMovements),
	cashSessions_openedBy: many(cashSessions, {
		relationName: "cashSessions_openedBy_users_id"
	}),
	cashSessions_closedBy: many(cashSessions, {
		relationName: "cashSessions_closedBy_users_id"
	}),
	creditPayments: many(creditPayments),
	devRequests: many(devRequests),
	employeeNovelties: many(employeeNovelties),
	employeeVacationBalances: many(employeeVacationBalances),
	financeTransactions: many(financeTransactions),
	fleetMaintenances: many(fleetMaintenance),
	payrollAdjustments: many(payrollAdjustments),
	payrollRecords: many(payrollRecords),
	purchaseInvoices: many(purchaseInvoices),
	rbOrders: many(rbOrders),
	rbPayments: many(rbPayments),
	refreshTokens: many(refreshTokens),
	sales: many(sales),
	stockMovements: many(stockMovements),
	storefrontOrders_deliveryDriverId: many(storefrontOrders, {
		relationName: "storefrontOrders_deliveryDriverId_users_id"
	}),
	storefrontOrders_clientUserId: many(storefrontOrders, {
		relationName: "storefrontOrders_clientUserId_users_id"
	}),
	tenants: many(tenants, {
		relationName: "tenants_ownerId_users_id"
	}),
	userAddresses: many(userAddresses),
	tenant: one(tenants, {
		fields: [users.tenantId],
		references: [tenants.id],
		relationName: "users_tenantId_tenants_id"
	}),
	workOrderPayments: many(workOrderPayments),
	workOrders_assignedTo: many(workOrders, {
		relationName: "workOrders_assignedTo_users_id"
	}),
	workOrders_createdBy: many(workOrders, {
		relationName: "workOrders_createdBy_users_id"
	}),
}));

export const categoriesRelations = relations(categories, ({one}) => ({
	tenant: one(tenants, {
		fields: [categories.tenantId],
		references: [tenants.id]
	}),
}));

export const challengeParticipantsRelations = relations(challengeParticipants, ({one}) => ({
	seasonalChallenge: one(seasonalChallenges, {
		fields: [challengeParticipants.challengeId],
		references: [seasonalChallenges.id]
	}),
}));

export const seasonalChallengesRelations = relations(seasonalChallenges, ({many}) => ({
	challengeParticipants: many(challengeParticipants),
}));

export const chatbotConfigRelations = relations(chatbotConfig, ({one}) => ({
	tenant: one(tenants, {
		fields: [chatbotConfig.tenantId],
		references: [tenants.id]
	}),
}));

export const chatbotSessionsRelations = relations(chatbotSessions, ({one}) => ({
	tenant: one(tenants, {
		fields: [chatbotSessions.tenantId],
		references: [tenants.id]
	}),
}));

export const coachFeedEntriesRelations = relations(coachFeedEntries, ({one}) => ({
	trainerBooking: one(trainerBookings, {
		fields: [coachFeedEntries.bookingId],
		references: [trainerBookings.id]
	}),
}));

export const trainerBookingsRelations = relations(trainerBookings, ({one, many}) => ({
	coachFeedEntries: many(coachFeedEntries),
	trainerOffer: one(trainerOffers, {
		fields: [trainerBookings.offerId],
		references: [trainerOffers.id]
	}),
	trainer: one(trainers, {
		fields: [trainerBookings.trainerId],
		references: [trainers.id]
	}),
	trainerCommissions: many(trainerCommissions),
}));

export const communityCommentsRelations = relations(communityComments, ({one}) => ({
	communityPost: one(communityPosts, {
		fields: [communityComments.postId],
		references: [communityPosts.id]
	}),
}));

export const communityPostsRelations = relations(communityPosts, ({many}) => ({
	communityComments: many(communityComments),
	communityPostAds: many(communityPostAds),
	communityPostMedias: many(communityPostMedia),
	communityReactions: many(communityReactions),
}));

export const communityPostAdsRelations = relations(communityPostAds, ({one}) => ({
	communityPost: one(communityPosts, {
		fields: [communityPostAds.postId],
		references: [communityPosts.id]
	}),
}));

export const communityPostMediaRelations = relations(communityPostMedia, ({one}) => ({
	communityPost: one(communityPosts, {
		fields: [communityPostMedia.postId],
		references: [communityPosts.id]
	}),
}));

export const communityReactionsRelations = relations(communityReactions, ({one}) => ({
	communityPost: one(communityPosts, {
		fields: [communityReactions.postId],
		references: [communityPosts.id]
	}),
}));

export const creditPaymentsRelations = relations(creditPayments, ({one}) => ({
	tenant: one(tenants, {
		fields: [creditPayments.tenantId],
		references: [tenants.id]
	}),
	sale: one(sales, {
		fields: [creditPayments.saleId],
		references: [sales.id]
	}),
	customer: one(customers, {
		fields: [creditPayments.customerId],
		references: [customers.id]
	}),
	user: one(users, {
		fields: [creditPayments.receivedBy],
		references: [users.id]
	}),
}));

export const salesRelations = relations(sales, ({one, many}) => ({
	creditPayments: many(creditPayments),
	rbOrders: many(rbOrders),
	saleItems: many(saleItems),
	tenant: one(tenants, {
		fields: [sales.tenantId],
		references: [tenants.id]
	}),
	customer: one(customers, {
		fields: [sales.customerId],
		references: [customers.id]
	}),
	user: one(users, {
		fields: [sales.sellerId],
		references: [users.id]
	}),
	fleetVehicle: one(fleetVehicles, {
		fields: [sales.vehicleId],
		references: [fleetVehicles.id]
	}),
}));

export const customersRelations = relations(customers, ({one, many}) => ({
	creditPayments: many(creditPayments),
	tenant: one(tenants, {
		fields: [customers.tenantId],
		references: [tenants.id]
	}),
	sales: many(sales),
}));

export const devRequestsRelations = relations(devRequests, ({one}) => ({
	tenant: one(tenants, {
		fields: [devRequests.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [devRequests.userId],
		references: [users.id]
	}),
}));

export const discountCouponsRelations = relations(discountCoupons, ({one}) => ({
	tenant: one(tenants, {
		fields: [discountCoupons.tenantId],
		references: [tenants.id]
	}),
}));

export const dropClaimsRelations = relations(dropClaims, ({one}) => ({
	drop: one(drops, {
		fields: [dropClaims.dropId],
		references: [drops.id]
	}),
}));

export const dropsRelations = relations(drops, ({many}) => ({
	dropClaims: many(dropClaims),
}));

export const employeeCargosRelations = relations(employeeCargos, ({one}) => ({
	tenant: one(tenants, {
		fields: [employeeCargos.tenantId],
		references: [tenants.id]
	}),
}));

export const employeeNoveltiesRelations = relations(employeeNovelties, ({one}) => ({
	tenant: one(tenants, {
		fields: [employeeNovelties.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [employeeNovelties.userId],
		references: [users.id]
	}),
}));

export const employeeVacationBalancesRelations = relations(employeeVacationBalances, ({one}) => ({
	tenant: one(tenants, {
		fields: [employeeVacationBalances.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [employeeVacationBalances.userId],
		references: [users.id]
	}),
}));

export const financeBudgetsRelations = relations(financeBudgets, ({one}) => ({
	tenant: one(tenants, {
		fields: [financeBudgets.tenantId],
		references: [tenants.id]
	}),
	financeCategory: one(financeCategories, {
		fields: [financeBudgets.categoryId],
		references: [financeCategories.id]
	}),
}));

export const financeCategoriesRelations = relations(financeCategories, ({one, many}) => ({
	financeBudgets: many(financeBudgets),
	tenant: one(tenants, {
		fields: [financeCategories.tenantId],
		references: [tenants.id]
	}),
	financeTransactions: many(financeTransactions),
}));

export const financeTransactionsRelations = relations(financeTransactions, ({one}) => ({
	tenant: one(tenants, {
		fields: [financeTransactions.tenantId],
		references: [tenants.id]
	}),
	financeCategory: one(financeCategories, {
		fields: [financeTransactions.categoryId],
		references: [financeCategories.id]
	}),
	user: one(users, {
		fields: [financeTransactions.createdBy],
		references: [users.id]
	}),
}));

export const fleetMaintenanceRelations = relations(fleetMaintenance, ({one}) => ({
	tenant: one(tenants, {
		fields: [fleetMaintenance.tenantId],
		references: [tenants.id]
	}),
	fleetVehicle: one(fleetVehicles, {
		fields: [fleetMaintenance.vehicleId],
		references: [fleetVehicles.id]
	}),
	user: one(users, {
		fields: [fleetMaintenance.createdBy],
		references: [users.id]
	}),
}));

export const fleetVehiclesRelations = relations(fleetVehicles, ({one, many}) => ({
	fleetMaintenances: many(fleetMaintenance),
	tenant: one(tenants, {
		fields: [fleetVehicles.tenantId],
		references: [tenants.id]
	}),
	sales: many(sales),
	storefrontOrders: many(storefrontOrders),
}));

export const guildMembersRelations = relations(guildMembers, ({one}) => ({
	guild: one(guilds, {
		fields: [guildMembers.guildId],
		references: [guilds.id]
	}),
}));

export const guildsRelations = relations(guilds, ({many}) => ({
	guildMembers: many(guildMembers),
}));

export const invoiceSequenceRelations = relations(invoiceSequence, ({one}) => ({
	tenant: one(tenants, {
		fields: [invoiceSequence.tenantId],
		references: [tenants.id]
	}),
}));

export const merchantEventsRelations = relations(merchantEvents, ({one}) => ({
	tenant: one(tenants, {
		fields: [merchantEvents.tenantId],
		references: [tenants.id]
	}),
}));

export const merchantNotificationsRelations = relations(merchantNotifications, ({one}) => ({
	tenant: one(tenants, {
		fields: [merchantNotifications.tenantId],
		references: [tenants.id]
	}),
}));

export const paymentReceiptSequenceRelations = relations(paymentReceiptSequence, ({one}) => ({
	tenant: one(tenants, {
		fields: [paymentReceiptSequence.tenantId],
		references: [tenants.id]
	}),
}));

export const payrollAdjustmentsRelations = relations(payrollAdjustments, ({one}) => ({
	tenant: one(tenants, {
		fields: [payrollAdjustments.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [payrollAdjustments.sellerId],
		references: [users.id]
	}),
}));

export const payrollRecordsRelations = relations(payrollRecords, ({one}) => ({
	tenant: one(tenants, {
		fields: [payrollRecords.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [payrollRecords.sellerId],
		references: [users.id]
	}),
}));

export const portfolioServiceOptionsRelations = relations(portfolioServiceOptions, ({one}) => ({
	portfolioServiceCategory: one(portfolioServiceCategories, {
		fields: [portfolioServiceOptions.categoryId],
		references: [portfolioServiceCategories.id]
	}),
}));

export const portfolioServiceCategoriesRelations = relations(portfolioServiceCategories, ({many}) => ({
	portfolioServiceOptions: many(portfolioServiceOptions),
}));

export const priceHistoryRelations = relations(priceHistory, ({one}) => ({
	tenant: one(tenants, {
		fields: [priceHistory.tenantId],
		references: [tenants.id]
	}),
	product: one(products, {
		fields: [priceHistory.productId],
		references: [products.id]
	}),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	priceHistories: many(priceHistory),
	productAlerts: many(productAlerts),
	productRecipes_productId: many(productRecipes, {
		relationName: "productRecipes_productId_products_id"
	}),
	productRecipes_ingredientId: many(productRecipes, {
		relationName: "productRecipes_ingredientId_products_id"
	}),
	productReviews: many(productReviews),
	tenant: one(tenants, {
		fields: [products.tenantId],
		references: [tenants.id]
	}),
	supplier: one(suppliers, {
		fields: [products.supplierId],
		references: [suppliers.id]
	}),
	purchaseInvoiceItems: many(purchaseInvoiceItems),
	rbOrderItems: many(rbOrderItems),
	saleItems: many(saleItems),
	stockMovements: many(stockMovements),
	storeDropProducts: many(storeDropProducts),
	storeFeaturedProducts: many(storeFeaturedProducts),
	storefrontOrderItems: many(storefrontOrderItems),
}));

export const productAlertsRelations = relations(productAlerts, ({one}) => ({
	tenant: one(tenants, {
		fields: [productAlerts.tenantId],
		references: [tenants.id]
	}),
	product: one(products, {
		fields: [productAlerts.productId],
		references: [products.id]
	}),
}));

export const productRecipesRelations = relations(productRecipes, ({one}) => ({
	tenant: one(tenants, {
		fields: [productRecipes.tenantId],
		references: [tenants.id]
	}),
	product_productId: one(products, {
		fields: [productRecipes.productId],
		references: [products.id],
		relationName: "productRecipes_productId_products_id"
	}),
	product_ingredientId: one(products, {
		fields: [productRecipes.ingredientId],
		references: [products.id],
		relationName: "productRecipes_ingredientId_products_id"
	}),
}));

export const productReviewsRelations = relations(productReviews, ({one}) => ({
	tenant: one(tenants, {
		fields: [productReviews.tenantId],
		references: [tenants.id]
	}),
	product: one(products, {
		fields: [productReviews.productId],
		references: [products.id]
	}),
}));

export const suppliersRelations = relations(suppliers, ({one, many}) => ({
	products: many(products),
	purchaseInvoices: many(purchaseInvoices),
	tenant: one(tenants, {
		fields: [suppliers.tenantId],
		references: [tenants.id]
	}),
}));

export const purchaseInvoiceItemsRelations = relations(purchaseInvoiceItems, ({one}) => ({
	tenant: one(tenants, {
		fields: [purchaseInvoiceItems.tenantId],
		references: [tenants.id]
	}),
	purchaseInvoice: one(purchaseInvoices, {
		fields: [purchaseInvoiceItems.invoiceId],
		references: [purchaseInvoices.id]
	}),
	product: one(products, {
		fields: [purchaseInvoiceItems.productId],
		references: [products.id]
	}),
}));

export const purchaseInvoicesRelations = relations(purchaseInvoices, ({one, many}) => ({
	purchaseInvoiceItems: many(purchaseInvoiceItems),
	tenant: one(tenants, {
		fields: [purchaseInvoices.tenantId],
		references: [tenants.id]
	}),
	supplier: one(suppliers, {
		fields: [purchaseInvoices.supplierId],
		references: [suppliers.id]
	}),
	user: one(users, {
		fields: [purchaseInvoices.createdBy],
		references: [users.id]
	}),
}));

export const rbGastosRelations = relations(rbGastos, ({one}) => ({
	tenant: one(tenants, {
		fields: [rbGastos.tenantId],
		references: [tenants.id]
	}),
}));

export const rbGastosFijosRelations = relations(rbGastosFijos, ({one}) => ({
	tenant: one(tenants, {
		fields: [rbGastosFijos.tenantId],
		references: [tenants.id]
	}),
}));

export const rbIngresosDiariosRelations = relations(rbIngresosDiarios, ({one}) => ({
	tenant: one(tenants, {
		fields: [rbIngresosDiarios.tenantId],
		references: [tenants.id]
	}),
}));

export const rbOrderItemsRelations = relations(rbOrderItems, ({one}) => ({
	tenant: one(tenants, {
		fields: [rbOrderItems.tenantId],
		references: [tenants.id]
	}),
	rbOrder: one(rbOrders, {
		fields: [rbOrderItems.orderId],
		references: [rbOrders.id]
	}),
	product: one(products, {
		fields: [rbOrderItems.menuItemId],
		references: [products.id]
	}),
}));

export const rbOrdersRelations = relations(rbOrders, ({one, many}) => ({
	rbOrderItems: many(rbOrderItems),
	tenant: one(tenants, {
		fields: [rbOrders.tenantId],
		references: [tenants.id]
	}),
	rbTable: one(rbTables, {
		fields: [rbOrders.tableId],
		references: [rbTables.id]
	}),
	user: one(users, {
		fields: [rbOrders.waiterId],
		references: [users.id]
	}),
	sale: one(sales, {
		fields: [rbOrders.saleId],
		references: [sales.id]
	}),
	rbPayments: many(rbPayments),
}));

export const rbOrderSequenceRelations = relations(rbOrderSequence, ({one}) => ({
	tenant: one(tenants, {
		fields: [rbOrderSequence.tenantId],
		references: [tenants.id]
	}),
}));

export const rbTablesRelations = relations(rbTables, ({one, many}) => ({
	rbOrders: many(rbOrders),
	rbReservations: many(rbReservations),
	tenant: one(tenants, {
		fields: [rbTables.tenantId],
		references: [tenants.id]
	}),
}));

export const rbPaymentsRelations = relations(rbPayments, ({one}) => ({
	tenant: one(tenants, {
		fields: [rbPayments.tenantId],
		references: [tenants.id]
	}),
	rbOrder: one(rbOrders, {
		fields: [rbPayments.orderId],
		references: [rbOrders.id]
	}),
	user: one(users, {
		fields: [rbPayments.cashierId],
		references: [users.id]
	}),
	cashSession: one(cashSessions, {
		fields: [rbPayments.cashSessionId],
		references: [cashSessions.id]
	}),
}));

export const rbReservationSequenceRelations = relations(rbReservationSequence, ({one}) => ({
	tenant: one(tenants, {
		fields: [rbReservationSequence.tenantId],
		references: [tenants.id]
	}),
}));

export const rbReservationsRelations = relations(rbReservations, ({one}) => ({
	tenant: one(tenants, {
		fields: [rbReservations.tenantId],
		references: [tenants.id]
	}),
	rbTable: one(rbTables, {
		fields: [rbReservations.tableId],
		references: [rbTables.id]
	}),
}));

export const reClientsRelations = relations(reClients, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [reClients.tenantId],
		references: [tenants.id]
	}),
	reContracts: many(reContracts),
}));

export const reContractsRelations = relations(reContracts, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [reContracts.tenantId],
		references: [tenants.id]
	}),
	reProperty: one(reProperties, {
		fields: [reContracts.propertyId],
		references: [reProperties.id]
	}),
	reClient: one(reClients, {
		fields: [reContracts.clientId],
		references: [reClients.id]
	}),
	reRentPayments: many(reRentPayments),
}));

export const rePropertiesRelations = relations(reProperties, ({one, many}) => ({
	reContracts: many(reContracts),
	reMaintenances: many(reMaintenances),
	tenant: one(tenants, {
		fields: [reProperties.tenantId],
		references: [tenants.id]
	}),
	rePropertyFeatures: many(rePropertyFeatures),
	rePropertyMedias: many(rePropertyMedia),
	reVisits: many(reVisits),
}));

export const reLeadActivitiesRelations = relations(reLeadActivities, ({one}) => ({
	reLead: one(reLeads, {
		fields: [reLeadActivities.leadId],
		references: [reLeads.id]
	}),
	tenant: one(tenants, {
		fields: [reLeadActivities.tenantId],
		references: [tenants.id]
	}),
}));

export const reLeadsRelations = relations(reLeads, ({one, many}) => ({
	reLeadActivities: many(reLeadActivities),
	tenant: one(tenants, {
		fields: [reLeads.tenantId],
		references: [tenants.id]
	}),
}));

export const reMaintenancesRelations = relations(reMaintenances, ({one}) => ({
	tenant: one(tenants, {
		fields: [reMaintenances.tenantId],
		references: [tenants.id]
	}),
	reProperty: one(reProperties, {
		fields: [reMaintenances.propertyId],
		references: [reProperties.id]
	}),
}));

export const reOwnersRelations = relations(reOwners, ({one}) => ({
	tenant: one(tenants, {
		fields: [reOwners.tenantId],
		references: [tenants.id]
	}),
}));

export const rePropertyFeaturesRelations = relations(rePropertyFeatures, ({one}) => ({
	reProperty: one(reProperties, {
		fields: [rePropertyFeatures.propertyId],
		references: [reProperties.id]
	}),
}));

export const rePropertyMediaRelations = relations(rePropertyMedia, ({one}) => ({
	reProperty: one(reProperties, {
		fields: [rePropertyMedia.propertyId],
		references: [reProperties.id]
	}),
}));

export const reRentPaymentsRelations = relations(reRentPayments, ({one}) => ({
	tenant: one(tenants, {
		fields: [reRentPayments.tenantId],
		references: [tenants.id]
	}),
	reContract: one(reContracts, {
		fields: [reRentPayments.contractId],
		references: [reContracts.id]
	}),
}));

export const reVisitsRelations = relations(reVisits, ({one}) => ({
	tenant: one(tenants, {
		fields: [reVisits.tenantId],
		references: [tenants.id]
	}),
	reProperty: one(reProperties, {
		fields: [reVisits.propertyId],
		references: [reProperties.id]
	}),
}));

export const refreshTokensRelations = relations(refreshTokens, ({one}) => ({
	user: one(users, {
		fields: [refreshTokens.userId],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [refreshTokens.tenantId],
		references: [tenants.id]
	}),
}));

export const saleItemsRelations = relations(saleItems, ({one}) => ({
	tenant: one(tenants, {
		fields: [saleItems.tenantId],
		references: [tenants.id]
	}),
	sale: one(sales, {
		fields: [saleItems.saleId],
		references: [sales.id]
	}),
	product: one(products, {
		fields: [saleItems.productId],
		references: [products.id]
	}),
}));

export const sedesRelations = relations(sedes, ({one}) => ({
	tenant: one(tenants, {
		fields: [sedes.tenantId],
		references: [tenants.id]
	}),
}));

export const serviceAvailabilityRelations = relations(serviceAvailability, ({one}) => ({
	service: one(services, {
		fields: [serviceAvailability.serviceId],
		references: [services.id]
	}),
	tenant: one(tenants, {
		fields: [serviceAvailability.tenantId],
		references: [tenants.id]
	}),
}));

export const servicesRelations = relations(services, ({one, many}) => ({
	serviceAvailabilities: many(serviceAvailability),
	serviceBlockedPeriods: many(serviceBlockedPeriods),
	serviceBookings: many(serviceBookings),
	tenant: one(tenants, {
		fields: [services.tenantId],
		references: [tenants.id]
	}),
}));

export const serviceBlockedPeriodsRelations = relations(serviceBlockedPeriods, ({one}) => ({
	tenant: one(tenants, {
		fields: [serviceBlockedPeriods.tenantId],
		references: [tenants.id]
	}),
	service: one(services, {
		fields: [serviceBlockedPeriods.serviceId],
		references: [services.id]
	}),
}));

export const serviceBookingsRelations = relations(serviceBookings, ({one}) => ({
	tenant: one(tenants, {
		fields: [serviceBookings.tenantId],
		references: [tenants.id]
	}),
	service: one(services, {
		fields: [serviceBookings.serviceId],
		references: [services.id]
	}),
}));

export const shiftEmployeeBonusesRelations = relations(shiftEmployeeBonuses, ({one}) => ({
	cashSession: one(cashSessions, {
		fields: [shiftEmployeeBonuses.sessionId],
		references: [cashSessions.id]
	}),
	shiftEmployee: one(shiftEmployees, {
		fields: [shiftEmployeeBonuses.shiftEmpId],
		references: [shiftEmployees.id]
	}),
}));

export const shiftEmployeesRelations = relations(shiftEmployees, ({one, many}) => ({
	shiftEmployeeBonuses: many(shiftEmployeeBonuses),
	cashSession: one(cashSessions, {
		fields: [shiftEmployees.sessionId],
		references: [cashSessions.id]
	}),
}));

export const stockMovementsRelations = relations(stockMovements, ({one}) => ({
	tenant: one(tenants, {
		fields: [stockMovements.tenantId],
		references: [tenants.id]
	}),
	product: one(products, {
		fields: [stockMovements.productId],
		references: [products.id]
	}),
	user: one(users, {
		fields: [stockMovements.userId],
		references: [users.id]
	}),
}));

export const storeAnnouncementBarRelations = relations(storeAnnouncementBar, ({one}) => ({
	tenant: one(tenants, {
		fields: [storeAnnouncementBar.tenantId],
		references: [tenants.id]
	}),
}));

export const storeBannersRelations = relations(storeBanners, ({one}) => ({
	tenant: one(tenants, {
		fields: [storeBanners.tenantId],
		references: [tenants.id]
	}),
}));

export const storeCustomSectionsRelations = relations(storeCustomSections, ({one}) => ({
	tenant: one(tenants, {
		fields: [storeCustomSections.tenantId],
		references: [tenants.id]
	}),
}));

export const storeDropProductsRelations = relations(storeDropProducts, ({one}) => ({
	storeDrop: one(storeDrops, {
		fields: [storeDropProducts.dropId],
		references: [storeDrops.id]
	}),
	product: one(products, {
		fields: [storeDropProducts.productId],
		references: [products.id]
	}),
}));

export const storeDropsRelations = relations(storeDrops, ({one, many}) => ({
	storeDropProducts: many(storeDropProducts),
	tenant: one(tenants, {
		fields: [storeDrops.tenantId],
		references: [tenants.id]
	}),
}));

export const storeFeaturedProductsRelations = relations(storeFeaturedProducts, ({one}) => ({
	tenant: one(tenants, {
		fields: [storeFeaturedProducts.tenantId],
		references: [tenants.id]
	}),
	product: one(products, {
		fields: [storeFeaturedProducts.productId],
		references: [products.id]
	}),
}));

export const storeInfoRelations = relations(storeInfo, ({one}) => ({
	tenant: one(tenants, {
		fields: [storeInfo.tenantId],
		references: [tenants.id]
	}),
}));

export const storeLocationsRelations = relations(storeLocations, ({one}) => ({
	tenant: one(tenants, {
		fields: [storeLocations.tenantId],
		references: [tenants.id]
	}),
}));

export const storeOrderBumpRelations = relations(storeOrderBump, ({one}) => ({
	tenant: one(tenants, {
		fields: [storeOrderBump.tenantId],
		references: [tenants.id]
	}),
}));

export const storefrontOrderItemsRelations = relations(storefrontOrderItems, ({one}) => ({
	storefrontOrder: one(storefrontOrders, {
		fields: [storefrontOrderItems.orderId],
		references: [storefrontOrders.id]
	}),
	product: one(products, {
		fields: [storefrontOrderItems.productId],
		references: [products.id]
	}),
}));

export const storefrontOrdersRelations = relations(storefrontOrders, ({one, many}) => ({
	storefrontOrderItems: many(storefrontOrderItems),
	tenant: one(tenants, {
		fields: [storefrontOrders.tenantId],
		references: [tenants.id]
	}),
	user_deliveryDriverId: one(users, {
		fields: [storefrontOrders.deliveryDriverId],
		references: [users.id],
		relationName: "storefrontOrders_deliveryDriverId_users_id"
	}),
	user_clientUserId: one(users, {
		fields: [storefrontOrders.clientUserId],
		references: [users.id],
		relationName: "storefrontOrders_clientUserId_users_id"
	}),
	fleetVehicle: one(fleetVehicles, {
		fields: [storefrontOrders.vehicleId],
		references: [fleetVehicles.id]
	}),
}));

export const trainerOffersRelations = relations(trainerOffers, ({one, many}) => ({
	trainerBookings: many(trainerBookings),
	trainer: one(trainers, {
		fields: [trainerOffers.trainerId],
		references: [trainers.id]
	}),
}));

export const trainersRelations = relations(trainers, ({many}) => ({
	trainerBookings: many(trainerBookings),
	trainerCommissions: many(trainerCommissions),
	trainerOffers: many(trainerOffers),
	trainerReviews: many(trainerReviews),
	trainerWithdrawals: many(trainerWithdrawals),
}));

export const trainerCommissionsRelations = relations(trainerCommissions, ({one}) => ({
	trainerBooking: one(trainerBookings, {
		fields: [trainerCommissions.bookingId],
		references: [trainerBookings.id]
	}),
	trainer: one(trainers, {
		fields: [trainerCommissions.trainerId],
		references: [trainers.id]
	}),
}));

export const trainerReviewsRelations = relations(trainerReviews, ({one}) => ({
	trainer: one(trainers, {
		fields: [trainerReviews.trainerId],
		references: [trainers.id]
	}),
}));

export const trainerWithdrawalsRelations = relations(trainerWithdrawals, ({one}) => ({
	trainer: one(trainers, {
		fields: [trainerWithdrawals.trainerId],
		references: [trainers.id]
	}),
}));

export const userAddressesRelations = relations(userAddresses, ({one}) => ({
	user: one(users, {
		fields: [userAddresses.userId],
		references: [users.id]
	}),
}));

export const vaultKeyRedemptionsRelations = relations(vaultKeyRedemptions, ({one}) => ({
	vaultKey: one(vaultKeys, {
		fields: [vaultKeyRedemptions.vaultKeyId],
		references: [vaultKeys.id]
	}),
}));

export const vaultKeysRelations = relations(vaultKeys, ({many}) => ({
	vaultKeyRedemptions: many(vaultKeyRedemptions),
}));

export const workOrderMaterialsRelations = relations(workOrderMaterials, ({one}) => ({
	tenant: one(tenants, {
		fields: [workOrderMaterials.tenantId],
		references: [tenants.id]
	}),
	workOrder: one(workOrders, {
		fields: [workOrderMaterials.workOrderId],
		references: [workOrders.id]
	}),
}));

export const workOrdersRelations = relations(workOrders, ({one, many}) => ({
	workOrderMaterials: many(workOrderMaterials),
	workOrderPayments: many(workOrderPayments),
	tenant: one(tenants, {
		fields: [workOrders.tenantId],
		references: [tenants.id]
	}),
	user_assignedTo: one(users, {
		fields: [workOrders.assignedTo],
		references: [users.id],
		relationName: "workOrders_assignedTo_users_id"
	}),
	user_createdBy: one(users, {
		fields: [workOrders.createdBy],
		references: [users.id],
		relationName: "workOrders_createdBy_users_id"
	}),
}));

export const workOrderPaymentsRelations = relations(workOrderPayments, ({one}) => ({
	tenant: one(tenants, {
		fields: [workOrderPayments.tenantId],
		references: [tenants.id]
	}),
	workOrder: one(workOrders, {
		fields: [workOrderPayments.workOrderId],
		references: [workOrders.id]
	}),
	user: one(users, {
		fields: [workOrderPayments.receivedBy],
		references: [users.id]
	}),
}));

export const workOrderSequenceRelations = relations(workOrderSequence, ({one}) => ({
	tenant: one(tenants, {
		fields: [workOrderSequence.tenantId],
		references: [tenants.id]
	}),
}));

export const workoutExercisesRelations = relations(workoutExercises, ({one, many}) => ({
	workoutSession: one(workoutSessions, {
		fields: [workoutExercises.sessionId],
		references: [workoutSessions.id]
	}),
	workoutSets: many(workoutSets),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({many}) => ({
	workoutExercises: many(workoutExercises),
}));

export const workoutSetsRelations = relations(workoutSets, ({one}) => ({
	workoutExercise: one(workoutExercises, {
		fields: [workoutSets.exerciseSessionId],
		references: [workoutExercises.id]
	}),
}));