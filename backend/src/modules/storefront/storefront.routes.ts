import { Router, Request, Response, NextFunction } from 'express';
import { query, param, body } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';
import { authenticate, requirePlan } from '../../common/middleware';

const router: ReturnType<typeof Router> = Router();

/** Normaliza el campo images: MySQL puede devolver JSON column como string */
function parseImages(row: any): any {
  if (!row) return row;
  const raw = row.images;
  if (raw === null || raw === undefined) return { ...row, images: null };
  if (Array.isArray(raw)) {
    return { ...row, images: (raw as string[]).filter(Boolean) };
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return { ...row, images: Array.isArray(parsed) ? (parsed as string[]).filter(Boolean) : null };
    } catch {
      return { ...row, images: null };
    }
  }
  return { ...row, images: null };
}

// GET /api/storefront/products — Public endpoint, no auth required
router.get(
  '/products',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Pagina invalida'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limite invalido'),
    query('category').optional().notEmpty().withMessage('Categoria invalida'),
    query('search').optional().notEmpty(),
    query('store').optional().notEmpty(),
    query('municipality').optional().notEmpty(),
    query('no_location').optional().isBoolean(),
    query('sede').optional().notEmpty(),
    validateRequest,
  ],
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 200;
      const offset = (page - 1) * limit;
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;
      const store = req.query.store as string | undefined;
      const municipality = req.query.municipality as string | undefined;
      const noLocation = req.query.no_location === 'true';
      const sedeId = req.query.sede as string | undefined;

      // Get tenants — optionally filter by store slug
      let tenantId: string | null = null;
      const showAll = !store || store === 'all';

      if (!showAll) {
        const [tenants] = await pool.query(
          'SELECT id FROM tenants WHERE status = ? AND slug = ? LIMIT 1',
          ['activo', store]
        ) as any;
        if (tenants && tenants.length > 0) tenantId = tenants[0].id;
      }

      let whereClause: string;
      const params: any[] = [];

      if (showAll || !tenantId) {
        // Show products from all active tenants
        whereClause = `WHERE p.stock > 0 AND p.published_in_store = 1 AND p.tenant_id IN (SELECT id FROM tenants WHERE status = 'activo')`;
      } else {
        whereClause = 'WHERE p.tenant_id = ? AND p.stock > 0 AND p.published_in_store = 1';
        params.push(tenantId);
      }

      if (category) {
        whereClause += ' AND p.category = ?';
        params.push(category);
      }

      if (search) {
        whereClause += ' AND (p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Save fallback params (without municipality) before adding location filter
      let fallbackWhereClause = whereClause;
      const fallbackParams = [...params];

      // Location filter
      if (municipality) {
        // Client has location: show envio/ambos everywhere + domicilio only in same municipality
        whereClause += ` AND (p.delivery_type IS NULL OR p.delivery_type IN ('envio', 'ambos') OR (p.delivery_type = 'domicilio' AND si.municipality = ?))`;
        params.push(municipality);
      } else if (noLocation) {
        // Client skipped location: hide domicilio-only products, show envio/ambos/null
        whereClause += ` AND (p.delivery_type IS NULL OR p.delivery_type IN ('envio', 'ambos'))`;
      }

      // Sede filter: show products of that sede OR products without a sede
      if (sedeId) {
        whereClause += ` AND (p.sede_id = ? OR p.sede_id IS NULL)`;
        fallbackWhereClause += ` AND (p.sede_id = ? OR p.sede_id IS NULL)`;
        params.push(sedeId);
        fallbackParams.push(sedeId);
      }

      // Count total (JOIN store_info when municipality filtering is active)
      const joinStoreInfo = municipality ? 'LEFT JOIN store_info si ON si.tenant_id = p.tenant_id' : '';
      let total = 0;
      try {
        const [countResult] = await pool.query(
          `SELECT COUNT(*) as total FROM products p ${joinStoreInfo} ${whereClause}`,
          params
        ) as any;
        total = countResult[0].total;
      } catch {
        // Fallback count without location filter
        const [countResult] = await pool.query(
          `SELECT COUNT(*) as total FROM products p ${fallbackWhereClause}`,
          fallbackParams
        ) as any;
        total = countResult[0].total;
      }

      // Get products (only public-safe fields)
      let rows: any[];
      try {
        const [r] = await pool.query(
          `SELECT
            p.id, p.name, p.category, p.brand, p.description,
            p.sale_price as salePrice, p.image_url as imageUrl,
            p.image_urls as images,
            p.stock, p.color, p.size, p.gender,
            p.is_on_offer as isOnOffer, p.offer_price as offerPrice,
            p.offer_label as offerLabel,
            IF(p.available_for_delivery, 1, 0) as availableForDelivery,
            p.delivery_type as deliveryType,
            p.sede_id as sedeId,
            p.tenant_id as tenantId, t.name as storeName, t.slug as storeSlug
          FROM products p
          LEFT JOIN tenants t ON t.id = p.tenant_id
          ${joinStoreInfo}
          ${whereClause}
          ORDER BY p.is_on_offer DESC, p.name ASC
          LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        ) as any;
        rows = r;
      } catch {
        // Fallback: delivery_type / municipality columns may not exist in running DB yet
        const [r] = await pool.query(
          `SELECT
            p.id, p.name, p.category, p.brand, p.description,
            p.sale_price as salePrice, p.image_url as imageUrl,
            p.image_urls as images,
            p.stock, p.color, p.size, p.gender,
            p.is_on_offer as isOnOffer, p.offer_price as offerPrice,
            p.offer_label as offerLabel,
            IF(p.available_for_delivery, 1, 0) as availableForDelivery,
            NULL as deliveryType,
            NULL as sedeId,
            p.tenant_id as tenantId, t.name as storeName, t.slug as storeSlug
          FROM products p
          LEFT JOIN tenants t ON t.id = p.tenant_id
          ${fallbackWhereClause}
          ORDER BY p.is_on_offer DESC, p.name ASC
          LIMIT ? OFFSET ?`,
          [...fallbackParams, limit, offset]
        ) as any;
        rows = r;
      }

      res.json({
        success: true,
        data: {
          products: (rows as any[]).map(parseImages),
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error('Storefront products error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener productos' });
    }
  }
);

// GET /api/storefront/categories — Public endpoint
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const store = req.query.store as string | undefined;
    let tenantId: string | null = null;

    if (store) {
      const [tenants] = await pool.query(
        'SELECT id FROM tenants WHERE status = ? AND slug = ? LIMIT 1',
        ['activo', store]
      ) as any;
      if (tenants && tenants.length > 0) tenantId = tenants[0].id;
    }

    if (!tenantId) {
      // No store filter: get categories across all active tenants
      const [rows] = await pool.query(
        `SELECT DISTINCT p.category FROM products p
         INNER JOIN tenants t ON p.tenant_id = t.id
         WHERE t.status = 'activo' AND p.stock > 0 AND p.published_in_store = 1
         ORDER BY p.category`
      ) as any;

      res.json({ success: true, data: rows.map((r: any) => r.category) });
      return;
    }

    const [rows] = await pool.query(
      'SELECT DISTINCT category FROM products WHERE tenant_id = ? AND stock > 0 AND published_in_store = 1 ORDER BY category',
      [tenantId]
    ) as any;

    res.json({
      success: true,
      data: rows.map((r: any) => r.category),
    });
  } catch (error) {
    console.error('Storefront categories error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener categorías' });
  }
});

// GET /api/storefront/sedes — Public: sedes of a store
router.get('/sedes', async (req: Request, res: Response) => {
  try {
    const store = req.query.store as string | undefined;
    if (!store) return res.json({ success: true, data: [] });
    const [tenants] = await pool.query(
      'SELECT id FROM tenants WHERE status = ? AND slug = ? LIMIT 1',
      ['activo', store]
    ) as any;
    if (!tenants?.length) return res.json({ success: true, data: [] });
    const [rows] = await pool.query(
      'SELECT id, name, address FROM sedes WHERE tenant_id = ? ORDER BY created_at ASC',
      [tenants[0].id]
    ) as any;
    res.json({ success: true, data: rows });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/storefront/stores — Lista de tiendas activas (público)
// ?municipality=Mocoa  → filtra tiendas del mismo municipio O que tienen productos de envío
router.get('/stores', async (req: Request, res: Response) => {
  try {
    const municipality = req.query.municipality as string | undefined;

    let municipalityFilter = '';
    const params: any[] = [];

    if (municipality) {
      // Show: stores in same municipality, OR stores with envio/ambos products, OR stores with no location set
      municipalityFilter = `AND (si.municipality IS NULL OR si.municipality = ? OR EXISTS (
        SELECT 1 FROM products p2
        WHERE p2.tenant_id = t.id AND p2.stock > 0 AND p2.published_in_store = 1
          AND p2.delivery_type IN ('envio', 'ambos')
      ))`;
      params.push(municipality);
    }

    const [stores] = await pool.query(
      `SELECT t.id, t.name, t.slug, t.business_type as businessType,
              si.logo_url as logoUrl, si.address, si.latitude, si.longitude,
              si.municipality, si.department,
              (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id AND p.stock > 0 AND p.published_in_store = 1) as productCount
       FROM tenants t
       LEFT JOIN store_info si ON si.tenant_id = t.id
       WHERE t.status = 'activo'
       ${municipalityFilter}
       ORDER BY t.name ASC`,
      params
    ) as any;

    res.json({ success: true, data: stores });
  } catch (error) {
    console.error('Storefront stores error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener tiendas' });
  }
});

// GET /api/storefront/platform-settings — Public: configuración global de la plataforma
router.get('/platform-settings', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value FROM platform_settings'
    ) as any;
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value;
    }
    res.json({ success: true, data: settings });
  } catch {
    res.json({ success: true, data: { bg_color: '#000000' } });
  }
});

// =============================================
// AUTHENTICATED: Endpoints para gestionar publicación
// =============================================

// PUT /api/storefront/publish/:productId — Publicar/despublicar producto
router.put(
  '/publish/:productId',
  authenticate,
  requirePlan('empresarial'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { productId } = req.params;
      const { published } = req.body;

      // Validate published parameter
      if (typeof published !== 'boolean') {
        res.status(400).json({ success: false, error: 'El campo "published" debe ser verdadero o falso' });
        return;
      }

      const publishedValue = published ? 1 : 0;
      const [result] = await pool.query(
        'UPDATE products SET published_in_store = ? WHERE id = ? AND tenant_id = ?',
        [publishedValue, productId, tenantId]
      ) as any;

      if (result.affectedRows === 0) {
        res.status(404).json({ success: false, error: 'Producto no encontrado' });
        return;
      }

      res.json({ success: true, data: { id: productId, publishedInStore: published } });
    } catch (error) {
      console.error('Publish product error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar publicación' });
    }
  }
);

// PUT /api/storefront/delivery/:productId — Tipo de entrega del producto
// Body: { deliveryType: 'domicilio' | 'envio' | 'ambos' | null }
//   null = sin entrega configurada (no aparece en sección de domicilio)
router.put(
  '/delivery/:productId',
  authenticate,
  requirePlan('empresarial'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { productId } = req.params;
      const { deliveryType } = req.body;

      const validTypes = ['domicilio', 'envio', 'ambos', null];
      if (!validTypes.includes(deliveryType)) {
        res.status(400).json({ success: false, error: 'deliveryType debe ser "domicilio", "envio", "ambos" o null' });
        return;
      }

      const [result] = await pool.query(
        'UPDATE products SET delivery_type = ?, available_for_delivery = ? WHERE id = ? AND tenant_id = ?',
        [deliveryType || null, deliveryType ? 1 : 0, productId, tenantId]
      ) as any;

      if (result.affectedRows === 0) {
        res.status(404).json({ success: false, error: 'Producto no encontrado' });
        return;
      }

      res.json({ success: true, data: { id: productId, deliveryType: deliveryType || null, availableForDelivery: !!deliveryType } });
    } catch (error) {
      console.error('Toggle delivery product error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar tipo de entrega' });
    }
  }
);

// PUT /api/storefront/publish-bulk — Publicar/despublicar múltiples productos
router.put(
  '/publish-bulk',
  authenticate,
  requirePlan('empresarial'),
  [
    body('productIds').isArray({ min: 1 }).withMessage('Se requiere al menos un producto'),
    body('published').isBoolean().withMessage('Estado de publicación requerido'),
    validateRequest,
  ],
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { productIds, published } = req.body;

      const placeholders = productIds.map(() => '?').join(',');
      const [result] = await pool.query(
        `UPDATE products SET published_in_store = ? WHERE id IN (${placeholders}) AND tenant_id = ?`,
        [published ? 1 : 0, ...productIds, tenantId]
      ) as any;

      res.json({
        success: true,
        data: { updatedCount: result.affectedRows, published: !!published }
      });
    } catch (error) {
      console.error('Bulk publish error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar publicación masiva' });
    }
  }
);

// GET /api/storefront/my-published — Productos publicados del tenant actual
router.get(
  '/my-published',
  authenticate,
  requirePlan('empresarial'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user.tenantId;

      let rows: any[];
      try {
        // Full query with all new columns (delivery_type, is_new_launch, launch_date)
        const [r] = await pool.query(
          `SELECT id, name, category, brand, sale_price as salePrice, image_url as imageUrl,
                  stock, IF(published_in_store, 1, 0) as publishedInStore,
                  IF(is_on_offer, 1, 0) as isOnOffer,
                  offer_price as offerPrice, offer_label as offerLabel, offer_end as offerEnd,
                  IF(available_for_delivery, 1, 0) as availableForDelivery,
                  delivery_type as deliveryType,
                  IF(is_new_launch, 1, 0) as isNewLaunch, launch_date as launchDate
           FROM products
           WHERE tenant_id = ?
           ORDER BY name ASC`,
          [tenantId]
        ) as any;
        rows = r;
      } catch {
        try {
          // Fallback 1: without delivery_type
          const [r] = await pool.query(
            `SELECT id, name, category, brand, sale_price as salePrice, image_url as imageUrl,
                    stock, IF(published_in_store, 1, 0) as publishedInStore,
                    IF(is_on_offer, 1, 0) as isOnOffer,
                    offer_price as offerPrice, offer_label as offerLabel, offer_end as offerEnd,
                    IF(available_for_delivery, 1, 0) as availableForDelivery,
                    NULL as deliveryType,
                    IF(is_new_launch, 1, 0) as isNewLaunch, launch_date as launchDate
             FROM products
             WHERE tenant_id = ?
             ORDER BY name ASC`,
            [tenantId]
          ) as any;
          rows = r;
        } catch {
          // Fallback 2: without delivery_type, is_new_launch, or launch_date
          const [r] = await pool.query(
            `SELECT id, name, category, brand, sale_price as salePrice, image_url as imageUrl,
                    stock, IF(published_in_store, 1, 0) as publishedInStore,
                    IF(is_on_offer, 1, 0) as isOnOffer,
                    offer_price as offerPrice, offer_label as offerLabel, offer_end as offerEnd,
                    IF(available_for_delivery, 1, 0) as availableForDelivery,
                    NULL as deliveryType,
                    0 as isNewLaunch, NULL as launchDate
             FROM products
             WHERE tenant_id = ?
             ORDER BY name ASC`,
            [tenantId]
          ) as any;
          rows = r;
        }
      }

      // Ensure boolean fields are proper booleans (mysql2 may return Buffer for TINYINT/BIT)
      const data = (rows as any[]).map((r: any) => ({
        ...r,
        publishedInStore: Number(r.publishedInStore) === 1,
        isOnOffer: Number(r.isOnOffer) === 1,
        availableForDelivery: Number(r.availableForDelivery) === 1,
        isNewLaunch: Number(r.isNewLaunch) === 1,
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error('My published error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener productos' });
    }
  }
);

// =============================================
// OFFERS: Endpoints para gestionar ofertas
// =============================================

// PUT /api/storefront/offer/:productId — Toggle oferta de un producto
router.put(
  '/offer/:productId',
  authenticate,
  requirePlan('empresarial'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { productId } = req.params;
      const { isOnOffer, offerPrice, offerLabel, offerEnd } = req.body;

      if (typeof isOnOffer !== 'boolean') {
        res.status(400).json({ success: false, error: 'El campo "isOnOffer" debe ser verdadero o falso' });
        return;
      }

      if (isOnOffer && (!offerPrice || offerPrice <= 0)) {
        res.status(400).json({ success: false, error: 'El precio de oferta debe ser mayor a 0' });
        return;
      }

      const [result] = await pool.query(
        `UPDATE products SET
          is_on_offer = ?,
          offer_price = ?,
          offer_label = ?,
          offer_start = ${isOnOffer ? 'NOW()' : 'NULL'},
          offer_end = ?
        WHERE id = ? AND tenant_id = ?`,
        [
          isOnOffer ? 1 : 0,
          isOnOffer ? offerPrice : null,
          isOnOffer ? (offerLabel || null) : null,
          isOnOffer && offerEnd ? offerEnd : null,
          productId,
          tenantId,
        ]
      ) as any;

      if (result.affectedRows === 0) {
        res.status(404).json({ success: false, error: 'Producto no encontrado' });
        return;
      }

      res.json({ success: true, data: { id: productId, isOnOffer, offerPrice: isOnOffer ? offerPrice : null } });
    } catch (error) {
      console.error('Toggle offer error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar oferta' });
    }
  }
);

// GET /api/storefront/offers — Public: productos en oferta
router.get('/offers', async (req: Request, res: Response) => {
  try {
    const store = req.query.store as string | undefined;
    let tenantFilter = '';
    const params: any[] = [];

    if (store && store !== 'all') {
      const [tenants] = await pool.query(
        'SELECT id FROM tenants WHERE status = ? AND slug = ? LIMIT 1',
        ['activo', store]
      ) as any;
      if (tenants && tenants.length > 0) {
        tenantFilter = 'AND p.tenant_id = ?';
        params.push(tenants[0].id);
      }
    }

    const [rows] = await pool.query(
      `SELECT
        p.id, p.name, p.category, p.brand, p.description,
        p.sale_price as salePrice, p.offer_price as offerPrice,
        p.image_url as imageUrl, p.image_urls as images,
        p.stock, p.color, p.size, p.gender,
        p.offer_label as offerLabel, p.offer_end as offerEnd,
        p.product_type as productType,
        p.material, p.net_weight as netWeight, p.weight_unit as weightUnit,
        p.warranty_months as warrantyMonths, p.dimensions,
        p.tenant_id as tenantId, t.name as storeName, t.slug as storeSlug
      FROM products p
      LEFT JOIN tenants t ON t.id = p.tenant_id
      WHERE p.is_on_offer = 1
        AND p.published_in_store = 1
        AND p.stock > 0
        AND p.tenant_id IN (SELECT id FROM tenants WHERE status = 'activo')
        AND (p.offer_end IS NULL OR p.offer_end > NOW())
        ${tenantFilter}
      ORDER BY p.updated_at DESC
      LIMIT 20`,
      params
    ) as any;

    res.json({ success: true, data: (rows as any[]).map(parseImages) });
  } catch (error) {
    console.error('Get offers error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener ofertas' });
  }
});

// =============================================
// STORE CUSTOMIZATION: Banners, categorías, destacados, info tienda
// =============================================

// GET /api/storefront/store-config/:storeSlug — Public: config completa para landing
router.get('/store-config/:storeSlug', async (req: Request, res: Response) => {
  try {
    const { storeSlug } = req.params;

    const [tenants] = await pool.query(
      'SELECT id, bg_color, public_menu_enabled FROM tenants WHERE status = ? AND slug = ? LIMIT 1',
      ['activo', storeSlug]
    ) as any;

    if (!tenants || tenants.length === 0) {
      res.status(404).json({ success: false, error: 'Tienda no encontrada' });
      return;
    }

    const tenantId = tenants[0].id;
    const tenantBgColor = tenants[0].bg_color || '#000000';
    const publicMenuEnabled = !!tenants[0].public_menu_enabled;

    // Banners (table may not exist if migration not run yet)
    let banners: any[] = [];
    try {
      const [rows] = await pool.query(
        'SELECT id, position, image_url as imageUrl, video_url as videoUrl, title, subtitle, link_url as linkUrl, sort_order as sortOrder FROM store_banners WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order ASC',
        [tenantId]
      ) as any;
      banners = rows;
    } catch { /* table may not exist yet */ }

    // Categories with images (only those that have published products)
    let categories: any[] = [];
    try {
      // Try with image_url column (requires migration)
      const [rows] = await pool.query(
        `SELECT DISTINCT p.category as name, COALESCE(c.name, p.category) as displayName, c.image_url as imageUrl
         FROM products p
         LEFT JOIN categories c ON c.tenant_id = p.tenant_id AND c.id = p.category
         WHERE p.tenant_id = ? AND p.stock > 0 AND p.published_in_store = 1
           AND COALESCE(c.hidden_in_store, 0) = 0
         ORDER BY p.category`,
        [tenantId]
      ) as any;
      categories = rows;
    } catch {
      // Fallback: categories without image_url column
      try {
        const [rows] = await pool.query(
          `SELECT DISTINCT p.category as name, p.category as displayName, NULL as imageUrl
           FROM products p
           WHERE p.tenant_id = ? AND p.stock > 0 AND p.published_in_store = 1
           ORDER BY p.category`,
          [tenantId]
        ) as any;
        categories = rows;
      } catch { /* ignore */ }
    }

    // Featured products (table may not exist if migration not run yet)
    let featured: any[] = [];
    try {
      const [rows] = await pool.query(
        `SELECT p.id, p.name, p.category, p.brand, p.description,
                p.sale_price as salePrice, p.image_url as imageUrl, p.image_urls as images,
                p.stock, p.color, p.size, p.gender,
                p.is_on_offer as isOnOffer, p.offer_price as offerPrice,
                p.offer_label as offerLabel,
                IF(p.available_for_delivery, 1, 0) as availableForDelivery,
                p.delivery_type as deliveryType,
                p.tenant_id as tenantId, t.name as storeName, t.slug as storeSlug
         FROM store_featured_products sfp
         INNER JOIN products p ON p.id = sfp.product_id
         LEFT JOIN tenants t ON t.id = p.tenant_id
         WHERE sfp.tenant_id = ? AND p.stock > 0 AND p.published_in_store = 1
         ORDER BY sfp.sort_order ASC
         LIMIT 8`,
        [tenantId]
      ) as any;
      featured = rows;
    } catch { /* table may not exist yet */ }

    // Trending products (most recently published, on offer first)
    const [trending] = await pool.query(
      `SELECT p.id, p.name, p.category, p.brand, p.description,
              p.sale_price as salePrice, p.image_url as imageUrl, p.image_urls as images,
              p.stock, p.color, p.size, p.gender,
              p.is_on_offer as isOnOffer, p.offer_price as offerPrice,
              p.offer_label as offerLabel,
              IF(p.available_for_delivery, 1, 0) as availableForDelivery,
              p.delivery_type as deliveryType,
              p.tenant_id as tenantId, t.name as storeName, t.slug as storeSlug
       FROM products p
       LEFT JOIN tenants t ON t.id = p.tenant_id
       WHERE p.tenant_id = ? AND p.stock > 0 AND p.published_in_store = 1
       ORDER BY p.is_on_offer DESC, p.updated_at DESC
       LIMIT 8`,
      [tenantId]
    ) as any;

    // Store info extended
    let storeInfoData: any = null;
    try {
      const [storeInfo] = await pool.query(
        `SELECT si.name, si.address, si.phone, si.email, si.logo_url as logoUrl,
                si.schedule, si.location_map_url as locationMapUrl,
                si.terms_url as termsContent, si.privacy_url as privacyContent,
                si.shipping_terms as shippingTerms,
                si.payment_methods as paymentMethods,
                si.social_instagram as socialInstagram, si.social_facebook as socialFacebook,
                si.social_tiktok as socialTiktok, si.social_whatsapp as socialWhatsapp,
                si.product_card_style as productCardStyle,
                si.show_info_module as showInfoModule,
                si.info_module_description as infoModuleDescription
         FROM store_info si
         WHERE si.tenant_id = ?`,
        [tenantId]
      ) as any;
      storeInfoData = storeInfo[0] || null;
    } catch {
      // Fallback without extended columns
      try {
        const [storeInfo] = await pool.query(
          `SELECT si.name, si.address, si.phone, si.email, si.logo_url as logoUrl
           FROM store_info si
           WHERE si.tenant_id = ?`,
          [tenantId]
        ) as any;
        storeInfoData = storeInfo[0] || null;
      } catch { /* ignore */ }
    }

    // Contact page fields (separate query — columns may not exist yet)
    if (storeInfoData) {
      try {
        const [contactRows] = await pool.query(
          `SELECT contact_page_enabled as contactPageEnabled,
                  contact_page_title as contactPageTitle,
                  contact_page_description as contactPageDescription,
                  contact_page_image as contactPageImage,
                  contact_page_links as contactPageLinks
           FROM store_info WHERE tenant_id = ?`,
          [tenantId]
        ) as any;
        if (contactRows[0]) Object.assign(storeInfoData, contactRows[0]);
      } catch { /* columns not migrated yet — skip */ }
    }

    // Announcement bar
    let announcementBar: any = null;
    try {
      const [rows] = await pool.query(
        `SELECT text, link_url as linkUrl, bg_color as bgColor, text_color as textColor, is_active as isActive
         FROM store_announcement_bar WHERE tenant_id = ? AND is_active = 1`,
        [tenantId]
      ) as any;
      announcementBar = rows[0] || null;
    } catch { /* table may not exist */ }

    // Active drop
    let activeDrop: any = null;
    try {
      const [drops] = await pool.query(
        `SELECT id, name, description, banner_url as bannerUrl, global_discount as globalDiscount,
                starts_at as startsAt, ends_at as endsAt
         FROM store_drops WHERE tenant_id = ? AND is_active = 1 AND starts_at <= NOW() AND ends_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId]
      ) as any;
      if (drops.length > 0) {
        const drop = drops[0];
        const [dropProducts] = await pool.query(
          `SELECT p.id, p.name, p.category, p.brand, p.description,
                  p.sale_price as salePrice, p.image_url as imageUrl, p.image_urls as images,
                  p.stock, p.color, p.size, p.gender,
                  sdp.custom_discount as customDiscount,
                  ROUND(p.sale_price * (1 - COALESCE(sdp.custom_discount, ?) / 100)) as finalPrice,
                  IF(p.available_for_delivery, 1, 0) as availableForDelivery,
                  p.delivery_type as deliveryType,
                  p.tenant_id as tenantId, t.name as storeName, t.slug as storeSlug
           FROM store_drop_products sdp
           INNER JOIN products p ON p.id = sdp.product_id
           LEFT JOIN tenants t ON t.id = p.tenant_id
           WHERE sdp.drop_id = ? AND p.stock > 0 AND p.published_in_store = 1
           ORDER BY p.name`,
          [drop.globalDiscount, drop.id]
        ) as any;
        activeDrop = { ...drop, products: dropProducts };
      }
    } catch { /* table may not exist */ }

    // New launches
    let newLaunches: any[] = [];
    try {
      const [rows] = await pool.query(
        `SELECT p.id, p.name, p.category, p.brand, p.description,
                p.sale_price as salePrice, p.image_url as imageUrl, p.image_urls as images,
                p.stock, p.color, p.size, p.gender,
                p.is_on_offer as isOnOffer, p.offer_price as offerPrice,
                p.offer_label as offerLabel, p.launch_date as launchDate,
                IF(p.available_for_delivery, 1, 0) as availableForDelivery,
                p.delivery_type as deliveryType,
                p.tenant_id as tenantId, t.name as storeName, t.slug as storeSlug
         FROM products p
         LEFT JOIN tenants t ON t.id = p.tenant_id
         WHERE p.tenant_id = ? AND p.is_new_launch = 1 AND p.stock > 0 AND p.published_in_store = 1
         ORDER BY p.launch_date DESC, p.updated_at DESC
         LIMIT 12`,
        [tenantId]
      ) as any;
      newLaunches = rows;
    } catch { /* column may not exist yet */ }

    // Platform settings (global bg color)
    let platformBgColor = '#000000';
    try {
      const [psRows] = await pool.query(
        "SELECT setting_value FROM platform_settings WHERE setting_key = 'bg_color' LIMIT 1"
      ) as any;
      if (psRows.length > 0) platformBgColor = psRows[0].setting_value;
    } catch { /* table may not exist */ }

    res.json({
      success: true,
      data: {
        banners,
        categories,
        featuredProducts: (featured as any[]).map(parseImages),
        trendingProducts: (trending as any[]).map(parseImages),
        newLaunches: (newLaunches as any[]).map(parseImages),
        storeInfo: storeInfoData,
        announcementBar,
        activeDrop: activeDrop
          ? { ...activeDrop, products: (activeDrop.products || []).map(parseImages) }
          : null,
        bgColor: tenantBgColor,
        platformBgColor,
        publicMenuEnabled,
      },
    });
  } catch (error) {
    console.error('Store config error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener configuración de tienda' });
  }
});

