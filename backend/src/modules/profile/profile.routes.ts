/**
 * profile.routes.ts — TEMA 3: Perfil Público del Tenant.
 *
 * Página pública tipo "perfil" por negocio: banner, foto, descripción, links,
 * secciones dinámicas ordenables y mini-catálogo de productos públicos.
 *
 * Rutas:
 *   GET  /api/profile/:slug          → perfil público completo (publicado)
 *   GET  /api/profile/:slug/products → productos públicos de la tienda
 *   GET  /api/profile/me             → perfil del propio comercio (auth, editor)
 *   PUT  /api/profile                → actualizar datos fijos (auth)
 *   POST /api/profile/sections       → crear sección (auth)
 *   PUT  /api/profile/sections/order → reordenar (auth)  [antes de :id]
 *   PUT  /api/profile/sections/:id   → editar sección (auth)
 *   DEL  /api/profile/sections/:id   → eliminar sección (auth)
 *
 * Convenciones: { success, data }; tenant_id SIEMPRE desde req.user (JWT).
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { authenticate, AuthRequest } from '../../common/middleware';

const router: ReturnType<typeof Router> = Router();

const SECTION_TYPES = ['image_text', 'video', 'gif', 'description', 'gallery'];

const ok = (res: Response, data: any, code = 200) => res.status(code).json({ success: true, data });
const fail = (res: Response, e: any, msg: string, code = 500) => {
  if (code === 500) console.error(`${msg}:`, e);
  res.status(code).json({ success: false, error: e?.message || msg });
};

const parseContent = (raw: unknown) => {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(String(raw)); } catch { return {}; }
};

const mapProfile = (row: any) => ({
  id: row.id,
  tenantId: row.tenant_id,
  coverUrl: row.cover_url,
  profilePhotoUrl: row.profile_photo_url,
  displayName: row.display_name,
  tagline: row.tagline,
  aboutText: row.about_text,
  instagram: row.instagram,
  whatsapp: row.whatsapp,
  website: row.website,
  accentColor: row.accent_color,
  isPublished: !!row.is_published,
});

const mapSection = (row: any) => ({
  id: row.id,
  sectionType: row.section_type,
  orderIndex: row.order_index,
  content: parseContent(row.content),
  isActive: !!row.is_active,
});

/** Resuelve un tenant activo por slug → { id, name, slug, logoUrl }. */
async function resolveTenant(slug: string): Promise<{ id: string; name: string; slug: string; logoUrl: string | null } | null> {
  const [rows] = (await pool.query(
    `SELECT t.id, t.slug, t.name, si.logo_url AS logoUrl, si.name AS storeName
       FROM tenants t LEFT JOIN store_info si ON si.tenant_id = t.id
      WHERE t.slug = ? AND t.status = 'activo' LIMIT 1`,
    [slug]
  )) as any;
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, slug: r.slug, name: r.storeName || r.name, logoUrl: r.logoUrl || null };
}

/** Carga (o sintetiza) el perfil + secciones de un tenant. */
async function loadProfile(tenant: { id: string; name: string; slug: string; logoUrl: string | null }) {
  const [pRows] = (await pool.query('SELECT * FROM tenant_profile WHERE tenant_id = ? LIMIT 1', [tenant.id])) as any;
  let profile = pRows && pRows[0] ? mapProfile(pRows[0]) : null;

  if (!profile) {
    // Perfil por defecto derivado del tenant (aún no creado/publicado).
    profile = {
      id: null as any, tenantId: tenant.id, coverUrl: null, profilePhotoUrl: tenant.logoUrl,
      displayName: tenant.name, tagline: null, aboutText: null,
      instagram: null, whatsapp: null, website: null, accentColor: null, isPublished: false,
    };
  } else {
    if (!profile.displayName) profile.displayName = tenant.name;
    if (!profile.profilePhotoUrl) profile.profilePhotoUrl = tenant.logoUrl;
  }

  const [sRows] = (await pool.query(
    'SELECT * FROM profile_sections WHERE tenant_id = ? AND is_active = 1 ORDER BY order_index ASC, created_at ASC',
    [tenant.id]
  )) as any;

  return { profile, sections: (sRows || []).map(mapSection), tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } };
}

