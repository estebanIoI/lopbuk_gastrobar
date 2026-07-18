import { Router } from 'express'
import { authenticate, authorize } from '../../common/middleware'
import * as svc from './exercises.service'

const router = Router()

// ── Listado + filtros (admin y constructor de rutinas) ──
router.get('/', async (req, res, next) => {
  try {
    const { search, bodyPart, equipment, tag, lang, active, limit, offset } = req.query as Record<string, string>
    const result = await svc.listExercises({
      search, bodyPart, equipment, tag, lang,
      activeOnly: active === '1' || active === 'true',
      limit: Number(limit),
      offset: Number(offset),
    })
    res.json({ success: true, ...result })
  } catch (e) { next(e) }
})

router.get('/filters', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getFilters() })
  } catch (e) { next(e) }
})

// Analíticas de la librería (P6) — va antes de '/:id' para no ser capturada.
router.get('/stats', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getLibraryStats() })
  } catch (e) { next(e) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const lang = (req.query.lang as string) || svc.DEFAULT_LANG
    const ex = await svc.getExercise(req.params.id, lang)
    if (!ex) { res.status(404).json({ success: false, error: 'Ejercicio no encontrado' }); return }
    res.json({ success: true, data: ex })
  } catch (e) { next(e) }
})

// ── Admin: activar/ocultar, dificultad y textos por idioma ──
router.patch('/:id', authenticate, authorize('superadmin'), async (req, res, next) => {
  try {
    const { isActive, difficulty, name, instructions, tips, mistakes, lang } = req.body || {}
    const ex = await svc.updateExercise(
      req.params.id,
      { isActive, difficulty, name, instructions, tips, mistakes },
      lang || svc.DEFAULT_LANG,
    )
    res.json({ success: true, data: ex })
  } catch (e) { next(e) }
})

export default router