// GET /api/storefront/payment-config/:storeSlug — Public: which payment methods are configured
router.get('/payment-config/:storeSlug', async (req: Request, res: Response) => {
  try {
    const { storeSlug } = req.params;

    const [tenants] = await pool.query(
      'SELECT id FROM tenants WHERE status = ? AND slug = ? LIMIT 1',
      ['activo', storeSlug]
    ) as any;

    if (!tenants || tenants.length === 0) {
      res.status(404).json({ success: false, error: 'Tienda no encontrada' });
      return;
    }

    const tenantId = tenants[0].id;

    // Load platform_settings for this tenant
    const [psRows] = await pool.query(
      'SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN (?, ?, ?, ?, ?)',
      ['mp_access_token', 'addi_client_id', 'addi_client_secret', 'sistecredito_api_key', 'contraentrega_enabled']
    ) as any;

    const settings: Record<string, string> = {};
    for (const row of psRows) {
      settings[row.setting_key] = row.setting_value;
    }

    const mercadopago = !!(
      (settings['mp_access_token'] && settings['mp_access_token'].trim()) ||
      process.env.MP_ACCESS_TOKEN
    );
    const addi = !!(
      (settings['addi_client_id'] && settings['addi_client_id'].trim() &&
       settings['addi_client_secret'] && settings['addi_client_secret'].trim()) ||
      (process.env.ADDI_CLIENT_ID && process.env.ADDI_CLIENT_SECRET)
    );
    const sistecredito = !!(
      (settings['sistecredito_api_key'] && settings['sistecredito_api_key'].trim()) ||
      process.env.SISTECREDITO_API_KEY
    );

    // Read per-tenant contraentrega setting from store_info
    let contraentrega = true;
    try {
      const [siRows] = await pool.query(
        'SELECT allow_contraentrega FROM store_info WHERE tenant_id = ? LIMIT 1',
        [tenantId]
      ) as any;
      if (siRows && siRows.length > 0 && siRows[0].allow_contraentrega !== undefined) {
        contraentrega = siRows[0].allow_contraentrega === 1 || siRows[0].allow_contraentrega === true;
      }
    } catch { /* column may not exist yet — default to true */ }

    res.json({
      success: true,
      data: {
        mercadopago,
        addi,
        sistecredito,
        contraentrega,
      },
    });
  } catch (error) {
    console.error('Payment config error:', error);
    // On error, return safe defaults (only contraentrega)
    res.json({ success: true, data: { mercadopago: false, addi: false, sistecredito: false, contraentrega: true } });
  }
});

