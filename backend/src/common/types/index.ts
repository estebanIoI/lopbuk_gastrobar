// Tipos base
export type Category = string;
export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'fiado' | 'addi' | 'sistecredito' | 'mixto';
export type StockStatus = 'suficiente' | 'bajo' | 'agotado';
export type SaleStatus = 'completada' | 'anulada';
export type CreditStatus = 'pendiente' | 'parcial' | 'pagado';
export type StockMovementType = 'entrada' | 'salida' | 'ajuste' | 'venta' | 'devolucion';
export type UserRole = 'superadmin' | 'comerciante' | 'vendedor' | 'cliente' | 'repartidor' | 'auxiliar_bodega';
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
  sku: string;
  barcode?: string;
  stock: number;
  reorderPoint: number;
  supplier?: string;
  supplierId?: string;
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
  sellerId?: string;
  sellerName: string;
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
  topSellingProducts: Array<{
    id: string;
    name: string;
    category: string;
    totalSold: number;
    totalRevenue: number;
  }>;
  salesByCategory: Array<{
    category: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  recentSales: Sale[];
}

// Interfaces de request/response
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Cash Sessions
export type CashSessionStatus = 'abierta' | 'cerrada';
export type ClosingStatus = 'cuadrado' | 'sobrante' | 'faltante';
export type CashMovementType = 'entrada' | 'salida';

export interface CashSession {
  id: string;
  openedBy: string;
  openedByName: string;
  openingAmount: number;
  openedAt: Date;
  closedBy?: string;
  closedByName?: string;
  closedAt?: Date;
  totalCashSales: number;
  totalCardSales: number;
  totalTransferSales: number;
  totalFiadoSales: number;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CashMovement {
  id: string;
  sessionId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
  /** Permisos del cargo asignado. Cargados desde la BD en cada request (no en el JWT). */
  permissions?: string[];
  /** Plan del tenant. Cargado desde la BD en cada request (no en el JWT). */
  tenantPlan?: 'basico' | 'profesional' | 'empresarial';
}
