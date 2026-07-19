/**
 * Animaciones de entrada a una categoría (tema 1).
 *
 * Fuente única: el panel del comerciante ofrece exactamente estas opciones y la
 * tienda las renderiza. Agregar una animación nueva es agregar una entrada aquí
 * + sus keyframes en CATEGORY_TRANSITION_CSS.
 *
 * Todas se construyen con las MISMAS franjas (`bands`): cada franja lleva la
 * portada recortada en su porción, así que al juntarse reconstruyen la imagen.
 * Lo que cambia entre animaciones es cómo entra cada franja.
 */

export type CategoryTransition =
  | 'ninguna' | 'peine' | 'destruir' | 'persianas' | 'fracturar' | 'aplastar' | 'vortice'

export interface TransitionDef {
  key: CategoryTransition
  label: string
  hint: string
  /** Nº de piezas. 0 = sin animación. */
  bands: number
  /** 'filas' = franjas horizontales · 'columnas' = verticales · 'rejilla' = cuadrícula */
  layout: 'ninguno' | 'filas' | 'columnas' | 'rejilla'
  /** Duración total aproximada en ms (incluye retardos). Define cuándo abrir el catálogo. */
  durationMs: number
}

export const CATEGORY_TRANSITIONS: TransitionDef[] = [
  { key: 'ninguna',   label: 'Sin animación', hint: 'Abre la categoría al instante',                 bands: 0,  layout: 'ninguno',   durationMs: 0 },
  { key: 'peine',     label: 'Peine',         hint: 'Franjas que entran alternando izquierda y derecha', bands: 10, layout: 'filas',     durationMs: 1550 },
  { key: 'persianas', label: 'Persianas',     hint: 'Láminas verticales que se abren a la vez',      bands: 12, layout: 'columnas',  durationMs: 1450 },
  { key: 'destruir',  label: 'Destruir',      hint: 'Los bloques caen y se recomponen',              bands: 24, layout: 'rejilla',   durationMs: 1700 },
  { key: 'fracturar', label: 'Fracturar',     hint: 'La imagen se arma desde esquirlas dispersas',   bands: 24, layout: 'rejilla',   durationMs: 1700 },
  { key: 'aplastar',  label: 'Aplastar',      hint: 'Las franjas se comprimen y expanden de golpe',  bands: 10, layout: 'filas',     durationMs: 1500 },
  { key: 'vortice',   label: 'Vórtice',       hint: 'Los bloques giran hacia el centro',             bands: 24, layout: 'rejilla',   durationMs: 1750 },
]

export const DEFAULT_TRANSITION: CategoryTransition = 'peine'

/** Tolerante: un valor desconocido (o vacío) cae al default en vez de romper. */
export function getTransition(key?: string | null): TransitionDef {
  return CATEGORY_TRANSITIONS.find(t => t.key === key)
    ?? CATEGORY_TRANSITIONS.find(t => t.key === DEFAULT_TRANSITION)!
}

/**
 * Reparte las piezas en la rejilla y devuelve, por pieza, su posición y el
 * recorte de la portada que le corresponde.
 */
export function buildPieces(def: TransitionDef) {
  const { bands, layout } = def
  if (bands === 0 || layout === 'ninguno') return []
  if (layout === 'filas') {
    return Array.from({ length: bands }, (_, i) => ({
      i, row: i, col: 0, rows: bands, cols: 1,
      top: (i * 100) / bands, left: 0,
      h: 100 / bands, w: 100,
      bgSizeX: 100, bgSizeY: bands * 100,
      bgPosX: 0, bgPosY: bands > 1 ? (i * 100) / (bands - 1) : 0,
    }))
  }
  if (layout === 'columnas') {
    return Array.from({ length: bands }, (_, i) => ({
      i, row: 0, col: i, rows: 1, cols: bands,
      top: 0, left: (i * 100) / bands,
      h: 100, w: 100 / bands,
      bgSizeX: bands * 100, bgSizeY: 100,
      bgPosX: bands > 1 ? (i * 100) / (bands - 1) : 0, bgPosY: 0,
    }))
  }
  // rejilla: 6 columnas × N filas
  const cols = 6
  const rows = Math.max(1, Math.round(bands / cols))
  const total = cols * rows
  return Array.from({ length: total }, (_, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    return {
      i, row, col, rows, cols,
      top: (row * 100) / rows, left: (col * 100) / cols,
      h: 100 / rows, w: 100 / cols,
      bgSizeX: cols * 100, bgSizeY: rows * 100,
      bgPosX: cols > 1 ? (col * 100) / (cols - 1) : 0,
      bgPosY: rows > 1 ? (row * 100) / (rows - 1) : 0,
    }
  })
}