// GET /api/storefront/customization — Authenticated: config para admin
router.get('/customization', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const [banners] = await pool.query(
      'SELECT id, position, image_url as imageUrl, video_url as videoUrl, title, subtitle, link_url as linkUrl, is_active as isActive, sort_order as sortOrder FROM store_banners WHERE tenant_id = ? ORDER BY position, sort_order',
      [tenantId]
    ) as any;

    let categories: any[] = [];
    try {
      const [catRows] = await pool.query(
        'SELECT id, name, image_url as imageUrl, hidden_in_store as hiddenInStore FROM categories WHERE tenant_id = ? ORDER BY name',
        [tenantId]
      ) as any;
      categories = catRows;
    } catch {
      const [catRows] = await pool.query(
        'SELECT id, name, image_url as imageUrl, 0 as hiddenInStore FROM categories WHERE tenant_id = ? ORDER BY name',
        [tenantId]
      ) as any;
      categories = catRows;
    }

    const [featured] = await pool.query(
      `SELECT sfp.id, sfp.product_id as productId, sfp.sort_order as sortOrder,
              p.name, p.image_url as imageUrl, p.sale_price as salePrice
       FROM store_featured_products sfp
       INNER JOIN products p ON p.id = sfp.product_id
       WHERE sfp.tenant_id = ?
       ORDER BY sfp.sort_order`,
      [tenantId]
    ) as any;

    let storeInfoRow: any = null;
    try {
      const [siRows] = await pool.query(
        `SELECT si.name, si.address, si.phone, si.email, si.logo_url as logoUrl,
                si.schedule, si.location_map_url as locationMapUrl,
                si.terms_url as termsContent, si.privacy_url as privacyContent,
                si.shipping_terms as shippingTerms,
                si.payment_methods as paymentMethods,
                si.social_instagram as socialInstagram, si.social_facebook as socialFacebook,
                si.social_tiktok as socialTiktok, si.social_whatsapp as socialWhatsapp,
                si.department, si.municipality,
                si.product_card_style as productCardStyle,
                si.allow_contraentrega as allowContraentrega,
                si.show_info_module as showInfoModule,
                si.info_module_description as infoModuleDescription
         FROM store_info si
         WHERE si.tenant_id = ?`,
        [tenantId]
      ) as any;
      storeInfoRow = (siRows as any[])[0] || null;
    } catch {
      try {
        const [siRows] = await pool.query(
          `SELECT si.name, si.address, si.phone, si.email, si.logo_url as logoUrl,
                  si.schedule, si.location_map_url as locationMapUrl,
                  si.terms_url as termsContent, si.privacy_url as privacyContent,
                  si.shipping_terms as shippingTerms,
                  si.payment_methods as paymentMethods,
                  si.social_instagram as socialInstagram, si.social_facebook as socialFacebook,
                  si.social_tiktok as socialTiktok, si.social_whatsapp as socialWhatsapp
           FROM store_info si
           WHERE si.tenant_id = ?`,
          [tenantId]
        ) as any;
        storeInfoRow = (siRows as any[])[0] || null;
      } catch { /* ignore */ }
    }

    // Contact page fields (separate — columns may not exist yet)
    if (storeInfoRow) {
      try {
        const [contactRows] = await pool.query(
          `SELECT contact_page_enabled as contactPageEnabled,
                  contact_page_title as contactPageTitle,
                  contact_page_description as contactPageDescription,
                  contact_page_image as contactPageImage,
                  contact_page_products as contactPageProducts,
                  contact_page_links as contactPageLinks
           FROM store_info WHERE tenant_id = ?`,
          [tenantId]
        ) as any;
        if (contactRows[0]) Object.assign(storeInfoRow, contactRows[0]);
      } catch { /* columns not migrated yet */ }
    }

    // Published products for featured selection (stock filter removed so admins can feature any published product)
    const [publishedProducts] = await pool.query(
      `SELECT id, name, image_url as imageUrl, sale_price as salePrice, category
       FROM products WHERE tenant_id = ? AND published_in_store = 1
       ORDER BY name ASC`,
      [tenantId]
    ) as any;

    // Announcement bar
    let announcementBar: any = null;
    try {
      const [abRows] = await pool.query(
        `SELECT text, link_url as linkUrl, bg_color as bgColor, text_color as textColor, is_active as isActive
         FROM store_announcement_bar WHERE tenant_id = ?`,
        [tenantId]
      ) as any;
      announcementBar = abRows[0] || null;
    } catch { /* table may not exist */ }

    // Drops
    let drops: any[] = [];
    try {
      const [dropRows] = await pool.query(
        `SELECT d.id, d.name, d.description, d.banner_url as bannerUrl, d.global_discount as globalDiscount,
                d.starts_at as startsAt, d.ends_at as endsAt, d.is_active as isActive,
                (SELECT COUNT(*) FROM store_drop_products WHERE drop_id = d.id) as productCount
         FROM store_drops d WHERE d.tenant_id = ? ORDER BY d.created_at DESC`,
        [tenantId]
      ) as any;
      drops = dropRows;
    } catch { /* table may not exist */ }

    // Drop products for each drop
    for (const drop of drops) {
      try {
        const [dpRows] = await pool.query(
          `SELECT sdp.product_id as productId, sdp.custom_discount as customDiscount,
                  p.name, p.image_url as imageUrl, p.sale_price as salePrice
           FROM store_drop_products sdp
           INNER JOIN products p ON p.id = sdp.product_id
           WHERE sdp.drop_id = ?`,
          [drop.id]
        ) as any;
        drop.products = dpRows;
      } catch { drop.products = []; }
    }

    res.json({
      success: true,
      data: {
        banners,
        categories,
        featuredProducts: featured,
        storeInfo: storeInfoRow,
        publishedProducts,
        announcementBar,
        drops,
      },
    });
  } catch (error) {
    console.error('Get customization error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener personalización' });
  }
});

