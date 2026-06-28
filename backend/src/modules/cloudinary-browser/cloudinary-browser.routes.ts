import { Router, Request, Response } from 'express';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';
import { encrypt, decrypt } from '../../utils/crypto';

const router: ReturnType<typeof Router> = Router();

// Cualquier usuario autenticado puede explorar Cloudinary del tenant/plataforma
router.use(authenticate);

// ── Credenciales globales (platform_settings, superadmin) ───────────────────
async function getGlobalAdminCredentials(): Promise<{ cloudName: string; apiKey: string; apiSecret: string } | null> {
  const [rows] = await pool.query(
    "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('cloudinary_cloud_name','cloudinary_api_key','cloudinary_api_secret')"
  ) as any;
  const s: Record<string, string> = {};
  for (const row of (rows as any[])) s[row.setting_key] = row.setting_value || '';
  if (!s['cloudinary_cloud_name'] || !s['cloudinary_api_key'] || !s['cloudinary_api_secret']) return null;
  return { cloudName: s['cloudinary_cloud_name'], apiKey: s['cloudinary_api_key'], apiSecret: s['cloudinary_api_secret'] };
}

// ── Credenciales del comercio (store_info) ──────────────────────────────────
async function getTenantAdminCredentials(tenantId: string): Promise<{ cloudName: string; apiKey: string; apiSecret: string } | null> {
  if (!tenantId) return null;
  const [rows] = await pool.query(
    'SELECT cloudinary_cloud_name AS cn, cloudinary_api_key AS ak, cloudinary_api_secret AS asec FROM store_info WHERE tenant_id = ? LIMIT 1',
    [tenantId]
  ) as any;
  const r = rows?.[0];
  if (!r || !r.cn || !r.ak || !r.asec) return null;
  return { cloudName: r.cn, apiKey: r.ak, apiSecret: decrypt(r.asec) };
}

// ── Credenciales Admin API: comercio primero, fallback a global ─────────────
async function getAdminCredentials(tenantId?: string | null): Promise<{ cloudName: string; apiKey: string; apiSecret: string } | null> {
  if (tenantId) {
    const tenant = await getTenantAdminCredentials(tenantId);
    if (tenant) return tenant;
  }
  return getGlobalAdminCredentials();
}

// ── Config de UPLOAD (cloud_name + upload_preset): comercio primero, fallback global.
// La usa el componente CloudinaryUpload del frontend (subida unsigned desde el browser).
async function getUploadConfig(tenantId?: string | null): Promise<{ cloudName: string; uploadPreset: string }> {
  if (tenantId) {
    const [rows] = await pool.query(
      'SELECT cloudinary_cloud_name AS cn, cloudinary_upload_preset AS up FROM store_info WHERE tenant_id = ? LIMIT 1',
      [tenantId]
    ) as any;
    const r = rows?.[0];
    if (r?.cn && r?.up) return { cloudName: r.cn, uploadPreset: r.up };
  }
  const [g] = await pool.query(
    "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('cloudinary_cloud_name','cloudinary_upload_preset')"
  ) as any;
  const s: Record<string, string> = {};
  for (const row of (g as any[])) s[row.setting_key] = row.setting_value || '';
  return { cloudName: s['cloudinary_cloud_name'] || '', uploadPreset: s['cloudinary_upload_preset'] || '' };
}

