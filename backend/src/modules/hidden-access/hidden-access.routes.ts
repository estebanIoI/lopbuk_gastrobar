import { Router, Request, Response } from 'express'
import { authenticate } from '../../common/middleware'
import {
  generateHiddenAccess,
  regenerateHiddenAccess,
  disableHiddenAccess,
  validateHiddenToken,
  validateHiddenCode,
  getHiddenAccessInfo,
} from './hidden-access.service'

const router = Router()

// ── Rate limiter simple (in-memory, single-instance) ──────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function rateLimit(ip: string, maxPerMin = 5): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= maxPerMin) return false
  entry.count++
  return true
}

// Limpieza periódica para no acumular IPs infinitamente
setInterval(() => {
  const now = Date.now()
  for (const [ip, e] of rateLimitMap) {
    if (e.resetAt < now) rateLimitMap.delete(ip)
  }
}, 5 * 60_000)

// ── PUBLIC: validar token (por QR / deep link) ────────────────────────────────
router.post('/validate-token', async (req: Request, res: Response) => {
  const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown')
  if (!rateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Demasiados intentos. Intenta en un minuto.' })
  }

  const { token } = req.body as { token?: string }
  if (!token || typeof token !== 'string' || token.length > 300) {
    return res.status(400).json({ success: false, error: 'Token inválido' })
  }

  try {
    const result = await validateHiddenToken(token)
    if (!result) return res.status(404).json({ success: false, error: 'Acceso no encontrado o inválido' })
    if (result.expired) return res.status(410).json({ success: false, error: 'Este acceso ha expirado' })
    return res.json({ success: true, data: result })
  } catch {
    return res.status(500).json({ success: false, error: 'Error interno' })
  }
})

// ── PUBLIC: validar código alfanumérico ───────────────────────────────────────
router.post('/validate-code', async (req: Request, res: Response) => {
  const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown')
  if (!rateLimit(ip, 10)) {
    return res.status(429).json({ success: false, error: 'Demasiados intentos. Intenta en un minuto.' })
  }

  const { code } = req.body as { code?: string }
  if (!code || typeof code !== 'string' || code.length > 40) {
    return res.status(400).json({ success: false, error: 'Código inválido' })
  }

  try {
    const result = await validateHiddenCode(code.trim())
    if (!result) return res.status(404).json({ success: false, error: 'Código no encontrado' })
    if (result.expired) return res.status(410).json({ success: false, error: 'Este acceso ha expirado' })
    return res.json({ success: true, data: result })
  } catch {
    return res.status(500).json({ success: false, error: 'Error interno' })
  }
})

// ── PROTECTED (superadmin): generar acceso oculto ─────────────────────────────
router.post('/tenants/:id/generate', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user
  if (user?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Solo superadmin' })
  }

  const tenantId = req.params.id
  const { expiresInDays } = req.body as { expiresInDays?: number }

  try {
    const result = await generateHiddenAccess(tenantId, expiresInDays)
    return res.json({ success: true, data: result })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

// ── PROTECTED (superadmin): regenerar ────────────────────────────────────────
router.post('/tenants/:id/regenerate', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user
  if (user?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Solo superadmin' })
  }

  const tenantId = req.params.id
  const { expiresInDays } = req.body as { expiresInDays?: number }

  try {
    const result = await regenerateHiddenAccess(tenantId, expiresInDays)
    return res.json({ success: true, data: result })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message })
  }
})

// ── PROTECTED (superadmin): desactivar ───────────────────────────────────────
router.post('/tenants/:id/disable', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user
  if (user?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Solo superadmin' })
  }

  try {
    await disableHiddenAccess(req.params.id)
    return res.json({ success: true })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

// ── PROTECTED: leer estado del acceso oculto (superadmin o dueño del tenant) ──
router.get('/tenants/:id', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user
  const tenantId = req.params.id
  if (user?.role !== 'superadmin' && user?.tenantId !== tenantId) {
    return res.status(403).json({ success: false, error: 'Sin acceso' })
  }

  try {
    const info = await getHiddenAccessInfo(tenantId)
    if (!info) return res.status(404).json({ success: false, error: 'Tenant no encontrado' })
    return res.json({ success: true, data: info })
  } catch {
    return res.status(500).json({ success: false, error: 'Error interno' })
  }
})

export default router
