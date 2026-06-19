/**
 * cartillas.routes.ts — Módulo CARTILLA (Cartilla Digital) en Lopbuk.
 *
 * Orden importante para evitar colisiones con el parámetro :cartillaId:
 *   1) STAFF / COMERCIANTE  → rutas '/admin/*' (auth+rol en línea), registradas
 *      PRIMERO para que '/admin/retos' no sea capturado por '/:cartillaId/retos'.
 *   2) PÚBLICO              → catálogo y lectura (auth opcional).
 *   3) MIEMBRO              → resto, tras router.use(authenticate).
 *
 * El área es GLOBAL/cross-tenant: el tenant de negocio se deriva SIEMPRE de la
 * cartilla (su comercio dueño), no del usuario que la consume.
 */
import { Router, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { JWTPayload } from '../../common/types';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import * as svc from './cartillas.service';

const router: ReturnType<typeof Router> = Router();

const ok = (res: Response, data: any, code = 200) => res.status(code).json({ success: true, data });
const fail = (res: Response, e: any, msg: string) => {
  const code = e?.statusCode || 500;
  if (code === 500) console.error(`${msg}:`, e);
  res.status(code).json({ success: false, error: e?.message || msg });
};

/** Auth opcional: si hay token válido, adjunta req.user; si no, continúa. */
const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token =
    req.cookies?.authToken ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : undefined);
  if (token) {
    try { req.user = jwt.verify(token, config.jwt.secret) as JWTPayload; } catch { /* token inválido: anónimo */ }
  }
  next();
};

const STAFF = [authenticate, authorize('comerciante', 'administrador_rb', 'vendedor', 'cajero')];
const uid = (req: AuthRequest) => req.user!.userId as string;
const tid = (req: AuthRequest) => req.user!.tenantId as string;

// ════════════════════════ STAFF / COMERCIANTE (primero) ════════════════════════

router.get('/admin/cartillas', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.listarMisCartillas(tid(req))); }
  catch (e) { fail(res, e, 'Error al listar cartillas'); }
});
router.post('/admin/cartillas', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.crearCartilla(tid(req), req.body), 201); }
  catch (e) { fail(res, e, 'Error al crear cartilla'); }
});
router.put('/admin/cartillas/:id', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.actualizarCartilla(tid(req), req.params.id, req.body)); }
  catch (e) { fail(res, e, 'Error al actualizar cartilla'); }
});
router.delete('/admin/cartillas/:id', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.eliminarCartilla(tid(req), req.params.id)); }
  catch (e) { fail(res, e, 'Error al eliminar cartilla'); }
});

// Módulos
router.post('/admin/cartillas/:id/modulos', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.crearModulo(tid(req), req.params.id, req.body), 201); }
  catch (e) { fail(res, e, 'Error al crear módulo'); }
});
router.put('/admin/modulos/:moduloId', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.actualizarModulo(tid(req), req.params.moduloId, req.body)); }
  catch (e) { fail(res, e, 'Error al actualizar módulo'); }
});
router.delete('/admin/modulos/:moduloId', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.eliminarModulo(tid(req), req.params.moduloId)); }
  catch (e) { fail(res, e, 'Error al eliminar módulo'); }
});

// Actividades
router.get('/admin/modulos/:moduloId/actividades', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.listarActividades(tid(req), req.params.moduloId)); }
  catch (e) { fail(res, e, 'Error al listar actividades'); }
});
router.post('/admin/modulos/:moduloId/actividades', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.guardarActividad(tid(req), req.params.moduloId, req.body), 201); }
  catch (e) { fail(res, e, 'Error al crear actividad'); }
});
router.put('/admin/modulos/:moduloId/actividades/:actId', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.guardarActividad(tid(req), req.params.moduloId, req.body, req.params.actId)); }
  catch (e) { fail(res, e, 'Error al actualizar actividad'); }
});
router.delete('/admin/actividades/:actId', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.eliminarActividad(tid(req), req.params.actId)); }
  catch (e) { fail(res, e, 'Error al eliminar actividad'); }
});

// Contenido rico del módulo
router.post('/admin/modulos/:moduloId/secciones', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.crearSeccionModulo(req.params.moduloId, req.body), 201); }
  catch (e) { fail(res, e, 'Error al crear sección'); }
});
router.post('/admin/modulos/:moduloId/audios', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.crearAudioModulo(req.params.moduloId, req.body), 201); }
  catch (e) { fail(res, e, 'Error al crear audio'); }
});
router.post('/admin/modulos/:moduloId/imagenes', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.crearImagenModulo(req.params.moduloId, req.body), 201); }
  catch (e) { fail(res, e, 'Error al crear imagen'); }
});

// Vocabulario
router.get('/admin/vocabulario', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.listarVocabularioAdmin(tid(req), req.query.cartilla_id as string)); }
  catch (e) { fail(res, e, 'Error al listar vocabulario'); }
});
router.post('/admin/vocabulario', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.crearVocabulario(tid(req), req.body), 201); }
  catch (e) { fail(res, e, 'Error al crear vocabulario'); }
});
router.post('/admin/vocabulario/importar', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.importarVocabulario(tid(req), req.body?.cartilla_id || null, req.body?.pares || [], req.body?.categoria)); }
  catch (e) { fail(res, e, 'Error al importar vocabulario'); }
});
router.delete('/admin/vocabulario/:id', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.eliminarVocabulario(tid(req), req.params.id)); }
  catch (e) { fail(res, e, 'Error al eliminar vocabulario'); }
});