// ── Helper: llamar a Cloudinary Admin API (autenticación HTTP Basic) ────────
async function cloudinaryAdminRequest(
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  path: string,
  params: Record<string, string> = {}
): Promise<any> {
  const url = new URL(`https://api.cloudinary.com/v1_1/${cloudName}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err?.error?.message || `Cloudinary error ${res.status}`);
  }

  return res.json();
}

// =============================================
// GET /api/cloudinary/folders
// Lista todas las carpetas raíz disponibles
// =============================================
router.get('/folders', async (req: Request, res: Response) => {
  try {
    const creds = await getAdminCredentials((req as any).user?.tenantId);
    if (!creds) {
      res.status(400).json({
        success: false,
        error: 'Cloudinary Admin API no configurado. Agrega API Key y API Secret en Integraciones.',
      });
      return;
    }

    const data = await cloudinaryAdminRequest(
      creds.cloudName, creds.apiKey, creds.apiSecret,
      '/folders',
      { max_results: '500' }
    );

    // Normalizar: [ { path, name, external_id } ]
    const folders = ((data.folders || []) as any[]).map((f: any) => ({
      path: f.path || f.name,
      name: f.name || f.path,
    }));

    res.json({ success: true, data: folders });
  } catch (error: any) {
    console.error('Cloudinary folders error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener carpetas' });
  }
});

// =============================================
// GET /api/cloudinary/subfolders?folder=xxx
// Lista subcarpetas dentro de una carpeta
// =============================================
router.get('/subfolders', async (req: Request, res: Response) => {
  try {
    const creds = await getAdminCredentials((req as any).user?.tenantId);
    if (!creds) {
      res.status(400).json({ success: false, error: 'Cloudinary Admin API no configurado.' });
      return;
    }

    const folder = String(req.query.folder || '');
    if (!folder) {
      res.status(400).json({ success: false, error: 'Parámetro folder requerido' });
      return;
    }

    const data = await cloudinaryAdminRequest(
      creds.cloudName, creds.apiKey, creds.apiSecret,
      `/folders/${encodeURIComponent(folder)}`
    );

    const folders = ((data.folders || []) as any[]).map((f: any) => ({
      path: f.path || f.name,
      name: f.name || f.path,
    }));

    res.json({ success: true, data: folders });
  } catch (error: any) {
    console.error('Cloudinary subfolders error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener subcarpetas' });
  }
});

// =============================================
// GET /api/cloudinary/images
// Lista imágenes de una carpeta con paginación cursor
// Query params:
//   folder      (requerido)
//   next_cursor (opcional, paginación)
//   max_results (default 50, max 500)
//   search      (opcional, filtra por filename)
//   sort_by     (opcional: public_id | created_at | bytes)
//   direction   (asc | desc, default desc)
// =============================================
router.get('/images', async (req: Request, res: Response) => {
  try {
    const creds = await getAdminCredentials((req as any).user?.tenantId);
    if (!creds) {
      res.status(400).json({ success: false, error: 'Cloudinary Admin API no configurado.' });
      return;
    }

    const folder      = String(req.query.folder || '');
    const nextCursor  = String(req.query.next_cursor || '');
    const maxResults  = Math.min(Number(req.query.max_results || 50), 500);
    const sortBy      = String(req.query.sort_by || 'created_at');
    const direction   = String(req.query.direction || 'desc');

    if (!folder) {
      res.status(400).json({ success: false, error: 'Parámetro folder requerido' });
      return;
    }

    // Cloudinary Admin API — Resources by asset folder
    const params: Record<string, string> = {
      asset_folder: folder,
      max_results: String(maxResults),
      resource_type: 'image',
      // Pedir los campos necesarios
    };
    if (nextCursor) params.next_cursor = nextCursor;
    if (direction) params.direction = direction;

    // sort_by acepta: public_id, file_size, created_at
    const validSortFields = ['public_id', 'file_size', 'created_at'];
    if (validSortFields.includes(sortBy)) {
      params.sort_by = sortBy === 'bytes' ? 'file_size' : sortBy;
    }

    const data = await cloudinaryAdminRequest(
      creds.cloudName, creds.apiKey, creds.apiSecret,
      '/resources/image',
      params
    );

    // Normalizar al contrato que espera el frontend
    const images = ((data.resources || []) as any[]).map((r: any) => ({
      public_id:         r.public_id,
      secure_url:        r.secure_url,
      display_name:      r.display_name || r.public_id?.split('/').pop() || '',
      original_filename: r.filename || r.public_id?.split('/').pop() || '',
      folder:            r.asset_folder || r.folder || folder,
      format:            r.format,
      width:             r.width,
      height:            r.height,
      bytes:             r.bytes,
      created_at:        r.created_at,
    }));

    res.json({
      success: true,
      data: {
        images,
        next_cursor: data.next_cursor || null,
        total_count: data.total_count || images.length,
      },
    });
  } catch (error: any) {
    console.error('Cloudinary images error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener imágenes' });
  }
});

// =============================================
// GET /api/cloudinary/folder-stats?folder=xxx
// Cuenta total de imágenes y peso de una carpeta
// =============================================
router.get('/folder-stats', async (req: Request, res: Response) => {
  try {
    const creds = await getAdminCredentials((req as any).user?.tenantId);
    if (!creds) {
      res.status(400).json({ success: false, error: 'Cloudinary Admin API no configurado.' });
      return;
    }

    const folder = String(req.query.folder || '');
    if (!folder) {
      res.status(400).json({ success: false, error: 'Parámetro folder requerido' });
      return;
    }

    // Fetch con max_results para contar (Cloudinary da total_count sin cargar todos)
    const data = await cloudinaryAdminRequest(
      creds.cloudName, creds.apiKey, creds.apiSecret,
      '/resources/image',
      { asset_folder: folder, max_results: '1', resource_type: 'image' }
    );

    res.json({
      success: true,
      data: {
        folder,
        total_count: data.total_count || 0,
      },
    });
  } catch (error: any) {
    console.error('Cloudinary folder-stats error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener stats' });
  }
});

// =============================================
// GET /api/cloudinary/config
// Config Cloudinary del comercio (secret enmascarado) + de dónde sale la efectiva.
// =============================================
router.get('/config', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    let tenant: any = null;
    if (tenantId) {
      const [rows] = await pool.query(
        'SELECT cloudinary_cloud_name AS cn, cloudinary_upload_preset AS up, cloudinary_api_key AS ak, cloudinary_api_secret AS asec FROM store_info WHERE tenant_id = ? LIMIT 1',
        [tenantId]
      ) as any;
      tenant = rows?.[0] || null;
    }
    const global = await getGlobalAdminCredentials();
    const effective = await getAdminCredentials(tenantId);
    const upload = await getUploadConfig(tenantId);

    res.json({
      success: true,
      data: {
        cloudName: tenant?.cn || '',
        uploadPreset: tenant?.up || '',
        apiKey: tenant?.ak ? '••••••' + String(tenant.ak).slice(-4) : '',
        apiKeySet: !!tenant?.ak,
        apiSecretSet: !!tenant?.asec,
        // config efectiva de upload (lo que realmente usa el browser; tenant o global)
        effectiveCloudName: upload.cloudName,
        effectiveUploadPreset: upload.uploadPreset,
        // contexto para la UI: si el comercio no configuró Admin API, qué se usa
        source: tenant?.cn && tenant?.ak && tenant?.asec ? 'tenant' : (effective ? 'global' : 'none'),
        globalConfigured: !!global,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error al leer config' });
  }
});

// =============================================
// PUT /api/cloudinary/config
// Guarda la config Cloudinary del comercio (secret cifrado). Campos vacíos no se tocan;
// enviar null/"" explícito en un campo lo limpia.
// =============================================
router.put('/config', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Solo un comercio puede guardar su config Cloudinary' });
      return;
    }
    const { cloudName, uploadPreset, apiKey, apiSecret } = req.body as Record<string, string | null>;

    const sets: string[] = [];
    const vals: any[] = [];
    if (cloudName !== undefined)    { sets.push('cloudinary_cloud_name = ?');    vals.push(cloudName || null); }
    if (uploadPreset !== undefined) { sets.push('cloudinary_upload_preset = ?'); vals.push(uploadPreset || null); }
    if (apiKey !== undefined)       { sets.push('cloudinary_api_key = ?');       vals.push(apiKey || null); }
    // El secret solo se actualiza si llega un valor nuevo (no el placeholder de máscara).
    if (apiSecret !== undefined && apiSecret !== null && !apiSecret.startsWith('••')) {
      sets.push('cloudinary_api_secret = ?'); vals.push(apiSecret ? encrypt(apiSecret) : null);
    }
    if (sets.length === 0) {
      res.json({ success: true });
      return;
    }
    vals.push(tenantId);
    await pool.query(`UPDATE store_info SET ${sets.join(', ')} WHERE tenant_id = ?`, vals);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error al guardar config' });
  }
});

export default router;