/** Retardo de cada pieza según la animación (da su carácter a cada efecto). */
export function pieceDelay(key: CategoryTransition, p: ReturnType<typeof buildPieces>[number]): number {
  switch (key) {
    case 'peine':     return p.i * 28
    case 'persianas': return p.i * 18
    case 'aplastar':  return p.i * 22
    // Diagonal: arranca arriba-izquierda y avanza al fondo
    case 'destruir':  return (p.row + p.col) * 42
    // Disperso pero determinista (mismo orden en cada apertura)
    case 'fracturar': return ((p.i * 37) % 17) * 26
    // Del centro hacia afuera
    case 'vortice':   return Math.round(Math.hypot(p.row - (p.rows - 1) / 2, p.col - (p.cols - 1) / 2) * 55)
    default:          return 0
  }
}

/** Clase CSS de la pieza. Algunas animaciones alternan dos variantes. */
export function pieceClass(key: CategoryTransition, p: ReturnType<typeof buildPieces>[number]): string {
  switch (key) {
    case 'peine':     return p.i % 2 === 0 ? 'ct-peine-a' : 'ct-peine-b'
    case 'persianas': return 'ct-persianas'
    case 'destruir':  return 'ct-destruir'
    case 'fracturar': return p.i % 2 === 0 ? 'ct-fracturar-a' : 'ct-fracturar-b'
    case 'aplastar':  return 'ct-aplastar'
    case 'vortice':   return p.i % 2 === 0 ? 'ct-vortice-a' : 'ct-vortice-b'
    default:          return ''
  }
}

/**
 * Keyframes de todas las animaciones. Se inyecta con un <style> plano:
 * `<style jsx global>` multilínea rompe el bundle de Turbopack.
 */
export const CATEGORY_TRANSITION_CSS = [
  '.ct-overlay{animation:ctFade 1.5s ease both}',
  '@keyframes ctFade{0%{opacity:1}80%{opacity:1}100%{opacity:0}}',
  '.ct-label{animation:ctLabel 1.5s ease-out both}',
  '@keyframes ctLabel{0%{opacity:0;transform:translateY(16px)}42%{opacity:0;transform:translateY(16px)}62%{opacity:1;transform:translateY(0)}84%{opacity:1}100%{opacity:0}}',

  // Peine — franjas alternando lados
  '.ct-peine-a{animation:ctFromRight .62s cubic-bezier(.22,.61,.36,1) both}',
  '.ct-peine-b{animation:ctFromLeft .62s cubic-bezier(.22,.61,.36,1) both}',
  '@keyframes ctFromRight{from{transform:translateX(100%)}to{transform:translateX(0)}}',
  '@keyframes ctFromLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}',

  // Persianas — láminas que se abren girando sobre su eje vertical
  '.ct-persianas{animation:ctBlind .58s ease-out both;transform-origin:center}',
  '@keyframes ctBlind{from{transform:scaleX(0);opacity:.2}to{transform:scaleX(1);opacity:1}}',

  // Destruir — los bloques caen desde arriba y se asientan
  '.ct-destruir{animation:ctDrop .6s cubic-bezier(.34,1.32,.64,1) both}',
  '@keyframes ctDrop{from{transform:translateY(-140%) rotate(-8deg);opacity:0}to{transform:translateY(0) rotate(0);opacity:1}}',

  // Fracturar — esquirlas que llegan de lados opuestos y encajan
  '.ct-fracturar-a{animation:ctShardA .62s cubic-bezier(.2,.8,.3,1) both}',
  '.ct-fracturar-b{animation:ctShardB .62s cubic-bezier(.2,.8,.3,1) both}',
  '@keyframes ctShardA{from{transform:translate(-60%,-40%) scale(.4) rotate(-18deg);opacity:0}to{transform:translate(0,0) scale(1) rotate(0);opacity:1}}',
  '@keyframes ctShardB{from{transform:translate(60%,40%) scale(.4) rotate(18deg);opacity:0}to{transform:translate(0,0) scale(1) rotate(0);opacity:1}}',

  // Aplastar — la franja llega comprimida y rebota a su altura
  '.ct-aplastar{animation:ctSquash .55s cubic-bezier(.34,1.42,.64,1) both;transform-origin:center}',
  '@keyframes ctSquash{from{transform:scaleY(0) scaleX(1.25)}60%{transform:scaleY(1.15) scaleX(.96)}to{transform:scaleY(1) scaleX(1)}}',

  // Vórtice — los bloques giran hacia su sitio desde el centro
  '.ct-vortice-a{animation:ctSwirlA .68s cubic-bezier(.22,.68,.3,1) both}',
  '.ct-vortice-b{animation:ctSwirlB .68s cubic-bezier(.22,.68,.3,1) both}',
  '@keyframes ctSwirlA{from{transform:rotate(150deg) scale(.15);opacity:0}to{transform:rotate(0) scale(1);opacity:1}}',
  '@keyframes ctSwirlB{from{transform:rotate(-150deg) scale(.15);opacity:0}to{transform:rotate(0) scale(1);opacity:1}}',

  '@media(prefers-reduced-motion:reduce){[class^="ct-"],[class*=" ct-"]{animation-duration:.01ms!important}}',
].join('')
