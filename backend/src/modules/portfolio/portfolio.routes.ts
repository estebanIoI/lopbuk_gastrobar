import { Router, Request, Response } from 'express';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/portfolio/public — Pública: datos del portafolio
// ─────────────────────────────────────────────────────────────
router.get('/public', async (_req: Request, res: Response) => {
  try {
    let config: any = {};
    try {
      const [rows] = await pool.query('SELECT * FROM portfolio_config WHERE id = 1 LIMIT 1') as any;
      config = (rows as any[])[0] || {};
    } catch { /* tabla no migrada aún */ }

    let featuredStores: any[] = [];
    try {
      const ids: string[] = config.featured_tenant_ids
        ? JSON.parse(config.featured_tenant_ids)
        : [];
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const [stores] = await pool.query(
          `SELECT t.id, t.slug, t.plan,
                  si.name as storeName, si.logo_url as logoUrl,
                  si.contact_page_description as description
           FROM tenants t
           LEFT JOIN store_info si ON si.tenant_id = t.id
           WHERE t.id IN (${placeholders}) AND t.status = 'activo'`,
          ids
        ) as any;
        featuredStores = stores || [];
      }
    } catch { /* sin stores */ }

    res.json({
      success: true,
      data: {
        heroTitle: config.hero_title || 'DAIMUZ',
        heroSubtitle: config.hero_subtitle || 'Soluciones de gestión para tu negocio',
        heroImageUrl: config.hero_image_url || null,
        brandDescription: config.brand_description || null,
        showPricing: config.show_pricing !== undefined ? Boolean(config.show_pricing) : true,
        showFeaturedStores: config.show_featured_stores !== undefined ? Boolean(config.show_featured_stores) : true,
        contactEmail: config.contact_email || null,
        contactWhatsapp: config.contact_whatsapp || null,
        contactInstagram: config.contact_instagram || null,
        accentColor: config.accent_color || '#6366f1',
        isPublished: config.is_published !== undefined ? Boolean(config.is_published) : true,
        featuredStores,
      },
    });
  } catch (err) {
    console.error('Portfolio public error:', err);
    res.status(500).json({ success: false, error: 'Error al cargar portafolio' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/portfolio/config — Superadmin: leer configuración
// ─────────────────────────────────────────────────────────────
router.get('/config', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    let config: any = {};
    try {
      const [rows] = await pool.query('SELECT * FROM portfolio_config WHERE id = 1 LIMIT 1') as any;
      config = (rows as any[])[0] || {};
    } catch { /* tabla no migrada */ }

    const [tenants] = await pool.query(
      `SELECT t.id, t.name, t.slug, t.plan,
              si.logo_url as logoUrl
       FROM tenants t
       LEFT JOIN store_info si ON si.tenant_id = t.id
       WHERE t.status = 'activo'
       ORDER BY t.name`
    ) as any;

    res.json({
      success: true,
      data: {
        heroTitle: config.hero_title || 'DAIMUZ',
        heroSubtitle: config.hero_subtitle || '',
        heroImageUrl: config.hero_image_url || '',
        brandDescription: config.brand_description || '',
        showPricing: config.show_pricing !== undefined ? Boolean(config.show_pricing) : true,
        showFeaturedStores: config.show_featured_stores !== undefined ? Boolean(config.show_featured_stores) : true,
        featuredTenantIds: config.featured_tenant_ids ? JSON.parse(config.featured_tenant_ids) : [],
        contactEmail: config.contact_email || '',
        contactWhatsapp: config.contact_whatsapp || '',
        contactInstagram: config.contact_instagram || '',
        accentColor: config.accent_color || '#6366f1',
        isPublished: config.is_published !== undefined ? Boolean(config.is_published) : true,
        tenants: tenants || [],
      },
    });
  } catch (err) {
    console.error('Portfolio config get error:', err);
    res.status(500).json({ success: false, error: 'Error al obtener configuración' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/portfolio/config — Superadmin: guardar configuración
// ─────────────────────────────────────────────────────────────
router.put('/config', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    const {
      heroTitle, heroSubtitle, heroImageUrl, brandDescription,
      showPricing, showFeaturedStores, featuredTenantIds,
      contactEmail, contactWhatsapp, contactInstagram,
      accentColor, isPublished,
    } = req.body;

    const doUpsert = async () => {
      await pool.query(
        `INSERT INTO portfolio_config
           (id, hero_title, hero_subtitle, hero_image_url, brand_description,
            show_pricing, show_featured_stores, featured_tenant_ids,
            contact_email, contact_whatsapp, contact_instagram,
            accent_color, is_published)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           hero_title = VALUES(hero_title),
           hero_subtitle = VALUES(hero_subtitle),
           hero_image_url = VALUES(hero_image_url),
           brand_description = VALUES(brand_description),
           show_pricing = VALUES(show_pricing),
           show_featured_stores = VALUES(show_featured_stores),
           featured_tenant_ids = VALUES(featured_tenant_ids),
           contact_email = VALUES(contact_email),
           contact_whatsapp = VALUES(contact_whatsapp),
           contact_instagram = VALUES(contact_instagram),
           accent_color = VALUES(accent_color),
           is_published = VALUES(is_published)`,
        [
          heroTitle || 'DAIMUZ',
          heroSubtitle || '',
          heroImageUrl || '',
          brandDescription || '',
          showPricing ? 1 : 0,
          showFeaturedStores ? 1 : 0,
          JSON.stringify(Array.isArray(featuredTenantIds) ? featuredTenantIds : []),
          contactEmail || '',
          contactWhatsapp || '',
          contactInstagram || '',
          accentColor || '#6366f1',
          isPublished ? 1 : 0,
        ]
      );
    };

    try {
      await doUpsert();
    } catch (e: any) {
      if (e.code === 'ER_NO_SUCH_TABLE') {
        // Auto-crear tabla si no fue migrada
        await pool.query(`
          CREATE TABLE IF NOT EXISTS portfolio_config (
            id            INT PRIMARY KEY DEFAULT 1,
            hero_title    VARCHAR(255) NOT NULL DEFAULT 'DAIMUZ',
            hero_subtitle TEXT,
            hero_image_url TEXT,
            brand_description TEXT,
            show_pricing  TINYINT(1) NOT NULL DEFAULT 1,
            show_featured_stores TINYINT(1) NOT NULL DEFAULT 1,
            featured_tenant_ids JSON,
            contact_email VARCHAR(255),
            contact_whatsapp VARCHAR(50),
            contact_instagram VARCHAR(255),
            accent_color  VARCHAR(30) NOT NULL DEFAULT '#6366f1',
            is_published  TINYINT(1) NOT NULL DEFAULT 1,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await doUpsert();
      } else {
        throw e;
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Portfolio config save error:', err);
    res.status(500).json({ success: false, error: 'Error al guardar configuración' });
  }
});

export const portfolioRoutes = router;