// Retos
router.get('/admin/retos', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.listarRetosAdmin(tid(req), req.query.cartilla_id as string)); }
  catch (e) { fail(res, e, 'Error al listar retos'); }
});
router.post('/admin/retos', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.crearReto(tid(req), req.body), 201); }
  catch (e) { fail(res, e, 'Error al crear reto'); }
});
router.delete('/admin/retos/:id', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.eliminarReto(tid(req), req.params.id)); }
  catch (e) { fail(res, e, 'Error al eliminar reto'); }
});

// Ventas + confirmación de pago
router.get('/admin/ventas', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.listarComprasTenant(tid(req))); }
  catch (e) { fail(res, e, 'Error al listar ventas'); }
});
router.post('/admin/compras/:compraId/confirmar', STAFF, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.confirmarCompra(req.params.compraId, req.body?.referencia)); }
  catch (e) { fail(res, e, 'Error al confirmar compra'); }
});

// ════════════════════════ PÚBLICO ════════════════════════

router.get('/catalogo', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    ok(res, await svc.listarCatalogo({
      tipo: req.query.tipo as string,
      q: req.query.q as string,
      tenantId: req.query.comercio as string,
      destacado: req.query.destacado === 'true',
      page: req.query.page ? Number(req.query.page) : 1,
    }));
  } catch (e) { fail(res, e, 'Error al listar el catálogo'); }
});

router.get('/catalogo/:slug', optionalAuth, async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.obtenerCartillaPublica(req.params.slug, req.user?.userId)); }
  catch (e) { fail(res, e, 'Error al obtener la cartilla'); }
});

// Comentarios (lectura pública)
router.get('/comunidad/:pubId/comentarios', async (req, res) => {
  try { ok(res, await svc.listarComentarios(req.params.pubId)); }
  catch (e) { fail(res, e, 'Error al listar comentarios'); }
});

router.get('/:cartillaId/modulos', async (req, res) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.listarModulos(c.id));
  } catch (e) { fail(res, e, 'Error al listar módulos'); }
});
router.get('/:cartillaId/modulos/:clave', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.obtenerModulo(c.id, req.params.clave, req.user?.userId));
  } catch (e) { fail(res, e, 'Error al obtener el módulo'); }
});
router.get('/:cartillaId/vocabulario', async (req, res) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId).catch(() => null);
    ok(res, await svc.buscarVocabulario(c?.id, req.query.q as string));
  } catch (e) { fail(res, e, 'Error en la búsqueda'); }
});
router.get('/:cartillaId/top', async (req, res) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.topAprendices(c.id));
  } catch (e) { fail(res, e, 'Error al obtener ranking'); }
});
router.get('/:cartillaId/activos', async (req, res) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.miembrosActivos(c.id));
  } catch (e) { fail(res, e, 'Error al obtener miembros'); }
});
router.get('/:cartillaId/retos', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.listarRetos(c.id, c.tenant_id, req.user?.userId));
  } catch (e) { fail(res, e, 'Error al obtener retos'); }
});
router.get('/:cartillaId/comunidad', async (req, res) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.listarPublicaciones(c.id, req.query.page ? Number(req.query.page) : 1));
  } catch (e) { fail(res, e, 'Error al listar publicaciones'); }
});

// ════════════════════════ MIEMBRO (autenticado) ════════════════════════
router.use(authenticate);

router.get('/mis-compras', async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.misCompras(uid(req))); }
  catch (e) { fail(res, e, 'Error al obtener compras'); }
});

router.get('/:cartillaId/stats', async (req: AuthRequest, res: Response) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.statsUsuario(uid(req), c.id));
  } catch (e) { fail(res, e, 'Error al obtener estadísticas'); }
});
router.get('/:cartillaId/progreso', async (req: AuthRequest, res: Response) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.getProgreso(uid(req), c.id, c.tenant_id));
  } catch (e) { fail(res, e, 'Error al obtener progreso'); }
});
router.get('/:cartillaId/modulos/:clave/progreso', async (req: AuthRequest, res: Response) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.progresoModulo(uid(req), c.id, req.params.clave));
  } catch (e) { fail(res, e, 'Error al obtener progreso del módulo'); }
});

router.post('/:cartillaId/modulos/:clave/responder', async (req: AuthRequest, res: Response) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.responder(uid(req), c.tenant_id, c.id, req.params.clave, req.body?.respuesta));
  } catch (e) { fail(res, e, 'Error al responder'); }
});

router.post('/:cartillaId/comunidad', async (req: AuthRequest, res: Response) => {
  try {
    const c = await svc.resolverCartilla(req.params.cartillaId);
    ok(res, await svc.crearPublicacion(uid(req), c.tenant_id, c.id, req.body?.contenido), 201);
  } catch (e) { fail(res, e, 'Error al crear publicación'); }
});
router.post('/comunidad/:pubId/like', async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.toggleLike(uid(req), req.params.pubId)); }
  catch (e) { fail(res, e, 'Error al dar like'); }
});
router.post('/comunidad/:pubId/comentarios', async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.crearComentario(uid(req), req.params.pubId, req.body?.contenido), 201); }
  catch (e) { fail(res, e, 'Error al comentar'); }
});

router.post('/:cartillaId/comprar', async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.comprarCartilla(uid(req), req.params.cartillaId, req.body?.metodo || 'manual'), 201); }
  catch (e) { fail(res, e, 'Error al adquirir la cartilla'); }
});

export default router;
