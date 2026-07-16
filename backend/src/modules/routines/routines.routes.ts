import { Router } from 'express'
import { authenticate, authorize } from '../../common/middleware'
import * as svc from './routines.service'

const router = Router()
const admin = [authenticate, authorize('superadmin')]

// ── Lectura ──
router.get('/', async (_req, res, next) => {
  try { res.json({ success: true, data: await svc.listRoutines() }) } catch (e) { next(e) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const r = await svc.getRoutine(req.params.id, (req.query.lang as string) || undefined)
    if (!r) { res.status(404).json({ success: false, error: 'Rutina no encontrada' }); return }
    res.json({ success: true, data: r })
  } catch (e) { next(e) }
})

// ── Admin: rutina ──
router.post('/', ...admin, async (req, res, next) => {
  try {
    const { name } = req.body || {}
    if (!name || !String(name).trim()) { res.status(400).json({ success: false, error: 'El nombre es requerido' }); return }
    res.json({ success: true, data: await svc.createRoutine(req.body) })
  } catch (e) { next(e) }
})

router.put('/:id', ...admin, async (req, res, next) => {
  try { res.json({ success: true, data: await svc.updateRoutine(req.params.id, req.body || {}) }) } catch (e) { next(e) }
})

router.delete('/:id', ...admin, async (req, res, next) => {
  try { res.json({ success: true, data: await svc.deleteRoutine(req.params.id) }) } catch (e) { next(e) }
})

// ── Admin: versiones ──
// Abre (o reutiliza) un borrador clonando la última versión.
router.post('/:id/draft', ...admin, async (req, res, next) => {
  try { res.json({ success: true, data: await svc.newDraft(req.params.id) }) } catch (e) { next(e) }
})

// Reemplaza los ejercicios del borrador (orden = orden del array).
router.put('/versions/:versionId/exercises', ...admin, async (req, res, next) => {
  try {
    const list = Array.isArray(req.body?.exercises) ? req.body.exercises : []
    const r = await svc.setVersionExercises(req.params.versionId, list)
    if ((r as any)?.error) { res.status(400).json({ success: false, error: (r as any).error }); return }
    res.json({ success: true, data: r })
  } catch (e) { next(e) }
})

// Publica el borrador (lo congela y archiva la publicada anterior).
router.post('/versions/:versionId/publish', ...admin, async (req, res, next) => {
  try {
    const r = await svc.publishVersion(req.params.versionId)
    if ((r as any)?.error) { res.status(400).json({ success: false, error: (r as any).error }); return }
    res.json({ success: true, data: r })
  } catch (e) { next(e) }
})

export default router
