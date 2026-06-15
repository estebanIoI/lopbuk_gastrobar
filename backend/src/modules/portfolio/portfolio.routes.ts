import { Router, Request, Response } from 'express';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';

const router = Router();

// Planes por defecto (se usan si el superadmin aún no los ha personalizado)
const DEFAULT_PLANS = [
  { name: 'Micro', tag: 'Tienda única', price: '$80.000', period: '/mes', specs: ['1 sede', '1–3 usuarios', 'POS + Inventario', 'Tienda online básica'], highlighted: false, isEnterprise: false },
  { name: 'Pyme', tag: 'Negocio en crecimiento', price: '$300.000', period: '/mes', specs: ['2–5 sedes', '4–15 usuarios', 'Tienda + RestBar', 'Reportes avanzados'], highlighted: true, isEnterprise: false },
  { name: 'Mediana', tag: 'Empresa establecida', price: '$4.000.000', period: '/mes', specs: ['6–20 sedes', '16–60 usuarios', 'Multi-sede + Finanzas', 'Soporte prioritario'], highlighted: false, isEnterprise: false },
  { name: 'Enterprise', tag: '+20 sedes', price: 'Desde $5.000.000', period: '/mes', specs: ['Sedes ilimitadas', 'Usuarios ilimitados', 'SLA garantizado', 'Soporte 24/7 dedicado'], highlighted: false, isEnterprise: true },
];

