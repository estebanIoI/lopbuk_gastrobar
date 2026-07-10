import pool from '../../config/database';

// ── 🔐 RESTRICCIÓN DE PRIVACIDAD (Ley 1581 / RGPD) ─────────────────────────────
// El contexto RAG del agente SOLO puede contener datos del negocio (tienda,
// categorías, servicios, productos, ofertas, cupones). PROHIBIDO inyectar PII de
// OTROS clientes en el prompt del LLM. Excepción sancionada: personalización con
// los datos del PROPIO cliente de la sesión (nombre + resumen de su última compra),
// cuyo consentimiento data_processing quedó en consent_records al comprar. La
// DIRECCIÓN nunca va al LLM: se resuelve server-side en registrar_pedido
// ("misma dirección"). Ver daimuz/governance/universal-constraints.md.
// ────────────────────────────────────────────────────────────────────────────────

export interface FeaturedProduct {
  id: string;
  name: string;
  salePrice: number;
  category: string | null;
  imageUrl: string | null;
}

export interface OfferProduct {
  name: string;
  salePrice: number;
  offerPrice: number;
  offerLabel: string | null;
}

export interface ActiveCoupon {
  code: string;
  discountType: 'porcentaje' | 'fijo';
  discountValue: number;
  minPurchase: number | null;
  expiresAt: string | null;
}

export interface DynamicContext {
  storeName: string;
  storeSlug: string;
  storePhone: string | null;
  storeEmail: string | null;
  storeAddress: string | null;
  storeSchedule: string | null;
  storeWhatsapp: string | null;
  storeInstagram: string | null;
  paymentMethods: string | null;
  categories: string[];
  services: ServiceInfo[];
  featuredProducts: FeaturedProduct[];
  reservationsEnabled: boolean;
  reservationOpenTime?: string;
  reservationCloseTime?: string;
  reservationOccasions?: string[];
  // ── Palancas de cierre ──
  /** Productos en oferta activa (precio tachado real) */
  offers: OfferProduct[];
  /** Cupones vigentes que el agente puede ofrecer */
  activeCoupons: ActiveCoupon[];
  /** Costo de domicilio configurado por el comercio */
  deliveryFee: number;
  /** Envío gratis a partir de este subtotal (0 = sin envío gratis) */
  freeDeliveryMin: number;
  /** Complementos para upsell (order bump del comercio) */
  bumpTitle: string | null;
  bumpProducts: FeaturedProduct[];
  allowContraentrega: boolean;
}

interface ServiceInfo {
  name: string;
  price: number;
  priceType: string;
  durationMinutes: number | null;
  serviceType: string;
}

function parseJsonArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

