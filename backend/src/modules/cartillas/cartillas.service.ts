/**
 * cartillas.service.ts
 * Módulo CARTILLA (Cartilla Digital) integrado en Lopbuk.
 *
 * Sección independiente y multi-tenant: los comercios publican CARTILLAS /
 * LIBROS / CURSOS (gratis o con precio). El cliente abre una cartilla gratis
 * (o ya comprada) e interactúa con TODO su contenido: módulos, actividades
 * interactivas, secciones, audios, vocabulario, comunidad y retos.
 *
 * Convenciones Lopbuk:
 *   - Toda la lógica vive aquí (service), nunca en routes/controllers.
 *   - tenant_id SIEMPRE viene del JWT (req.user.tenantId), nunca del body.
 *   - Soft delete con is_active = 0.
 *   - AppError('mensaje', httpCode) para errores controlados.
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const PUNTOS_RESPUESTA_CORRECTA = parseInt(process.env.PUNTOS_RESPUESTA || '10', 10);
const PAGE_SIZE = 20;

// Avatares deterministas para usuarios sin emoji propio
const AVATARES = ['🌱', '🌺', '🦜', '🌿', '⛰️', '🌸', '🌻', '🦋', '🍃', '🌎'];
function avatarFor(id: string, fallback?: string | null): string {
  if (fallback) return fallback;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % AVATARES.length;
  return AVATARES[h];
}

const hoy = () => new Date().toISOString().slice(0, 10);
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();

// ════════════════════════════════════════════════════════════════════════
//  CATÁLOGO PÚBLICO (global, agrega cartillas de todos los comercios)
// ════════════════════════════════════════════════════════════════════════

export async function listarCatalogo(opts: {
  tipo?: string;
  q?: string;
  tenantId?: string;
  destacado?: boolean;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(50, opts.limit || PAGE_SIZE);
  const offset = (page - 1) * limit;

  const where: string[] = ['c.publicado = TRUE', 'c.is_active = TRUE'];
  const params: any[] = [];
  if (opts.tipo) { where.push('c.tipo = ?'); params.push(opts.tipo); }
  if (opts.tenantId) { where.push('c.tenant_id = ?'); params.push(opts.tenantId); }
  if (opts.destacado) { where.push('c.destacado = TRUE'); }
  if (opts.q && opts.q.trim()) {
    where.push('(c.titulo LIKE ? OR c.descripcion LIKE ? OR c.autor LIKE ?)');
    const like = `%${opts.q.trim()}%`;
    params.push(like, like, like);
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.*, t.name AS comercio, t.slug AS comercio_slug,
            (SELECT COUNT(*) FROM cartilla_modulos m WHERE m.cartilla_id = c.id AND m.is_active = TRUE) AS total_modulos
       FROM cartillas c
       LEFT JOIN tenants t ON t.id = c.tenant_id
      WHERE ${where.join(' AND ')}
      ORDER BY c.destacado DESC, c.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM cartillas c WHERE ${where.join(' AND ')}`,
    params
  );

  return {
    data: rows.map(mapCartilla),
    page, pageSize: limit, total: Number(total),
    hasMore: offset + rows.length < Number(total),
  };
}

function mapCartilla(r: RowDataPacket) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    comercio: r.comercio || null,
    comercioSlug: r.comercio_slug || null,
    slug: r.slug,
    titulo: r.titulo,
    tipo: r.tipo,
    descripcion: r.descripcion,
    portadaUrl: r.portada_url,
    color: r.color,
    autor: r.autor,
    idioma: r.idioma,
    nivel: r.nivel,
    frase: r.frase,
    traduccion: r.traduccion,
    esGratis: !!r.es_gratis,
    precio: Number(r.precio || 0),
    moneda: r.moneda || 'COP',
    publicado: !!r.publicado,
    destacado: !!r.destacado,
    totalModulos: r.total_modulos != null ? Number(r.total_modulos) : undefined,
  };
}

/** Carga una cartilla publicada por slug (o id) + datos de acceso del usuario. */
export async function obtenerCartillaPublica(idOrSlug: string, usuarioId?: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.*, t.name AS comercio, t.slug AS comercio_slug
       FROM cartillas c LEFT JOIN tenants t ON t.id = c.tenant_id
      WHERE (c.id = ? OR c.slug = ?) AND c.is_active = TRUE
      LIMIT 1`,
    [idOrSlug, idOrSlug]
  );
  if (rows.length === 0) throw new AppError('Cartilla no encontrada', 404);
  const cartilla = mapCartilla(rows[0]);

  const acceso = await tieneAcceso(cartilla.id, cartilla.esGratis, usuarioId);
  // Archivos adjuntos: siempre exponemos la metadata; la URL de descarga solo si hay
  // acceso (gratis o comprado). Sin acceso → locked, para mostrar "comprar para descargar".
  const archivosRaw = await listarArchivos(cartilla.id);
  const archivos = archivosRaw.map((a: any) => ({
    id: a.id, nombre: a.nombre, tipo: a.tipo, sizeBytes: a.sizeBytes,
    url: acceso ? a.url : null, locked: !acceso,
  }));
  return { ...cartilla, acceso, archivos };
}

/** ¿El usuario puede interactuar con el contenido completo de la cartilla? */
export async function tieneAcceso(cartillaId: string, esGratis: boolean, usuarioId?: string): Promise<boolean> {
  if (esGratis) return true;
  if (!usuarioId) return false;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT estado FROM cartilla_compras WHERE cartilla_id = ? AND usuario_id = ? LIMIT 1`,
    [cartillaId, usuarioId]
  );
  return rows.length > 0 && (rows[0].estado === 'pagado' || rows[0].estado === 'gratis');
}

/**
 * Resuelve una cartilla por id o slug y devuelve sus datos núcleo.
 * El área de cartillas es GLOBAL (cross-tenant): el tenant de negocio es
 * SIEMPRE el dueño de la cartilla, no el del usuario que la consume.
 */