/** Parsea el JSON de planes (string u objeto) a array, o null si vacío/ inválido. */
function parsePlans(raw: unknown): any[] | null {
  if (!raw) return null;
  let arr: any = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { return null; } }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.map((p: any) => ({
    name: String(p.name || ''),
    tag: String(p.tag || ''),
    price: String(p.price || ''),
    period: String(p.period || '/mes'),
    specs: Array.isArray(p.specs) ? p.specs.map((s: any) => String(s)) : [],
    highlighted: !!p.highlighted,
    isEnterprise: !!p.isEnterprise,
  }));
}

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
      const _raw = config.featured_tenant_ids
      const ids: any[] = Array.isArray(_raw) ? _raw : (_raw ? JSON.parse(_raw) : []);
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
        robotSplineUrl: config.robot_spline_url || '',
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
        featuredTenantIds: (() => { const r = config.featured_tenant_ids; return Array.isArray(r) ? r : (r ? JSON.parse(r) : []) })(),
        contactEmail: config.contact_email || '',
        contactWhatsapp: config.contact_whatsapp || '',
        contactInstagram: config.contact_instagram || '',
        accentColor: config.accent_color || '#6366f1',
        isPublished: config.is_published !== undefined ? Boolean(config.is_published) : true,
        robotSplineUrl: config.robot_spline_url || '',
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
      accentColor, isPublished, robotSplineUrl,
    } = req.body;

    // Migración idempotente: columna del robot 3D (URL de Spline).
    try {
      const [rcols] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'portfolio_config' AND COLUMN_NAME = 'robot_spline_url'`
      ) as any;
      if (!rcols.length) await pool.query('ALTER TABLE portfolio_config ADD COLUMN robot_spline_url TEXT NULL');
    } catch { /* tabla aun no existe; se crea en el upsert */ }

    const doUpsert = async () => {
      await pool.query(
        `INSERT INTO portfolio_config
           (id, hero_title, hero_subtitle, hero_image_url, brand_description,
            show_pricing, show_featured_stores, featured_tenant_ids,
            contact_email, contact_whatsapp, contact_instagram,
            accent_color, is_published, robot_spline_url)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
           is_published = VALUES(is_published),
           robot_spline_url = VALUES(robot_spline_url)`,
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
          robotSplineUrl || '',
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
            robot_spline_url TEXT,
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

// ─────────────────────────────────────────────────────────────
// Helper: auto-crear tabla portfolio_team_cards
// ─────────────────────────────────────────────────────────────
async function ensureTeamTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio_team_cards (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(120) NOT NULL,
      role        VARCHAR(120) NOT NULL DEFAULT '',
      bio         TEXT,
      photo_url   TEXT,
      accent_color VARCHAR(30) NOT NULL DEFAULT '#06b6d4',
      sort_order  INT NOT NULL DEFAULT 0,
      is_active   TINYINT(1) NOT NULL DEFAULT 1,
      github_url  VARCHAR(255),
      linkedin_url VARCHAR(255),
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Migración idempotente: imagen de la banda/cordón del carnet 3D (por tarjeta).
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'portfolio_team_cards' AND COLUMN_NAME = 'band_image_url'`
  ) as any;
  if (!cols.length) {
    await pool.query('ALTER TABLE portfolio_team_cards ADD COLUMN band_image_url TEXT NULL AFTER photo_url');
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/portfolio/team — Pública: lista de ingenieros activos
// ─────────────────────────────────────────────────────────────
router.get('/team', async (_req: Request, res: Response) => {
  try {
    await ensureTeamTable();
    const [rows] = await pool.query(
      'SELECT * FROM portfolio_team_cards WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    ) as any;
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Portfolio team get error:', err);
    res.status(500).json({ success: false, error: 'Error al cargar equipo' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/portfolio/team/all — Superadmin: lista completa
// ─────────────────────────────────────────────────────────────
router.get('/team/all', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await ensureTeamTable();
    const [rows] = await pool.query(
      'SELECT * FROM portfolio_team_cards ORDER BY sort_order ASC, id ASC'
    ) as any;
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Portfolio team all error:', err);
    res.status(500).json({ success: false, error: 'Error al cargar equipo' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/portfolio/team — Superadmin: crear tarjeta
// ─────────────────────────────────────────────────────────────
router.post('/team', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await ensureTeamTable();
    const { name, role, bio, photoUrl, bandImageUrl, accentColor, sortOrder, isActive, githubUrl, linkedinUrl } = req.body;
    if (!name) { res.status(400).json({ success: false, error: 'Nombre requerido' }); return; }
    const [result] = await pool.query(
      `INSERT INTO portfolio_team_cards (name, role, bio, photo_url, band_image_url, accent_color, sort_order, is_active, github_url, linkedin_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, role || '', bio || '', photoUrl || '', bandImageUrl || '', accentColor || '#06b6d4', sortOrder ?? 0, isActive !== false ? 1 : 0, githubUrl || '', linkedinUrl || '']
    ) as any;
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Portfolio team create error:', err);
    res.status(500).json({ success: false, error: 'Error al crear tarjeta' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/portfolio/team/:id — Superadmin: editar tarjeta
// ─────────────────────────────────────────────────────────────
router.put('/team/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await ensureTeamTable();
    const { id } = req.params;
    const { name, role, bio, photoUrl, bandImageUrl, accentColor, sortOrder, isActive, githubUrl, linkedinUrl } = req.body;
    await pool.query(
      `UPDATE portfolio_team_cards
       SET name=?, role=?, bio=?, photo_url=?, band_image_url=?, accent_color=?, sort_order=?, is_active=?, github_url=?, linkedin_url=?, updated_at=NOW()
       WHERE id=?`,
      [name, role || '', bio || '', photoUrl || '', bandImageUrl || '', accentColor || '#06b6d4', sortOrder ?? 0, isActive !== false ? 1 : 0, githubUrl || '', linkedinUrl || '', id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Portfolio team update error:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar tarjeta' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/portfolio/team/:id — Superadmin: eliminar tarjeta
// ─────────────────────────────────────────────────────────────
router.delete('/team/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await ensureTeamTable();
    await pool.query('DELETE FROM portfolio_team_cards WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Portfolio team delete error:', err);
    res.status(500).json({ success: false, error: 'Error al eliminar tarjeta' });
  }
});

// ─────────────────────────────────────────────────────────────
// Helpers: auto-crear tablas de features y servicios
// ─────────────────────────────────────────────────────────────
async function ensureFeatureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio_feature_cards (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      icon        VARCHAR(10) NOT NULL DEFAULT '⚡',
      title       VARCHAR(120) NOT NULL,
      description TEXT,
      sort_order  INT NOT NULL DEFAULT 0,
      is_active   TINYINT(1) NOT NULL DEFAULT 1,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureServiceTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio_service_categories (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      icon       VARCHAR(10) NOT NULL DEFAULT '📦',
      label      VARCHAR(120) NOT NULL,
      type       ENUM('package','subscription','addon') NOT NULL DEFAULT 'package',
      sort_order INT NOT NULL DEFAULT 0,
      is_active  TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio_service_options (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT NOT NULL,
      title       VARCHAR(120) NOT NULL,
      description TEXT,
      savings     VARCHAR(50),
      price       DECIMAL(12,0) NOT NULL DEFAULT 0,
      is_popular  TINYINT(1) NOT NULL DEFAULT 0,
      sort_order  INT NOT NULL DEFAULT 0,
      is_active   TINYINT(1) NOT NULL DEFAULT 1,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES portfolio_service_categories(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// ─────────────────────────────────────────────────────────────
// Feature Cards — sección Características
// ─────────────────────────────────────────────────────────────
router.get('/features', async (_req: Request, res: Response) => {
  try {
    await ensureFeatureTable();
    const [rows] = await pool.query(
      'SELECT * FROM portfolio_feature_cards WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    ) as any;
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Portfolio features get error:', err);
    res.status(500).json({ success: false, error: 'Error al cargar características' });
  }
});

router.get('/features/all', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await ensureFeatureTable();
    const [rows] = await pool.query(
      'SELECT * FROM portfolio_feature_cards ORDER BY sort_order ASC, id ASC'
    ) as any;
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error' });
  }
});

router.post('/features', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await ensureFeatureTable();
    const { icon, title, description, sortOrder, isActive } = req.body;
    if (!title) { res.status(400).json({ success: false, error: 'Título requerido' }); return; }
    const [result] = await pool.query(
      'INSERT INTO portfolio_feature_cards (icon, title, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [icon || '⚡', title, description || '', sortOrder ?? 0, isActive !== false ? 1 : 0]
    ) as any;
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al crear' });
  }
});

router.put('/features/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    const { icon, title, description, sortOrder, isActive } = req.body;
    await pool.query(
      'UPDATE portfolio_feature_cards SET icon=?, title=?, description=?, sort_order=?, is_active=?, updated_at=NOW() WHERE id=?',
      [icon || '⚡', title, description || '', sortOrder ?? 0, isActive !== false ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al actualizar' });
  }
});

router.delete('/features/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await pool.query('DELETE FROM portfolio_feature_cards WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al eliminar' });
  }
});

// ─────────────────────────────────────────────────────────────
// Service Catalog — sección Servicios
// ─────────────────────────────────────────────────────────────
router.get('/services', async (_req: Request, res: Response) => {
  try {
    await ensureServiceTables();
    const [cats] = await pool.query(
      'SELECT * FROM portfolio_service_categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    ) as any;
    for (const cat of cats as any[]) {
      const [opts] = await pool.query(
        'SELECT * FROM portfolio_service_options WHERE category_id = ? AND is_active = 1 ORDER BY sort_order ASC, id ASC',
        [cat.id]
      ) as any;
      cat.options = opts;
    }
    res.json({ success: true, data: cats });
  } catch (err) {
    console.error('Portfolio services get error:', err);
    res.status(500).json({ success: false, error: 'Error al cargar servicios' });
  }
});

router.get('/services/all', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await ensureServiceTables();
    const [cats] = await pool.query(
      'SELECT * FROM portfolio_service_categories ORDER BY sort_order ASC, id ASC'
    ) as any;
    for (const cat of cats as any[]) {
      const [opts] = await pool.query(
        'SELECT * FROM portfolio_service_options WHERE category_id = ? ORDER BY sort_order ASC, id ASC',
        [cat.id]
      ) as any;
      cat.options = opts;
    }
    res.json({ success: true, data: cats });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error' });
  }
});

router.post('/services/categories', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await ensureServiceTables();
    const { icon, label, type, sortOrder, isActive } = req.body;
    if (!label) { res.status(400).json({ success: false, error: 'Etiqueta requerida' }); return; }
    const [r] = await pool.query(
      'INSERT INTO portfolio_service_categories (icon, label, type, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [icon || '📦', label, type || 'package', sortOrder ?? 0, isActive !== false ? 1 : 0]
    ) as any;
    res.json({ success: true, id: r.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al crear categoría' });
  }
});

router.put('/services/categories/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    const { icon, label, type, sortOrder, isActive } = req.body;
    await pool.query(
      'UPDATE portfolio_service_categories SET icon=?, label=?, type=?, sort_order=?, is_active=?, updated_at=NOW() WHERE id=?',
      [icon || '📦', label, type || 'package', sortOrder ?? 0, isActive !== false ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al actualizar' });
  }
});

router.delete('/services/categories/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await pool.query('DELETE FROM portfolio_service_categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al eliminar' });
  }
});

router.post('/services/options', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await ensureServiceTables();
    const { categoryId, title, description, savings, price, isPopular, sortOrder, isActive } = req.body;
    if (!categoryId || !title) { res.status(400).json({ success: false, error: 'Categoría y título requeridos' }); return; }
    const [r] = await pool.query(
      'INSERT INTO portfolio_service_options (category_id, title, description, savings, price, is_popular, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [categoryId, title, description || '', savings || '', price || 0, isPopular ? 1 : 0, sortOrder ?? 0, isActive !== false ? 1 : 0]
    ) as any;
    res.json({ success: true, id: r.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al crear opción' });
  }
});

router.put('/services/options/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    const { title, description, savings, price, isPopular, sortOrder, isActive } = req.body;
    await pool.query(
      'UPDATE portfolio_service_options SET title=?, description=?, savings=?, price=?, is_popular=?, sort_order=?, is_active=?, updated_at=NOW() WHERE id=?',
      [title, description || '', savings || '', price || 0, isPopular ? 1 : 0, sortOrder ?? 0, isActive !== false ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al actualizar' });
  }
});

router.delete('/services/options/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'superadmin') { res.status(403).json({ success: false, error: 'Solo superadmin' }); return; }
    await pool.query('DELETE FROM portfolio_service_options WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al eliminar opción' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/portfolio/checkout — Pública: crea Preference MP para servicios
// Recibe items (título, cantidad, precio unitario en COP) y devuelve init_point
// ─────────────────────────────────────────────────────────────
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { items, backUrl } = req.body as {
      items: { title: string; quantity?: number; unit_price: number }[]
      backUrl?: string
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'Se requiere al menos un ítem' })
      return
    }

    // Leer Access Token de MercadoPago desde platform_settings
    const [rows] = await pool.query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'mp_access_token' LIMIT 1`
    ) as any
    const mpToken: string | null = (rows as any[])[0]?.setting_value ?? null

    if (!mpToken) {
      res.status(400).json({
        success: false,
        error: 'MercadoPago no está configurado. Contacta al administrador para activar los pagos en línea.',
      })
      return
    }

    const { MercadoPagoConfig, Preference } = await import('mercadopago')
    const client = new MercadoPagoConfig({ accessToken: mpToken })
    const preferenceApi = new Preference(client)

    const returnUrl = backUrl || (req.headers.origin as string) || 'http://localhost:3000'

    const pref = await preferenceApi.create({
      body: {
        items: items.map((item) => ({
          title: item.title,
          quantity: item.quantity ?? 1,
          unit_price: Math.round(item.unit_price),
          currency_id: 'COP',
        })),
        back_urls: {
          success: returnUrl,
          failure: returnUrl,
          pending: returnUrl,
        },
        auto_return: 'approved',
      } as any,
    })

    res.json({
      success: true,
      data: {
        init_point: pref.init_point,
        sandbox_init_point: (pref as any).sandbox_init_point,
      },
    })
  } catch (err: any) {
    console.error('[Portfolio Checkout]', err)
    res.status(500).json({ success: false, error: err.message || 'Error al crear el pago' })
  }
})

export const portfolioRoutes: ReturnType<typeof Router> = router;
