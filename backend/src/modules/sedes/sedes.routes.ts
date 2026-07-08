import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import sedesService from './sedes.service';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

const tenantOf = (req: Request) => (req as any).user!.tenantId! as string;
const userOf = (req: Request) => (req as any).user!.userId as string;

// GET /api/sedes — listar todas las sedes del tenant (con tipo, encargado y personal)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await sedesService.listSedes(tenantOf(req), req.query.all === '1');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Multibodega: stock por sede ───────────────────────────────────────────────

// GET /api/sedes/stock-matrix?search= — desglose de stock de todos los productos por sede
router.get('/stock-matrix', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await sedesService.getStockMatrix(tenantOf(req), req.query.search as string | undefined);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/sedes/low-stock?sedeId= — productos bajo su mínimo por sede
router.get('/low-stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await sedesService.lowStockBySede(tenantOf(req), req.query.sedeId as string | undefined);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/sedes/availability/:productId — en qué sedes hay stock de un producto (POS)
router.get(
  '/availability/:productId',
  [param('productId').notEmpty(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await sedesService.getProductAvailability(tenantOf(req), req.params.productId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ── Multibodega: transferencias entre sedes ───────────────────────────────────

// GET /api/sedes/transfers?status=
router.get('/transfers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await sedesService.listTransfers(tenantOf(req), req.query.status as string | undefined);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/sedes/transfers — crear transferencia (solicitada)
router.post(
  '/transfers',
  [
    body('fromSedeId').notEmpty(),
    body('toSedeId').notEmpty(),
    body('items').isArray({ min: 1 }),
    body('notes').optional().isString(),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await sedesService.createTransfer(tenantOf(req), userOf(req), req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/sedes/transfers/:id/status — en_transito | recibida | cancelada
router.patch(
  '/transfers/:id/status',
  [param('id').notEmpty(), body('status').notEmpty(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await sedesService.setTransferStatus(tenantOf(req), userOf(req), req.params.id, req.body.status);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sedes/:id/stock — inventario físico de una sede
router.get(
  '/:id/stock',
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await sedesService.getSedeStock(tenantOf(req), req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/sedes/:id/stock/:productId — distribuir/ajustar desglose de un producto
router.put(
  '/:id/stock/:productId',
  [
    param('id').notEmpty(),
    param('productId').notEmpty(),
    body('stock').isFloat({ min: 0 }),
    body('minStock').optional().isFloat({ min: 0 }),
    body('warehouseLocation').optional({ nullable: true }).isString().isLength({ max: 50 }),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await sedesService.setSedeStock(
        tenantOf(req), req.params.id, req.params.productId,
        Number(req.body.stock), req.body.minStock !== undefined ? Number(req.body.minStock) : undefined,
        req.body.warehouseLocation !== undefined ? (req.body.warehouseLocation || null) : undefined
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ── CRUD de sedes ─────────────────────────────────────────────────────────────

// POST /api/sedes — crear sede
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('address').optional().isString(),
    body('type').optional().isIn(['punto_venta', 'bodega', 'mixta']),
    body('phone').optional().isString(),
    body('managerId').optional({ nullable: true }).isString(),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = tenantOf(req);
      const { name, address, type, phone, managerId } = req.body;
      const id = uuidv4();
      await pool.query<ResultSetHeader>(
        'INSERT INTO sedes (id, tenant_id, name, address, type, phone, manager_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, tenantId, name, address || null, type || 'mixta', phone || null, managerId || null]
      );
      res.status(201).json({ success: true, data: { id, name, address: address || null, type: type || 'mixta' } });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/sedes/:id — actualizar sede
router.put(
  '/:id',
  [
    param('id').notEmpty(),
    body('name').optional().notEmpty().withMessage('El nombre no puede estar vacio'),
    body('address').optional().isString(),
    body('type').optional().isIn(['punto_venta', 'bodega', 'mixta']),
    body('phone').optional({ nullable: true }).isString(),
    body('managerId').optional({ nullable: true }).isString(),
    body('isActive').optional().isBoolean(),
    validateRequest,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = tenantOf(req);
      const { id } = req.params;
      const { name, address, type, phone, managerId, isActive } = req.body;
      const sets: string[] = [];
      const values: any[] = [];
      if (name !== undefined) { sets.push('name = ?'); values.push(name); }
      if (address !== undefined) { sets.push('address = ?'); values.push(address || null); }
      if (type !== undefined) { sets.push('type = ?'); values.push(type); }
      if (phone !== undefined) { sets.push('phone = ?'); values.push(phone || null); }
      if (managerId !== undefined) { sets.push('manager_id = ?'); values.push(managerId || null); }
      if (isActive !== undefined) { sets.push('is_active = ?'); values.push(isActive ? 1 : 0); }
      if (sets.length === 0) return res.status(400).json({ success: false, message: 'Nada que actualizar' });
      values.push(id, tenantId);
      await pool.query<ResultSetHeader>(
        `UPDATE sedes SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
        values
      );
      res.json({ success: true, message: 'Sede actualizada' });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/sedes/:id — desactivar sede (soft delete; el desglose histórico se conserva)
router.delete(
  '/:id',
  [param('id').notEmpty(), validateRequest],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = tenantOf(req);
      const { id } = req.params;
      // Desvincular productos y personal de esta sede
      await pool.query('UPDATE products SET sede_id = NULL WHERE sede_id = ? AND tenant_id = ?', [id, tenantId]);
      await pool.query('UPDATE users SET sede_id = NULL WHERE sede_id = ? AND tenant_id = ?', [id, tenantId]);
      await pool.query<ResultSetHeader>(
        'UPDATE sedes SET is_active = 0 WHERE id = ? AND tenant_id = ?',
        [id, tenantId]
      );
      res.json({ success: true, message: 'Sede desactivada' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