// PUT /api/storefront/banners — Create/update banner
router.put('/banners', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    // Superadmin can pass tenantId in body; regular users use their own
    const tenantId = user.role === 'superadmin' ? (req.body.tenantId || user.tenantId) : user.tenantId;
    const { id, position, imageUrl, videoUrl, title, subtitle, linkUrl } = req.body;

    if (!tenantId) {
      res.status(400).json({ success: false, error: 'No se pudo determinar el comercio. Si eres superadmin, envía tenantId en el body.' });
      return;
    }

    if (!position || !imageUrl) {
      res.status(400).json({ success: false, error: 'Posición e imagen son requeridas' });
      return;
    }

    if (!['hero1', 'hero4'].includes(position)) {
      res.status(400).json({ success: false, error: 'Posición inválida (hero1 o hero4)' });
      return;
    }

    if (id) {
      // Update existing
      const [result] = await pool.query(
        `UPDATE store_banners SET image_url = ?, video_url = ?, title = ?, subtitle = ?, link_url = ?
         WHERE id = ? AND tenant_id = ?`,
        [imageUrl, videoUrl || null, title || null, subtitle || null, linkUrl || null, id, tenantId]
      ) as any;

      if (result.affectedRows === 0) {
        res.status(404).json({ success: false, error: 'Banner no encontrado' });
        return;
      }
      res.json({ success: true, data: { id, updated: true } });
    } else {
      // Create new
      const [result] = await pool.query(
        `INSERT INTO store_banners (tenant_id, position, image_url, video_url, title, subtitle, link_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, position, imageUrl, videoUrl || null, title || null, subtitle || null, linkUrl || null]
      ) as any;

      res.json({ success: true, data: { id: result.insertId, created: true } });
    }
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar banner' });
  }
});

// DELETE /api/storefront/banners/:id — Delete banner
router.delete('/banners/:id', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user.role === 'superadmin' ? (req.body.tenantId || user.tenantId) : user.tenantId;
    const { id } = req.params;

    const [result] = await pool.query(
      'DELETE FROM store_banners WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    ) as any;

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: 'Banner no encontrado' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar banner' });
  }
});

// PUT /api/storefront/categories/:id/image — Update category image
router.put('/categories/:id/image', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id } = req.params;
    const { imageUrl } = req.body;

    const [result] = await pool.query(
      'UPDATE categories SET image_url = ? WHERE id = ? AND tenant_id = ?',
      [imageUrl || null, id, tenantId]
    ) as any;

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: 'Categoría no encontrada' });
      return;
    }

    res.json({ success: true, data: { id, imageUrl } });
  } catch (error) {
    console.error('Update category image error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar imagen de categoría' });
  }
});

// PUT /api/storefront/categories/:id/visibility — Toggle hidden_in_store
router.put('/categories/:id/visibility', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id } = req.params;
    const { hidden } = req.body;

    await pool.query(
      'UPDATE categories SET hidden_in_store = ? WHERE id = ? AND tenant_id = ?',
      [hidden ? 1 : 0, id, tenantId]
    );

    res.json({ success: true, data: { id, hiddenInStore: !!hidden } });
  } catch (error) {
    console.error('Toggle category visibility error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar visibilidad de categoría' });
  }
});

// POST /api/storefront/featured-products — Add featured product
router.post('/featured-products', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { productId } = req.body;

    if (!productId) {
      res.status(400).json({ success: false, error: 'ID de producto requerido' });
      return;
    }

    // Check max 8 featured
    const [count] = await pool.query(
      'SELECT COUNT(*) as total FROM store_featured_products WHERE tenant_id = ?',
      [tenantId]
    ) as any;

    if (count[0].total >= 8) {
      res.status(400).json({ success: false, error: 'Máximo 8 productos destacados permitidos' });
      return;
    }

    const [maxOrder] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as nextOrder FROM store_featured_products WHERE tenant_id = ?',
      [tenantId]
    ) as any;

    await pool.query(
      'INSERT INTO store_featured_products (tenant_id, product_id, sort_order) VALUES (?, ?, ?)',
      [tenantId, productId, maxOrder[0].nextOrder]
    );

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, error: 'Este producto ya está destacado' });
      return;
    }
    console.error('Add featured product error:', error);
    res.status(500).json({ success: false, error: 'Error al agregar producto destacado' });
  }
});

// DELETE /api/storefront/featured-products/:productId — Remove featured product
router.delete('/featured-products/:productId', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { productId } = req.params;

    const [result] = await pool.query(
      'DELETE FROM store_featured_products WHERE tenant_id = ? AND product_id = ?',
      [tenantId, productId]
    ) as any;

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: 'Producto destacado no encontrado' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Remove featured product error:', error);
    res.status(500).json({ success: false, error: 'Error al quitar producto destacado' });
  }
});

// PUT /api/storefront/store-extended-info — Update extended store info
router.put('/store-extended-info', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const {
      logoUrl, schedule, locationMapUrl, termsContent, privacyContent, shippingTerms, paymentMethods,
      socialInstagram, socialFacebook, socialTiktok, socialWhatsapp,
      department, municipality, productCardStyle, allowContraentrega,
      showInfoModule, infoModuleDescription,
    } = req.body;

    const allowCod = allowContraentrega === false ? 0 : 1;
    const infoModule = showInfoModule ? 1 : 0;

    let result: any;
    try {
      [result] = await pool.query(
        `UPDATE store_info SET
          logo_url = ?, schedule = ?, location_map_url = ?, terms_url = ?, privacy_url = ?, shipping_terms = ?,
          payment_methods = ?, social_instagram = ?, social_facebook = ?,
          social_tiktok = ?, social_whatsapp = ?,
          department = ?, municipality = ?, product_card_style = ?, allow_contraentrega = ?,
          show_info_module = ?, info_module_description = ?
         WHERE tenant_id = ?`,
        [
          logoUrl || null, schedule || null, locationMapUrl || null, termsContent || null, privacyContent || null, shippingTerms || null,
          paymentMethods || null, socialInstagram || null, socialFacebook || null,
          socialTiktok || null, socialWhatsapp || null,
          department || null, municipality || null, productCardStyle || 'style1', allowCod,
          infoModule, infoModuleDescription || null,
          tenantId,
        ]
      ) as any;
    } catch {
      // Fallback: some columns may not exist
      try {
        [result] = await pool.query(
          `UPDATE store_info SET
            logo_url = ?, schedule = ?, location_map_url = ?, terms_url = ?, privacy_url = ?, shipping_terms = ?,
            payment_methods = ?, social_instagram = ?, social_facebook = ?,
            social_tiktok = ?, social_whatsapp = ?,
            department = ?, municipality = ?
           WHERE tenant_id = ?`,
          [
            logoUrl || null, schedule || null, locationMapUrl || null, termsContent || null, privacyContent || null, shippingTerms || null,
            paymentMethods || null, socialInstagram || null, socialFacebook || null,
            socialTiktok || null, socialWhatsapp || null,
            department || null, municipality || null, tenantId,
          ]
        ) as any;
      } catch {
        [result] = await pool.query(
          `UPDATE store_info SET
            logo_url = ?, schedule = ?, location_map_url = ?, terms_url = ?, privacy_url = ?,
            payment_methods = ?, social_instagram = ?, social_facebook = ?,
            social_tiktok = ?, social_whatsapp = ?
           WHERE tenant_id = ?`,
          [
            logoUrl || null, schedule || null, locationMapUrl || null, termsContent || null, privacyContent || null,
            paymentMethods || null, socialInstagram || null, socialFacebook || null,
            socialTiktok || null, socialWhatsapp || null, tenantId,
          ]
        ) as any;
      }
    }

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, error: 'Información de tienda no encontrada' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update store extended info error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar información de tienda' });
  }
});

// =============================================
// PUT /api/storefront/contact-page — Update contact page fields only
// =============================================
router.put('/contact-page', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { contactPageEnabled, contactPageTitle, contactPageDescription, contactPageImage, contactPageProducts, contactPageLinks } = req.body;

    const values = [
      contactPageEnabled ? 1 : 0,
      contactPageTitle || null,
      contactPageDescription || null,
      contactPageImage || null,
      contactPageProducts ? JSON.stringify(contactPageProducts) : null,
      contactPageLinks ? JSON.stringify(contactPageLinks) : null,
      tenantId,
    ];

    try {
      await pool.query(
        `UPDATE store_info SET
          contact_page_enabled = ?,
          contact_page_title = ?,
          contact_page_description = ?,
          contact_page_image = ?,
          contact_page_products = ?,
          contact_page_links = ?
         WHERE tenant_id = ?`,
        values
      );
    } catch {
      // Columns don't exist yet — run migration automatically
      await pool.query(`ALTER TABLE store_info
        ADD COLUMN IF NOT EXISTS contact_page_enabled  TINYINT(1)   NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS contact_page_title     VARCHAR(255)          DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS contact_page_description TEXT                DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS contact_page_image     VARCHAR(500)          DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS contact_page_products  TEXT                  DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS contact_page_links     TEXT                  DEFAULT NULL`);
      await pool.query(
        `UPDATE store_info SET
          contact_page_enabled = ?,
          contact_page_title = ?,
          contact_page_description = ?,
          contact_page_image = ?,
          contact_page_products = ?,
          contact_page_links = ?
         WHERE tenant_id = ?`,
        values
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Contact page update error:', error);
    res.status(500).json({ success: false, error: 'Error al guardar página de contacto' });
  }
});

// =============================================
// ANNOUNCEMENT BAR
// =============================================

// PUT /api/storefront/announcement-bar — Update announcement bar
router.put('/announcement-bar', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { text, linkUrl, bgColor, textColor, isActive } = req.body;

    // Upsert: try update first, then insert
    const [existing] = await pool.query(
      'SELECT id FROM store_announcement_bar WHERE tenant_id = ?', [tenantId]
    ) as any;

    if (existing.length > 0) {
      await pool.query(
        `UPDATE store_announcement_bar SET text = ?, link_url = ?, bg_color = ?, text_color = ?, is_active = ? WHERE tenant_id = ?`,
        [text, linkUrl || null, bgColor || '#f59e0b', textColor || '#000000', isActive ? 1 : 0, tenantId]
      );
    } else {
      await pool.query(
        `INSERT INTO store_announcement_bar (tenant_id, text, link_url, bg_color, text_color, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        [tenantId, text, linkUrl || null, bgColor || '#f59e0b', textColor || '#000000', isActive ? 1 : 0]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update announcement bar error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar barra de anuncio' });
  }
});

// =============================================
// DROPS
// =============================================

// GET /api/storefront/drops — List drops (superadmin: all; merchant: own)
router.get('/drops', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isSuperadmin = user.role === 'superadmin';

    let drops: any[];
    if (isSuperadmin) {
      const [rows] = await pool.query(
        `SELECT id, tenant_id as tenantId, name, description, banner_url as bannerUrl,
                global_discount as globalDiscount, starts_at as startsAt, ends_at as endsAt,
                IF(is_active, 1, 0) as isActive, created_at as createdAt
         FROM store_drops ORDER BY created_at DESC`
      ) as any;
      drops = rows;
    } else {
      const [rows] = await pool.query(
        `SELECT id, tenant_id as tenantId, name, description, banner_url as bannerUrl,
                global_discount as globalDiscount, starts_at as startsAt, ends_at as endsAt,
                IF(is_active, 1, 0) as isActive, created_at as createdAt
         FROM store_drops WHERE tenant_id = ? ORDER BY created_at DESC`,
        [user.tenantId]
      ) as any;
      drops = rows;
    }

    res.json({ success: true, data: drops });
  } catch (error) {
    console.error('Get drops error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener drops' });
  }
});