export async function resolverCartilla(idOrSlug: string): Promise<{ id: string; tenant_id: string; es_gratis: boolean }> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, tenant_id, es_gratis FROM cartillas WHERE (id = ? OR slug = ?) AND is_active = TRUE LIMIT 1`,
    [idOrSlug, idOrSlug]
  );
  if (rows.length === 0) throw new AppError('Cartilla no encontrada', 404);
  return { id: rows[0].id, tenant_id: rows[0].tenant_id, es_gratis: !!rows[0].es_gratis };
}

async function cartillaCore(cartillaId: string): Promise<RowDataPacket> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM cartillas WHERE id = ? AND is_active = TRUE LIMIT 1`, [cartillaId]
  );
  if (rows.length === 0) throw new AppError('Cartilla no encontrada', 404);
  return rows[0];
}

/** Lanza 402 si la cartilla es de pago y el usuario no tiene acceso. */
async function requireAcceso(cartillaId: string, usuarioId?: string) {
  const c = await cartillaCore(cartillaId);
  const ok = await tieneAcceso(cartillaId, !!c.es_gratis, usuarioId);
  if (!ok) throw new AppError('Esta cartilla es de pago. Adquiérela para ver su contenido.', 402);
  return c;
}

// ════════════════════════════════════════════════════════════════════════
//  LECTOR — MÓDULOS Y CONTENIDO
// ════════════════════════════════════════════════════════════════════════

export async function listarModulos(cartillaId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, clave, titulo, icono, color, descripcion, video_url, frase, traduccion, orden
       FROM cartilla_modulos
      WHERE cartilla_id = ? AND is_active = TRUE
      ORDER BY orden ASC, created_at ASC`,
    [cartillaId]
  );
  return rows.map(mapModulo);
}

function mapModulo(r: RowDataPacket) {
  return {
    id: r.id,
    clave: r.clave,
    titulo: r.titulo,
    icono: r.icono,
    color: r.color,
    descripcion: r.descripcion,
    video_url: r.video_url,
    frase: r.frase,
    traduccion: r.traduccion,
    orden: r.orden,
  };
}

/** Detalle completo de un módulo (actividades + imágenes + secciones + audios). Gated. */
export async function obtenerModulo(cartillaId: string, clave: string, usuarioId?: string) {
  await requireAcceso(cartillaId, usuarioId);

  const [mods] = await db.query<RowDataPacket[]>(
    `SELECT * FROM cartilla_modulos WHERE cartilla_id = ? AND clave = ? AND is_active = TRUE LIMIT 1`,
    [cartillaId, clave]
  );
  if (mods.length === 0) throw new AppError('Módulo no encontrado', 404);
  const modulo = mods[0];
  const mid = modulo.id;

  const [[actRows], [imagenes], [secciones], [audios]] = await Promise.all([
    db.query<RowDataPacket[]>(`SELECT * FROM cartilla_actividades WHERE modulo_id = ? ORDER BY orden ASC`, [mid]),
    db.query<RowDataPacket[]>(`SELECT id, url, alt, caption, orden FROM cartilla_modulo_imagenes WHERE modulo_id = ? ORDER BY orden ASC`, [mid]),
    db.query<RowDataPacket[]>(`SELECT id, titulo, contenido, tipo, orden FROM cartilla_modulo_secciones WHERE modulo_id = ? ORDER BY orden ASC`, [mid]),
    db.query<RowDataPacket[]>(`SELECT id, titulo, url, descripcion, orden FROM cartilla_modulo_audios WHERE modulo_id = ? ORDER BY orden ASC`, [mid]),
  ]);

  const actividades = await cargarDetallesActividades(actRows);
  return { ...mapModulo(modulo), actividades, imagenes, secciones, audios };
}

async function cargarDetallesActividades(actRows: RowDataPacket[]) {
  if (actRows.length === 0) return [];
  const ids = actRows.map(a => a.id);

  const [[opciones], [pares], [vf], [ordenar]] = await Promise.all([
    db.query<RowDataPacket[]>(`SELECT actividad_id, id, texto, orden FROM cartilla_actividad_opciones WHERE actividad_id IN (?) ORDER BY orden`, [ids]),
    db.query<RowDataPacket[]>(`SELECT actividad_id, id, inga, espanol FROM cartilla_actividad_pares WHERE actividad_id IN (?)`, [ids]),
    db.query<RowDataPacket[]>(`SELECT actividad_id, id, enunciado, es_verdadero, orden FROM cartilla_actividad_vf WHERE actividad_id IN (?) ORDER BY orden`, [ids]),
    db.query<RowDataPacket[]>(`SELECT actividad_id, id, fragmento, orden_correcto FROM cartilla_actividad_ordenar WHERE actividad_id IN (?) ORDER BY orden_correcto`, [ids]),
  ]);

  const group = (rows: RowDataPacket[]) => rows.reduce<Record<string, RowDataPacket[]>>((acc, r) => {
    (acc[r.actividad_id] ||= []).push(r); return acc;
  }, {});
  const opByAct = group(opciones), parByAct = group(pares), vfByAct = group(vf), ordByAct = group(ordenar);

  return actRows.map(act => {
    const base = { id: act.id, tipo: act.tipo, pregunta: act.pregunta, respuesta_correcta: act.respuesta_correcta };
    if (act.tipo === 'completar') return { ...base, opciones: opByAct[act.id] || [] };
    if (act.tipo === 'emparejar') return { ...base, pares: parByAct[act.id] || [] };
    if (act.tipo === 'verdadero_falso') return { ...base, enunciados_vf: vfByAct[act.id] || [] };
    if (act.tipo === 'ordenar') return { ...base, fragmentos_ordenar: ordByAct[act.id] || [] };
    return base;
  });
}

// ════════════════════════════════════════════════════════════════════════
//  ACTIVIDADES — RESPONDER (+ puntos, progreso, retos)
// ════════════════════════════════════════════════════════════════════════

export async function responder(usuarioId: string, tenantId: string, cartillaId: string, clave: string, respuesta: string) {
  if (typeof respuesta !== 'string' || respuesta.length > 500) {
    throw new AppError('Respuesta inválida', 400);
  }
  await requireAcceso(cartillaId, usuarioId);

  const [mods] = await db.query<RowDataPacket[]>(
    `SELECT id FROM cartilla_modulos WHERE cartilla_id = ? AND clave = ? LIMIT 1`, [cartillaId, clave]
  );
  if (mods.length === 0) throw new AppError('Módulo no encontrado', 404);
  const moduloId = mods[0].id;

  const [acts] = await db.query<RowDataPacket[]>(
    `SELECT * FROM cartilla_actividades WHERE modulo_id = ? ORDER BY orden ASC LIMIT 1`, [moduloId]
  );
  if (acts.length === 0) throw new AppError('Actividad no encontrada', 404);
  const actividad = acts[0];

  const esCorrecta = actividad.tipo === 'completar' && respuesta === actividad.respuesta_correcta;
  const puntosGanados = esCorrecta ? PUNTOS_RESPUESTA_CORRECTA : 0;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO cartilla_usuario_respuestas (id, usuario_id, actividad_id, respuesta, es_correcta, puntos_obtenidos)
       VALUES (?,?,?,?,?,?)`,
      [uuidv4(), usuarioId, actividad.id, respuesta, esCorrecta, puntosGanados]
    );

    if (puntosGanados > 0) {
      await sumarPuntos(conn, tenantId, usuarioId, cartillaId, puntosGanados, 1);
      await incrementarProgresoReto(conn, usuarioId, tenantId, cartillaId, 'vocabulario', 1);

      const [[{ total, correctas }]] = await conn.query<RowDataPacket[]>(
        `SELECT
           (SELECT COUNT(*) FROM cartilla_actividades WHERE modulo_id = ?) AS total,
           (SELECT COUNT(DISTINCT ur.actividad_id)
              FROM cartilla_usuario_respuestas ur
              JOIN cartilla_actividades a ON ur.actividad_id = a.id
             WHERE ur.usuario_id = ? AND a.modulo_id = ? AND ur.es_correcta = TRUE) AS correctas`,
        [moduloId, usuarioId, moduloId]
      );

      if (Number(correctas) >= Number(total)) {
        await conn.query(
          `INSERT INTO cartilla_usuario_modulos (id, usuario_id, modulo_id, completado, puntos_obtenidos, completado_en)
           VALUES (?,?,?,TRUE,?,NOW())
           ON DUPLICATE KEY UPDATE completado = TRUE, completado_en = NOW()`,
          [uuidv4(), usuarioId, moduloId, puntosGanados]
        );
        await incrementarProgresoReto(conn, usuarioId, tenantId, cartillaId, 'modulo', 1);
      }
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const prog = await getProgreso(usuarioId, cartillaId, tenantId);
  return { correcta: esCorrecta, puntos_obtenidos: puntosGanados, puntos_totales: prog.puntos };
}