// ════════════════════════ PÚBLICO ════════════════════════

// GET /api/profile/:slug/products — productos públicos (debe ir antes de /:slug? no, distinto path)
router.get('/:slug/products', async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant) return fail(res, null, 'Negocio no encontrado', 404);

    const limit = Math.min(48, Math.max(1, parseInt(String(req.query.limit || '24'), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));

    const [rows] = (await pool.query(
      `SELECT p.id, p.name, p.category, p.brand, p.description,
              p.sale_price AS salePrice, p.image_url AS imageUrl, p.image_urls AS images,
              p.stock, p.color, p.size,
              p.is_on_offer AS isOnOffer, p.offer_price AS offerPrice, p.offer_label AS offerLabel
         FROM products p
        WHERE p.tenant_id = ? AND p.published_in_store = 1 AND p.stock > 0
        ORDER BY p.is_on_offer DESC, p.updated_at DESC
        LIMIT ? OFFSET ?`,
      [tenant.id, limit, offset]
    )) as any;

    const products = (rows || []).map((p: any) => ({
      ...p,
      images: (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })(),
      isOnOffer: !!p.isOnOffer,
    }));
    ok(res, { products, storeSlug: tenant.slug, storeName: tenant.name });
  } catch (e) { fail(res, e, 'Error al obtener productos'); }
});

// GET /api/profile/:slug — perfil público completo
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant) return fail(res, null, 'Negocio no encontrado', 404);

    const data = await loadProfile(tenant);
    if (!data.profile.isPublished) return fail(res, null, 'Este perfil aún no está publicado', 404);
    ok(res, data);
  } catch (e) { fail(res, e, 'Error al obtener el perfil'); }
});

// ════════════════════════ AUTENTICADO (comercio) ════════════════════════
router.use(authenticate);

// GET /api/profile/me — perfil del propio comercio (para el editor)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const [tRows] = (await pool.query(
      `SELECT t.id, t.slug, t.name, si.logo_url AS logoUrl, si.name AS storeName
         FROM tenants t LEFT JOIN store_info si ON si.tenant_id = t.id WHERE t.id = ? LIMIT 1`,
      [tenantId]
    )) as any;
    if (!tRows || tRows.length === 0) return fail(res, null, 'Comercio no encontrado', 404);
    const t = tRows[0];
    const data = await loadProfile({ id: t.id, slug: t.slug, name: t.storeName || t.name, logoUrl: t.logoUrl || null });
    ok(res, data);
  } catch (e) { fail(res, e, 'Error al obtener el perfil'); }
});

