/**
 * theme4.routes.ts — TEMA 4: Servicios Profesionales (Adaptable).
 *
 * Perfil público de empresa de servicios (transporte / software / general) con
 * secciones activables: hero, stats, servicios, sección especializada
 * (flota+rutas | proyectos+stack), proceso, equipo, testimonios, contacto y
 * barra de comunidad (like/save).
 *
 * Público:  GET /api/theme4/:slug (+ /projects /fleet /routes), POST /:slug/react
 * Comercio: PUT /config, CRUD de cada entidad (auth).
 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { config } from '../../config';
import { JWTPayload } from '../../common/types';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';

const router: ReturnType<typeof Router> = Router();

const ok = (res: Response, data: any, code = 200) => res.status(code).json({ success: true, data });
const fail = (res: Response, e: any, msg: string, code?: number) => {
  const c = code || e?.statusCode || 500;
  if (c === 500) console.error(`${msg}:`, e);
  res.status(c).json({ success: false, error: e?.message || msg });
};
const STAFF = [authenticate, authorize('comerciante', 'administrador_rb', 'vendedor')];

const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token = req.cookies?.authToken ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : undefined);
  if (token) { try { req.user = jwt.verify(token, config.jwt.secret) as JWTPayload; } catch { /* anónimo */ } }
  next();
};

const parseJson = (v: any, fallback: any = []) => {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return fallback; }
};

async function resolveTenant(slug: string): Promise<{ id: string; name: string; slug: string; logoUrl: string | null } | null> {
  const [rows] = (await pool.query(
    `SELECT t.id, t.slug, t.name, si.logo_url AS logoUrl, si.name AS storeName
       FROM tenants t LEFT JOIN store_info si ON si.tenant_id = t.id
      WHERE t.slug = ? AND t.status = 'activo' LIMIT 1`, [slug]
  )) as any;
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, slug: r.slug, name: r.storeName || r.name, logoUrl: r.logoUrl || null };
}

// ── CRUD genérico para las secciones de lista ────────────────────────────────
interface Field { key: string; col: string; json?: boolean }
function makeCrud(table: string, fields: Field[], opts: { order?: boolean; softDelete?: boolean } = {}) {
  const order = opts.order !== false;
  const softDelete = opts.softDelete !== false;
  return {
    list: async (tenantId: string, onlyActive = true) => {
      const [rows] = (await pool.query(
        `SELECT * FROM ${table} WHERE tenant_id = ?${onlyActive ? ' AND is_active = 1' : ''}${order ? ' ORDER BY order_index ASC, id ASC' : ''}`,
        [tenantId]
      )) as any;
      return (rows || []).map((r: any) => mapRow(r, fields));
    },
    create: async (tenantId: string, body: any) => {
      const id = uuidv4();
      const cols = ['id', 'tenant_id', ...fields.map(f => f.col)];
      const vals = [id, tenantId, ...fields.map(f => toVal(body[f.key], f))];
      await pool.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals);
      const [rows] = (await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id])) as any;
      return mapRow(rows[0], fields);
    },
    update: async (tenantId: string, id: string, body: any) => {
      const sets: string[] = []; const params: any[] = [];
      for (const f of fields) {
        if (body[f.key] === undefined) continue;
        sets.push(`${f.col} = ?`); params.push(toVal(body[f.key], f));
      }
      if (body.isActive !== undefined) { sets.push('is_active = ?'); params.push(!!body.isActive); }
      if (!sets.length) return null;
      params.push(id, tenantId);
      await pool.query(`UPDATE ${table} SET ${sets.join(',')} WHERE id = ? AND tenant_id = ?`, params);
      const [rows] = (await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id])) as any;
      return rows[0] ? mapRow(rows[0], fields) : null;
    },
    remove: async (tenantId: string, id: string) => {
      if (softDelete) await pool.query(`UPDATE ${table} SET is_active = 0 WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
      else await pool.query(`DELETE FROM ${table} WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    },
  };
}
function toVal(v: any, f: Field) { return f.json ? JSON.stringify(v ?? []) : (v ?? null); }
function mapRow(r: any, fields: Field[]) {
  const out: any = { id: r.id, isActive: r.is_active == null ? true : !!r.is_active };
  if ('order_index' in r) out.orderIndex = r.order_index;
  for (const f of fields) out[f.key] = f.json ? parseJson(r[f.col]) : r[f.col];
  return out;
}