export async function progresoModulo(usuarioId: string, cartillaId: string, clave: string) {
  const [mods] = await db.query<RowDataPacket[]>(
    `SELECT id FROM cartilla_modulos WHERE cartilla_id = ? AND clave = ? LIMIT 1`, [cartillaId, clave]
  );
  if (mods.length === 0) throw new AppError('Módulo no encontrado', 404);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT completado, puntos_obtenidos, completado_en FROM cartilla_usuario_modulos WHERE usuario_id = ? AND modulo_id = ?`,
    [usuarioId, mods[0].id]
  );
  return rows.length > 0 ? rows[0] : { completado: false, puntos_obtenidos: 0 };
}

// ════════════════════════════════════════════════════════════════════════
//  GAMIFICACIÓN — PROGRESO, PUNTOS, RETOS, RANKING
// ════════════════════════════════════════════════════════════════════════

async function sumarPuntos(conn: any, tenantId: string, usuarioId: string, cartillaId: string, puntos: number, palabras = 0) {
  await conn.query(
    `INSERT INTO cartilla_progreso (id, tenant_id, usuario_id, cartilla_id, puntos, palabras_aprendidas, ultimo_acceso)
     VALUES (?,?,?,?,?,?,CURDATE())
     ON DUPLICATE KEY UPDATE puntos = puntos + VALUES(puntos),
                             palabras_aprendidas = palabras_aprendidas + VALUES(palabras_aprendidas),
                             ultimo_acceso = CURDATE()`,
    [uuidv4(), tenantId, usuarioId, cartillaId, puntos, palabras]
  );
}

export async function getProgreso(usuarioId: string, cartillaId: string, tenantId?: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT puntos, dias_seguidos, palabras_aprendidas FROM cartilla_progreso WHERE usuario_id = ? AND cartilla_id = ?`,
    [usuarioId, cartillaId]
  );
  if (rows.length === 0) {
    if (tenantId) {
      await db.query(
        `INSERT IGNORE INTO cartilla_progreso (id, tenant_id, usuario_id, cartilla_id) VALUES (?,?,?,?)`,
        [uuidv4(), tenantId, usuarioId, cartillaId]
      );
    }
    return { puntos: 0, dias_seguidos: 0, palabras_aprendidas: 0 };
  }
  return { puntos: rows[0].puntos, dias_seguidos: rows[0].dias_seguidos, palabras_aprendidas: rows[0].palabras_aprendidas };
}

/** Incrementa el progreso de los retos de una categoría para el día de hoy. */
async function incrementarProgresoReto(conn: any, usuarioId: string, tenantId: string, cartillaId: string, categoria: string, cantidad = 1) {
  const fecha = hoy();
  const [retos] = await conn.query(
    `SELECT id, puntos, meta FROM cartilla_retos
      WHERE categoria = ? AND activo = TRUE AND tenant_id = ? AND (cartilla_id = ? OR cartilla_id IS NULL)`,
    [categoria, tenantId, cartillaId]
  );

  for (const reto of retos as RowDataPacket[]) {
    const meta = reto.meta || 1;
    const [existe] = await conn.query(
      `SELECT * FROM cartilla_usuario_retos WHERE usuario_id = ? AND reto_id = ? AND fecha = ?`,
      [usuarioId, reto.id, fecha]
    );

    if ((existe as RowDataPacket[]).length === 0) {
      const actual = Math.min(cantidad, meta);
      const progreso = Math.round((actual / meta) * 100);
      const completado = actual >= meta;
      await conn.query(
        `INSERT INTO cartilla_usuario_retos (id, usuario_id, reto_id, fecha, completado, actual, progreso, completado_en)
         VALUES (?,?,?,?,?,?,?,?)`,
        [uuidv4(), usuarioId, reto.id, fecha, completado, actual, progreso, completado ? new Date() : null]
      );
      if (completado) await sumarPuntos(conn, tenantId, usuarioId, cartillaId, reto.puntos, 0);
    } else {
      const reg = (existe as RowDataPacket[])[0];
      if (reg.completado) continue;
      const actual = Math.min(reg.actual + cantidad, meta);
      const progreso = Math.round((actual / meta) * 100);
      const completado = actual >= meta;
      await conn.query(
        `UPDATE cartilla_usuario_retos SET actual = ?, progreso = ?, completado = ?, completado_en = ? WHERE id = ?`,
        [actual, progreso, completado, completado ? new Date() : null, reg.id]
      );
      if (completado) await sumarPuntos(conn, tenantId, usuarioId, cartillaId, reto.puntos, 0);
    }
  }
}

