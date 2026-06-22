/**
 * explore-recommend — motor de recomendación contextual del Explore (C6, básico).
 * Convierte Explore de "ecommerce genérico" a "commerce intelligence": puntúa
 * productos según el objetivo del usuario (heurística por palabras clave). Diseñado
 * para reemplazarse luego por un ranking del backend/IA sin cambiar el consumo.
 */
const norm = (s: unknown) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const GOAL_KEYWORDS: Record<string, string[]> = {
  bajar_peso: ['proteina', 'light', 'fit', 'detox', 'ensalada', 'bajo en calorias', 'fibra', 'te ', 'snack', 'saludable', 'integral', 'cero'],
  subir_masa: ['proteina', 'whey', 'creatina', 'masa', 'gainer', 'pollo', 'huevo', 'avena', 'carbohidrato', 'mantequilla de mani', 'barra'],
  mantener: ['balance', 'integral', 'natural', 'proteina', 'fruta', 'avena'],
  salud_general: ['vitamina', 'omega', 'natural', 'organico', 'fibra', 'colageno', 'probiotico', 'te '],
}

/** Puntúa un producto contra el objetivo. 0 = sin relación. */
export function scoreProduct(p: any, goal?: string): number {
  if (!goal) return 0
  const kws = GOAL_KEYWORDS[goal]
  if (!kws) return 0
  const text = norm(`${p.name} ${p.category} ${p.brand} ${p.description || ''}`)
  let s = 0
  for (const k of kws) if (text.includes(k.trim())) s += 2
  if (p.isOnOffer) s += 0.5
  return s
}

/** Ordena por relevancia al objetivo (desc). Sin objetivo, deja el orden original. */
export function rankByGoal<T>(products: T[], goal?: string): T[] {
  if (!goal) return products
  return [...products].sort((a, b) => scoreProduct(b, goal) - scoreProduct(a, goal))
}

/** Top productos recomendados (score > 0). */
export function topRecommended<T>(products: T[], goal?: string, limit = 8): T[] {
  if (!goal) return []
  return products
    .map(p => ({ p, s: scoreProduct(p, goal) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.p)
}
