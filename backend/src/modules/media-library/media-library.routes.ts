import { Router, Request, Response } from 'express';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';
import { v4 as uuidv4 } from 'uuid';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

// GET /api/media-library — listar imágenes del tenant (o todas si superadmin)
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user.tenantId;
    const isSuperadmin = user.role === 'superadmin';

    let rows: any[];
    if (isSuperadmin) {
      const [result] = await pool.query(
        'SELECT id, url, public_id, tenant_id, created_at FROM media_library ORDER BY created_at DESC LIMIT 200'
      ) as any;
      rows = result;
    } else {
      const [result] = await pool.query(
        'SELECT id, url, public_id, created_at FROM media_library WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200',
        [tenantId]
      ) as any;
      rows = result;
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Media library GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener imágenes' });
  }
});

// POST /api/media-library — guardar URL después de subir a Cloudinary
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { url, publicId } = req.body;

    if (!url) {
      res.status(400).json({ success: false, error: 'URL requerida' });
      return;
    }

    const id = uuidv4();
    await pool.query(
      'INSERT INTO media_library (id, tenant_id, url, public_id, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [id, user.tenantId || null, url, publicId || null, user.userId]
    );

    res.json({ success: true, data: { id, url } });
  } catch (error) {
    console.error('Media library POST error:', error);
    res.status(500).json({ success: false, error: 'Error al guardar imagen' });
  }
});

// DELETE /api/media-library/:id — eliminar registro (no borra de Cloudinary)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const isSuperadmin = user.role === 'superadmin';

    if (isSuperadmin) {
      await pool.query('DELETE FROM media_library WHERE id = ?', [id]);
    } else {
      await pool.query('DELETE FROM media_library WHERE id = ? AND tenant_id = ?', [id, user.tenantId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Media library DELETE error:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar imagen' });
  }
});

export default router;