export async function listarRetos(cartillaId: string, tenantId: string, usuarioId?: string) {
  if (usuarioId) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT r.id, r.titulo, r.descripcion, r.puntos, r.dificultad, r.categoria, r.meta,
              COALESCE(ur.completado, FALSE) AS completado,
              COALESCE(ur.actual, 0) AS actual,
              COALESCE(ur.progreso, 0) AS progreso
         FROM cartilla_retos r
         LEFT JOIN cartilla_usuario_retos ur
           ON r.id = ur.reto_id AND ur.usuario_id = ? AND ur.fecha = CURDATE()
        WHERE r.activo = TRUE AND r.tenant_id = ? AND (r.cartilla_id = ? OR r.cartilla_id IS NULL)
        ORDER BY r.created_at`,
      [usuarioId, tenantId, cartillaId]
    );
    return rows.map(r => ({ ...r, completado: Boolean(r.completado) }));
  }
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, titulo, descripcion, puntos, dificultad, categoria, meta FROM cartilla_retos
      WHERE activo = TRUE AND tenant_id = ? AND (cartilla_id = ? OR cartilla_id IS NULL) ORDER BY created_at`,
    [tenantId, cartillaId]
  );
  return rows.map(r => ({ ...r, completado: false, actual: 0, progreso: 0 }));
}

export async function topAprendices(cartillaId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT u.id, u.name AS nombre, u.avatar, p.puntos
       FROM cartilla_progreso p JOIN users u ON u.id = p.usuario_id
      WHERE p.cartilla_id = ?
      ORDER BY p.puntos DESC LIMIT 5`,
    [cartillaId]
  );
  return rows.map(r => ({ id: r.id, nombre: r.nombre, avatar: avatarFor(r.id, r.avatar), puntos: Number(r.puntos), nivel: nivelPara(Number(r.puntos)) }));
}

function nivelPara(puntos: number): string {
  if (puntos >= 300) return 'Experta';
  if (puntos >= 250) return 'Avanzado';
  if (puntos >= 150) return 'Intermedio';
  if (puntos >= 50) return 'Aprendiz';
  return 'Nuevo';
}

export async function miembrosActivos(cartillaId: string) {
  const [[{ total }]] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT usuario_id) AS total FROM cartilla_progreso WHERE cartilla_id = ?`, [cartillaId]
  );
  return { total: Number(total) };
}

export async function statsUsuario(usuarioId: string, cartillaId: string) {
  const prog = await getProgreso(usuarioId, cartillaId);
  const [[{ total }]] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM cartilla_modulos WHERE cartilla_id = ? AND is_active = TRUE`, [cartillaId]
  );
  return { ...prog, modulos_total: Number(total) };
}

// ════════════════════════════════════════════════════════════════════════
//  VOCABULARIO / TRADUCTOR
// ════════════════════════════════════════════════════════════════════════

export async function buscarVocabulario(cartillaId: string | undefined, q: string) {
  const termino = (q || '').trim();
  if (termino.length < 2) return { resultados: [], total: 0 };
  const like = `%${termino}%`;
  const params: any[] = [];
  let scope = '';
  if (cartillaId) { scope = 'cartilla_id = ? AND'; params.push(cartillaId); }
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, espanol, inga, categoria, notas FROM cartilla_vocabulario
      WHERE ${scope} (espanol LIKE ? OR inga LIKE ?)
      ORDER BY CASE WHEN espanol = ? OR inga = ? THEN 0
                    WHEN espanol LIKE ? OR inga LIKE ? THEN 1 ELSE 2 END, espanol ASC
      LIMIT 30`,
    [...params, like, like, termino, termino, `${termino}%`, `${termino}%`]
  );
  const resultados = rows.map(r => ({
    ...r,
    coincide: r.espanol.toLowerCase().includes(termino.toLowerCase()) ? 'espanol' : 'inga',
  }));
  return { resultados, total: resultados.length };
}

// ════════════════════════════════════════════════════════════════════════
//  COMUNIDAD
// ════════════════════════════════════════════════════════════════════════

