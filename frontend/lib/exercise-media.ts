// ── Media de ejemplo por ejercicio ───────────────────────────────────────────
// Reutiliza el dataset de ejercicios (© Gym visual). Los archivos viven en
// /public/exercises/<id>.jpg (foto 180×180) y <id>.gif (demo del movimiento),
// donde <id> es el id del dataset (4 dígitos).
//
// Este mapa cubre el catálogo hardcodeado actual (slug → id del dataset). Cuando
// las rutinas pasen a la librería en BD (Fase B), el media saldrá directo de
// exercises.image_url / gif_url y este mapa desaparece.

export interface ExerciseMedia {
  /** Foto estática (180×180). */
  image: string
  /** Demo animado (gif) del movimiento. */
  gif: string
}

/** slug del catálogo de rutinas → id del dataset de ejercicios. */
const SLUG_TO_ID: Record<string, string> = {
  press_banca: '0025',
  remo_barra: '0027',
  press_militar: '1457',
  jalon_pecho: '2330',
  curl_biceps: '0031',
  extension_triceps: '0201',
  sentadilla: '0043',
  prensa: '2287',
  peso_muerto_rumano: '0085',
  hip_thrust: '1409',
  extension_cuadriceps: '0585',
  curl_femoral: '0586',
}

/** Media de ejemplo para un exerciseId (slug del catálogo o id del dataset). */
export function exerciseMediaFor(exerciseId?: string | null): ExerciseMedia | null {
  if (!exerciseId) return null
  // Acepta directamente un id de dataset (4 dígitos) o un slug del catálogo.
  const id = /^[0-9]{4}$/.test(exerciseId) ? exerciseId : SLUG_TO_ID[exerciseId]
  if (!id) return null
  return { image: `/exercises/${id}.jpg`, gif: `/exercises/${id}.gif` }
}