// Definición de cada entidad (clave camelCase ↔ columna)
const services = makeCrud('theme4_services', [
  { key: 'icon', col: 'icon' }, { key: 'title', col: 'title' }, { key: 'description', col: 'description' },
  { key: 'priceLabel', col: 'price_label' }, { key: 'isFeatured', col: 'is_featured' }, { key: 'orderIndex', col: 'order_index' },
])
const fleet = makeCrud('theme4_fleet', [
  { key: 'name', col: 'name' }, { key: 'vehicleType', col: 'vehicle_type' }, { key: 'capacity', col: 'capacity' },
  { key: 'photoUrl', col: 'photo_url' }, { key: 'features', col: 'features', json: true }, { key: 'orderIndex', col: 'order_index' },
])
const routes = makeCrud('theme4_routes', [
  { key: 'origin', col: 'origin' }, { key: 'destination', col: 'destination' }, { key: 'stops', col: 'stops', json: true },
  { key: 'departureTime', col: 'departure_time' }, { key: 'arrivalTime', col: 'arrival_time' }, { key: 'vehicleId', col: 'vehicle_id' },
  { key: 'price', col: 'price' }, { key: 'bookingUrl', col: 'booking_url' }, { key: 'orderIndex', col: 'order_index' },
])
const projects = makeCrud('theme4_projects', [
  { key: 'title', col: 'title' }, { key: 'description', col: 'description' }, { key: 'category', col: 'category' },
  { key: 'screenshotUrls', col: 'screenshot_urls', json: true }, { key: 'techStack', col: 'tech_stack', json: true },
  { key: 'liveUrl', col: 'live_url' }, { key: 'caseStudyUrl', col: 'case_study_url' }, { key: 'isFeatured', col: 'is_featured' }, { key: 'orderIndex', col: 'order_index' },
])
const stats = makeCrud('theme4_stats', [
  { key: 'icon', col: 'icon' }, { key: 'label', col: 'label' }, { key: 'value', col: 'value' }, { key: 'orderIndex', col: 'order_index' },
])
const steps = makeCrud('theme4_steps', [
  { key: 'stepNumber', col: 'step_number' }, { key: 'title', col: 'title' }, { key: 'description', col: 'description' }, { key: 'icon', col: 'icon' },
], { order: false })
const team = makeCrud('theme4_team', [
  { key: 'name', col: 'name' }, { key: 'role', col: 'role' }, { key: 'photoUrl', col: 'photo_url' },
  { key: 'bio', col: 'bio' }, { key: 'linkedinUrl', col: 'linkedin_url' }, { key: 'orderIndex', col: 'order_index' },
])
const testimonials = makeCrud('theme4_testimonials', [
  { key: 'author', col: 'author' }, { key: 'role', col: 'role' }, { key: 'avatarUrl', col: 'avatar_url' },
  { key: 'rating', col: 'rating' }, { key: 'text', col: 'text' }, { key: 'orderIndex', col: 'order_index' },
])

const ENTITIES: Record<string, ReturnType<typeof makeCrud>> = {
  services, fleet, routes, projects, stats, steps, team, testimonials,
}

// ── Config (mapeo) ───────────────────────────────────────────────────────────
const CONFIG_FIELDS: Record<string, string> = {
  businessType: 'business_type', heroVideoUrl: 'hero_video_url', heroImageUrl: 'hero_image_url',
  heroTitle: 'hero_title', heroSubtitle: 'hero_subtitle', ctaLabel: 'cta_label', ctaUrl: 'cta_url',
  aboutText: 'about_text', accentColor: 'accent_color', whatsapp: 'whatsapp', email: 'email', phone: 'phone',
  address: 'address', mapUrl: 'map_url', showStats: 'show_stats', showServices: 'show_services',
  showProcess: 'show_process', showTeam: 'show_team', showTestimonials: 'show_testimonials',
  showContact: 'show_contact', showCommunity: 'show_community', isPublished: 'is_published',
}
function mapConfig(r: any) {
  if (!r) return null;
  return {
    businessType: r.business_type, heroVideoUrl: r.hero_video_url, heroImageUrl: r.hero_image_url,
    heroTitle: r.hero_title, heroSubtitle: r.hero_subtitle, ctaLabel: r.cta_label, ctaUrl: r.cta_url,
    aboutText: r.about_text, accentColor: r.accent_color, whatsapp: r.whatsapp, email: r.email, phone: r.phone,
    address: r.address, mapUrl: r.map_url,
    showStats: !!r.show_stats, showServices: !!r.show_services, showProcess: !!r.show_process,
    showTeam: !!r.show_team, showTestimonials: !!r.show_testimonials, showContact: !!r.show_contact,
    showCommunity: !!r.show_community,
    likes: Number(r.likes_count || 0), saves: Number(r.saves_count || 0), isPublished: !!r.is_published,
  };
}