export async function listarPublicaciones(cartillaId: string, page = 1) {
  const limit = PAGE_SIZE;
  const offset = (Math.max(1, page) - 1) * limit;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.id, u.name AS usuario, u.avatar, u.id AS usuario_id, p.contenido, p.likes, p.created_at AS creado_en,
            COALESCE(c.total, 0) AS comentarios
       FROM cartilla_publicaciones p
       JOIN users u ON p.usuario_id = u.id
       LEFT JOIN (SELECT publicacion_id, COUNT(*) AS total FROM cartilla_comentarios GROUP BY publicacion_id) c
         ON c.publicacion_id = p.id
      WHERE p.cartilla_id = ? AND p.is_active = TRUE
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [cartillaId, limit, offset]
  );
  const [[{ total }]] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM cartilla_publicaciones WHERE cartilla_id = ? AND is_active = TRUE`, [cartillaId]
  );
  const data = rows.map(r => ({ ...r, avatar: avatarFor(r.usuario_id, r.avatar) }));
  return { data, page, pageSize: limit, total: Number(total), hasMore: offset + rows.length < Number(total) };
}

export async function crearPublicacion(usuarioId: string, tenantId: string, cartillaId: string, contenidoRaw: string) {
  const contenido = stripHtml(String(contenidoRaw || ''));
  if (!contenido) throw new AppError('El contenido es requerido', 400);
  if (contenido.length > 1000) throw new AppError('El contenido no puede superar 1000 caracteres', 400);

  const id = uuidv4();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO cartilla_publicaciones (id, tenant_id, cartilla_id, usuario_id, contenido) VALUES (?,?,?,?,?)`,
      [id, tenantId, cartillaId, usuarioId, contenido]
    );
    await incrementarProgresoReto(conn, usuarioId, tenantId, cartillaId, 'comunidad', 1);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.id, u.name AS usuario, u.avatar, u.id AS usuario_id, p.contenido, p.likes, 0 AS comentarios, p.created_at AS creado_en
       FROM cartilla_publicaciones p JOIN users u ON p.usuario_id = u.id WHERE p.id = ?`,
    [id]
  );
  const r = rows[0];
  return { ...r, avatar: avatarFor(r.usuario_id, r.avatar) };
}

export async function toggleLike(usuarioId: string, publicacionId: string) {
  const [pub] = await db.query<RowDataPacket[]>(`SELECT id FROM cartilla_publicaciones WHERE id = ?`, [publicacionId]);
  if (pub.length === 0) throw new AppError('Publicación no encontrada', 404);

  const [existe] = await db.query<RowDataPacket[]>(
    `SELECT id FROM cartilla_publicacion_likes WHERE publicacion_id = ? AND usuario_id = ?`, [publicacionId, usuarioId]
  );
  let liked: boolean;
  if (existe.length > 0) {
    await db.query(`DELETE FROM cartilla_publicacion_likes WHERE id = ?`, [existe[0].id]);
    await db.query(`UPDATE cartilla_publicaciones SET likes = GREATEST(likes - 1, 0) WHERE id = ?`, [publicacionId]);
    liked = false;
  } else {
    await db.query(`INSERT INTO cartilla_publicacion_likes (id, publicacion_id, usuario_id) VALUES (?,?,?)`, [uuidv4(), publicacionId, usuarioId]);
    await db.query(`UPDATE cartilla_publicaciones SET likes = likes + 1 WHERE id = ?`, [publicacionId]);
    liked = true;
  }
  const [[{ likes }]] = await db.query<RowDataPacket[]>(`SELECT likes FROM cartilla_publicaciones WHERE id = ?`, [publicacionId]);
  return { likes: Number(likes), liked };
}

export async function listarComentarios(publicacionId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.id, u.name AS usuario, u.avatar, u.id AS usuario_id, c.contenido, c.created_at AS creado_en
       FROM cartilla_comentarios c JOIN users u ON c.usuario_id = u.id
      WHERE c.publicacion_id = ? ORDER BY c.created_at ASC`,
    [publicacionId]
  );
  return rows.map(r => ({ ...r, avatar: avatarFor(r.usuario_id, r.avatar) }));
}

export async function crearComentario(usuarioId: string, publicacionId: string, contenidoRaw: string) {
  const contenido = stripHtml(String(contenidoRaw || ''));
  if (!contenido) throw new AppError('El comentario es requerido', 400);
  const [pub] = await db.query<RowDataPacket[]>(`SELECT id FROM cartilla_publicaciones WHERE id = ?`, [publicacionId]);
  if (pub.length === 0) throw new AppError('Publicación no encontrada', 404);

  const id = uuidv4();
  await db.query(`INSERT INTO cartilla_comentarios (id, publicacion_id, usuario_id, contenido) VALUES (?,?,?,?)`,
    [id, publicacionId, usuarioId, contenido]);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.id, u.name AS usuario, u.avatar, u.id AS usuario_id, c.contenido, c.created_at AS creado_en
       FROM cartilla_comentarios c JOIN users u ON c.usuario_id = u.id WHERE c.id = ?`, [id]
  );
  const r = rows[0];
  return { ...r, avatar: avatarFor(r.usuario_id, r.avatar) };
}

// ════════════════════════════════════════════════════════════════════════
//  COMPRA / DESBLOQUEO (integración de pago)
// ════════════════════════════════════════════════════════════════════════

/**
 * Adquiere acceso a una cartilla.
 *  - Gratis -> acceso inmediato (estado 'gratis').
 *  - Con precio -> crea/recupera la compra. Si Stripe está configurado y el
 *    método es 'stripe', devuelve checkoutUrl para completar el pago; el acceso
 *    se concede al confirmar (confirmarCompra, llamado por webhook/admin).
 *    Con método 'manual'/'efectivo'/'credito' el comercio concede acceso al
 *    confirmar el pago por su canal habitual.
 */
export async function comprarCartilla(usuarioId: string, cartillaIdOrSlug: string, metodo = 'manual') {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM cartillas WHERE (id = ? OR slug = ?) AND is_active = TRUE LIMIT 1`,
    [cartillaIdOrSlug, cartillaIdOrSlug]
  );
  if (rows.length === 0) throw new AppError('Cartilla no encontrada', 404);
  const c = rows[0];

  // ¿Ya tiene compra?
  const [prev] = await db.query<RowDataPacket[]>(
    `SELECT * FROM cartilla_compras WHERE cartilla_id = ? AND usuario_id = ? LIMIT 1`, [c.id, usuarioId]
  );
  if (prev.length > 0 && (prev[0].estado === 'pagado' || prev[0].estado === 'gratis')) {
    return { compra: prev[0], acceso: true };
  }

  if (c.es_gratis) {
    const id = prev.length ? prev[0].id : uuidv4();
    await db.query(
      `INSERT INTO cartilla_compras (id, tenant_id, cartilla_id, usuario_id, precio, moneda, estado, metodo, pagado_en)
       VALUES (?,?,?,?,?,?,'gratis','gratis',NOW())
       ON DUPLICATE KEY UPDATE estado='gratis', metodo='gratis', pagado_en=NOW()`,
      [id, c.tenant_id, c.id, usuarioId, 0, c.moneda]
    );
    return { compra: { id, estado: 'gratis' }, acceso: true };
  }

  // De pago
  const compraId = prev.length ? prev[0].id : uuidv4();
  await db.query(
    `INSERT INTO cartilla_compras (id, tenant_id, cartilla_id, usuario_id, precio, moneda, estado, metodo)
     VALUES (?,?,?,?,?,?,'pendiente',?)
     ON DUPLICATE KEY UPDATE estado='pendiente', metodo=VALUES(metodo), updated_at=NOW()`,
    [compraId, c.tenant_id, c.id, usuarioId, c.precio, c.moneda, metodo]
  );

  // Gateway → Wompi (flujo validado de la plataforma). 'manual' = solicitar acceso al comercio.
  let checkoutUrl: string | null = null;
  if (metodo !== 'manual') {
    checkoutUrl = await crearWompiCheckout(c, usuarioId, compraId);
  }

  return {
    compra: { id: compraId, estado: 'pendiente', precio: Number(c.precio), moneda: c.moneda },
    acceso: false,
    checkoutUrl,
  };
}