// POST /api/storefront/drops — Create drop
router.post('/drops', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user.role === 'superadmin' ? null : user.tenantId;
    const { name, description, bannerUrl, globalDiscount, startsAt, endsAt, isActive } = req.body;

    const [result] = await pool.query(
      `INSERT INTO store_drops (tenant_id, name, description, banner_url, global_discount, starts_at, ends_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, name, description || null, bannerUrl || null, globalDiscount || 0, startsAt, endsAt, isActive !== false ? 1 : 0]
    ) as any;

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Create drop error:', error);
    res.status(500).json({ success: false, error: 'Error al crear drop' });
  }
});

// PUT /api/storefront/drops/:id — Update drop
router.put('/drops/:id', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isSuperadmin = user.role === 'superadmin';
    const dropId = req.params.id;
    const { name, description, bannerUrl, globalDiscount, startsAt, endsAt, isActive } = req.body;

    if (isSuperadmin) {
      await pool.query(
        `UPDATE store_drops SET name = ?, description = ?, banner_url = ?, global_discount = ?, starts_at = ?, ends_at = ?, is_active = ?
         WHERE id = ?`,
        [name, description || null, bannerUrl || null, globalDiscount || 0, startsAt, endsAt, isActive ? 1 : 0, dropId]
      );
    } else {
      await pool.query(
        `UPDATE store_drops SET name = ?, description = ?, banner_url = ?, global_discount = ?, starts_at = ?, ends_at = ?, is_active = ?
         WHERE id = ? AND tenant_id = ?`,
        [name, description || null, bannerUrl || null, globalDiscount || 0, startsAt, endsAt, isActive ? 1 : 0, dropId, user.tenantId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update drop error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar drop' });
  }
});

// DELETE /api/storefront/drops/:id — Delete drop
router.delete('/drops/:id', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role === 'superadmin') {
      await pool.query('DELETE FROM store_drops WHERE id = ?', [req.params.id]);
    } else {
      await pool.query('DELETE FROM store_drops WHERE id = ? AND tenant_id = ?', [req.params.id, user.tenantId]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete drop error:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar drop' });
  }
});

// POST /api/storefront/drops/:id/products — Add product to drop
router.post('/drops/:id/products', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const dropId = req.params.id;
    const { productId, customDiscount } = req.body;

    // Verify drop belongs to tenant
    const [drops] = await pool.query('SELECT id FROM store_drops WHERE id = ? AND tenant_id = ?', [dropId, tenantId]) as any;
    if (drops.length === 0) { res.status(404).json({ success: false, error: 'Drop no encontrado' }); return; }

    await pool.query(
      `INSERT INTO store_drop_products (drop_id, product_id, custom_discount) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE custom_discount = VALUES(custom_discount)`,
      [dropId, productId, customDiscount != null ? customDiscount : null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Add drop product error:', error);
    res.status(500).json({ success: false, error: 'Error al agregar producto al drop' });
  }
});

// DELETE /api/storefront/drops/:id/products/:productId — Remove product from drop
router.delete('/drops/:id/products/:productId', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id: dropId, productId } = req.params;

    const [drops] = await pool.query('SELECT id FROM store_drops WHERE id = ? AND tenant_id = ?', [dropId, tenantId]) as any;
    if (drops.length === 0) { res.status(404).json({ success: false, error: 'Drop no encontrado' }); return; }

    await pool.query('DELETE FROM store_drop_products WHERE drop_id = ? AND product_id = ?', [dropId, productId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove drop product error:', error);
    res.status(500).json({ success: false, error: 'Error al quitar producto del drop' });
  }
});

// GET /api/storefront/drop/:dropId — Public: get drop with products
router.get('/drop/:dropId', async (req: Request, res: Response) => {
  try {
    const dropId = req.params.dropId;

    const [drops] = await pool.query(
      `SELECT id, tenant_id as tenantId, name, description, banner_url as bannerUrl,
              global_discount as globalDiscount, starts_at as startsAt, ends_at as endsAt
       FROM store_drops WHERE id = ? AND is_active = 1 AND ends_at > NOW()`,
      [dropId]
    ) as any;

    if (drops.length === 0) { res.status(404).json({ success: false, error: 'Drop no encontrado o expirado' }); return; }

    const drop = drops[0];

    const [products] = await pool.query(
      `SELECT p.id, p.name, p.category, p.brand, p.description,
              p.sale_price as salePrice, p.image_url as imageUrl, p.stock,
              p.color, p.size, p.gender,
              sdp.custom_discount as customDiscount,
              ROUND(p.sale_price * (1 - COALESCE(sdp.custom_discount, ?) / 100)) as finalPrice
       FROM store_drop_products sdp
       INNER JOIN products p ON p.id = sdp.product_id
       WHERE sdp.drop_id = ? AND p.stock > 0 AND p.published_in_store = 1
       ORDER BY p.name`,
      [drop.globalDiscount, dropId]
    ) as any;

    res.json({ success: true, data: { ...drop, products } });
  } catch (error) {
    console.error('Get drop error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener drop' });
  }
});

// =============================================
// ORDER BUMP / CROSS-SELL: Configuración y productos sugeridos
// =============================================

// GET /api/storefront/order-bump-config — Authenticated: get merchant config
router.get('/order-bump-config', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;

    let config: any = null;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS store_order_bump (
          id INT PRIMARY KEY AUTO_INCREMENT,
          tenant_id VARCHAR(36) NOT NULL,
          is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          mode ENUM('auto','manual') NOT NULL DEFAULT 'auto',
          title VARCHAR(255) NOT NULL DEFAULT '¿También te puede interesar?',
          max_items INT NOT NULL DEFAULT 3,
          product_ids JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE INDEX idx_order_bump_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const [rows] = await pool.query(
        `SELECT is_enabled as isEnabled, mode, title, max_items as maxItems, product_ids as productIds
         FROM store_order_bump WHERE tenant_id = ?`,
        [tenantId]
      ) as any;
      if (rows.length > 0) {
        config = {
          ...rows[0],
          isEnabled: Number(rows[0].isEnabled) === 1,
          productIds: (() => { try { const v = rows[0].productIds; if (!v) return []; return Array.isArray(v) ? v : JSON.parse(v); } catch { return []; } })(),
        };
      }
    } catch (e) { console.error('Order bump config fetch error:', e); }

    if (!config) {
      config = { isEnabled: false, mode: 'auto', title: '¿También te puede interesar?', maxItems: 3, productIds: [] };
    }

    // Also return published products for manual selection
    const [publishedProducts] = await pool.query(
      `SELECT id, name, category, brand, image_url as imageUrl, sale_price as salePrice, stock
       FROM products WHERE tenant_id = ? AND published_in_store = 1 AND stock > 0
       ORDER BY name ASC`,
      [tenantId]
    ) as any;

    res.json({ success: true, data: { config, publishedProducts } });
  } catch (error) {
    console.error('Get order bump config error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener configuración de order bump' });
  }
});

// PUT /api/storefront/order-bump-config — Authenticated: save config
router.put('/order-bump-config', authenticate, requirePlan('empresarial'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { isEnabled, mode, title, maxItems, productIds } = req.body;

    // Ensure table exists (in case migration hasn't been applied yet)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_order_bump (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id VARCHAR(36) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        mode ENUM('auto','manual') NOT NULL DEFAULT 'auto',
        title VARCHAR(255) NOT NULL DEFAULT '¿También te puede interesar?',
        max_items INT NOT NULL DEFAULT 3,
        product_ids JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_order_bump_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [existing] = await pool.query(
      'SELECT id FROM store_order_bump WHERE tenant_id = ?', [tenantId]
    ) as any;

    const productIdsJson = Array.isArray(productIds) ? JSON.stringify(productIds) : '[]';
    const safeMode = mode === 'manual' ? 'manual' : 'auto';
    const safeMax = Math.min(Math.max(1, parseInt(maxItems) || 3), 6);
    const safeTitle = (title || '¿También te puede interesar?').slice(0, 255);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE store_order_bump SET is_enabled = ?, mode = ?, title = ?, max_items = ?, product_ids = ?, updated_at = NOW() WHERE tenant_id = ?`,
        [isEnabled ? 1 : 0, safeMode, safeTitle, safeMax, productIdsJson, tenantId]
      );
    } else {
      await pool.query(
        `INSERT INTO store_order_bump (tenant_id, is_enabled, mode, title, max_items, product_ids) VALUES (?, ?, ?, ?, ?, ?)`,
        [tenantId, isEnabled ? 1 : 0, safeMode, safeTitle, safeMax, productIdsJson]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update order bump config error:', error);
    res.status(500).json({ success: false, error: 'Error al guardar configuración de order bump' });
  }
});

