import { describe, it, expect } from 'vitest'
import { BLOCKS, BLOCK_TYPES, blockDefaults, parseSettings } from '../registry'

/**
 * Los schemas son la red de compatibilidad del refactor: las plantillas ya
 * guardadas en producción tienen settings con formas viejas y NO se migran.
 * Reglas obligatorias (ver plan-fase-1.5):
 *   · todo campo con .default()  → un campo ausente nunca es error
 *   · .passthrough()             → claves desconocidas sobreviven
 *   · .catch()                   → settings corruptos degradan, no rompen
 */

describe('Schemas · defaults derivados', () => {
  it('parse({}) devuelve defaults para todo bloque (sin defaults duplicados)', () => {
    for (const b of BLOCKS) {
      expect(() => b.schema.parse({}), `${b.type} debe parsear {}`).not.toThrow()
      expect(blockDefaults(b.type), `${b.type} debe tener defaults`).toBeTypeOf('object')
    }
  })

  it('los defaults de cada bloque son estables y re-parseables', () => {
    for (const t of BLOCK_TYPES) {
      const d = blockDefaults(t)
      expect(parseSettings(t, d)).toEqual(d)
    }
  })
})

describe('Schemas · tolerancia (compatibilidad hacia atrás)', () => {
  it('NINGÚN schema lanza, ni con basura', () => {
    const basura = [null, undefined, 0, 'texto', [], true, { items: 'no-es-array' }, { columns: {} }]
    for (const t of BLOCK_TYPES) {
      for (const v of basura) {
        expect(() => parseSettings(t, v), `${t} con ${JSON.stringify(v)}`).not.toThrow()
      }
    }
  })

  it('settings corruptos degradan a defaults en vez de romper la tienda', () => {
    expect(parseSettings('benefits', { items: 'roto' })).toEqual(blockDefaults('benefits'))
    expect(parseSettings('faq', { items: 42 })).toEqual(blockDefaults('faq'))
  })

  it('preserva claves desconocidas (no destruye data de otra versión)', () => {
    const out = parseSettings('benefits', { title: 'Hola', settingFuturo: { x: 1 } })
    expect(out?.settingFuturo).toEqual({ x: 1 })
    expect(out?.title).toBe('Hola')
  })

  it('acepta las formas guardadas por el editor viejo', () => {
    // Réplicas de los defaults del SECTION_CATALOG anterior al refactor
    const viejos: Record<string, any> = {
      benefits: { title: '¿Por qué elegir {{product.title}}?', columns: 2, items: [{ icon: '🚚', text: 'Envío rápido' }] },
      rich_text: { title: '', body: '{{product.description}}', imageUrl: '', imagePosition: 'right' },
      video: { title: 'Míralo en acción', url: '' },
      faq: { title: 'Preguntas frecuentes', items: [{ q: '¿Envío?', a: '2 a 5 días.' }] },
      testimonials: { title: 'Lo que dicen nuestros clientes', maxItems: 6 },
      comparison: { title: 'A vs B', ourLabel: 'Nuestro', theirLabel: 'Otros', rows: [{ feature: 'Garantía', ours: '✓', theirs: '✗' }] },
      urgency: { message: '🔥 Quedan {{product.stock}} unidades', showStock: true, deadline: '' },
      guarantees: { items: [{ icon: '🛡️', title: 'Garantía', text: 'Por defectos' }] },
      image_banner: { imageUrl: '', title: '', subtitle: '', ctaText: '' },
      related: { title: 'También te puede gustar', maxItems: 4 },
    }
    for (const [type, settings] of Object.entries(viejos)) {
      const out = parseSettings(type, settings)
      expect(out, `${type} debe parsear la forma vieja`).toBeTruthy()
      // los valores que el comerciante ya había configurado no se pierden
      for (const [k, v] of Object.entries(settings)) {
        expect(out?.[k], `${type}.${k} debe conservarse`).toEqual(v)
      }
    }
  })

  it('showStock no se corrompe con strings (z.coerce.boolean sería un bug)', () => {
    // Boolean('false') === true → por eso el schema es estricto + .catch(true)
    expect(parseSettings('urgency', { showStock: false })?.showStock).toBe(false)
    expect(parseSettings('urgency', { showStock: true })?.showStock).toBe(true)
  })
})

describe('Urgency · solo datos reales', () => {
  it('no expone ningún setting de prueba social simulada', () => {
    const keys = Object.keys(blockDefaults('urgency'))
    for (const prohibido of ['viewers', 'fakeViewers', 'peopleViewing', 'soldCount', 'simulate', 'randomMin', 'randomMax']) {
      expect(keys, `urgency no debe permitir "${prohibido}"`).not.toContain(prohibido)
    }
    expect(keys.sort()).toEqual(['deadline', 'message', 'showStock'])
  })
})
