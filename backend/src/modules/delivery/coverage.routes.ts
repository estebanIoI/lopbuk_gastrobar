import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

const router: ReturnType<typeof Router> = Router();

// ── Point-in-polygon (ray casting) ──────────────────────────────────────────
function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Haversine distance (km) ──────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Centro del polígono (average) ────────────────────────────────────────────
function polygonCenter(polygon: [number, number][]): [number, number] {
  const lat = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  return [lat, lng];
}

// =============================================================================
// POST /api/coverage/check — público, valida cobertura por lat/lng (no auth)
// =============================================================================
router.post(
  '/check',
  [
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { lat, lng, tenantId } = req.body as { lat: number; lng: number; tenantId?: string };

      let sql = 'SELECT id, name, city, polygon, delivery_fee_base as deliveryFeeBase, min_order_amount as minOrderAmount, estimated_minutes as estimatedMinutes, max_radius_km as maxRadiusKm, tenant_id as tenantId FROM delivery_zones WHERE is_active = 1';
      const params: any[] = [];
      if (tenantId) { sql += ' AND tenant_id = ?'; params.push(tenantId); }

      const [zones] = await pool.query(sql, params) as any;

      const covered: any[] = [];

      for (const zone of zones as any[]) {
        let inZone = false;

        if (zone.polygon) {
          try {
            const poly: [number, number][] = JSON.parse(zone.polygon);
            if (poly.length >= 3) {
              inZone = pointInPolygon(lat, lng, poly);
            } else if (zone.maxRadiusKm) {
              const center = polygonCenter(poly);
              inZone = haversineKm(lat, lng, center[0], center[1]) <= Number(zone.maxRadiusKm);
            }
          } catch {}
        } else if (zone.maxRadiusKm) {
          // Zona sin polígono — no se puede validar sin un centro
          inZone = false;
        }

        if (inZone) {
          covered.push({
            id: zone.id,
            name: zone.name,
            city: zone.city,
            tenantId: zone.tenantId,
            deliveryFeeBase: Number(zone.deliveryFeeBase),
            minOrderAmount: Number(zone.minOrderAmount),
            estimatedMinutes: zone.estimatedMinutes,
          });
        }
      }

      const hasCoverage = covered.length > 0;

      res.json({
        success: true,
        data: {
          covered: hasCoverage,
          zones: covered,
          message: hasCoverage
            ? `✅ Domicilios disponibles en tu zona`
            : `⚠️ Aún no tenemos cobertura en esta zona. Estamos expandiendo DAIMUZ Delivery Network.`,
        },
      });
    } catch (error: any) {
      console.error('Coverage check error:', error);
      res.status(500).json({ success: false, error: 'Error al verificar cobertura' });
    }
  }
);

// Todas las rutas de gestión de zonas requieren auth
router.use(authenticate);

// =============================================================================
// GET /api/coverage/zones — listar zonas del tenant
// =============================================================================
router.get(
  '/zones',
  authorize('comerciante', 'superadmin', 'administrador_rb'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const [zones] = await pool.query(
        `SELECT id, tenant_id as tenantId, name, city, polygon, is_active as isActive,
                delivery_fee_base as deliveryFeeBase, max_radius_km as maxRadiusKm,
                min_order_amount as minOrderAmount, estimated_minutes as estimatedMinutes,
                color, created_at as createdAt
         FROM delivery_zones
         WHERE tenant_id = ?
         ORDER BY city, name`,
        [tenantId]
      ) as any;

      res.json({ success: true, data: zones });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Error al obtener zonas' });
    }
  }
);

// =============================================================================
// POST /api/coverage/zones — crear zona
// =============================================================================
router.post(
  '/zones',
  authorize('comerciante', 'superadmin'),
  [
    body('name').notEmpty().withMessage('Nombre requerido'),
    body('city').notEmpty().withMessage('Ciudad requerida'),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const {
        name, city, polygon, deliveryFeeBase = 0, maxRadiusKm,
        minOrderAmount = 0, estimatedMinutes = 30, color = '#3B82F6',
      } = req.body;

      const id = uuidv4();
      await pool.query(
        `INSERT INTO delivery_zones
           (id, tenant_id, name, city, polygon, delivery_fee_base, max_radius_km, min_order_amount, estimated_minutes, color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, tenantId, name, city,
          polygon ? JSON.stringify(polygon) : null,
          deliveryFeeBase, maxRadiusKm || null, minOrderAmount, estimatedMinutes, color,
        ]
      );

      res.json({ success: true, data: { id } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Error al crear zona' });
    }
  }
);

// =============================================================================
// PUT /api/coverage/zones/:id — actualizar zona
// =============================================================================
router.put(
  '/zones/:id',
  authorize('comerciante', 'superadmin'),
  [param('id').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const {
        name, city, polygon, deliveryFeeBase, maxRadiusKm,
        minOrderAmount, estimatedMinutes, color, isActive,
      } = req.body;

      const sets: string[] = [];
      const vals: any[] = [];
      if (name !== undefined)              { sets.push('name = ?');              vals.push(name); }
      if (city !== undefined)              { sets.push('city = ?');              vals.push(city); }
      if (polygon !== undefined)           { sets.push('polygon = ?');           vals.push(polygon ? JSON.stringify(polygon) : null); }
      if (deliveryFeeBase !== undefined)   { sets.push('delivery_fee_base = ?'); vals.push(deliveryFeeBase); }
      if (maxRadiusKm !== undefined)       { sets.push('max_radius_km = ?');     vals.push(maxRadiusKm || null); }
      if (minOrderAmount !== undefined)    { sets.push('min_order_amount = ?');  vals.push(minOrderAmount); }
      if (estimatedMinutes !== undefined)  { sets.push('estimated_minutes = ?'); vals.push(estimatedMinutes); }
      if (color !== undefined)             { sets.push('color = ?');             vals.push(color); }
      if (isActive !== undefined)          { sets.push('is_active = ?');         vals.push(isActive ? 1 : 0); }

      if (sets.length === 0) { res.json({ success: true }); return; }

      vals.push(id, tenantId);
      await pool.query(`UPDATE delivery_zones SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Error al actualizar zona' });
    }
  }
);

// =============================================================================
// DELETE /api/coverage/zones/:id — desactivar zona (soft)
// =============================================================================
router.delete(
  '/zones/:id',
  authorize('comerciante', 'superadmin'),
  [param('id').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      await pool.query(
        'UPDATE delivery_zones SET is_active = 0 WHERE id = ? AND tenant_id = ?',
        [id, tenantId]
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Error al eliminar zona' });
    }
  }
);

export default router;