/** Crea un Web Checkout de Wompi para la compra (context 'cartilla'). Devuelve la URL o null. */
async function crearWompiCheckout(cartilla: RowDataPacket, usuarioId: string, compraId: string): Promise<string | null> {
  try {
    const { createCheckout } = await import('../payments/payments.service');
    let email: string | undefined;
    try {
      const [u] = await db.query<RowDataPacket[]>(`SELECT email FROM users WHERE id = ? LIMIT 1`, [usuarioId]);
      email = u[0]?.email || undefined;
    } catch { /* sin email */ }
    const frontend = process.env.FRONTEND_URL || '';
    const r = await createCheckout({
      context: 'cartilla',
      contextId: compraId, // el monto y el tenant se resuelven en el server desde cartilla_compras
      tenantId: cartilla.tenant_id,
      amountInCents: Math.round(Number(cartilla.precio) * 100),
      currency: cartilla.moneda || 'COP',
      customerEmail: email,
      redirectUrl: `${frontend}/cartilla-inga/${cartilla.slug}`,
    });
    await db.query(`UPDATE cartilla_compras SET referencia = ? WHERE id = ?`, [r.reference, compraId]);
    return r.checkoutUrl;
  } catch (e) {
    console.error('crearWompiCheckout error:', e);
    return null;
  }
}

/** Best-effort: crea una sesión de Stripe Checkout si el módulo/llaves existen. */
async function crearStripeCheckout(cartilla: RowDataPacket, usuarioId: string, compraId: string): Promise<string | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    // Carga perezosa para no acoplar el módulo a Stripe si no está configurado.
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: (cartilla.moneda || 'cop').toLowerCase(),
          product_data: { name: cartilla.titulo },
          unit_amount: Math.round(Number(cartilla.precio) * 100),
        },
        quantity: 1,
      }],
      metadata: { compraId, cartillaId: cartilla.id, usuarioId },
      success_url: `${process.env.FRONTEND_URL || ''}/cartilla-inga/${cartilla.slug}?compra=ok`,
      cancel_url: `${process.env.FRONTEND_URL || ''}/cartilla-inga/${cartilla.slug}?compra=cancelada`,
    });
    await db.query(`UPDATE cartilla_compras SET referencia = ? WHERE id = ?`, [session.id, compraId]);
    return session.url || null;
  } catch {
    return null;
  }
}

/** Marca una compra como pagada y concede acceso (webhook Stripe / admin del comercio). */
export async function confirmarCompra(compraId: string, referencia?: string) {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM cartilla_compras WHERE id = ? LIMIT 1`, [compraId]);
  if (rows.length === 0) throw new AppError('Compra no encontrada', 404);
  await db.query(
    `UPDATE cartilla_compras SET estado='pagado', pagado_en=NOW(), referencia = COALESCE(?, referencia) WHERE id = ?`,
    [referencia || null, compraId]
  );
  return { ok: true };
}

export async function misCompras(usuarioId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT co.id, co.estado, co.precio, co.moneda, co.created_at, c.id AS cartilla_id, c.slug, c.titulo
       FROM cartilla_compras co JOIN cartillas c ON c.id = co.cartilla_id
      WHERE co.usuario_id = ? ORDER BY co.created_at DESC`,
    [usuarioId]
  );
  return rows;
}

// ════════════════════════════════════════════════════════════════════════
//  STAFF / COMERCIANTE — CRUD de cartillas y contenido (scoping por tenant)
// ════════════════════════════════════════════════════════════════════════

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'cartilla';

export async function listarMisCartillas(tenantId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.*, (SELECT COUNT(*) FROM cartilla_modulos m WHERE m.cartilla_id = c.id AND m.is_active = TRUE) AS total_modulos,
            (SELECT COUNT(*) FROM cartilla_compras co WHERE co.cartilla_id = c.id AND co.estado='pagado') AS ventas
       FROM cartillas c WHERE c.tenant_id = ? AND c.is_active = TRUE ORDER BY c.created_at DESC`,
    [tenantId]
  );
  return rows.map(r => ({ ...mapCartilla(r), ventas: Number(r.ventas || 0) }));
}

export async function crearCartilla(tenantId: string, data: any) {
  if (!data?.titulo) throw new AppError('El título es requerido', 400);
  const id = uuidv4();
  let slug = data.slug ? slugify(data.slug) : slugify(data.titulo);
  // Garantiza unicidad por tenant
  const [dups] = await db.query<RowDataPacket[]>(`SELECT slug FROM cartillas WHERE tenant_id = ? AND slug LIKE ?`, [tenantId, `${slug}%`]);
  if (dups.some(d => d.slug === slug)) slug = `${slug}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const esGratis = data.esGratis ?? (Number(data.precio || 0) <= 0);
  await db.query(
    `INSERT INTO cartillas (id, tenant_id, slug, titulo, tipo, descripcion, portada_url, color, autor, idioma, nivel, frase, traduccion, es_gratis, precio, moneda, publicado, destacado)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, slug, data.titulo, data.tipo || 'cartilla', data.descripcion || null, data.portadaUrl || null,
     data.color || 'emerald', data.autor || null, data.idioma || 'Inga', data.nivel || null, data.frase || null,
     data.traduccion || null, esGratis, Number(data.precio || 0), data.moneda || 'COP', !!data.publicado, !!data.destacado]
  );
  return obtenerMiCartilla(tenantId, id);
}

export async function obtenerMiCartilla(tenantId: string, id: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM cartillas WHERE id = ? AND tenant_id = ? AND is_active = TRUE`, [id, tenantId]
  );
  if (rows.length === 0) throw new AppError('Cartilla no encontrada', 404);
  return mapCartilla(rows[0]);
}

