import { describe, it, expect } from 'vitest'
import {
  defaultCheckoutConfig, withCheckoutDefaults, CORE_FIELDS, ALL_FIELDS,
} from '@/lib/checkout-experience'

/**
 * Invariantes de seguridad del Checkout Experience: los campos núcleo (nombre,
 * teléfono) no se pueden ocultar ni volver opcionales, porque el pedido los
 * necesita. El backend lo fuerza en sanitize(); aquí se verifica el espejo del
 * cliente (withCheckoutDefaults), que además blinda el consumo en el checkout.
 */

describe('Checkout Experience · defaults', () => {
  it('trae los 10 campos con orden y textos', () => {
    const d = defaultCheckoutConfig()
    expect(Object.keys(d.fields).sort()).toEqual([...ALL_FIELDS].sort())
    for (const k of ALL_FIELDS) {
      expect(d.fields[k].label).toBeTruthy()
      expect(typeof d.fields[k].order).toBe('number')
    }
    expect(d.cta.text).toBeTruthy()
    expect(d.header.title).toBeTruthy()
  })
})

describe('Checkout Experience · campos núcleo blindados', () => {
  it('nombre y teléfono siempre visibles y obligatorios, pase lo que pase', () => {
    const hostil = withCheckoutDefaults({
      fields: {
        nombre: { visible: false, required: false } as any,
        telefono: { visible: false, required: false } as any,
      },
    })
    for (const k of CORE_FIELDS) {
      expect(hostil.fields[k].visible, `${k} visible`).toBe(true)
      expect(hostil.fields[k].required, `${k} required`).toBe(true)
    }
  })

  it('un campo opcional SÍ se puede ocultar', () => {
    const cfg = withCheckoutDefaults({ fields: { email: { visible: false } as any } })
    expect(cfg.fields.email.visible).toBe(false)
  })
})

describe('Checkout Experience · merge tolerante', () => {
  it('null/undefined → defaults', () => {
    expect(withCheckoutDefaults(null).cta.text).toBe(defaultCheckoutConfig().cta.text)
    expect(withCheckoutDefaults(undefined).header.title).toBeTruthy()
  })
  it('override parcial conserva el resto', () => {
    const cfg = withCheckoutDefaults({ cta: { text: 'Comprar ya' } as any })
    expect(cfg.cta.text).toBe('Comprar ya')
    expect(cfg.cta.subtext).toBe(defaultCheckoutConfig().cta.subtext) // no se perdió
  })
  it('respeta label/placeholder personalizados', () => {
    const cfg = withCheckoutDefaults({ fields: { direccion: { label: 'Dónde entregamos', placeholder: 'Tu dirección' } as any } })
    expect(cfg.fields.direccion.label).toBe('Dónde entregamos')
    expect(cfg.fields.direccion.placeholder).toBe('Tu dirección')
  })
})