// GET /api/storefront/order-bump — Public: get bump products for a store
// Query params: store (slug), categories (comma-separated), exclude (comma-separated product IDs)
router.get('/order-bump', async (req: Request, res: Response) => {
  try {
    const store = req.query.store as string | undefined;
    const categoriesParam = req.query.categories as string | undefined;
    const excludeParam = req.query.exclude as string | undefined;

    if (!store || store === 'all') {
      res.json({ success: true, data: { isEnabled: false, products: [], title: '' } });
      return;
    }

    // Get tenant
    const [tenants] = await pool.query(
      'SELECT id FROM tenants WHERE status = ? AND slug = ? LIMIT 1',
      ['activo', store]
    ) as any;

    if (!tenants || tenants.length === 0) {
      res.json({ success: true, data: { isEnabled: false, products: [], title: '' } });
      return;
    }

    const tenantId = tenants[0].id;

    // Get config
    let config: any = null;
    try {
      const [rows] = await pool.query(
        'SELECT is_enabled, mode, title, max_items, product_ids FROM store_order_bump WHERE tenant_id = ?',
        [tenantId]
      ) as any;
      if (rows.length > 0) config = rows[0];
    } catch { /* table may not exist */ }

    if (!config || !config.is_enabled) {
      res.json({ success: true, data: { isEnabled: false, products: [], title: '' } });
      return;
    }

    const maxItems = config.max_items || 3;
    const excludeIds: string[] = excludeParam ? excludeParam.split(',').filter(Boolean) : [];
    let products: any[] = [];

    if (config.mode === 'manual' && config.product_ids) {
      const parsedIds = (() => { try { const v = config.product_ids; if (!v) return []; return Array.isArray(v) ? v : JSON.parse(v); } catch { return []; } })();
      const manualIds: string[] = parsedIds.filter((id: string) => !excludeIds.includes(id));
      if (manualIds.length > 0) {
        const placeholders = manualIds.map(() => '?').join(',');
        const [rows] = await pool.query(
          `SELECT p.id, p.name, p.category, p.brand, p.description,
                  p.sale_price as salePrice, p.image_url as imageUrl, p.stock,
                  p.is_on_offer as isOnOffer, p.offer_price as offerPrice, p.offer_label as offerLabel
           FROM products p
           WHERE p.id IN (${placeholders}) AND p.tenant_id = ? AND p.published_in_store = 1 AND p.stock > 0
           LIMIT ?`,
          [...manualIds.slice(0, maxItems), tenantId, maxItems]
        ) as any;
        products = rows;
      }
    } else {
      // Auto mode: same category as cart items
      const categories: string[] = categoriesParam ? categoriesParam.split(',').filter(Boolean) : [];
      let whereClause = 'p.tenant_id = ? AND p.published_in_store = 1 AND p.stock > 0';
      const params: any[] = [tenantId];

      if (categories.length > 0) {
        const catPlaceholders = categories.map(() => '?').join(',');
        whereClause += ` AND p.category IN (${catPlaceholders})`;
        params.push(...categories);
      }

      if (excludeIds.length > 0) {
        const excPlaceholders = excludeIds.map(() => '?').join(',');
        whereClause += ` AND p.id NOT IN (${excPlaceholders})`;
        params.push(...excludeIds);
      }

      params.push(maxItems);

      const [rows] = await pool.query(
        `SELECT p.id, p.name, p.category, p.brand, p.description,
                p.sale_price as salePrice, p.image_url as imageUrl, p.stock,
                p.is_on_offer as isOnOffer, p.offer_price as offerPrice, p.offer_label as offerLabel
         FROM products p
         WHERE ${whereClause}
         ORDER BY p.is_on_offer DESC, p.updated_at DESC
         LIMIT ?`,
        params
      ) as any;
      products = rows;

      // If no products from same category, fallback to any published products
      if (products.length === 0 && categories.length > 0) {
        let fallbackWhere = 'p.tenant_id = ? AND p.published_in_store = 1 AND p.stock > 0';
        const fallbackParams: any[] = [tenantId];
        if (excludeIds.length > 0) {
          const excP = excludeIds.map(() => '?').join(',');
          fallbackWhere += ` AND p.id NOT IN (${excP})`;
          fallbackParams.push(...excludeIds);
        }
        fallbackParams.push(maxItems);
        const [fallback] = await pool.query(
          `SELECT p.id, p.name, p.category, p.brand, p.description,
                  p.sale_price as salePrice, p.image_url as imageUrl, p.stock,
                  p.is_on_offer as isOnOffer, p.offer_price as offerPrice, p.offer_label as offerLabel
           FROM products p WHERE ${fallbackWhere}
           ORDER BY p.is_on_offer DESC, p.updated_at DESC LIMIT ?`,
          fallbackParams
        ) as any;
        products = fallback;
      }
    }

    res.json({
      success: true,
      data: { isEnabled: true, title: config.title, products },
    });
  } catch (error) {
    console.error('Get order bump error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener order bump' });
  }
});