export async function actualizarCartilla(tenantId: string, id: string, data: any) {
  await obtenerMiCartilla(tenantId, id);
  const fields: Record<string, string> = {
    titulo: 'titulo', tipo: 'tipo', descripcion: 'descripcion', portadaUrl: 'portada_url', color: 'color',
    autor: 'autor', idioma: 'idioma', nivel: 'nivel', frase: 'frase', traduccion: 'traduccion',
    esGratis: 'es_gratis', precio: 'precio', moneda: 'moneda', publicado: 'publicado', destacado: 'destacado',
  };
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, col] of Object.entries(fields)) {
    if (data[k] !== undefined) { sets.push(`${col} = ?`); params.push(data[k]); }
  }
  if (data.precio !== undefined && data.esGratis === undefined) {
    sets.push('es_gratis = ?'); params.push(Number(data.precio) <= 0);
  }
  if (sets.length === 0) return obtenerMiCartilla(tenantId, id);
  params.push(id, tenantId);
  await db.query(`UPDATE cartillas SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
  return obtenerMiCartilla(tenantId, id);
}

export async function eliminarCartilla(tenantId: string, id: string) {
  await obtenerMiCartilla(tenantId, id);
  await db.query(`UPDATE cartillas SET is_active = FALSE WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  return { mensaje: 'Cartilla eliminada' };
}

// ---- Archivos descargables de una cartilla (PDF/Excel/ZIP/TXT/MD…) ----
export async function listarArchivos(cartillaId: string, tenantId?: string) {
  const where: string[] = ['cartilla_id = ?'];
  const params: any[] = [cartillaId];
  if (tenantId) { where.push('tenant_id = ?'); params.push(tenantId); }
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, cartilla_id AS cartillaId, nombre, url, tipo, size_bytes AS sizeBytes, sort_order AS sortOrder
       FROM cartilla_archivos WHERE ${where.join(' AND ')} ORDER BY sort_order ASC, created_at ASC`,
    params
  );
  return rows;
}

export async function crearArchivo(tenantId: string, cartillaId: string, data: any) {
  await obtenerMiCartilla(tenantId, cartillaId); // valida propiedad del comercio
  if (!data?.nombre || !data?.url) throw new AppError('Nombre y URL del archivo son requeridos', 400);
  const id = uuidv4();
  await db.query(
    `INSERT INTO cartilla_archivos (id, tenant_id, cartilla_id, nombre, url, tipo, size_bytes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, tenantId, cartillaId,
      String(data.nombre).slice(0, 200), String(data.url).slice(0, 500),
      data.tipo ? String(data.tipo).slice(0, 30) : null,
      Number.isFinite(+data.sizeBytes) ? +data.sizeBytes : null,
      Number.isFinite(+data.sortOrder) ? +data.sortOrder : 0,
    ]
  );
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, cartilla_id AS cartillaId, nombre, url, tipo, size_bytes AS sizeBytes, sort_order AS sortOrder
       FROM cartilla_archivos WHERE id = ?`,
    [id]
  );
  return rows[0];
}

export async function eliminarArchivo(tenantId: string, id: string) {
  await db.query(`DELETE FROM cartilla_archivos WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  return { mensaje: 'Archivo eliminado' };
}

// ---- Módulos (staff) ----
export async function crearModulo(tenantId: string, cartillaId: string, data: any) {
  await obtenerMiCartilla(tenantId, cartillaId);
  if (!data?.titulo) throw new AppError('El título del módulo es requerido', 400);
  const id = uuidv4();
  const clave = data.clave ? slugify(data.clave) : slugify(data.titulo);
  await db.query(
    `INSERT INTO cartilla_modulos (id, tenant_id, cartilla_id, clave, titulo, icono, color, descripcion, video_url, frase, traduccion, orden)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, cartillaId, clave, data.titulo, data.icono || 'Book', data.color || 'emerald',
     data.descripcion || null, data.videoUrl || data.video_url || null, data.frase || null, data.traduccion || null, data.orden || 0]
  );
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM cartilla_modulos WHERE id = ?`, [id]);
  return mapModulo(rows[0]);
}

export async function actualizarModulo(tenantId: string, moduloId: string, data: any) {
  const fields: Record<string, string> = {
    titulo: 'titulo', icono: 'icono', color: 'color', descripcion: 'descripcion',
    videoUrl: 'video_url', frase: 'frase', traduccion: 'traduccion', orden: 'orden',
  };
  const sets: string[] = []; const params: any[] = [];
  for (const [k, col] of Object.entries(fields)) {
    if (data[k] !== undefined) { sets.push(`${col} = ?`); params.push(data[k]); }
  }
  if (sets.length === 0) throw new AppError('Sin cambios', 400);
  params.push(moduloId, tenantId);
  await db.query(`UPDATE cartilla_modulos SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM cartilla_modulos WHERE id = ?`, [moduloId]);
  if (rows.length === 0) throw new AppError('Módulo no encontrado', 404);
  return mapModulo(rows[0]);
}

export async function eliminarModulo(tenantId: string, moduloId: string) {
  await db.query(`UPDATE cartilla_modulos SET is_active = FALSE WHERE id = ? AND tenant_id = ?`, [moduloId, tenantId]);
  return { mensaje: 'Módulo eliminado' };
}

