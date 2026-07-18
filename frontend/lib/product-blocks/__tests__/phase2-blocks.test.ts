import { describe, it, expect } from 'vitest'
import { getBlock, blockDefaults, parseSettings, BLOCK_TYPES } from '../registry'
import { videoEmbed } from '../shared'
import { productDiscountPct, productImages } from '@/lib/template-vars'

const PHASE2 = ['hero', 'feature_grid', 'cta', 'before_after', 'multimedia', 'spacer']

describe('Fase 2 · bloques nuevos registrados', () => {
  it('los 6 bloques nuevos están en el registry', () => {
    for (const t of PHASE2) {
      expect(getBlock(t), `${t} debe existir`).not.toBeNull()
      expect(BLOCK_TYPES).toContain(t)
    }
  })

  it('cada bloque nuevo parsea {} y tolera basura', () => {
    for (const t of PHASE2) {
      expect(() => blockDefaults(t)).not.toThrow()
      for (const v of [null, undefined, 'x', 42, [], { items: 'roto' }]) {
        expect(() => parseSettings(t, v), `${t} con ${JSON.stringify(v)}`).not.toThrow()
      }
    }
  })
})

describe('Hero · regla de oro (no almacena contenido del producto)', () => {
  it('el schema del Hero no tiene campos de datos del producto', () => {
    const keys = Object.keys(blockDefaults('hero'))
    for (const prohibido of ['title', 'name', 'price', 'salePrice', 'compareAtPrice', 'description', 'images', 'stock']) {
      expect(keys, `hero no debe almacenar "${prohibido}"`).not.toContain(prohibido)
    }
  })
  it('solo guarda estructura: layout, toggles, badges, textos del CTA', () => {
    const d = blockDefaults('hero')
    expect(d.layout).toBe('image_left')
    expect(d.media).toBe('slider')
    expect(d.ctaText).toBeTypeOf('string')
    expect(Array.isArray(d.badges)).toBe(true)
  })
})

describe('CTA · acciones modeladas', () => {
  it('default es la acción de compra nativa', () => {
    expect(blockDefaults('cta').action).toBe('default')
  })
  it('acepta las acciones futuras sin romper', () => {
    for (const a of ['checkout', 'whatsapp', 'reservar', 'evento', 'formulario', 'url']) {
      expect(parseSettings('cta', { action: a })?.action).toBe(a)
    }
  })
  it('una acción inválida degrada a default (no rompe)', () => {
    expect(parseSettings('cta', { action: 'hackeo' })?.action).toBe('default')
  })
})

describe('Multimedia · detección de plataformas', () => {
  const cases: Array<[string, string]> = [
    ['https://youtube.com/watch?v=abcdef123', 'youtube'],
    ['https://youtube.com/shorts/abcdef123', 'youtube'],
    ['https://www.tiktok.com/@user/video/12345', 'tiktok'],
    ['https://www.instagram.com/reel/AbC-123/', 'instagram'],
    ['https://cdn.x.com/a.gif', 'gif'],
    ['https://cdn.x.com/a.mp4', 'mp4'],
    ['https://cdn.x.com/foto.jpg', 'none'],
  ]
  it('resuelve cada plataforma al kind correcto', () => {
    for (const [url, kind] of cases) {
      expect(videoEmbed(url).kind, url).toBe(kind)
    }
  })
  it('shorts/tiktok/instagram son verticales (9/16)', () => {
    expect(videoEmbed('https://youtube.com/shorts/abcdef123').vertical).toBe(true)
    expect(videoEmbed('https://www.tiktok.com/@u/video/1').vertical).toBe(true)
    expect(videoEmbed('https://www.instagram.com/reel/AbC-123/').vertical).toBe(true)
    expect(videoEmbed('https://youtube.com/watch?v=abcdef123').vertical).toBe(false)
  })
})

describe('template-vars · precios y descuento reales', () => {
  it('descuento se calcula desde precios reales', () => {
    expect(productDiscountPct({ isOnOffer: true, salePrice: 100000, offerPrice: 79000 })).toBe(21)
    expect(productDiscountPct({ isOnOffer: false, salePrice: 100000, offerPrice: 79000 })).toBe(0)
    expect(productDiscountPct({ isOnOffer: true, salePrice: 100000, offerPrice: 120000 })).toBe(0) // no negativo
    expect(productDiscountPct(null)).toBe(0)
  })
  it('galería con fallback a imageUrl', () => {
    expect(productImages({ images: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(productImages({ images: [], imageUrl: 'x' })).toEqual(['x'])
    expect(productImages({ imageUrl: 'x' })).toEqual(['x'])
    expect(productImages({})).toEqual([])
  })
})