export async function buildDynamicContext(tenantId: string): Promise<DynamicContext> {
  const [[storeRows], [tenantRows], [catRows], [svcRows], [prodRows], [offerRows], [couponRows], [bumpRows]] = await Promise.all([
    pool.query(
      `SELECT name, phone, email, address, schedule, social_whatsapp, social_instagram, payment_methods,
              cart_delivery_fee, cart_min_purchase, allow_contraentrega
       FROM store_info WHERE tenant_id = ? LIMIT 1`,
      [tenantId]
    ).catch(() => [[]] as any) as Promise<any>,
    pool.query(
      `SELECT slug, reservations_enabled, reservations_open_time, reservations_close_time,
              reservations_slot_minutes, reservations_occasions
       FROM tenants WHERE id = ? LIMIT 1`,
      [tenantId]
    ).catch(() => [[]] as any) as Promise<any>,
    pool.query(
      `SELECT name FROM categories WHERE tenant_id = ? AND hidden_in_store = 0 ORDER BY name LIMIT 20`,
      [tenantId]
    ).catch(() => [[]] as any) as Promise<any>,
    pool.query(
      `SELECT name, price, price_type, duration_minutes, service_type
       FROM services WHERE tenant_id = ? AND is_published = 1 AND is_active = 1
       ORDER BY sort_order ASC LIMIT 10`,
      [tenantId]
    ).catch(() => [[]] as any) as Promise<any>,
    pool.query(
      `SELECT id, name, sale_price AS salePrice, category, image_url AS imageUrl
       FROM products
       WHERE tenant_id = ? AND published_in_store = 1 AND stock > 0
       ORDER BY created_at DESC LIMIT 20`,
      [tenantId]
    ).catch(() => [[]] as any) as Promise<any>,
    // Ofertas activas: palanca de cierre honesta (precio tachado real)
    pool.query(
      `SELECT name, sale_price AS salePrice, offer_price AS offerPrice, offer_label AS offerLabel
       FROM products
       WHERE tenant_id = ? AND published_in_store = 1 AND is_on_offer = 1 AND offer_price IS NOT NULL
         AND (stock > 0 OR EXISTS (SELECT 1 FROM product_variants v
              WHERE v.product_id = products.id AND v.is_active = 1 AND (v.stock - v.reserved_stock) > 0))
       ORDER BY updated_at DESC LIMIT 5`,
      [tenantId]
    ).catch(() => [[]] as any) as Promise<any>,
    // Cupones vigentes que el agente puede ofrecer para cerrar
    pool.query(
      `SELECT code, discount_type AS discountType, discount_value AS discountValue,
              min_purchase AS minPurchase, expires_at AS expiresAt
       FROM discount_coupons
       WHERE tenant_id = ? AND is_active = 1
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR times_used < max_uses)
       ORDER BY created_at DESC LIMIT 5`,
      [tenantId]
    ).catch(() => [[]] as any) as Promise<any>,
    // Order bump del comercio → complementos para upsell
    pool.query(
      `SELECT is_enabled AS isEnabled, mode, title, max_items AS maxItems, product_ids AS productIds
       FROM store_order_bump WHERE tenant_id = ? LIMIT 1`,
      [tenantId]
    ).catch(() => [[]] as any) as Promise<any>,
  ]);

  const store = (storeRows as any[])?.[0] || {};
  const tenant = (tenantRows as any[])?.[0] || {};

  // Resolver productos del order bump (manual = ids elegidos; auto = novedades en stock)
  let bumpTitle: string | null = null;
  let bumpProducts: FeaturedProduct[] = [];
  const bump = (bumpRows as any[])?.[0];
  if (bump?.isEnabled) {
    bumpTitle = bump.title || null;
    const maxItems = Math.min(Number(bump.maxItems) || 3, 5);
    let bumpQuery = '';
    let bumpParams: any[] = [];
    const manualIds = parseJsonArray(bump.productIds);
    if (bump.mode === 'manual' && manualIds.length > 0) {
      bumpQuery = `SELECT id, name, sale_price AS salePrice, category, image_url AS imageUrl
                   FROM products WHERE tenant_id = ? AND id IN (${manualIds.map(() => '?').join(',')})
                     AND published_in_store = 1 AND stock > 0 LIMIT ${maxItems}`;
      bumpParams = [tenantId, ...manualIds];
    } else {
      bumpQuery = `SELECT id, name, sale_price AS salePrice, category, image_url AS imageUrl
                   FROM products WHERE tenant_id = ? AND published_in_store = 1 AND stock > 0
                   ORDER BY created_at DESC LIMIT ${maxItems}`;
      bumpParams = [tenantId];
    }
    try {
      const [bp] = await pool.query(bumpQuery, bumpParams) as any;
      bumpProducts = ((bp as any[]) || []).map((p: any) => ({
        id: String(p.id), name: p.name, salePrice: Number(p.salePrice),
        category: p.category || null, imageUrl: p.imageUrl || null,
      }));
    } catch { /* bump es opcional: nunca rompe el contexto */ }
  }

  return {
    storeName: store.name || '',
    storeSlug: tenant.slug || '',
    storePhone: store.phone || null,
    storeEmail: store.email || null,
    storeAddress: store.address || null,
    storeSchedule: store.schedule || null,
    storeWhatsapp: store.social_whatsapp || null,
    storeInstagram: store.social_instagram || null,
    paymentMethods: store.payment_methods || null,
    categories: ((catRows as any[]) || []).map((r: any) => r.name),
    services: ((svcRows as any[]) || []).map((s: any) => ({
      name: s.name,
      price: Number(s.price),
      priceType: s.price_type,
      durationMinutes: s.duration_minutes || null,
      serviceType: s.service_type,
    })),
    featuredProducts: ((prodRows as any[]) || []).map((p: any) => ({
      id: String(p.id),
      name: p.name,
      salePrice: Number(p.salePrice),
      category: p.category || null,
      imageUrl: p.imageUrl || null,
    })),
    reservationsEnabled: !!tenant.reservations_enabled,
    reservationOpenTime: tenant.reservations_open_time || undefined,
    reservationCloseTime: tenant.reservations_close_time || undefined,
    reservationOccasions: parseJsonArray(tenant.reservations_occasions),
    offers: ((offerRows as any[]) || []).map((o: any) => ({
      name: o.name,
      salePrice: Number(o.salePrice),
      offerPrice: Number(o.offerPrice),
      offerLabel: o.offerLabel || null,
    })),
    activeCoupons: ((couponRows as any[]) || []).map((c: any) => ({
      code: c.code,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      minPurchase: c.minPurchase != null ? Number(c.minPurchase) : null,
      expiresAt: c.expiresAt || null,
    })),
    deliveryFee: Number(store.cart_delivery_fee || 0),
    freeDeliveryMin: Number(store.cart_min_purchase || 0),
    bumpTitle,
    bumpProducts,
    allowContraentrega: store.allow_contraentrega !== 0,
  };
}