async function loadConfig(tenantId: string) {
  const [rows] = (await pool.query('SELECT * FROM theme4_config WHERE tenant_id = ? LIMIT 1', [tenantId])) as any;
  return rows && rows[0] ? rows[0] : null;
}

// ════════════════════════ PÚBLICO ════════════════════════

router.get('/:slug/projects', async (req, res) => {
  try { const t = await resolveTenant(req.params.slug); if (!t) return fail(res, null, 'No encontrado', 404); ok(res, await projects.list(t.id)); }
  catch (e) { fail(res, e, 'Error al obtener proyectos'); }
});
router.get('/:slug/fleet', async (req, res) => {
  try { const t = await resolveTenant(req.params.slug); if (!t) return fail(res, null, 'No encontrado', 404); ok(res, await fleet.list(t.id)); }
  catch (e) { fail(res, e, 'Error al obtener la flota'); }
});
router.get('/:slug/routes', async (req, res) => {
  try { const t = await resolveTenant(req.params.slug); if (!t) return fail(res, null, 'No encontrado', 404); ok(res, await routes.list(t.id)); }
  catch (e) { fail(res, e, 'Error al obtener las rutas'); }
});

// Perfil público completo
router.get('/:slug', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const t = await resolveTenant(req.params.slug);
    if (!t) return fail(res, null, 'Empresa no encontrada', 404);
    const cfgRow = await loadConfig(t.id);
    // Si no hay config, devolver defaults vacíos en lugar de 404.
    // El tenant ya está validado como 'activo' en resolveTenant — eso es suficiente gate.
    const cfg = cfgRow ? mapConfig(cfgRow) : {
      businessType: null, heroVideoUrl: null, heroImageUrl: null,
      heroTitle: t.name, heroSubtitle: null, ctaLabel: null, ctaUrl: null,
      aboutText: null, accentColor: '#0ea5e9', whatsapp: null, email: null, phone: null,
      address: null, mapUrl: null,
      showStats: false, showServices: false, showProcess: false,
      showTeam: false, showTestimonials: false, showContact: false, showCommunity: false,
      likes: 0, saves: 0, isPublished: false,
    };
    // Nota: ya NO bloqueamos por isPublished — el tenant activo siempre es accesible.

    const [svc, flt, rts, prj, sts, stp, tm, tst] = await Promise.all([
      services.list(t.id), fleet.list(t.id), routes.list(t.id), projects.list(t.id),
      stats.list(t.id), steps.list(t.id), team.list(t.id), testimonials.list(t.id),
    ]);

    let reaction = { liked: false, saved: false };
    if (req.user?.userId) {
      const [rr] = (await pool.query('SELECT type FROM theme4_reactions WHERE tenant_id = ? AND user_id = ?', [t.id, req.user.userId])) as any;
      for (const r of rr) { if (r.type === 'like') reaction.liked = true; else reaction.saved = true; }
    }

    ok(res, {
      tenant: { id: t.id, name: t.name, slug: t.slug, logoUrl: t.logoUrl },
      config: cfg, services: svc, fleet: flt, routes: rts, projects: prj,
      stats: sts, steps: stp, team: tm, testimonials: tst, reaction,
    });
  } catch (e) { fail(res, e, 'Error al obtener el perfil'); }
});

// CommunityBar: like / save (toggle)
router.post('/:slug/react', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const t = await resolveTenant(req.params.slug);
    if (!t) return fail(res, null, 'No encontrado', 404);
    const type = req.body?.type === 'save' ? 'save' : 'like';
    const col = type === 'like' ? 'likes_count' : 'saves_count';
    const userId = req.user!.userId;

    const [ex] = (await pool.query('SELECT id FROM theme4_reactions WHERE tenant_id = ? AND user_id = ? AND type = ?', [t.id, userId, type])) as any;
    let active: boolean;
    if (ex.length) {
      await pool.query('DELETE FROM theme4_reactions WHERE id = ?', [ex[0].id]);
      await pool.query(`UPDATE theme4_config SET ${col} = GREATEST(${col} - 1, 0) WHERE tenant_id = ?`, [t.id]);
      active = false;
    } else {
      await pool.query('INSERT INTO theme4_reactions (id, tenant_id, user_id, type) VALUES (?,?,?,?)', [uuidv4(), t.id, userId, type]);
      await pool.query(`UPDATE theme4_config SET ${col} = ${col} + 1 WHERE tenant_id = ?`, [t.id]);
      active = true;
    }
    const [[c]] = (await pool.query('SELECT likes_count AS likes, saves_count AS saves FROM theme4_config WHERE tenant_id = ?', [t.id])) as any;
    ok(res, { type, active, likes: Number(c?.likes || 0), saves: Number(c?.saves || 0) });
  } catch (e) { fail(res, e, 'Error al reaccionar'); }
});