// =============================================
// NEW LAUNCHES: Endpoints para gestionar nuevos lanzamientos
// =============================================

// PUT /api/storefront/new-launch/:productId — Marcar/desmarcar producto como nuevo lanzamiento
router.put(
  '/new-launch/:productId',
  authenticate,
  requirePlan('empresarial'),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { productId } = req.params;
      const { isNewLaunch, launchDate } = req.body;

      if (typeof isNewLaunch !== 'boolean') {
        res.status(400).json({ success: false, error: 'El campo "isNewLaunch" debe ser verdadero o falso' });
        return;
      }

      const [result] = await pool.query(
        'UPDATE products SET is_new_launch = ?, launch_date = ? WHERE id = ? AND tenant_id = ?',
        [isNewLaunch ? 1 : 0, isNewLaunch ? (launchDate || new Date().toISOString().split('T')[0]) : null, productId, tenantId]
      ) as any;

      if (result.affectedRows === 0) {
        res.status(404).json({ success: false, error: 'Producto no encontrado' });
        return;
      }

      res.json({ success: true, data: { id: productId, isNewLaunch } });
    } catch (error) {
      console.error('Toggle new launch error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar nuevo lanzamiento' });
    }
  }
);

// GET /api/storefront/new-launches — Public: productos marcados como nuevo lanzamiento
router.get('/new-launches', async (req: Request, res: Response) => {
  try {
    const store = req.query.store as string | undefined;
    let tenantFilter = '';
    const params: any[] = [];

    if (store && store !== 'all') {
      const [tenants] = await pool.query(
        'SELECT id FROM tenants WHERE status = ? AND slug = ? LIMIT 1',
        ['activo', store]
      ) as any;
      if (tenants && tenants.length > 0) {
        tenantFilter = 'AND p.tenant_id = ?';
        params.push(tenants[0].id);
      }
    }

    const [rows] = await pool.query(
      `SELECT
        p.id, p.name, p.category, p.brand, p.description,
        p.sale_price as salePrice, p.image_url as imageUrl,
        p.stock, p.color, p.size, p.gender,
        p.is_on_offer as isOnOffer, p.offer_price as offerPrice,
        p.offer_label as offerLabel, p.launch_date as launchDate,
        p.tenant_id as tenantId, t.name as storeName, t.slug as storeSlug
      FROM products p
      LEFT JOIN tenants t ON t.id = p.tenant_id
      WHERE p.is_new_launch = 1
        AND p.published_in_store = 1
        AND p.stock > 0
        AND p.tenant_id IN (SELECT id FROM tenants WHERE status = 'activo')
        ${tenantFilter}
      ORDER BY p.launch_date DESC, p.updated_at DESC
      LIMIT 20`,
      params
    ) as any;

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get new launches error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener nuevos lanzamientos' });
  }
});


