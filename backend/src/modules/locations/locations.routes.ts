import { Router, Request, Response } from 'express';

const router: ReturnType<typeof Router> = Router();

// ── Caché en memoria (24 h) ──────────────────────────────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { data: any; expiresAt: number }>();

function fromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}
function toCache(key: string, data: any) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

const BASE = 'https://countriesnow.space/api/v0.1';

async function cnGet(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`CountriesNow error ${res.status}`);
  return res.json();
}

async function cnPost(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`CountriesNow error ${res.status}`);
  return res.json();
}

// ── GET /api/locations/countries ─────────────────────────────────────────────
router.get('/countries', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'countries';
    let data = fromCache(cacheKey);
    if (!data) {
      const json = await cnGet('/countries/iso');
      // Devuelve array de { name, Iso2, Iso3 }
      data = (json.data || []).map((c: any) => ({ name: c.name, iso2: c.Iso2 }));
      toCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// ── POST /api/locations/states ────────────────────────────────────────────────
router.post('/states', async (req: Request, res: Response) => {
  const { country } = req.body;
  if (!country) { res.status(400).json({ success: false, error: 'country requerido' }); return; }
  try {
    const cacheKey = `states:${country}`;
    let data = fromCache(cacheKey);
    if (!data) {
      const json = await cnPost('/countries/states', { country });
      data = (json.data?.states || []).map((s: any) => s.name);
      toCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// ── POST /api/locations/cities ────────────────────────────────────────────────
router.post('/cities', async (req: Request, res: Response) => {
  const { country, state } = req.body;
  if (!country || !state) { res.status(400).json({ success: false, error: 'country y state requeridos' }); return; }
  try {
    const cacheKey = `cities:${country}:${state}`;
    let data = fromCache(cacheKey);
    if (!data) {
      const json = await cnPost('/countries/state/cities', { country, state });
      data = json.data || [];
      toCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

export default router;