// ════════════════════════ COMERCIO (auth) ════════════════════════

// GET propio (editor): config + secciones incluyendo inactivas
router.get('/admin/me', STAFF, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const cfgRow = await loadConfig(tenantId);
    const [svc, flt, rts, prj, sts, stp, tm, tst] = await Promise.all([
      services.list(tenantId, false), fleet.list(tenantId, false), routes.list(tenantId, false), projects.list(tenantId, false),
      stats.list(tenantId, false), steps.list(tenantId, false), team.list(tenantId, false), testimonials.list(tenantId, false),
    ]);
    ok(res, {
      config: mapConfig(cfgRow) || { businessType: 'general', isPublished: false, showStats: true, showServices: true, showProcess: true, showTeam: true, showTestimonials: true, showContact: true, showCommunity: true, likes: 0, saves: 0 },
      services: svc, fleet: flt, routes: rts, projects: prj, stats: sts, steps: stp, team: tm, testimonials: tst,
    });
  } catch (e) { fail(res, e, 'Error al cargar el editor'); }
});

// PUT config (upsert)
router.put('/config', STAFF, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const b = req.body || {};
    const [ex] = (await pool.query('SELECT id FROM theme4_config WHERE tenant_id = ? LIMIT 1', [tenantId])) as any;
    if (ex.length) {
      const sets: string[] = []; const params: any[] = [];
      for (const [k, col] of Object.entries(CONFIG_FIELDS)) {
        if (b[k] === undefined) continue;
        sets.push(`${col} = ?`); params.push(b[k]);
      }
      if (sets.length) { params.push(tenantId); await pool.query(`UPDATE theme4_config SET ${sets.join(',')} WHERE tenant_id = ?`, params); }
    } else {
      const cols = ['id', 'tenant_id']; const ph = ['?', '?']; const vals: any[] = [uuidv4(), tenantId];
      for (const [k, col] of Object.entries(CONFIG_FIELDS)) {
        if (b[k] === undefined) continue;
        cols.push(col); ph.push('?'); vals.push(b[k]);
      }
      await pool.query(`INSERT INTO theme4_config (${cols.join(',')}) VALUES (${ph.join(',')})`, vals);
    }
    const cfgRow = await loadConfig(tenantId);
    ok(res, mapConfig(cfgRow));
  } catch (e) { fail(res, e, 'Error al guardar la configuración'); }
});

// CRUD genérico por entidad: /:entity
function isEntity(name: string): name is keyof typeof ENTITIES { return Object.prototype.hasOwnProperty.call(ENTITIES, name); }

router.post('/:entity', STAFF, async (req: AuthRequest, res: Response) => {
  try {
    if (!isEntity(req.params.entity)) return fail(res, null, 'Entidad inválida', 400);
    ok(res, await ENTITIES[req.params.entity].create(req.user!.tenantId!, req.body), 201);
  } catch (e) { fail(res, e, 'Error al crear'); }
});
router.put('/:entity/:id', STAFF, async (req: AuthRequest, res: Response) => {
  try {
    if (!isEntity(req.params.entity)) return fail(res, null, 'Entidad inválida', 400);
    const r = await ENTITIES[req.params.entity].update(req.user!.tenantId!, req.params.id, req.body);
    if (!r) return fail(res, null, 'No encontrado o sin cambios', 404);
    ok(res, r);
  } catch (e) { fail(res, e, 'Error al actualizar'); }
});
router.delete('/:entity/:id', STAFF, async (req: AuthRequest, res: Response) => {
  try {
    if (!isEntity(req.params.entity)) return fail(res, null, 'Entidad inválida', 400);
    await ENTITIES[req.params.entity].remove(req.user!.tenantId!, req.params.id);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e, 'Error al eliminar'); }
});

export default router;
