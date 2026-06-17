/**
 * affiliates.types.ts — Tipos del módulo de Promotores / Afiliados (Sprint 1).
 *
 * Modelo de dos niveles:
 *   • Plataforma: el promotor (`affiliates`) existe fuera del scope de un tenant.
 *   • Tenant: campañas, conversiones, comisiones y paquetes van ancladas a un tenant_id.
 *
 * Dos modelos de ingreso:
 *   1) Comisión por conversión (enlace ?ref= o código de descuento).
 *   2) Paquetes de publicidad con pago inmediato al wallet.
 */

export type AffiliateTier = 'bronze' | 'silver' | 'gold';
export type AffiliateStatus = 'active' | 'suspended';

export type CampaignEntityType = 'store' | 'product' | 'event' | 'service';
export type PackageEntityType = 'store' | 'event' | 'service';

export type ConversionMethod = 'link' | 'code';
export type ConversionStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export type CommissionType = 'conversion' | 'mission_bonus' | 'tier_bonus' | 'package';
export type CommissionStatus = 'pending' | 'approved' | 'paid';

export type PackageOrderStatus =
  | 'pending_payment' | 'paid' | 'in_progress' | 'completed' | 'cancelled';

export type WithdrawalStatus = 'requested' | 'processing' | 'paid' | 'rejected';
export type MissionSubmissionStatus = 'submitted' | 'approved' | 'rejected';

// ── Entidades ────────────────────────────────────────────────────────────────

export interface Affiliate {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string | null;
  handle: string | null;
  tier: AffiliateTier;
  balanceCop: number;
  pendingCop: number;
  monthlySales: number;
  status: AffiliateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantEvent {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  coverImage: string | null;
  ticketPrice: number | null;
  capacity: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliatePackage {
  id: string;
  name: string;
  description: string | null;
  deliverables: Record<string, number> | null;
  priceCop: number;
  affiliatePct: number;
  platformPct: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateCampaign {
  id: string;
  affiliateId: string;
  tenantId: string;
  entityType: CampaignEntityType;
  entityId: string | null;
  refToken: string;
  discountCode: string | null;
  discountPct: number;
  commissionPct: number;
  cookieDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateConversion {
  id: string;
  campaignId: string;
  tenantId: string;
  orderId: string | null;
  saleId: string | null;
  method: ConversionMethod;
  orderTotalCop: number;
  commissionCop: number;
  status: ConversionStatus;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AffiliateCommission {
  id: string;
  affiliateId: string;
  conversionId: string | null;
  type: CommissionType;
  amountCop: number;
  status: CommissionStatus;
  note: string | null;
  createdAt: string;
}

export interface AffiliatePackageOrder {
  id: string;
  packageId: string;
  affiliateId: string;
  tenantId: string;
  entityType: PackageEntityType;
  entityId: string | null;
  status: PackageOrderStatus;
  totalCop: number;
  affiliateCop: number;
  platformCop: number;
  paidAt: string | null;
  contentDeadline: string | null;
  contentDelivered: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateWithdrawal {
  id: string;
  affiliateId: string;
  amountCop: number;
  paymentMethod: string;
  status: WithdrawalStatus;
  processedBy: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateMission {
  id: string;
  title: string;
  description: string | null;
  rewardCop: number;
  requiredViews: number | null;
  minTier: AffiliateTier;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AffiliateMissionSubmission {
  id: string;
  missionId: string;
  affiliateId: string;
  contentUrl: string;
  status: MissionSubmissionStatus;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// ── Reglas de niveles (Tier Engine, Sprint 4) ────────────────────────────────
// La comisión del tier MULTIPLICA/ajusta la base de la campaña; no la sobrescribe.
export const TIER_RULES: Record<AffiliateTier, { minMonthlySales: number; baseCommissionPct: number }> = {
  bronze: { minMonthlySales: 0,  baseCommissionPct: 5 },
  silver: { minMonthlySales: 11, baseCommissionPct: 7 },
  gold:   { minMonthlySales: 50, baseCommissionPct: 10 },
};

export const DEFAULT_COOKIE_DAYS = 7;