// PUT /api/profile — actualizar datos fijos (upsert)
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const b = req.body || {};
    const [exists] = (await pool.query('SELECT id FROM tenant_profile WHERE tenant_id = ? LIMIT 1', [tenantId])) as any;

    const fields = {
      cover_url: b.coverUrl ?? null,
      profile_photo_url: b.profilePhotoUrl ?? null,
      display_name: b.displayName ?? null,
      tagline: b.tagline ?? null,
      about_text: b.aboutText ?? null,
      instagram: b.instagram ?? null,
      whatsapp: b.whatsapp ?? null,
      website: b.website ?? null,
      accent_color: b.accentColor ?? null,
      is_published: b.isPublished != null ? !!b.isPublished : undefined,
    };

    if (exists && exists.length > 0) {
      const sets: string[] = []; const params: any[] = [];
      for (const [col, val] of Object.entries(fields)) {
        if (val === undefined) continue;
        sets.push(`${col} = ?`); params.push(val);
      }
      if (sets.length) {
        params.push(tenantId);
        await pool.query(`UPDATE tenant_profile SET ${sets.join(', ')} WHERE tenant_id = ?`, params);
      }
    } else {
      await pool.query(
        `INSERT INTO tenant_profile
          (id, tenant_id, cover_url, profile_photo_url, display_name, tagline, about_text, instagram, whatsapp, website, accent_color, is_published)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [uuidv4(), tenantId, fields.cover_url, fields.profile_photo_url, fields.display_name, fields.tagline,
         fields.about_text, fields.instagram, fields.whatsapp, fields.website, fields.accent_color, !!fields.is_published]
      );
    }

    const [rows] = (await pool.query('SELECT * FROM tenant_profile WHERE tenant_id = ? LIMIT 1', [tenantId])) as any;
    ok(res, mapProfile(rows[0]));
  } catch (e) { fail(res, e, 'Error al guardar el perfil'); }
});

// PUT /api/profile/sections/order — reordenar (DEBE ir antes de /sections/:id)
router.put('/sections/order', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const raw = req.body?.order ?? req.body?.items ?? req.body;
    if (!Array.isArray(raw)) return fail(res, null, 'Formato de orden inválido', 400);

    // Acepta ['id1','id2',...] o [{id, orderIndex}, ...]
    const items = raw.map((it: any, i: number) =>
      typeof it === 'string' ? { id: it, orderIndex: i } : { id: it.id, orderIndex: it.orderIndex ?? it.order_index ?? i }
    );
    for (const it of items) {
      await pool.query('UPDATE profile_sections SET order_index = ? WHERE id = ? AND tenant_id = ?', [it.orderIndex, it.id, tenantId]);
    }
    ok(res, { reordered: items.length });
  } catch (e) { fail(res, e, 'Error al reordenar'); }
});

// POST /api/profile/sections — crear sección
router.post('/sections', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { sectionType, content } = req.body || {};
    if (!SECTION_TYPES.includes(sectionType)) return fail(res, null, 'Tipo de sección inválido', 400);

    const [maxRows] = (await pool.query(
      'SELECT COALESCE(MAX(order_index), -1) AS maxOrder FROM profile_sections WHERE tenant_id = ?', [tenantId]
    )) as any;
    const orderIndex = Number(maxRows[0].maxOrder) + 1;

    const id = uuidv4();
    await pool.query(
      'INSERT INTO profile_sections (id, tenant_id, section_type, order_index, content, is_active) VALUES (?,?,?,?,?,1)',
      [id, tenantId, sectionType, orderIndex, JSON.stringify(content ?? {})]
    );
    const [rows] = (await pool.query('SELECT * FROM profile_sections WHERE id = ?', [id])) as any;
    ok(res, mapSection(rows[0]), 201);
  } catch (e) { fail(res, e, 'Error al crear la sección'); }
});

// PUT /api/profile/sections/:id — editar sección
router.put('/sections/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { content, isActive, sectionType } = req.body || {};
    const sets: string[] = []; const params: any[] = [];
    if (content !== undefined) { sets.push('content = ?'); params.push(JSON.stringify(content)); }
    if (isActive !== undefined) { sets.push('is_active = ?'); params.push(!!isActive); }
    if (sectionType !== undefined && SECTION_TYPES.includes(sectionType)) { sets.push('section_type = ?'); params.push(sectionType); }
    if (!sets.length) return fail(res, null, 'Sin cambios', 400);
    params.push(req.params.id, tenantId);

    const [r] = (await pool.query(`UPDATE profile_sections SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params)) as any;
    if (!r.affectedRows) return fail(res, null, 'Sección no encontrada', 404);
    const [rows] = (await pool.query('SELECT * FROM profile_sections WHERE id = ?', [req.params.id])) as any;
    ok(res, mapSection(rows[0]));
  } catch (e) { fail(res, e, 'Error al editar la sección'); }
});

// DELETE /api/profile/sections/:id — eliminar sección
router.delete('/sections/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    await pool.query('DELETE FROM profile_sections WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e, 'Error al eliminar la sección'); }
});

export default router;
