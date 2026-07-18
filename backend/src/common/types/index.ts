// Tipos base
export type Category = string;

// ─── Variantes & Tiers ────────────────────────────────────────────────────────

export type InventoryMovementType =
  | 'entrada' | 'salida' | 'ajuste' | 'merma' | 'transferencia' | 'reserva' | 'liberacion';

export interface ProductVariant {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  barcode?: string;
  color?: string;
  colorHex?: string;
  size?: string;
  material?: string;
  stock: number;
  reservedStock: number;
  minStock: number;
  costPrice?: number;
  priceOverride?: number;
  supplierId?: string;
  images?: string[];
  sortOrder: number;
  isActive: boolean;
  preorderLimit?: number | null;  // cupo máximo de preventa (null = ilimitado)
  preorderCount?: number;         // unidades vendidas/reservadas en preventa
  presale?: boolean;              // variante marcada como preventa
  presaleDate?: string | null;    // fecha estimada de disponibilidad
  presaleLimit?: number | null;   // cupo máximo de preventa (null = ilimitado)
  presaleSold?: number;           // unidades vendidas/reservadas en preventa
  presaleDepositPct?: number;     // % de anticipo requerido en preventa
  hormaId?: string | null;        // horma (silueta) de ESTA variante — un producto puede tener variantes en distintas hormas
  attributes?: Array<{ name: string; value: string }>; // ejes con nombre (ferretería/genérico): Diámetro, Ángulo, Presión…
  createdAt: Date;
  updatedAt: Date;
  // Eager-loaded
  priceTiers?: VariantPriceTier[];
  productName?: string;
  basePrice?: number;
  hormaName?: string;
  label?: string; // "Negro / M"
}

