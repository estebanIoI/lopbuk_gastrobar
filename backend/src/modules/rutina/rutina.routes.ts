/**
 * rutina.routes.ts
 * Endpoints del módulo CONSUMIDOR (rutina/estilo de vida).
 * Todas requieren sesión de cliente. Los datos se filtran por el userId del JWT.
 */
import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import * as svc from './rutina.service';
import { runAssistant, isPlatformAssistantEnabled } from './rutina.assistant';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(authorize('cliente'));

const ok  = (res: Response, data: any) => res.json({ success: true, data });
const fail = (res: Response, e: any, msg: string) => {
  const code = e?.statusCode || 500;
  if (code === 500) console.error(`${msg}:`, e);
  res.status(code).json({ success: false, error: e?.message || msg });
};

// ── Asistente IA (solo si la plataforma lo tiene habilitado) ──
router.get('/assistant/status', async (_req: AuthRequest, res) => {
  try { ok(res, { enabled: await isPlatformAssistantEnabled() }); }
  catch (e) { fail(res, e, 'Error al consultar el asistente'); }
});
router.post('/assistant', async (req: AuthRequest, res) => {
  try {
    if (!(await isPlatformAssistantEnabled())) {
      res.status(403).json({ success: false, error: 'El asistente no está habilitado' });
      return;
    }
    const { message, history } = req.body || {};
    if (!message?.trim()) { res.status(400).json({ success: false, error: 'Mensaje requerido' }); return; }
    ok(res, await runAssistant(req.user!.userId, message.trim(), history || []));
  } catch (e) { fail(res, e, 'Error en el asistente'); }
});

// ── Resumen (home del consumidor) ──
router.get('/resumen', async (req: AuthRequest, res) => {
  try { ok(res, await svc.getResumen(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener resumen'); }
});

// ── Perfil ──
router.get('/perfil', async (req: AuthRequest, res) => {
  try { ok(res, await svc.getPerfil(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener perfil'); }
});
router.put('/perfil', async (req: AuthRequest, res) => {
  try { ok(res, await svc.upsertPerfil(req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al guardar perfil'); }
});

// ── Despensa ──
router.get('/despensa', async (req: AuthRequest, res) => {
  try { ok(res, await svc.listDespensa(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener despensa'); }
});
router.post('/despensa', async (req: AuthRequest, res) => {
  try { ok(res, await svc.addDespensa(req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al agregar a la despensa'); }
});
router.put('/despensa/:id', async (req: AuthRequest, res) => {
  try { ok(res, await svc.updateDespensa(req.user!.userId, req.params.id, req.body)); }
  catch (e) { fail(res, e, 'Error al actualizar ítem'); }
});
router.delete('/despensa/:id', async (req: AuthRequest, res) => {
  try { await svc.deleteDespensa(req.user!.userId, req.params.id); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar ítem'); }
});

// ── Recetas ──
router.get('/recetas', async (req: AuthRequest, res) => {
  try { ok(res, await svc.listRecetas(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener recetas'); }
});
router.get('/recetas/puedo-hacer', async (req: AuthRequest, res) => {
  try { ok(res, await svc.recetasQuePuedoHacer(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al calcular recetas'); }
});
router.get('/recetas/:id', async (req: AuthRequest, res) => {
  try { ok(res, await svc.getReceta(req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al obtener receta'); }
});
router.post('/recetas', async (req: AuthRequest, res) => {
  try { ok(res, await svc.createReceta(req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al crear receta'); }
});
router.delete('/recetas/:id', async (req: AuthRequest, res) => {
  try { await svc.deleteReceta(req.user!.userId, req.params.id); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar receta'); }
});
router.post('/recetas/:id/a-lista-compras', async (req: AuthRequest, res) => {
  try { ok(res, await svc.generarComprasDesdeReceta(req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al generar lista de compras'); }
});

// ── Rutinas + actividades ──
router.get('/rutinas', async (req: AuthRequest, res) => {
  try { ok(res, await svc.listRutinas(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener rutinas'); }
});
router.post('/rutinas', async (req: AuthRequest, res) => {
  try { ok(res, await svc.createRutina(req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al crear rutina'); }
});
router.delete('/rutinas/:id', async (req: AuthRequest, res) => {
  try { await svc.deleteRutina(req.user!.userId, req.params.id); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar rutina'); }
});
router.post('/rutinas/:id/actividades', async (req: AuthRequest, res) => {
  try { ok(res, await svc.addActividad(req.user!.userId, req.params.id, req.body)); }
  catch (e) { fail(res, e, 'Error al agregar actividad'); }
});
router.delete('/actividades/:id', async (req: AuthRequest, res) => {
  try { await svc.deleteActividad(req.user!.userId, req.params.id); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar actividad'); }
});
router.get('/actividades-log', async (req: AuthRequest, res) => {
  try { ok(res, await svc.getActividadesLog(req.user!.userId, req.query.from as string, req.query.to as string)); }
  catch (e) { fail(res, e, 'Error al obtener cumplimiento'); }
});
router.post('/actividades/:id/toggle-log', async (req: AuthRequest, res) => {
  try { ok(res, await svc.toggleActividadLog(req.user!.userId, req.params.id, req.body?.date)); }
  catch (e) { fail(res, e, 'Error al marcar actividad'); }
});

// ── Plan de comidas ──
router.get('/plan-comidas', async (req: AuthRequest, res) => {
  try { ok(res, await svc.listPlanComidas(req.user!.userId, req.query.from as string, req.query.to as string)); }
  catch (e) { fail(res, e, 'Error al obtener plan de comidas'); }
});
router.post('/plan-comidas', async (req: AuthRequest, res) => {
  try { ok(res, await svc.addPlanComida(req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al agregar comida'); }
});
router.patch('/plan-comidas/:id/toggle', async (req: AuthRequest, res) => {
  try { ok(res, await svc.togglePlanComida(req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al actualizar comida'); }
});
router.delete('/plan-comidas/:id', async (req: AuthRequest, res) => {
  try { await svc.deletePlanComida(req.user!.userId, req.params.id); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar comida'); }
});

// ── Lista de compras ──
router.get('/lista-compras', async (req: AuthRequest, res) => {
  try { ok(res, await svc.listCompras(req.user!.userId)); }
  catch (e) { fail(res, e, 'Error al obtener lista de compras'); }
});
router.post('/lista-compras', async (req: AuthRequest, res) => {
  try { ok(res, await svc.addCompra(req.user!.userId, req.body)); }
  catch (e) { fail(res, e, 'Error al agregar a la lista'); }
});
router.patch('/lista-compras/:id/toggle', async (req: AuthRequest, res) => {
  try { ok(res, await svc.toggleCompra(req.user!.userId, req.params.id)); }
  catch (e) { fail(res, e, 'Error al actualizar ítem'); }
});
router.delete('/lista-compras/:id', async (req: AuthRequest, res) => {
  try { await svc.deleteCompra(req.user!.userId, req.params.id); ok(res, { deleted: true }); }
  catch (e) { fail(res, e, 'Error al eliminar ítem'); }
});

export default router;