// =============================================
// SUPERADMIN: Sales timeline per tenant
// =============================================
router.get('/superadmin/sales-timeline', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin puede acceder' });
      return;
    }
    const days = parseInt(req.query.days as string) || 30;

    // Storefront orders per tenant per day
    const [orderRows] = await pool.query(
      `SELECT t.id as tenantId, t.name as tenantName, t.slug,
        DATE(o.created_at) as saleDate,
        COUNT(*) as orderCount,
        COALESCE(SUM(o.total), 0) as revenue
      FROM storefront_orders o
      JOIN tenants t ON t.id = o.tenant_id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND o.status != 'cancelado'
      GROUP BY t.id, t.name, t.slug, DATE(o.created_at)
      ORDER BY saleDate ASC`,
      [days]
    ) as any;

    // POS sales per tenant per day
    const [posRows] = await pool.query(
      `SELECT t.id as tenantId, t.name as tenantName, t.slug,
        DATE(s.created_at) as saleDate,
        COUNT(*) as orderCount,
        COALESCE(SUM(s.total), 0) as revenue
      FROM sales s
      JOIN tenants t ON t.id = s.tenant_id
      WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND s.status = 'completada'
      GROUP BY t.id, t.name, t.slug, DATE(s.created_at)
      ORDER BY saleDate ASC`,
      [days]
    ) as any;

    // Merge: aggregate by tenantId + date
    const map = new Map<string, { tenantId: string; tenantName: string; slug: string; days: Record<string, { orderCount: number; revenue: number }> }>();
    const process = (rows: any[]) => {
      for (const row of rows) {
        const key = row.tenantId;
        if (!map.has(key)) map.set(key, { tenantId: row.tenantId, tenantName: row.tenantName, slug: row.slug, days: {} });
        const entry = map.get(key)!;
        const dateStr = typeof row.saleDate === 'string' ? row.saleDate : new Date(row.saleDate).toISOString().split('T')[0];
        if (!entry.days[dateStr]) entry.days[dateStr] = { orderCount: 0, revenue: 0 };
        entry.days[dateStr].orderCount += Number(row.orderCount);
        entry.days[dateStr].revenue += Number(row.revenue);
      }
    };
    process(orderRows);
    process(posRows);

    // Build date range for the period
    const dateRange: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateRange.push(d.toISOString().split('T')[0]);
    }

    // Format output
    const tenants = Array.from(map.values()).map(t => ({
      tenantId: t.tenantId,
      tenantName: t.tenantName,
      slug: t.slug,
      totalRevenue: Object.values(t.days).reduce((s, d) => s + d.revenue, 0),
      totalOrders: Object.values(t.days).reduce((s, d) => s + d.orderCount, 0),
      timeline: dateRange.map(date => ({
        date,
        revenue: t.days[date]?.revenue || 0,
        orderCount: t.days[date]?.orderCount || 0,
      })),
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({ success: true, data: { tenants, dateRange } });
  } catch (error) {
    console.error('Sales timeline error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener línea de tiempo de ventas' });
  }
});

// =============================================
// PLATFORM FEATURED PRODUCTS (Superadmin pinned)
// =============================================

// GET /api/storefront/platform-featured — Public
router.get('/platform-featured', async (req: Request, res: Response) => {
  try {
    const [settings] = await pool.query(
      "SELECT setting_value FROM platform_settings WHERE setting_key = 'platform_featured_product_ids' LIMIT 1"
    ) as any;
    if (!settings || settings.length === 0 || !settings[0].setting_value) {
      res.json({ success: true, data: [] });
      return;
    }
    let ids: number[] = [];
    try { ids = JSON.parse(settings[0].setting_value); } catch { ids = []; }
    if (!ids.length) { res.json({ success: true, data: [] }); return; }

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.category, p.brand, p.description,
        p.sale_price as salePrice, p.image_url as imageUrl, p.images,
        p.stock, p.color, p.size, p.gender,
        p.is_on_offer as isOnOffer, p.offer_price as offerPrice,
        p.offer_label as offerLabel, p.product_type as productType,
        p.available_for_delivery as availableForDelivery,
        p.delivery_type as deliveryType,
        p.tenant_id as tenantId, t.name as storeName, t.slug as storeSlug
      FROM products p
      LEFT JOIN tenants t ON t.id = p.tenant_id
      WHERE p.id IN (${placeholders})
        AND p.published_in_store = 1
        AND p.stock > 0
        AND p.tenant_id IN (SELECT id FROM tenants WHERE status = 'activo')`,
      ids
    ) as any;

    // Preserve order from ids array
    const byId = new Map(rows.map((r: any) => [r.id, parseImages(r)]));
    const ordered = ids.map(id => byId.get(id)).filter(Boolean);
    res.json({ success: true, data: ordered });
  } catch (error) {
    console.error('Platform featured error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener productos destacados' });
  }
});

// PUT /api/storefront/platform-featured — Superadmin only
router.put('/platform-featured', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin puede gestionar productos destacados' });
      return;
    }
    const { productIds } = req.body;
    if (!Array.isArray(productIds)) {
      res.status(400).json({ success: false, error: 'productIds debe ser un array' });
      return;
    }
    const value = JSON.stringify(productIds.map(Number).filter(Boolean));
    await pool.query(
      "INSERT INTO platform_settings (setting_key, setting_value) VALUES ('platform_featured_product_ids', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
      [value, value]
    );
    res.json({ success: true, data: { productIds } });
  } catch (error) {
    console.error('Update platform featured error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar productos destacados' });
  }
});

// =============================================
// GET /api/storefront/links/:slug — Public: link-in-bio page data
// =============================================
router.get('/links/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [tenants] = await pool.query(
      'SELECT id FROM tenants WHERE status = ? AND slug = ? LIMIT 1',
      ['activo', slug]
    ) as any;

    if (!tenants || tenants.length === 0) {
      res.status(404).json({ success: false, error: 'Tienda no encontrada' });
      return;
    }

    const tenantId = tenants[0].id;

    // Base store info
    const [siRows] = await pool.query(
      `SELECT si.name, si.email, si.phone,
              si.logo_url as logoUrl,
              si.social_instagram as socialInstagram,
              si.social_facebook as socialFacebook,
              si.social_tiktok as socialTiktok,
              si.social_whatsapp as socialWhatsapp
       FROM store_info si WHERE si.tenant_id = ? LIMIT 1`,
      [tenantId]
    ) as any;

    const storeInfo = (siRows as any[])[0] || null;

    // Contact page fields (may not exist yet)
    let contactData: any = {};
    try {
      const [cRows] = await pool.query(
        `SELECT contact_page_enabled as contactPageEnabled,
                contact_page_title as contactPageTitle,
                contact_page_description as contactPageDescription,
                contact_page_image as contactPageImage,
                contact_page_links as contactPageLinks
         FROM store_info WHERE tenant_id = ? LIMIT 1`,
        [tenantId]
      ) as any;
      contactData = (cRows as any[])[0] || {};
    } catch { /* columns not migrated */ }

    res.json({
      success: true,
      data: {
        slug,
        name: storeInfo?.name || '',
        logoUrl: storeInfo?.logoUrl || null,
        email: storeInfo?.email || null,
        phone: storeInfo?.phone || null,
        socialInstagram: storeInfo?.socialInstagram || null,
        socialFacebook: storeInfo?.socialFacebook || null,
        socialTiktok: storeInfo?.socialTiktok || null,
        socialWhatsapp: storeInfo?.socialWhatsapp || null,
        contactPageTitle: contactData.contactPageTitle || null,
        contactPageDescription: contactData.contactPageDescription || null,
        contactPageImage: contactData.contactPageImage || null,
        contactPageLinks: contactData.contactPageLinks || null,
      },
    });
  } catch (error) {
    console.error('Links page error:', error);
    res.status(500).json({ success: false, error: 'Error al cargar datos' });
  }
});

export const storefrontRoutes = router;
