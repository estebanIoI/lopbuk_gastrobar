import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { BLOCKS, BLOCK_TYPES, getBlock, isKnownBlock, blockDefaults, newSection, parseSettings } from '../registry'

/**
 * Lee la allowlist REAL del backend. Es el único punto donde el registry del
 * frontend y el backend pueden desincronizarse (decisión de arquitectura de la
 * Fase 1.5: no hay paquete compartido para no tocar el despliegue), así que
 * este test es la red que lo impide.
 */
function backendSectionTypes(): string[] {
  const file = resolve(process.cwd(), '../backend/src/modules/product-templates/section-types.ts')
  const src = readFileSync(file, 'utf8')
  const m = src.match(/export const SECTION_TYPES = \[([\s\S]*?)\] as const;/)
  if (!m) throw new Error('No se pudo leer SECTION_TYPES del backend')
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])
}

describe('Block Registry · integridad', () => {
  it('cada bloque declara el contrato completo', () => {
    for (const b of BLOCKS) {
      expect(b.type, 'type').toBeTruthy()
      expect(b.label, `label de ${b.type}`).toBeTruthy()
      expect(b.desc, `desc de ${b.type}`).toBeTruthy()
      expect(b.category, `category de ${b.type}`).toBeTruthy()
      expect(b.schema, `schema de ${b.type}`).toBeTruthy()
      expect(typeof b.Render, `Render de ${b.type}`).toBe('function')
      expect(typeof b.Editor, `Editor de ${b.type}`).toBe('function')
    }
  })

  it('no hay tipos duplicados', () => {
    expect(new Set(BLOCK_TYPES).size).toBe(BLOCK_TYPES.length)
  })

  it('getBlock / isKnownBlock resuelven cada tipo registrado', () => {
    for (const t of BLOCK_TYPES) {
      expect(isKnownBlock(t)).toBe(true)
      expect(getBlock(t)?.type).toBe(t)
    }
  })

  it('un tipo desconocido no rompe: se ignora con gracia', () => {
    expect(getBlock('bloque_del_futuro')).toBeNull()
    expect(isKnownBlock('bloque_del_futuro')).toBe(false)
    expect(parseSettings('bloque_del_futuro', { a: 1 })).toBeNull()
    expect(blockDefaults('bloque_del_futuro')).toEqual({})
  })

  it('newSection nace visible, ordenada y con los defaults del schema', () => {
    const s = newSection('benefits', 3)
    expect(s.type).toBe('benefits')
    expect(s.order).toBe(3)
    expect(s.visible).toBe(true)
    expect(s.id).toMatch(/^sec-/)
    expect(s.settings).toEqual(blockDefaults('benefits'))
  })
})

describe('Contrato frontend ↔ backend', () => {
  it('el registry y la allowlist del backend contienen exactamente los mismos tipos', () => {
    // Si este test falla: agregaste un bloque al registry y olvidaste añadir su
    // `type` a SECTION_TYPES en backend/src/modules/product-templates/section-types.ts
    // (o al revés). El backend rechazaría la sección al persistirla.
    expect([...BLOCK_TYPES].sort()).toEqual([...backendSectionTypes()].sort())
  })
})