// ---- Actividades (staff, con detalles) ----
export async function guardarActividad(tenantId: string, moduloId: string, data: any, actId?: string) {
  const [mod] = await db.query<RowDataPacket[]>(`SELECT id FROM cartilla_modulos WHERE id = ? AND tenant_id = ?`, [moduloId, tenantId]);
  if (mod.length === 0) throw new AppError('Módulo no encontrado', 404);

  const id = actId || uuidv4();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (actId) {
      await conn.query(`UPDATE cartilla_actividades SET tipo=?, pregunta=?, respuesta_correcta=?, orden=? WHERE id=? AND modulo_id=?`,
        [data.tipo, data.pregunta, data.respuesta_correcta || null, data.orden || 0, id, moduloId]);
      await conn.query(`DELETE FROM cartilla_actividad_opciones WHERE actividad_id=?`, [id]);
      await conn.query(`DELETE FROM cartilla_actividad_pares WHERE actividad_id=?`, [id]);
      await conn.query(`DELETE FROM cartilla_actividad_vf WHERE actividad_id=?`, [id]);
      await conn.query(`DELETE FROM cartilla_actividad_ordenar WHERE actividad_id=?`, [id]);
    } else {
      await conn.query(`INSERT INTO cartilla_actividades (id, tenant_id, modulo_id, tipo, pregunta, respuesta_correcta, orden) VALUES (?,?,?,?,?,?,?)`,
        [id, tenantId, moduloId, data.tipo, data.pregunta, data.respuesta_correcta || null, data.orden || 0]);
    }
    for (const [i, o] of (data.opciones || []).entries())
      await conn.query(`INSERT INTO cartilla_actividad_opciones (id, actividad_id, texto, orden) VALUES (?,?,?,?)`, [uuidv4(), id, o.texto ?? o, i]);
    for (const p of (data.pares || []))
      await conn.query(`INSERT INTO cartilla_actividad_pares (id, actividad_id, inga, espanol) VALUES (?,?,?,?)`, [uuidv4(), id, p.inga, p.espanol]);
    for (const [i, v] of (data.enunciados_vf || []).entries())
      await conn.query(`INSERT INTO cartilla_actividad_vf (id, actividad_id, enunciado, es_verdadero, orden) VALUES (?,?,?,?,?)`, [uuidv4(), id, v.enunciado, !!v.es_verdadero, i]);
    for (const [i, f] of (data.fragmentos_ordenar || []).entries())
      await conn.query(`INSERT INTO cartilla_actividad_ordenar (id, actividad_id, fragmento, orden_correcto) VALUES (?,?,?,?)`, [uuidv4(), id, f.fragmento ?? f, f.orden_correcto ?? i]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return { id, mensaje: 'Actividad guardada' };
}

export async function listarActividades(tenantId: string, moduloId: string) {
  const [acts] = await db.query<RowDataPacket[]>(`SELECT * FROM cartilla_actividades WHERE modulo_id = ? AND tenant_id = ? ORDER BY orden`, [moduloId, tenantId]);
  return cargarDetallesActividades(acts);
}

export async function eliminarActividad(tenantId: string, actId: string) {
  await db.query(`DELETE FROM cartilla_actividades WHERE id = ? AND tenant_id = ?`, [actId, tenantId]);
  return { mensaje: 'Actividad eliminada' };
}

// ---- Secciones / audios / imágenes de módulo (staff) ----
async function _modSubCreate(table: string, moduloId: string, cols: string[], vals: any[]) {
  const id = uuidv4();
  await db.query(`INSERT INTO ${table} (id, modulo_id, ${cols.join(', ')}) VALUES (?,?,${cols.map(() => '?').join(',')})`, [id, moduloId, ...vals]);
  return id;
}
export async function crearSeccionModulo(moduloId: string, d: any) {
  const id = await _modSubCreate('cartilla_modulo_secciones', moduloId, ['titulo', 'contenido', 'tipo', 'orden'], [d.titulo, d.contenido || null, d.tipo || 'texto', d.orden || 0]);
  return { id, mensaje: 'Sección creada' };
}
export async function crearAudioModulo(moduloId: string, d: any) {
  const id = await _modSubCreate('cartilla_modulo_audios', moduloId, ['titulo', 'url', 'descripcion', 'orden'], [d.titulo, d.url, d.descripcion || null, d.orden || 0]);
  return { id, mensaje: 'Audio creado' };
}
export async function crearImagenModulo(moduloId: string, d: any) {
  const id = await _modSubCreate('cartilla_modulo_imagenes', moduloId, ['url', 'alt', 'caption', 'orden'], [d.url, d.alt || null, d.caption || null, d.orden || 0]);
  return { id, mensaje: 'Imagen creada' };
}

// ---- Vocabulario (staff) ----
export async function listarVocabularioAdmin(tenantId: string, cartillaId?: string) {
  const params: any[] = [tenantId];
  let scope = '';
  if (cartillaId) { scope = 'AND cartilla_id = ?'; params.push(cartillaId); }
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM cartilla_vocabulario WHERE tenant_id = ? ${scope} ORDER BY espanol ASC`, params);
  return rows;
}
export async function crearVocabulario(tenantId: string, d: any) {
  const id = uuidv4();
  await db.query(`INSERT INTO cartilla_vocabulario (id, tenant_id, cartilla_id, modulo_id, espanol, inga, categoria, notas) VALUES (?,?,?,?,?,?,?,?)`,
    [id, tenantId, d.cartilla_id || d.cartillaId || null, d.modulo_id || null, d.espanol, d.inga, d.categoria || 'general', d.notas || null]);
  return { id, mensaje: 'Vocabulario creado' };
}
export async function importarVocabulario(tenantId: string, cartillaId: string | null, pares: { espanol: string; inga: string }[], categoria = 'general') {
  let n = 0;
  for (const p of pares) {
    if (!p.espanol || !p.inga) continue;
    await db.query(`INSERT INTO cartilla_vocabulario (id, tenant_id, cartilla_id, espanol, inga, categoria) VALUES (?,?,?,?,?,?)`,
      [uuidv4(), tenantId, cartillaId, p.espanol, p.inga, categoria]);
    n++;
  }
  return { insertados: n };
}
export async function eliminarVocabulario(tenantId: string, id: string) {
  await db.query(`DELETE FROM cartilla_vocabulario WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  return { mensaje: 'Vocabulario eliminado' };
}

// ---- Retos (staff) ----
export async function listarRetosAdmin(tenantId: string, cartillaId?: string) {
  const params: any[] = [tenantId];
  let scope = '';
  if (cartillaId) { scope = 'AND (cartilla_id = ? OR cartilla_id IS NULL)'; params.push(cartillaId); }
  const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM cartilla_retos WHERE tenant_id = ? ${scope} ORDER BY created_at`, params);
  return rows;
}
export async function crearReto(tenantId: string, d: any) {
  const id = uuidv4();
  await db.query(`INSERT INTO cartilla_retos (id, tenant_id, cartilla_id, titulo, descripcion, puntos, dificultad, categoria, meta, activo) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, d.cartilla_id || d.cartillaId || null, d.titulo, d.descripcion, d.puntos || 0, d.dificultad || 'facil', d.categoria, d.meta || 1, d.activo ?? true]);
  return { id, mensaje: 'Reto creado' };
}
export async function eliminarReto(tenantId: string, id: string) {
  await db.query(`DELETE FROM cartilla_retos WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  return { mensaje: 'Reto eliminado' };
}

// ---- Ventas / compras del comercio (staff) ----
export async function listarComprasTenant(tenantId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT co.id, co.estado, co.precio, co.moneda, co.metodo, co.created_at, co.pagado_en,
            c.titulo AS cartilla, u.name AS usuario
       FROM cartilla_compras co
       JOIN cartillas c ON c.id = co.cartilla_id
       JOIN users u ON u.id = co.usuario_id
      WHERE co.tenant_id = ? ORDER BY co.created_at DESC`,
    [tenantId]
  );
  return rows;
}
