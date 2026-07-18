import { describe, it, expect } from 'vitest'
import { getBlock, blockDefaults, parseSettings, BLOCK_TYPES } from '../registry'
import { buildSocialProofSignals, timeAgo } from '../blocks/social-proof'
import type { SocialProofData } from '../types'

/**
 * Social Proof Engine — la garantía central es que NUNCA muestra nada sin
 * respaldo real. Se testea la función pura de gating (buildSocialProofSignals),
 * que es donde un descuido inventaría prueba social. El cálculo de los datos
 * vive en el backend (social-proof.service, solo lee ventas/stock/reseñas).
 */

const base: SocialProofData = {
  viewers: 0, soldRecent: 0, soldTotal: 0, recentDays: 7,
  lastPurchaseAt: null, stock: null, lowStock: false, reviewCount: 0, avgRating: null,
}
const ALL_ON = blockDefaults('social_proof')
const txt = (sp: SocialProofData | null, s: any = ALL_ON) => buildSocialProofSignals(s, sp).map(i => i.text).join(' | ')

describe('Social Proof · contrato del bloque', () => {
  it('registrado y con contrato completo', () => {
    expect(BLOCK_TYPES).toContain('social_proof')
    expect(getBlock('social_proof')!.category).toBe('confianza')
  })
  it('tolera basura', () => {
    for (const v of [null, 'x', 42, { layout: 'no' }]) expect(() => parseSettings('social_proof', v)).not.toThrow()
  })
})

describe('Social Proof · SOLO muestra con datos reales', () => {
  it('sin datos → ninguna señal', () => {
    expect(buildSocialProofSignals(ALL_ON, null)).toHaveLength(0)
    expect(buildSocialProofSignals(ALL_ON, { ...base })).toHaveLength(0)
  })
  it('1 espectador NO se muestra (necesita > 1)', () => {
    expect(txt({ ...base, viewers: 1 })).not.toContain('viendo')
  })
  it('espectadores reales (>1) sí', () => {
    expect(txt({ ...base, viewers: 5 })).toContain('5 personas viendo')
  })
  it('vendidos solo si > 0', () => {
    expect(txt({ ...base, soldRecent: 0 })).not.toContain('vendidos')
    expect(txt({ ...base, soldRecent: 12 })).toContain('12 vendidos en los últimos 7')
  })
  it('stock bajo solo si lowStock real', () => {
    expect(txt({ ...base, stock: 100, lowStock: false })).not.toContain('Solo quedan')
    expect(txt({ ...base, stock: 4, lowStock: true })).toContain('Solo quedan 4')
  })
  it('valoración solo con reseñas verificadas reales', () => {
    expect(txt({ ...base, avgRating: null, reviewCount: 0 })).not.toContain('reseñas')
    expect(txt({ ...base, avgRating: 4.6, reviewCount: 23 })).toContain('4.6 de 5 · 23 reseñas verificadas')
  })
})

describe('Social Proof · última compra por antigüedad real', () => {
  it('reciente se muestra', () => {
    const iso = new Date(Date.now() - 8 * 60 * 1000).toISOString()
    expect(timeAgo(iso)).toBeTruthy()
    expect(txt({ ...base, lastPurchaseAt: iso })).toContain('Última compra')
  })
  it('demasiado vieja (>30 días) NO se muestra', () => {
    const iso = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString()
    expect(timeAgo(iso)).toBeNull()
    expect(txt({ ...base, lastPurchaseAt: iso })).not.toContain('Última compra')
  })
  it('fecha futura o inválida → null', () => {
    expect(timeAgo(new Date(Date.now() + 60000).toISOString())).toBeNull()
    expect(timeAgo('no-es-fecha')).toBeNull()
    expect(timeAgo(null)).toBeNull()
  })
})

describe('Social Proof · el comerciante elige qué mostrar, no los valores', () => {
  it('apagar una señal la oculta aunque haya dato real', () => {
    expect(txt({ ...base, viewers: 9 }, { ...ALL_ON, showViewers: false })).not.toContain('viendo')
  })
  it('el schema no expone ningún valor numérico (no se puede inventar)', () => {
    const keys = Object.keys(blockDefaults('social_proof'))
    for (const forbidden of ['viewers', 'soldCount', 'count', 'fake', 'min', 'max', 'value']) {
      expect(keys).not.toContain(forbidden)
    }
  })
})
