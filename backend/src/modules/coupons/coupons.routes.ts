import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';

const router: ReturnType<typeof Router> = Router();

// =============================================
// PUBLIC: Validar cupón desde el storefront (sin auth)
// =============================================
router.post(
    '/validate',
    [
        body('code').notEmpty().withMessage('Código de cupón requerido'),
        body('subtotal').isFloat({ min: 0 }).withMessage('Subtotal inválido'),
        validateRequest,
    ],
    async (req: Request, res: Response, _next: NextFunction) => {
        try {
            const { code, subtotal } = req.body;

            const [coupons] = await pool.query(
                `SELECT * FROM discount_coupons 
         WHERE code = ? AND is_active = 1`,
                [code.toUpperCase()]
            ) as any;

            if (!coupons || coupons.length === 0) {
                res.json({
                    success: true,
                    data: {
                        valido: false,
                        mensaje: 'Cupón no encontrado o inactivo',
                    },
                });
                return;
            }

            const coupon = coupons[0];

            // Check expiry
            if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
                res.json({
                    success: true,
                    data: {
                        valido: false,
                        mensaje: 'Este cupón ha expirado',
                    },
                });
                return;
            }

            // Check usage limit
            if (coupon.max_uses !== null && coupon.times_used >= coupon.max_uses) {
                res.json({
                    success: true,
                    data: {
                        valido: false,
                        mensaje: 'Este cupón ya alcanzó su límite de usos',
                    },
                });
                return;
            }

            // Check minimum purchase
            if (coupon.min_purchase && subtotal < Number(coupon.min_purchase)) {
                res.json({
                    success: true,
                    data: {
                        valido: false,
                        mensaje: `Compra mínima de $${Number(coupon.min_purchase).toLocaleString('es-CO')} requerida`,
                    },
                });
                return;
            }

            // Calculate discount
            let descuento = 0;
            if (coupon.discount_type === 'porcentaje') {
                descuento = Math.round(subtotal * (Number(coupon.discount_value) / 100));
            } else {
                descuento = Math.min(Number(coupon.discount_value), subtotal);
            }

            res.json({
                success: true,
                data: {
                    valido: true,
                    mensaje: `Cupón aplicado: ${coupon.discount_type === 'porcentaje' ? `${coupon.discount_value}% de descuento` : `$${Number(coupon.discount_value).toLocaleString('es-CO')} de descuento`}`,
                    descuento,
                    tipo: coupon.discount_type,
                    couponId: coupon.id,
                },
            });
        } catch (error) {
            console.error('Validate coupon error:', error);
            res.status(500).json({ success: false, error: 'Error al validar cupón' });
        }
    }
);

// =============================================
// PUBLIC: Registrar uso de cupón (llamado al confirmar pedido)
// =============================================
router.post(
    '/use',
    [
        body('code').notEmpty().withMessage('Código de cupón requerido'),
        validateRequest,
    ],
    async (req: Request, res: Response, _next: NextFunction) => {
        try {
            const { code } = req.body;

            await pool.query(
                `UPDATE discount_coupons SET times_used = times_used + 1 WHERE code = ? AND is_active = 1`,
                [code.toUpperCase()]
            );

            res.json({ success: true, message: 'Uso de cupón registrado' });
        } catch (error) {
            console.error('Use coupon error:', error);
            res.status(500).json({ success: false, error: 'Error al registrar uso de cupón' });
        }
    }
);

// =============================================
// AUTHENTICATED: CRUD completo de cupones
// =============================================
router.use(authenticate);

// GET /api/coupons — Listar cupones del tenant
router.get(
    '/',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('search').optional().notEmpty(),
        validateRequest,
    ],
    async (req: Request, res: Response, _next: NextFunction) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = (page - 1) * limit;
            const search = req.query.search as string | undefined;

            let whereClause = 'WHERE tenant_id = ?';
            const params: any[] = [tenantId];

            if (search) {
                whereClause += ' AND (code LIKE ? OR description LIKE ?)';
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm);
            }

            const [countResult] = await pool.query(
                `SELECT COUNT(*) as total FROM discount_coupons ${whereClause}`,
                params
            ) as any;
            const total = countResult[0].total;

            const [coupons] = await pool.query(
                `SELECT id, code, description, discount_type as discountType, 
                discount_value as discountValue, min_purchase as minPurchase,
                max_uses as maxUses, times_used as timesUsed, 
                is_active as isActive, expires_at as expiresAt,
                created_at as createdAt, updated_at as updatedAt
         FROM discount_coupons
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            ) as any;

            // Convert isActive from buffer/tinyint to boolean
            const data = (coupons as any[]).map((c: any) => ({
                ...c,
                isActive: Number(c.isActive) === 1,
            }));

            res.json({
                success: true,
                data: {
                    coupons: data,
                    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
                },
            });
        } catch (error) {
            console.error('Get coupons error:', error);
            res.status(500).json({ success: false, error: 'Error al obtener cupones' });
        }
    }
);

// POST /api/coupons — Crear cupón
router.post(
    '/',
    [
        body('code').notEmpty().withMessage('Código del cupón es requerido'),
        body('discountType').isIn(['porcentaje', 'fijo']).withMessage('Tipo de descuento inválido'),
        body('discountValue').isFloat({ min: 0.01 }).withMessage('Valor de descuento inválido'),
        body('description').optional().notEmpty(),
        body('minPurchase').optional().isFloat({ min: 0 }),
        body('maxUses').optional().isInt({ min: 1 }),
        body('expiresAt').optional().isISO8601(),
        validateRequest,
    ],
    async (req: Request, res: Response, _next: NextFunction) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const {
                code, description, discountType, discountValue,
                minPurchase, maxUses, expiresAt,
            } = req.body;

            const couponCode = code.toUpperCase().replace(/\s/g, '');

            // Check duplicate code within tenant
            const [existing] = await pool.query(
                'SELECT id FROM discount_coupons WHERE code = ? AND tenant_id = ?',
                [couponCode, tenantId]
            ) as any;

            if (existing && existing.length > 0) {
                res.status(400).json({ success: false, error: 'Ya existe un cupón con ese código' });
                return;
            }

            const id = uuidv4();

            await pool.query(
                `INSERT INTO discount_coupons 
          (id, tenant_id, code, description, discount_type, discount_value, min_purchase, max_uses, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    id, tenantId, couponCode, description || null,
                    discountType, discountValue, minPurchase || null,
                    maxUses || null, expiresAt || null,
                ]
            );

            res.status(201).json({
                success: true,
                data: {
                    id,
                    code: couponCode,
                    discountType,
                    discountValue,
                    description: description || null,
                    minPurchase: minPurchase || null,
                    maxUses: maxUses || null,
                    timesUsed: 0,
                    isActive: true,
                    expiresAt: expiresAt || null,
                },
            });
        } catch (error) {
            console.error('Create coupon error:', error);
            res.status(500).json({ success: false, error: 'Error al crear cupón' });
        }
    }
);