export interface VariantPriceTier {
  id: string;
  tenantId: string;
  variantId: string;
  minQty: number;
  price: number;
  tenantMarginPct: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResolvedPrice {
  price: number;
  tenantMarginPct: number;
  source: 'tier' | 'override' | 'base';
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactInfo?: string;
  phone?: string;
  email?: string;
  paymentTerms?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierProduct {
  id: string;
  tenantId: string;
  supplierId: string;
  productId: string;
  supplierSku?: string;
  supplierPrice?: number;
  leadTimeDays?: number;
  isPreferred: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryMovement {
  id: string;
  tenantId: string;
  variantId?: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'fiado' | 'addi' | 'sistecredito' | 'mixto';
export type StockStatus = 'suficiente' | 'bajo' | 'agotado';
export type SaleStatus = 'completada' | 'anulada';
export type CreditStatus = 'pendiente' | 'parcial' | 'pagado';
export type StockMovementType = 'entrada' | 'salida' | 'ajuste' | 'venta' | 'devolucion';
export type UserRole =
  | 'superadmin'
  | 'comerciante'
  | 'vendedor'
  | 'cliente'
  | 'repartidor'
  | 'auxiliar_bodega'
  | 'administrador_rb'
  | 'cajero'
  | 'mesero'
  | 'cocinero'
  | 'bartender'
  | 'despachador'
  | 'comunidad_admin';
export type TenantStatus = 'activo' | 'suspendido' | 'cancelado';
export type TenantPlan = 'basico' | 'profesional' | 'empresarial';
export type ProductType = 'general' | 'alimentos' | 'bebidas' | 'ropa' | 'electronica' | 'farmacia' | 'ferreteria' | 'libreria' | 'juguetes' | 'cosmetica' | 'perfumes' | 'deportes' | 'hogar' | 'mascotas' | 'otros';
export type WeightUnit = 'g' | 'kg' | 'ml' | 'l' | 'oz' | 'lb' | 'unidad';
export type Gender = 'hombre' | 'mujer' | 'unisex' | 'niño' | 'niña';
export type Season = 'verano' | 'invierno' | 'primavera' | 'otoño' | 'todo_año';
export type ProductCondition = 'nuevo' | 'reacondicionado' | 'usado' | 'exhibición';
export type BookFormat = 'pasta_dura' | 'pasta_blanda' | 'digital' | 'audio';

// Interfaces de entidades
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  businessType?: string;
  status: TenantStatus;
  plan: TenantPlan;
  maxUsers: number;
  maxProducts: number;
  ownerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId?: string | null;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  canLogin?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  articulo?: string;
  category: Category;
  productType: ProductType;
  brand?: string;
  model?: string;
  description?: string;
  purchasePrice: number;
  salePrice: number;
  /** Promo de cantidad (JSON string): {secondUnitPct, tiers:[{minQty,discountPct}]}. */
  qtyPromo?: string;
  sku: string;
  barcode?: string;
  stock: number;
  reorderPoint: number;
  supplier?: string;
  supplierId?: string;
  /** Horma (calzado): agrupa colores/tallas bajo una misma horma. */
  hormaId?: string;
  entryDate: Date;
  imageUrl?: string;
  images?: string[];
  locationInStore?: string;
  notes?: string;
  tags?: string[];
  // Alimentos / Bebidas
  expiryDate?: Date;
  batchNumber?: string;
  netWeight?: number;
  weightUnit?: WeightUnit;
  sanitaryRegistration?: string;
  storageTemperature?: string;
  ingredients?: string;
  nutritionalInfo?: string;
  alcoholContent?: number;
  allergens?: string;
  // Ropa
  size?: string;
  color?: string;
  material?: string;
  gender?: Gender;
  season?: Season;
  garmentType?: string;
  washingInstructions?: string;
  countryOfOrigin?: string;
  // Electronica
  serialNumber?: string;
  warrantyMonths?: number;
  technicalSpecs?: string;
  voltage?: string;
  powerWatts?: number;
  compatibility?: string;
  includesAccessories?: string;
  productCondition?: ProductCondition;
  // Farmacia
  activeIngredient?: string;
  concentration?: string;
  requiresPrescription?: boolean;
  administrationRoute?: string;
  presentation?: string;
  unitsPerPackage?: number;
  laboratory?: string;
  contraindications?: string;
  // Ferreteria
  dimensions?: string;
  weight?: number;
  caliber?: string;
  resistance?: string;
  finish?: string;
  recommendedUse?: string;
  // Libreria
  author?: string;
  publisher?: string;
  isbn?: string;
  pages?: number;
  language?: string;
  publicationYear?: number;
  edition?: string;
  bookFormat?: BookFormat;
  // Juguetes
  recommendedAge?: string;
  numberOfPlayers?: string;
  gameType?: string;
  requiresBatteries?: boolean;
  packageDimensions?: string;
  packageContents?: string;
  safetyWarnings?: string;
  // Sede / sucursal
  sedeId?: string;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  stockStatus?: StockStatus;
  isComposite?: boolean;
  bomCost?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  items?: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  mixedEfectivoAmount?: number;
  mixedSecondMethod?: string;
  mixedSecondAmount?: number;
  sellerId?: string;
  sellerName: string;
  sedeId?: string;
  status: SaleStatus;
  creditStatus?: CreditStatus;
  dueDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  referenceId?: string;
  userId?: string;
  createdAt: Date;
}

export interface StoreInfo {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  taxId?: string;
  email?: string;
  logoUrl?: string;
  updatedAt: Date;
}

export interface DashboardMetrics {
  totalProducts: number;
  totalInventoryValue: number;
  dailySales: number;
  weeklySales: number;
  monthlySales: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  accountsReceivable?: number;
  topSellingProducts: Array<{ id: string; name: string; category: string; totalSold: number; totalRevenue: number }>;
  salesByCategory: Array<{ category: string; totalQuantity: number; totalRevenue: number }>;
  recentSales: any[];
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
export interface JWTPayload {
  userId: string;
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
  /** Plan del comercio, cargado por el middleware de autenticación. */
  tenantPlan?: TenantPlan;
  /** Permisos del cargo, cargados por el middleware de autenticación. */
  permissions?: string[];
}

// ─── Respuesta paginada genérica ────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Caja (cash sessions) ───────────────────────────────────────────────────────
export type CashSessionStatus = 'abierta' | 'cerrada' | 'completada';
export type ClosingStatus = 'cuadrado' | 'sobrante' | 'faltante';

export interface CashSession {
  id: string;
  openedBy: string;
  openedByName: string;
  openingAmount: number;
  openedAt: Date;
  shiftType?: string;
  shiftLabel?: string | null;
  closedBy?: string;
  closedByName?: string;
  closedAt?: Date;
  totalCashSales: number;
  totalCardSales: number;
  totalTransferSales: number;
  totalFiadoSales: number;
  totalCreditPaymentsEfectivo: number;
  totalCreditPaymentsTarjeta: number;
  totalCreditPaymentsTransferencia: number;
  totalSalesCount: number;
  totalChangeGiven: number;
  totalCashEntries: number;
  totalCashWithdrawals: number;
  expectedCash?: number;
  actualCash?: number;
  difference?: number;
  status: CashSessionStatus;
  closingStatus?: ClosingStatus;
  observations?: string;
  /** Libro de ventas del turno (snapshot por producto al cerrar). */
  salesBook?: SalesBookEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SalesBookEntry {
  productId: string;
  name: string;
  quantity: number;
  total: number;
}

export interface CashMovement {
  id: string;
  sessionId: string;
  type: 'entrada' | 'salida';
  amount: number;
  reason: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Customer Engagement Platform (P1)
// ═══════════════════════════════════════════════════════════════════════════════

export type LoyaltyLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyAccount {
  id: string;
  tenantId: string;
  customerName: string | null;
  customerPhone: string;
  customerEmail: string | null;
  pointsBalance: number;
  totalEarned: number;
  level: LoyaltyLevel;
  visits: number;
  lastVisit: string | null;
  totalSpent: number;
  walletId: string | null;
  walletProvider: string;
  walletStatus: 'active' | 'expired' | 'revoked';
  birthday: string | null;
  acquisitionChannel: string | null;
  favoriteCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyConfig {
  enabled: boolean;
  pointsPerThousand: number;
  walletEnabled: boolean;
  walletLogoUrl: string | null;
  walletPrimaryColor: string;
  walletBusinessName: string | null;
  walletShortDescription: string | null;
  geoRadiusMeters: number;
  geoPushEnabled: boolean;
  geoPushMessage: string | null;
}

export interface LoyaltyReward {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  pointsCost: number;
  rewardType: 'points' | 'purchase_count' | 'spend_amount' | 'cashback' | 'streak' | 'referral';
  conditionValue: number | null;
  streakDays: number | null;
  isActive: boolean;
  createdAt: string;
}

export type EngagementCampaignObjective =
  | 'increase_sales' | 'recover_inactive' | 'reward_loyal'
  | 'promote_product' | 'anniversary' | 'birthday' | 'custom';

export type EngagementCampaignStatus =
  | 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';

export type EngagementOfferType =
  | 'percentage' | 'fixed' | 'free_item' | 'points_multiplier' | 'free_delivery';

export interface EngagementCampaign {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  objective: EngagementCampaignObjective;
  audienceFilter: Record<string, any> | null;
  offerType: EngagementOfferType | null;
  offerValue: number | null;
  channels: string[];
  scheduledAt: string | null;
  sentCount: number;
  openedCount: number;
  convertedCount: number;
  status: EngagementCampaignStatus;
}

export type AutomationTrigger =
  | 'sale_completed' | 'points_earned' | 'level_up'
  | 'inactive_7d' | 'inactive_30d' | 'birthday' | 'geo_enter'
  | 'time_of_day' | 'near_reward' | 'visit_streak' | 'first_purchase';

export type AutomationAction =
  | 'push' | 'whatsapp' | 'notification' | 'coupon' | 'wallet_update' | 'email';

export interface EngagementAutomation {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  triggerType: AutomationTrigger;
  triggerConfig: Record<string, any> | null;
  actionType: AutomationAction;
  actionConfig: Record<string, any> | null;
  isActive: boolean;
}

export interface EngagementEvent {
  id: string;
  tenantId: string;
  accountId: string | null;
  eventType: string;
  eventData: Record<string, any> | null;
  createdAt: string;
}

export interface EngagementSegment {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  rules: Record<string, any>;
  customerCount: number;
  isDynamic: boolean;
  isActive: boolean;
}

export const LEVEL_THRESHOLDS: Record<LoyaltyLevel, { minVisits: number; minSpent: number; color: string; label: string }> = {
  bronze:   { minVisits: 0,  minSpent: 0,      color: '#CD7F32', label: 'Bronce' },
  silver:   { minVisits: 5,  minSpent: 150000,  color: '#C0C0C0', label: 'Plata' },
  gold:     { minVisits: 15, minSpent: 500000,  color: '#FFD700', label: 'Oro' },
  platinum: { minVisits: 40, minSpent: 1500000, color: '#E5E4E2', label: 'Platino' },
};

export function computeLevel(visits: number, totalSpent: number): LoyaltyLevel {
  if (visits >= LEVEL_THRESHOLDS.platinum.minVisits && totalSpent >= LEVEL_THRESHOLDS.platinum.minSpent) return 'platinum';
  if (visits >= LEVEL_THRESHOLDS.gold.minVisits && totalSpent >= LEVEL_THRESHOLDS.gold.minSpent) return 'gold';
  if (visits >= LEVEL_THRESHOLDS.silver.minVisits && totalSpent >= LEVEL_THRESHOLDS.silver.minSpent) return 'silver';
  return 'bronze';
}