// PUT /api/coupons/:id — Actualizar cupón
router.put(
    '/:id',
    [
        param('id').notEmpty(),
        body('description').optional(),
        body('discountType').optional().isIn(['porcentaje', 'fijo']),
        body('discountValue').optional().isFloat({ min: 0.01 }),
        body('minPurchase').optional(),
        body('maxUses').optional(),
        body('expiresAt').optional(),
        body('isActive').optional().isBoolean(),
        validateRequest,
    ],
    async (req: Request, res: Response, _next: NextFunction) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const couponId = req.params.id;
            const updates = req.body;

            // Build dynamic update
            const fields: string[] = [];
            const values: any[] = [];

            if (updates.description !== undefined) {
                fields.push('description = ?');
                values.push(updates.description || null);
            }
            if (updates.discountType !== undefined) {
                fields.push('discount_type = ?');
                values.push(updates.discountType);
            }
            if (updates.discountValue !== undefined) {
                fields.push('discount_value = ?');
                values.push(updates.discountValue);
            }
            if (updates.minPurchase !== undefined) {
                fields.push('min_purchase = ?');
                values.push(updates.minPurchase || null);
            }
            if (updates.maxUses !== undefined) {
                fields.push('max_uses = ?');
                values.push(updates.maxUses || null);
            }
            if (updates.expiresAt !== undefined) {
                fields.push('expires_at = ?');
                values.push(updates.expiresAt || null);
            }
            if (updates.isActive !== undefined) {
                fields.push('is_active = ?');
                values.push(updates.isActive ? 1 : 0);
            }

            if (fields.length === 0) {
                res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
                return;
            }

            values.push(couponId, tenantId);

            const [result] = await pool.query(
                `UPDATE discount_coupons SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
                values
            ) as any;

            if (result.affectedRows === 0) {
                res.status(404).json({ success: false, error: 'Cupón no encontrado' });
                return;
            }

            res.json({ success: true, message: 'Cupón actualizado correctamente' });
        } catch (error) {
            console.error('Update coupon error:', error);
            res.status(500).json({ success: false, error: 'Error al actualizar cupón' });
        }
    }
);

// DELETE /api/coupons/:id — Eliminar cupón
router.delete(
    '/:id',
    async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const couponId = req.params.id;

            const [result] = await pool.query(
                'DELETE FROM discount_coupons WHERE id = ? AND tenant_id = ?',
                [couponId, tenantId]
            ) as any;

            if (result.affectedRows === 0) {
                res.status(404).json({ success: false, error: 'Cupón no encontrado' });
                return;
            }

            res.json({ success: true, message: 'Cupón eliminado correctamente' });
        } catch (error) {
            console.error('Delete coupon error:', error);
            res.status(500).json({ success: false, error: 'Error al eliminar cupón' });
        }
    }
);

// POST /api/coupons/seed-defaults — Generar cupones estándar (10%, 20%, 30%)
router.post(
    '/seed-defaults',
    async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;

            const defaults = [
                { code: 'DESC10', value: 10, desc: 'Descuento del 10%' },
                { code: 'DESC20', value: 20, desc: 'Descuento del 20%' },
                { code: 'DESC30', value: 30, desc: 'Descuento del 30%' },
            ];

            const created: any[] = [];

            for (const d of defaults) {
                // Skip if already exists
                const [existing] = await pool.query(
                    'SELECT id FROM discount_coupons WHERE code = ? AND tenant_id = ?',
                    [d.code, tenantId]
                ) as any;

                if (existing && existing.length > 0) continue;

                const id = uuidv4();
                await pool.query(
                    `INSERT INTO discount_coupons 
            (id, tenant_id, code, description, discount_type, discount_value, is_active)
           VALUES (?, ?, ?, ?, 'porcentaje', ?, 1)`,
                    [id, tenantId, d.code, d.desc, d.value]
                );

                created.push({ id, code: d.code, discountValue: d.value });
            }

            res.json({
                success: true,
                data: created,
                message: `${created.length} cupones estándar creados`,
            });
        } catch (error) {
            console.error('Seed default coupons error:', error);
            res.status(500).json({ success: false, error: 'Error al crear cupones estándar' });
        }
    }
);

export const couponsRoutes: ReturnType<typeof Router> = router;
